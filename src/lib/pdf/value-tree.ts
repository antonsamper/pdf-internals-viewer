import type { PdfObject } from '@libpdf/core';

import type { PdfValue } from './types';

import { byteText, refId } from './engine-objects.ts';
import { MAX_DISPLAY_BYTES } from './limits.ts';

const MAX_NESTING_DEPTH = 60;
const MAX_STRING_PREVIEW = 4096;

type ObjectOfType<T extends PdfObject['type']> = Extract<PdfObject, { type: T }>;
type ContainerObject = ObjectOfType<'ref' | 'array' | 'dict' | 'stream'>;
type ScalarObject = Exclude<PdfObject, ContainerObject>;

const hexText = (bytes: Uint8Array) => {
  const hex = Array.from(bytes.subarray(0, MAX_STRING_PREVIEW), (b) => b.toString(16).padStart(2, '0')).join('');
  return `<${hex}${bytes.length > MAX_STRING_PREVIEW ? '…' : ''}>`;
};

const stringValue = (object: ObjectOfType<'string'>): PdfValue => {
  const text = object.asString();
  return {
    text: object.format === 'hex' ? hexText(object.bytes) : `(${text.slice(0, MAX_STRING_PREVIEW)})`,
    type: 'string',
    value: text,
  };
};

const rawValue = (object: ObjectOfType<'raw'>): PdfValue => {
  const text = byteText(object.bytes.subarray(0, MAX_DISPLAY_BYTES));
  return { text, type: 'raw', value: text };
};

const scalarValue = (object: ScalarObject): PdfValue => {
  switch (object.type) {
    case 'null':
      return { text: 'null', type: 'null' };
    case 'bool':
      return { text: String(object.value), type: 'boolean', value: object.value };
    case 'number':
      return { text: String(object.value), type: 'number', value: object.value };
    case 'name':
      return { text: `/${object.value}`, type: 'name', value: object.value };
    case 'string':
      return stringValue(object);
    case 'raw':
      return rawValue(object);
  }
};

const referenceValue = (object: ObjectOfType<'ref'>, references: Set<string>): PdfValue => {
  const id = refId(object);
  references.add(id);
  return { ref: id, text: `${id} R`, type: 'reference' };
};

const arrayValue = (object: ObjectOfType<'array'>, references: Set<string>, depth: number): PdfValue => {
  const items = object.toArray().map((item) => valueTree(item, references, depth + 1));
  return {
    items,
    text: `[ ${items.map((item) => item.text).join(' ')} ]`,
    type: 'array',
  };
};

const dictionaryValue = (object: ObjectOfType<'dict' | 'stream'>, references: Set<string>, depth: number): PdfValue => {
  const entries = Array.from(object, ([key, value]) => ({
    key: key.value,
    value: valueTree(value, references, depth + 1),
  }));
  return {
    entries,
    text: `<<\n${entries.map((entry) => `  /${entry.key} ${entry.value.text.replace(/\n/g, '\n  ')}`).join('\n')}\n>>`,
    type: object.type === 'stream' ? 'stream' : 'dictionary',
  };
};

const containerValue = (object: ContainerObject, references: Set<string>, depth: number): PdfValue => {
  if (object.type === 'ref') return referenceValue(object, references);
  if (object.type === 'array') return arrayValue(object, references, depth);
  return dictionaryValue(object, references, depth);
};

const isContainer = (object: PdfObject): object is ContainerObject =>
  object.type === 'ref' || object.type === 'array' || object.type === 'dict' || object.type === 'stream';

/** Builds the display tree for a PDF object and collects the references it contains. */
export const valueTree = (object: PdfObject, references: Set<string>, depth = 0): PdfValue => {
  if (depth > MAX_NESTING_DEPTH) return { text: '[Nesting limit reached]', type: 'raw', value: '[Nesting limit reached]' };
  return isContainer(object) ? containerValue(object, references, depth) : scalarValue(object);
};
