/** Original, deterministic examples. No third-party fonts, images or documents. */
import { readFileSync } from 'node:fs';
import { classicPdf } from './pdf-fixtures.mjs';
const ascii = text => Buffer.from(text, 'latin1');
const stream = (data, dictionary = '') => {
  const bytes = typeof data === 'string' ? ascii(data) : data;
  return Buffer.concat([ascii(`<< /Length ${bytes.length} ${dictionary} >>\nstream\n`), bytes, ascii('\nendstream')]);
};
const invoice = (instructions, font = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', resources = '') => [
  [1, '<< /Type /Catalog /Pages 2 0 R >>'],
  [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
  [3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> ${resources} >> /Contents 4 0 R >>`],
  [4, stream(`0.12 0.16 0.24 rg\nBT /F1 28 Tf 72 708 Td (Example invoice) Tj ET\n${instructions}\n0.4 0.4 0.4 rg\nBT /F1 10 Tf 72 72 Td (Original learning sample - PDF Internals) Tj ET\n`)],
  [5, font],
];
export function oversizedImagePdf() {
  // Store raw RGB deliberately: 1200 x 1200 x 3 = 4,320,000 bytes.
  const pixels = Buffer.alloc(1200 * 1200 * 3);
  for (let y = 0; y < 1200; y++) for (let x = 0; x < 1200; x++) {
    const offset = (y * 1200 + x) * 3;
    pixels[offset] = 40 + Math.floor(x * 110 / 1199);
    pixels[offset + 1] = 75 + Math.floor(y * 100 / 1199);
    pixels[offset + 2] = 190;
  }
  const objects = invoice('BT /F1 12 Tf 72 672 Td (One page. One small image. Several megabytes.) Tj ET\nq\n144 0 0 144 72 464 cm\n/Im1 Do\nQ\nBT /F1 18 Tf 72 412 Td (Invoice total: \\2431,250.00) Tj ET', undefined, '/XObject << /Im1 6 0 R >>');
  objects.push([6, stream(pixels, '/Type /XObject /Subtype /Image /Width 1200 /Height 1200 /ColorSpace /DeviceRGB /BitsPerComponent 8')]);
  return classicPdf(objects);
}
export function incorrectUnicodePdf() {
  // Rendering uses Helvetica/WinAnsi. Extraction uses this deliberately wrong map.
  const codes = [...Array.from({ length: 95 }, (_, i) => i + 32), 163];
  const hex = (code, width) => code.toString(16).toUpperCase().padStart(width, '0');
  const mappings = codes.map(code => `<${hex(code, 2)}> <${hex(code === 49 ? 57 : code, 4)}>`).join('\n');
  const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /DeliberatelyIncorrectUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<00> <FF>\nendcodespacerange\n${codes.length} beginbfchar\n${mappings}\nendbfchar\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n`;
  const objects = invoice('BT /F1 12 Tf 72 672 Td (A readable amount with an incorrect Unicode mapping.) Tj ET\nBT /F1 24 Tf 72 564 Td (Invoice total: \\2431,250.00) Tj ET', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding /ToUnicode 6 0 R >>');
  objects.push([6, stream(cmap)]);
  return classicPdf(objects);
}

// This tiny font contains an original geometric H, made by make-example-font.py.
// Normal PDF regeneration reads the checked-in asset and needs only Node.
export function embeddedFontPdf() {
  const objects = invoice('BT /F1 12 Tf 72 660 Td (Two font resources, only one embedded program.) Tj ET\nBT /F2 48 Tf 72 540 Td (HHHH) Tj ET', undefined);
  objects[2][1] = objects[2][1].replace('/F1 5 0 R', '/F1 5 0 R /F2 6 0 R');
  objects.push([6, '<< /Type /Font /Subtype /TrueType /BaseFont /ExampleMark /FirstChar 72 /LastChar 72 /Widths [600] /Encoding /WinAnsiEncoding /FontDescriptor 7 0 R >>']);
  objects.push([7, '<< /Type /FontDescriptor /FontName /ExampleMark /Flags 32 /FontBBox [50 0 550 700] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 100 /FontFile2 8 0 R >>']);
  const font = readFileSync(new URL('./assets/example-mark.ttf', import.meta.url));
  objects.push([8, stream(font, `/Length1 ${font.length}`)]);
  return classicPdf(objects);
}

export const attachmentText = 'description,amount\nService charge,1250.00\n';
export function hiddenAttachmentPdf() {
  const objects = invoice('BT /F1 18 Tf 72 564 Td (Invoice total: \\2431,250.00) Tj ET');
  objects[0][1] = '<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles << /Names [(line-items.csv) 6 0 R] >> >> >>';
  objects.push([6, '<< /Type /Filespec /F (line-items.csv) /UF (line-items.csv) /EF << /F 7 0 R >> >>']);
  objects.push([7, stream(attachmentText, `/Type /EmbeddedFile /Subtype /text#2Fcsv /Params << /Size ${ascii(attachmentText).length} >>`)]);
  return classicPdf(objects);
}

const logoPixels = () => {
  const bytes = Buffer.alloc(24 * 24 * 3);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    const i = (y * 24 + x) * 3;
    bytes[i] = 40 + x * 4; bytes[i + 1] = 75 + y * 4; bytes[i + 2] = 190;
  }
  return bytes;
};
const logo = () => stream(logoPixels(), '/Type /XObject /Subtype /Image /Width 24 /Height 24 /ColorSpace /DeviceRGB /BitsPerComponent 8');
export function repeatedLogoPdf() {
  const page = image => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 9 0 R >> /XObject << /Logo ${image} 0 R >> >> >>`;
  return classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>'],
    [3, page(7)], [4, page(7)], [5, page(8)],
    [6, stream('0.12 0.16 0.24 rg\nBT /F1 28 Tf 72 708 Td (Repeated logo) Tj ET\nBT /F1 12 Tf 72 660 Td (Compare the image references on all three pages.) Tj ET\nq\n96 0 0 96 72 500 cm\n/Logo Do\nQ\n')],
    [7, logo()], [8, logo()],
    [9, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'],
  ]);
}

export function pageRotationPdf() {
  return classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 /Rotate 90 /Resources << /Font << /F1 7 0 R >> >> >>'],
    [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>'],
    [4, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Rotate 0 /Contents 6 0 R >>'],
    [5, stream('0.12 0.16 0.24 rg\nBT /F1 28 Tf 72 708 Td (Inherited page rotation) Tj ET\nBT /F1 12 Tf 72 660 Td (The page inherits Rotate 90 from its parent.) Tj ET\n')],
    [6, stream('0.12 0.16 0.24 rg\nBT /F1 28 Tf 72 708 Td (Page rotation: 0) Tj ET\nq\n0 1 -1 0 450 80 cm\nBT /F1 24 Tf 0 0 Td (Content stream rotation) Tj ET\nQ\n')],
    [7, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'],
  ]);
}

export function inheritedResourcesPdf() {
  const objects = invoice('BT /F1 14 Tf 72 660 Td (The page has no Resources entry of its own.) Tj ET\nq\n96 0 0 96 72 500 cm\n/Im1 Do\nQ\n');
  objects[1][1] = '<< /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /Font << /F1 5 0 R >> /XObject << /Im1 6 0 R >> >> >>';
  objects[2][1] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>';
  objects.push([6, logo()]);
  return classicPdf(objects);
}

export function openingActionPdf() {
  const objects = invoice('BT /F1 14 Tf 72 660 Td (The catalogue requests a view of the first page.) Tj ET');
  objects[0][1] = '<< /Type /Catalog /Pages 2 0 R /OpenAction 6 0 R >>';
  objects.push([6, '<< /Type /Action /S /GoTo /D [3 0 R /Fit] >>']);
  return classicPdf(objects);
}

/** Damage only the metadata object's xref entry; the page objects remain intact. */
export function brokenXrefPdf() {
  const objects = invoice('BT /F1 14 Tf 72 660 Td (A readable page can still contain a structural error.) Tj ET\nBT /F1 12 Tf 72 628 Td (Open Issues to inspect the broken metadata cross-reference.) Tj ET');
  objects[0][1] = '<< /Type /Catalog /Pages 2 0 R /Metadata 6 0 R >>';
  objects.push([6, stream('<?xml version="1.0"?><x:xmpmeta xmlns:x="adobe:ns:meta/"/>', '/Type /Metadata /Subtype /XML')]);
  const fixture = classicPdf(objects);
  const bytes = Buffer.from(fixture.bytes);
  const entry = bytes.indexOf(ascii(`${String(fixture.offsets.get(6)).padStart(10, '0')} 00000 n`), fixture.xref);
  if (entry < 0) throw new Error('Metadata xref entry not found');
  bytes.set(ascii('0000999999'), entry);
  return { ...fixture, bytes: new Uint8Array(bytes) };
}

export const ADDITIONAL_EXAMPLES = [
  ['embedded-font', embeddedFontPdf],
  ['hidden-attachment', hiddenAttachmentPdf],
  ['repeated-logo', repeatedLogoPdf],
  ['page-rotation', pageRotationPdf],
  ['inherited-resources', inheritedResourcesPdf],
  ['opening-action', openingActionPdf],
  ['broken-xref', brokenXrefPdf],
];
