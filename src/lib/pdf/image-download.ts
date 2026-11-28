import type { PdfObjectRecord } from './types';

import { hasSubtype } from './navigation';
import { imagePlan } from './resource-tools';
export const imageDownloadPlan = function imageDownloadPlan(object: PdfObjectRecord) {
  if (!object.stream || !hasSubtype(object, 'Image')) {
    throw new Error('This object is not an image stream.');
  }

  const filename = `image-${object.id.replace(/ /g, '-')}`;

  if (object.stream.filters.length === 1 && ['DCTDecode', 'DCT'].includes(object.stream.filters[0])) {
    return { filename: `${filename}.jpg`, format: 'jpeg' as const };
  }

  const supported = new Set(['FlateDecode', 'Fl', 'ASCIIHexDecode', 'AHx', 'ASCII85Decode', 'A85']);
  const unsupported = object.stream.filters.find((filter) => {
    return !supported.has(filter);
  });

  if (unsupported) {
    throw new Error(`Image export unavailable: /${unsupported} is not supported for this image. Inspect its stream instead.`);
  }

  try {
    return {
      filename: `${filename}.png`,
      format: 'png' as const,
      pixels: imagePlan(object),
    };
  } catch (error) {
    throw new Error(
      (error instanceof Error ? error.message : 'Image export unavailable.').replace('Thumbnail unavailable:', 'Image export unavailable:'),
      { cause: error }
    );
  }
};
