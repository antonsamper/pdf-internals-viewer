import type { PdfObject, PdfRef as EngineRef, PdfStream } from '@libpdf/core';

export const byteText = (bytes: Uint8Array) => {
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return text;
};

export const refId = (ref: EngineRef) => {
  return `${ref.objectNumber} ${ref.generation}`;
};

export const errorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : String(error);
};

export const isStream = (object: PdfObject | undefined): object is PdfStream => {
  return object?.type === 'stream';
};

export const streamFilters = (stream: PdfStream): string[] => {
  const filter = stream.get('Filter');
  if (!filter) {
    return [];
  }
  if (filter.type === 'name') {
    return [filter.value];
  }
  if (filter.type === 'array') {
    return filter.toArray().map((item) => {
      return item.type === 'name' ? item.value : 'Unsupported indirect filter';
    });
  }
  return ['Unsupported indirect filter'];
};
