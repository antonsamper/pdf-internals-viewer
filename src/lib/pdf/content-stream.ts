import { effectiveResources, hasSubtype, property } from "./navigation"
import type { PdfObjectRecord, PdfValue } from "./types"

export interface ContentToken {
  text: string
  start: number
  end: number
  kind: "name" | "number" | "value" | "operator"
}
export interface ContentInstruction {
  start: number
  end: number
  tokens: ContentToken[]
  operator?: string
  warning?: string
}
const whitespace = (char: string) => char === "\0" || /[\t\n\f\r ]/.test(char)
const delimiter = (char: string) =>
  !char || whitespace(char) || /[()[\]<>/%]/.test(char)

/** Lex PDF operands as complete values so strings, arrays and comments cannot invent operators. */
export function contentInstructions(
  text: string,
  limit = 1500
): { instructions: ContentInstruction[]; incomplete: boolean } {
  let cursor = 0
  let malformed = false
  const instructions: ContentInstruction[] = []
  let operands: ContentToken[] = []
  let tokenCount = 0
  function skip() {
    while (cursor < text.length) {
      if (whitespace(text[cursor])) cursor++
      else if (text[cursor] === "%") {
        while (cursor < text.length && !/[\r\n]/.test(text[cursor])) cursor++
      } else break
    }
  }
  function value(): ContentToken {
    const start = cursor
    const char = text[cursor++]
    let kind: ContentToken["kind"] = "value"
    if (char === "(") {
      let depth = 1
      while (cursor < text.length && depth) {
        const next = text[cursor++]
        if (next === "\\") {
          if (text[cursor] === "\r" && text[cursor + 1] === "\n") cursor += 2
          else if (cursor < text.length) cursor++
        } else if (next === "(") depth++
        else if (next === ")") depth--
      }
      if (depth) malformed = true
    } else if (char === "[" || (char === "<" && text[cursor] === "<")) {
      const dict = char === "<"
      if (dict) cursor++
      let closed = false
      // Iteration uses an explicit stack; hostile deeply nested values cannot overflow the call stack.
      const closes = [dict ? ">>" : "]"]
      while (cursor < text.length && closes.length) {
        skip()
        const close = closes[closes.length - 1]
        if (text.startsWith(close, cursor)) {
          cursor += close.length
          closes.pop()
          closed = closes.length === 0
        } else if (text[cursor] === "[") {
          closes.push("]")
          cursor++
        } else if (text.startsWith("<<", cursor)) {
          closes.push(">>")
          cursor += 2
        } else if (cursor < text.length) value()
      }
      if (!closed) malformed = true
    } else if (char === "<") {
      while (cursor < text.length && text[cursor] !== ">") cursor++
      if (cursor === text.length) malformed = true
      else cursor++
    } else if (char === "/") {
      kind = "name"
      while (cursor < text.length && !delimiter(text[cursor])) cursor++
    } else {
      while (cursor < text.length && !delimiter(text[cursor])) cursor++
      const raw = text.slice(start, cursor)
      kind = /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw)
        ? "number"
        : /^(true|false|null)$/.test(raw)
          ? "value"
          : "operator"
    }
    return { text: text.slice(start, cursor), start, end: cursor, kind }
  }
  while (
    cursor < text.length &&
    instructions.length < limit &&
    tokenCount < 5000
  ) {
    skip()
    if (cursor >= text.length) break
    const token = value()
    tokenCount++
    if (token.kind !== "operator") {
      operands.push(token)
      continue
    }
    if (token.text === "BI") {
      instructions.push({
        start: operands[0]?.start ?? token.start,
        end: text.length,
        tokens: [...operands, token],
        operator: "BI",
        warning:
          "Inline image data is opaque. Remaining bytes are available in Decoded byte text; instruction interpretation stops here.",
      })
      return { instructions, incomplete: true }
    }
    instructions.push({
      start: operands[0]?.start ?? token.start,
      end: token.end,
      tokens: [...operands, token],
      operator: token.text,
    })
    operands = []
  }
  if (operands.length && instructions.length < limit)
    instructions.push({
      start: operands[0].start,
      end: operands[operands.length - 1].end,
      tokens: operands,
      warning: "Trailing operands have no complete operator.",
    })
  return {
    instructions,
    incomplete: malformed || cursor < text.length || operands.length > 0,
  }
}

