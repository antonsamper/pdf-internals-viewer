import type { PdfObjectRecord, PdfValue } from './types';

import { effectiveResources, hasSubtype, property } from './navigation';
/** Lex PDF operands as complete values so strings, arrays and comments cannot invent operators. */
export const contentInstructions = function contentInstructions(
  text: string,
  limit = 1500
): {
  instructions: ContentInstruction[];
  incomplete: boolean;
} {
  const skip = function skip() {
    while (cursor < text.length) {
      if (whitespace(text[cursor])) cursor++;
      else if (text[cursor] === '%') {
        while (cursor < text.length && !/[\r\n]/.test(text[cursor])) cursor++;
      } else break;
    }
  };
  const value = function value(): ContentToken {
    const start = cursor;
    const char = text[cursor++];
    let kind: ContentToken['kind'] = 'value';
    if (char === '(') {
      let depth = 1;
      while (cursor < text.length && depth) {
        const next = text[cursor++];
        if (next === '\\') {
          if (text[cursor] === '\r' && text[cursor + 1] === '\n') cursor += 2;
          else if (cursor < text.length) cursor++;
        } else if (next === '(') depth++;
        else if (next === ')') depth--;
      }
      if (depth) malformed = true;
    } else if (char === '[' || (char === '<' && text[cursor] === '<')) {
      const dict = char === '<';
      if (dict) cursor++;
      let closed = false;
      // Iteration uses an explicit stack; hostile deeply nested values cannot overflow the call stack.
      const closes = [dict ? '>>' : ']'];
      while (cursor < text.length && closes.length) {
        skip();
        const close = closes[closes.length - 1];
        if (text.startsWith(close, cursor)) {
          cursor += close.length;
          closes.pop();
          closed = closes.length === 0;
        } else if (text[cursor] === '[') {
          closes.push(']');
          cursor++;
        } else if (text.startsWith('<<', cursor)) {
          closes.push('>>');
          cursor += 2;
        } else if (cursor < text.length) value();
      }
      if (!closed) malformed = true;
    } else if (char === '<') {
      while (cursor < text.length && text[cursor] !== '>') cursor++;
      if (cursor === text.length) malformed = true;
      else cursor++;
    } else if (char === '/') {
      kind = 'name';
      while (cursor < text.length && !delimiter(text[cursor])) cursor++;
    } else {
      while (cursor < text.length && !delimiter(text[cursor])) cursor++;
      const raw = text.slice(start, cursor);
      kind = /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw) ? 'number' : /^(true|false|null)$/.test(raw) ? 'value' : 'operator';
    }
    return { end: cursor, kind, start, text: text.slice(start, cursor) };
  };
  let cursor = 0;
  let malformed = false;
  const instructions: ContentInstruction[] = [];
  let operands: ContentToken[] = [];
  let tokenCount = 0;
  while (cursor < text.length && instructions.length < limit && tokenCount < 5000) {
    skip();
    if (cursor >= text.length) break;
    const token = value();
    tokenCount++;
    if (token.kind !== 'operator') {
      operands.push(token);
      continue;
    }
    if (token.text === 'BI') {
      instructions.push({
        end: text.length,
        operator: 'BI',
        start: operands[0]?.start ?? token.start,
        tokens: [...operands, token],
        warning:
          'The instruction view stops at inline image data because it cannot interpret those bytes. Use Decoded byte text to inspect the remaining bytes.',
      });
      return { incomplete: true, instructions };
    }
    instructions.push({
      end: token.end,
      operator: token.text,
      start: operands[0]?.start ?? token.start,
      tokens: [...operands, token],
    });
    operands = [];
  }
  if (operands.length && instructions.length < limit)
    instructions.push({
      end: operands[operands.length - 1].end,
      start: operands[0].start,
      tokens: operands,
      warning: 'Trailing operands have no complete operator.',
    });
  return {
    incomplete: malformed || cursor < text.length || operands.length > 0,
    instructions,
  };
};
export const resolveValue = function resolveValue(
  value: PdfValue | undefined,
  objects: Map<string, PdfObjectRecord>
): PdfValue | undefined {
  const seen = new Set<string>();
  while (value?.type === 'reference') {
    if (seen.has(value.ref)) return undefined;
    seen.add(value.ref);
    value = objects.get(value.ref)?.value;
  }
  return value;
};
const containsContent = function containsContent(
  value: PdfValue | undefined,
  id: string,
  objects: Map<string, PdfObjectRecord>,
  seen = new Set<string>(),
  depth = 0
): boolean {
  // A Contents entry may itself be an indirect array. Bound recursion on malformed files.
  if (!value || seen.size > 64 || depth > 64) return false;
  if (value.type === 'reference') {
    if (value.ref === id) return true;
    if (seen.has(value.ref)) return false;
    seen.add(value.ref);
    return containsContent(objects.get(value.ref)?.value, id, objects, seen, depth + 1);
  }
  return value.type === 'array' && value.items.some((item) => containsContent(item, id, objects, new Set(seen), depth + 1));
};
export const resourceContexts = function resourceContexts(
  object: PdfObjectRecord,
  objects: Map<string, PdfObjectRecord>,
  pages: string[],
  contextPageId?: string
): ResourceContext[] {
  if (hasSubtype(object, 'Form')) {
    const own = property(object.value, 'Resources');
    if (own)
      return [
        {
          id: object.id,
          label: `Form ${object.id} resources`,
          path: ['/Resources'],
          resources: own,
        },
      ];
    // A nearest page in the navigation trail does not prove the resource scope of
    // an invocation through nested forms. Never guess at a missing form dictionary.
    return [
      {
        id: 'unknown-form',
        label: 'Form invocation context unknown',
        path: [],
      },
    ];
  }
  const contexts = pages.flatMap((id, index) => {
    const page = objects.get(id);
    if (!page || !containsContent(property(page.value, 'Contents'), object.id, objects)) return [];
    return [
      {
        id,
        label: `Page ${index + 1} resources`,
        path: ['/Resources'],
        resources: effectiveResources(page, objects)?.value,
      },
    ];
  });
  if (contextPageId) contexts.sort((a, b) => Number(b.id === contextPageId) - Number(a.id === contextPageId));
  return contexts;
};
export const explainInstruction = function explainInstruction(instruction: ContentInstruction): string {
  if (instruction.warning) return instruction.warning;
  if (
    instruction.operator === 'Tf' &&
    instruction.tokens.length === 3 &&
    instruction.tokens[0].kind === 'name' &&
    instruction.tokens[1].kind === 'number'
  )
    return `Select font ${instruction.tokens[0].text} at size ${instruction.tokens[1].text}.`;
  return explanations[instruction.operator ?? ''] ?? 'Unknown or unsupported operator; inspect the decoded bytes.';
};
export const resourceCategory = function resourceCategory(
  operator: string | undefined,
  operandIndex: number,
  operandCount: number
): string | undefined {
  if (operator === 'Tf' && operandIndex === 0) return 'Font';
  if (operator === 'Do' && operandIndex === 0) return 'XObject';
  if (operator === 'gs' && operandIndex === 0) return 'ExtGState';
  if (operator === 'sh' && operandIndex === 0) return 'Shading';
  if ((operator === 'cs' || operator === 'CS') && operandIndex === 0) return 'ColorSpace';
  if ((operator === 'scn' || operator === 'SCN') && operandIndex === operandCount - 1) return 'Pattern';
  if ((operator === 'BDC' || operator === 'DP') && operandIndex === 1) return 'Properties';
};
export const namedResource = function namedResource(
  context: ResourceContext | undefined,
  category: string,
  name: string,
  objects: Map<string, PdfObjectRecord>
):
  | {
      value: PdfValue;
      id?: string;
    }
  | undefined {
  const dictionary = resolveValue(context?.resources, objects);
  const group = resolveValue(dictionary && property(dictionary, category), objects);
  const decodedName = name.replace(/^\//, '').replace(/#([\da-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  const entry = group && property(group, decodedName);
  if (!entry) return undefined;
  return {
    value: entry,
    ...(entry.type === 'reference' && objects.has(entry.ref) ? { id: entry.ref } : {}),
  };
};
export interface ContentToken {
  text: string;
  start: number;
  end: number;
  kind: 'name' | 'number' | 'value' | 'operator';
}
export interface ContentInstruction {
  start: number;
  end: number;
  tokens: ContentToken[];
  operator?: string;
  warning?: string;
}
const whitespace = (char: string) => char === '\0' || /[\t\n\f\r ]/.test(char);
const delimiter = (char: string) => !char || whitespace(char) || /[()[\]<>/%]/.test(char);
export interface ResourceContext {
  id: string;
  label: string;
  resources?: PdfValue;
  path: string[];
}
const explanations: Record<string, string> = {
  '"': 'Set spacing, move to the next line and show text.',
  "'": 'Move to the next line and show text.',
  B: 'Fill and stroke the path.',
  'B*': 'Fill using even-odd, then stroke.',
  BDC: 'Begin marked content with properties.',
  BI: 'Begin inline image data.',
  BMC: 'Begin marked content.',
  BT: 'Begin a text object.',
  BX: 'Begin a compatibility section.',
  CS: 'Set stroke colour space.',
  DP: 'Mark a point with properties.',
  Do: 'Paint an image or form XObject.',
  EMC: 'End marked content.',
  ET: 'End the text object.',
  EX: 'End a compatibility section.',
  F: 'Fill the path using the nonzero rule.',
  G: 'Set stroke grey.',
  J: 'Set the line cap style.',
  K: 'Set stroke CMYK colour.',
  M: 'Set the miter limit.',
  MP: 'Mark a point in the content.',
  Q: 'Restore the graphics state.',
  RG: 'Set stroke RGB colour.',
  S: 'Stroke the path.',
  SC: 'Set stroke colour.',
  SCN: 'Set stroke colour or pattern.',
  'T*': 'Move to the next text line.',
  TD: 'Move the text position and set line spacing (leading).',
  TJ: 'Draw each string in order, using the numbers to adjust spacing without adding characters.',
  TL: 'Set the spacing between text lines (leading).',
  Tc: 'Set character spacing.',
  Td: 'Move the text position.',
  Tf: 'Select a font and size.',
  Tj: 'Show a text string using the current font encoding.',
  Tm: 'Set the text matrix.',
  Tr: 'Set text rendering mode.',
  Ts: 'Set the vertical offset of text from its baseline (text rise).',
  Tw: 'Set word spacing.',
  Tz: 'Set horizontal text scaling.',
  W: 'Clip using the nonzero rule.',
  'W*': 'Clip using the even-odd rule.',
  b: 'Close, fill and stroke the path.',
  'b*': 'Close, fill using even-odd, then stroke.',
  c: 'Add a cubic Bézier curve.',
  cm: 'Combine this matrix with the current transformation matrix to change the coordinate system (for example, scale, rotate, or move it).',
  cs: 'Set fill colour space.',
  d: 'Set the dash pattern.',
  f: 'Fill the path using the nonzero rule.',
  'f*': 'Fill the path using the even-odd rule.',
  g: 'Set fill grey.',
  gs: 'Apply an extended graphics state resource.',
  h: 'Close the current subpath.',
  i: 'Set flatness tolerance.',
  j: 'Set the line join style.',
  k: 'Set fill CMYK colour.',
  l: 'Add a line segment.',
  m: 'Begin a path at this point.',
  n: 'End the path without painting.',
  q: 'Save the graphics state.',
  re: 'Append a rectangle to the path.',
  rg: 'Set fill RGB colour.',
  ri: 'Set rendering intent.',
  s: 'Close and stroke the path.',
  sc: 'Set fill colour.',
  scn: 'Set fill colour or pattern.',
  sh: 'Paint a shading resource.',
  v: 'Add a curve with the first control point at the current point.',
  w: 'Set line width.',
  y: 'Add a curve with the final control point at its endpoint.',
};
