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
  const lexer = new ContentLexer(text);
  const instructions: ContentInstruction[] = [];
  let operands: ContentToken[] = [];
  for (let tokenCount = 0; tokenCount < 5000 && instructions.length < limit; tokenCount++) {
    const token = lexer.next();
    if (!token) {
      break;
    }
    if (token.kind !== 'operator') {
      operands.push(token);
      continue;
    }
    if (token.text === 'BI') {
      instructions.push(inlineImageInstruction(operands, token, text.length));
      return { incomplete: true, instructions };
    }
    instructions.push(operatorInstruction(operands, token));
    operands = [];
  }
  if (operands.length && instructions.length < limit) {
    instructions.push(trailingOperandsInstruction(operands));
  }
  return {
    incomplete: lexer.incomplete() || operands.length > 0,
    instructions,
  };
};
const operatorInstruction = function operatorInstruction(operands: ContentToken[], token: ContentToken): ContentInstruction {
  return {
    end: token.end,
    operator: token.text,
    start: operands[0]?.start ?? token.start,
    tokens: [...operands, token],
  };
};
const inlineImageInstruction = function inlineImageInstruction(
  operands: ContentToken[],
  token: ContentToken,
  end: number
): ContentInstruction {
  return {
    ...operatorInstruction(operands, token),
    end,
    warning:
      'The instruction view stops at inline image data because it cannot interpret those bytes. Use Decoded byte text to inspect the remaining bytes.',
  };
};
const trailingOperandsInstruction = function trailingOperandsInstruction(operands: ContentToken[]): ContentInstruction {
  return {
    end: operands[operands.length - 1].end,
    start: operands[0].start,
    tokens: operands,
    warning: 'Trailing operands have no complete operator.',
  };
};
/** Reads one complete operand or operator at a time and records whether any value was left unterminated. */
class ContentLexer {
  private cursor = 0;
  private malformed = false;
  private readonly text: string;
  constructor(text: string) {
    this.text = text;
  }
  /** Skip whitespace and comments, then read the next token, if any. */
  next(): ContentToken | undefined {
    this.skip();
    return this.cursor < this.text.length ? this.value() : undefined;
  }
  incomplete(): boolean {
    return this.malformed || this.cursor < this.text.length;
  }
  private skip() {
    while (this.cursor < this.text.length) {
      if (whitespace(this.text[this.cursor])) {
        this.cursor++;
      } else if (this.text[this.cursor] === '%') {
        this.skipComment();
      } else {
        break;
      }
    }
  }
  private skipComment() {
    while (this.cursor < this.text.length && !/[\r\n]/.test(this.text[this.cursor])) {
      this.cursor++;
    }
  }
  private value(): ContentToken {
    const start = this.cursor;
    const kind = this.readValue(this.text[this.cursor++], start);
    return { end: this.cursor, kind, start, text: this.text.slice(start, this.cursor) };
  }
  private readValue(char: string, start: number): ContentToken['kind'] {
    if (char === '(') {
      this.readString();
    } else if (char === '[') {
      this.readContainer(']');
    } else if (char === '<' && this.text[this.cursor] === '<') {
      this.cursor++;
      this.readContainer('>>');
    } else if (char === '<') {
      this.readHexString();
    } else {
      this.skipRegular();
      return char === '/' ? 'name' : bareTokenKind(this.text.slice(start, this.cursor));
    }
    return 'value';
  }
  private readString() {
    let depth = 1;
    while (this.cursor < this.text.length && depth) {
      const next = this.text[this.cursor++];
      if (next === '\\') {
        this.skipEscape();
      } else if (next === '(') {
        depth++;
      } else if (next === ')') {
        depth--;
      }
    }
    if (depth) {
      this.malformed = true;
    }
  }
  private skipEscape() {
    if (this.text[this.cursor] === '\r' && this.text[this.cursor + 1] === '\n') {
      this.cursor += 2;
    } else if (this.cursor < this.text.length) {
      this.cursor++;
    }
  }
  private readContainer(close: string) {
    // Iteration uses an explicit stack; hostile deeply nested values cannot overflow the call stack.
    const closes = [close];
    while (this.cursor < this.text.length && closes.length) {
      this.skip();
      this.readContainerPart(closes);
    }
    if (closes.length) {
      this.malformed = true;
    }
  }
  private readContainerPart(closes: string[]) {
    const close = closes[closes.length - 1];
    if (this.text.startsWith(close, this.cursor)) {
      this.cursor += close.length;
      closes.pop();
    } else if (this.text[this.cursor] === '[') {
      closes.push(']');
      this.cursor++;
    } else if (this.text.startsWith('<<', this.cursor)) {
      closes.push('>>');
      this.cursor += 2;
    } else if (this.cursor < this.text.length) {
      this.value();
    }
  }
  private readHexString() {
    while (this.cursor < this.text.length && this.text[this.cursor] !== '>') {
      this.cursor++;
    }
    if (this.cursor === this.text.length) {
      this.malformed = true;
    } else {
      this.cursor++;
    }
  }
  private skipRegular() {
    while (this.cursor < this.text.length && !delimiter(this.text[this.cursor])) {
      this.cursor++;
    }
  }
}
const bareTokenKind = function bareTokenKind(raw: string): ContentToken['kind'] {
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw)) {
    return 'number';
  }
  return /^(true|false|null)$/.test(raw) ? 'value' : 'operator';
};
export const resolveValue = function resolveValue(
  value: PdfValue | undefined,
  objects: Map<string, PdfObjectRecord>
): PdfValue | undefined {
  const seen = new Set<string>();
  while (value?.type === 'reference') {
    if (seen.has(value.ref)) {
      return undefined;
    }
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
  if (!value || seen.size > 64 || depth > 64) {
    return false;
  }
  if (value.type === 'reference') {
    return referenceContainsContent(value.ref, id, objects, seen, depth);
  }
  return (
    value.type === 'array' &&
    value.items.some((item) => {
      return containsContent(item, id, objects, new Set(seen), depth + 1);
    })
  );
};
const referenceContainsContent = function referenceContainsContent(
  ref: string,
  id: string,
  objects: Map<string, PdfObjectRecord>,
  seen: Set<string>,
  depth: number
): boolean {
  if (ref === id) {
    return true;
  }
  if (seen.has(ref)) {
    return false;
  }
  seen.add(ref);
  return containsContent(objects.get(ref)?.value, id, objects, seen, depth + 1);
};
export const resourceContexts = function resourceContexts(
  object: PdfObjectRecord,
  objects: Map<string, PdfObjectRecord>,
  pages: string[],
  contextPageId?: string
): ResourceContext[] {
  if (hasSubtype(object, 'Form')) {
    const own = property(object.value, 'Resources');
    if (own) {
      return [
        {
          id: object.id,
          label: `Form ${object.id} resources`,
          path: ['/Resources'],
          resources: own,
        },
      ];
    }
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
    if (!page || !containsContent(property(page.value, 'Contents'), object.id, objects)) {
      return [];
    }
    return [
      {
        id,
        label: `Page ${index + 1} resources`,
        path: ['/Resources'],
        resources: effectiveResources(page, objects)?.value,
      },
    ];
  });
  if (contextPageId) {
    contexts.sort((a, b) => {
      return Number(b.id === contextPageId) - Number(a.id === contextPageId);
    });
  }
  return contexts;
};
export const explainInstruction = function explainInstruction(instruction: ContentInstruction): string {
  if (instruction.warning) {
    return instruction.warning;
  }
  if (
    instruction.operator === 'Tf' &&
    instruction.tokens.length === 3 &&
    instruction.tokens[0].kind === 'name' &&
    instruction.tokens[1].kind === 'number'
  ) {
    return `Select font ${instruction.tokens[0].text} at size ${instruction.tokens[1].text}.`;
  }
  return explanations[instruction.operator ?? ''] ?? 'Unknown or unsupported operator; inspect the decoded bytes.';
};
export const resourceCategory = function resourceCategory(
  operator: string | undefined,
  operandIndex: number,
  operandCount: number
): string | undefined {
  const resource = resourceOperands.get(operator ?? '');
  if (!resource) {
    return undefined;
  }
  const index = resource.operand === 'last' ? operandCount - 1 : resource.operand;
  return operandIndex === index ? resource.category : undefined;
};
/** The operand that names a resource for each operator that uses one. Operators come from the document, so look them up in a Map. */
const resourceOperands = new Map<string, { category: string; operand: number | 'last' }>([
  ['Tf', { category: 'Font', operand: 0 }],
  ['Do', { category: 'XObject', operand: 0 }],
  ['gs', { category: 'ExtGState', operand: 0 }],
  ['sh', { category: 'Shading', operand: 0 }],
  ['cs', { category: 'ColorSpace', operand: 0 }],
  ['CS', { category: 'ColorSpace', operand: 0 }],
  ['scn', { category: 'Pattern', operand: 'last' }],
  ['SCN', { category: 'Pattern', operand: 'last' }],
  ['BDC', { category: 'Properties', operand: 1 }],
  ['DP', { category: 'Properties', operand: 1 }],
]);
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
  const decodedName = name.replace(/^\//, '').replace(/#([\da-f]{2})/gi, (_, hex: string) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  const entry = group && property(group, decodedName);
  if (!entry) {
    return undefined;
  }
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
const whitespace = (char: string) => {
  return char === '\0' || /[\t\n\f\r ]/.test(char);
};
const delimiter = (char: string) => {
  return !char || whitespace(char) || /[()[\]<>/%]/.test(char);
};
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