export interface ResourceContext {
  id: string
  label: string
  resources?: PdfValue
  path: string[]
}
export function resolveValue(
  value: PdfValue | undefined,
  objects: Map<string, PdfObjectRecord>
): PdfValue | undefined {
  const seen = new Set<string>()
  while (value?.type === "reference") {
    if (seen.has(value.ref)) return undefined
    seen.add(value.ref)
    value = objects.get(value.ref)?.value
  }
  return value
}
function containsContent(
  value: PdfValue | undefined,
  id: string,
  objects: Map<string, PdfObjectRecord>,
  seen = new Set<string>(),
  depth = 0
): boolean {
  // A Contents entry may itself be an indirect array. Bound recursion on malformed files.
  if (!value || seen.size > 64 || depth > 64) return false
  if (value.type === "reference") {
    if (value.ref === id) return true
    if (seen.has(value.ref)) return false
    seen.add(value.ref)
    return containsContent(
      objects.get(value.ref)?.value,
      id,
      objects,
      seen,
      depth + 1
    )
  }
  return (
    value.type === "array" &&
    value.items.some((item) =>
      containsContent(item, id, objects, new Set(seen), depth + 1)
    )
  )
}
export function resourceContexts(
  object: PdfObjectRecord,
  objects: Map<string, PdfObjectRecord>,
  pages: string[],
  contextPageId?: string
): ResourceContext[] {
  if (hasSubtype(object, "Form")) {
    const own = property(object.value, "Resources")
    if (own)
      return [
        {
          id: object.id,
          label: `Form ${object.id} resources`,
          resources: own,
          path: ["/Resources"],
        },
      ]
    // A nearest page in the navigation trail does not prove the resource scope of
    // an invocation through nested forms. Never guess at a missing form dictionary.
    return [
      {
        id: "unknown-form",
        label: "Form invocation context unknown",
        path: [],
      },
    ]
  }
  const contexts = pages.flatMap((id, index) => {
    const page = objects.get(id)
    if (
      !page ||
      !containsContent(property(page.value, "Contents"), object.id, objects)
    )
      return []
    return [
      {
        id,
        label: `Page ${index + 1} resources`,
        resources: effectiveResources(page, objects)?.value,
        path: ["/Resources"],
      },
    ]
  })
  if (contextPageId)
    contexts.sort(
      (a, b) => Number(b.id === contextPageId) - Number(a.id === contextPageId)
    )
  return contexts
}

const explanations: Record<string, string> = {
  q: "Save the graphics state.",
  Q: "Restore the graphics state.",
  cm: "Concatenate the transformation matrix.",
  BT: "Begin a text object.",
  ET: "End the text object.",
  Tf: "Select a font and size.",
  Tj: "Show a text string using the current font encoding.",
  TJ: "Show text with positioning adjustments.",
  Td: "Move the text position.",
  TD: "Move the text position and set leading.",
  Tm: "Set the text matrix.",
  "T*": "Move to the next text line.",
  Tc: "Set character spacing.",
  Tw: "Set word spacing.",
  Tz: "Set horizontal text scaling.",
  TL: "Set text leading.",
  Tr: "Set text rendering mode.",
  Ts: "Set text rise.",
  "'": "Move to the next line and show text.",
  '"': "Set spacing, move to the next line and show text.",
  m: "Begin a path at this point.",
  l: "Add a line segment.",
  c: "Add a cubic Bézier curve.",
  v: "Add a curve with the first control point at the current point.",
  y: "Add a curve with the final control point at its endpoint.",
  h: "Close the current subpath.",
  re: "Append a rectangle to the path.",
  S: "Stroke the path.",
  s: "Close and stroke the path.",
  f: "Fill the path using the nonzero rule.",
  F: "Fill the path using the nonzero rule.",
  "f*": "Fill the path using the even-odd rule.",
  B: "Fill and stroke the path.",
  "B*": "Fill using even-odd, then stroke.",
  b: "Close, fill and stroke the path.",
  "b*": "Close, fill using even-odd, then stroke.",
  n: "End the path without painting.",
  W: "Clip using the nonzero rule.",
  "W*": "Clip using the even-odd rule.",
  w: "Set line width.",
  J: "Set the line cap style.",
  j: "Set the line join style.",
  M: "Set the miter limit.",
  d: "Set the dash pattern.",
  ri: "Set rendering intent.",
  i: "Set flatness tolerance.",
  gs: "Apply an extended graphics state resource.",
  G: "Set stroke gray.",
  g: "Set fill gray.",
  RG: "Set stroke RGB color.",
  rg: "Set fill RGB color.",
  K: "Set stroke CMYK color.",
  k: "Set fill CMYK color.",
  CS: "Set stroke color space.",
  cs: "Set fill color space.",
  SC: "Set stroke color.",
  sc: "Set fill color.",
  SCN: "Set stroke color or pattern.",
  scn: "Set fill color or pattern.",
  Do: "Paint an image or form XObject.",
  sh: "Paint a shading resource.",
  MP: "Mark a point in the content.",
  DP: "Mark a point with properties.",
  BMC: "Begin marked content.",
  BDC: "Begin marked content with properties.",
  EMC: "End marked content.",
  BX: "Begin a compatibility section.",
  EX: "End a compatibility section.",
  BI: "Begin inline image data.",
}
export function explainInstruction(instruction: ContentInstruction): string {
  if (instruction.warning) return instruction.warning
  if (
    instruction.operator === "Tf" &&
    instruction.tokens.length === 3 &&
    instruction.tokens[0].kind === "name" &&
    instruction.tokens[1].kind === "number"
  )
    return `Select font ${instruction.tokens[0].text} at size ${instruction.tokens[1].text}.`
  return (
    explanations[instruction.operator ?? ""] ??
    "Unknown or unsupported operator; inspect the decoded bytes."
  )
}
export function resourceCategory(
  operator: string | undefined,
  operandIndex: number,
  operandCount: number
): string | undefined {
  if (operator === "Tf" && operandIndex === 0) return "Font"
  if (operator === "Do" && operandIndex === 0) return "XObject"
  if (operator === "gs" && operandIndex === 0) return "ExtGState"
  if (operator === "sh" && operandIndex === 0) return "Shading"
  if ((operator === "cs" || operator === "CS") && operandIndex === 0)
    return "ColorSpace"
  if (
    (operator === "scn" || operator === "SCN") &&
    operandIndex === operandCount - 1
  )
    return "Pattern"
  if ((operator === "BDC" || operator === "DP") && operandIndex === 1)
    return "Properties"
}
export function namedResource(
  context: ResourceContext | undefined,
  category: string,
  name: string,
  objects: Map<string, PdfObjectRecord>
): { value: PdfValue; id?: string } | undefined {
  const dictionary = resolveValue(context?.resources, objects)
  const group = resolveValue(
    dictionary && property(dictionary, category),
    objects
  )
  const decodedName = name
    .replace(/^\//, "")
    .replace(/#([\da-f]{2})/gi, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    )
  const entry = group && property(group, decodedName)
  if (!entry) return undefined
  return {
    value: entry,
    ...(entry.type === "reference" && objects.has(entry.ref)
      ? { id: entry.ref }
      : {}),
  }
}
