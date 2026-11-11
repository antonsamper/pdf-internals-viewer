/** Original project-owned PDF fixtures, generated without third-party assets. */
import { deflateSync } from 'node:zlib';
const ascii = value => Buffer.from(value, 'latin1');
const stream = (text, dict = '', encode = false) => {
  const data = encode ? deflateSync(ascii(text)) : ascii(text);
  return Buffer.concat([ascii(`<< /Length ${data.length} ${encode ? '/Filter /FlateDecode ' : ''}${dict} >>\nstream\n`), data, ascii('\nendstream')]);
};
export function classicPdf(objects, options = {}) {
  let result = ascii('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n');
  const offsets = new Map();
  const ranges = new Map();
  for (const [id, value] of objects) {
    const object = Buffer.concat([ascii(`${id} 0 obj\n`), typeof value === 'string' ? ascii(value) : value, ascii('\nendobj')]);
    offsets.set(id, result.length); ranges.set(id, { start: result.length, end: result.length + object.length });
    result = Buffer.concat([result, object, ascii('\n')]);
  }
  const xref = result.length;
  const size = Math.max(...offsets.keys()) + 1;
  let table = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let id = 1; id < size; id++) table += offsets.has(id) ? `${String(offsets.get(id)).padStart(10, '0')} 00000 n \n` : '0000000000 00000 f \n';
  result = Buffer.concat([result, ascii(`${table}trailer\n<< /Size ${size} /Root 1 0 R ${options.trailer ?? ''} >>\nstartxref\n${xref}\n%%EOF\n`)]);
  return { bytes: new Uint8Array(result), offsets, ranges, xref, size };
}
const baseObjects = () => [
  [1, '<< /Type /Catalog /Pages 2 0 R >>'],
  [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /Font << /F1 5 0 R >> >> >>'],
  [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>'],
  [4, stream('BT\n/F1 24 Tf\n72 700 Td\n(Hello, PDF internals.) Tj\nET\n')],
  [5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'],
];
export const minimalPdf = () => classicPdf(baseObjects());
export function resourcesPdf() {
  const objects = baseObjects();
  objects[0][1] = '<< /Type /Catalog /Pages 2 0 R /Metadata 7 0 R /Names << /EmbeddedFiles << /Names [(notes.txt) 10 0 R] >> >> >>';
  objects[1][1] = '<< /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /Font << /F1 5 0 R >> /XObject << /Im1 6 0 R >> >> >>';
  objects[3][1] = stream('BT\n/F1 24 Tf\n72 700 Td\n(Resources and references) Tj\nET\nq\n120 0 0 120 72 500 cm\n/Im1 Do\nQ\n', '', true);
  objects.push([6, stream('\x20\x75\xD6', '/Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8')]);
  objects.push([7, stream('<?xml version="1.0"?><x:xmpmeta xmlns:x="adobe:ns:meta/">Project-owned fixture</x:xmpmeta>', '/Type /Metadata /Subtype /XML')]);
  objects.push([8, '<< /Title (Resources and references) /Author (PDF Internals Viewer) /Producer (Project fixture generator) >>']);
  objects.push([9, stream('This attachment is data. No scripts or remote links.', '/Type /EmbeddedFile')]);
  objects.push([10, '<< /Type /Filespec /F (notes.txt) /EF << /F 9 0 R >> >>']);
  return classicPdf(objects, { trailer: '/Info 8 0 R' });
}
export function compressedPdf(hybrid = false) {
  const objects = baseObjects();
  const compressed = objects.filter(([id]) => id !== 4);
  let body = '';
  let index = '';
  const locations = new Map();
  for (const [id, value] of compressed) { locations.set(id, { start: body.length, end: body.length + value.length }); index += `${id} ${body.length} `; body += `${value}\n`; }
  const first = index.length;
  for (const range of locations.values()) { range.start += first; range.end += first; }
  const objStream = stream(index + body, `/Type /ObjStm /N ${compressed.length} /First ${first}`, true);
  let result = ascii('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n');
  const offsets = new Map();
  const ranges = new Map();
  for (const [id, value] of [[4, objects[3][1]], [6, objStream]]) {
    const object = Buffer.concat([ascii(`${id} 0 obj\n`), value, ascii('\nendobj')]);
    offsets.set(id, result.length); ranges.set(id, { start: result.length, end: result.length + object.length });
    result = Buffer.concat([result, object, ascii('\n')]);
  }
  const xrefOffset = result.length;
  offsets.set(7, xrefOffset);
  const table = Buffer.alloc(8 * 7);
  for (let id = 0; id < 8; id++) {
    const position = id * 7;
    const compressedIndex = compressed.findIndex(([num]) => num === id);
    table[position] = id === 0 ? 0 : compressedIndex >= 0 ? 2 : 1;
    table.writeUInt32BE(id === 0 ? 0 : compressedIndex >= 0 ? 6 : offsets.get(id), position + 1);
    table.writeUInt16BE(id === 0 ? 65535 : compressedIndex >= 0 ? compressedIndex : 0, position + 5);
  }
  const xrefStream = Buffer.concat([ascii(`<< /Type /XRef /Size 8 /Root 1 0 R /W [1 4 2] /Length ${table.length} >>\nstream\n`), table, ascii('\nendstream')]);
  const xrefObj = Buffer.concat([ascii('7 0 obj\n'), xrefStream, ascii('\nendobj')]);
  ranges.set(7, { start: result.length, end: result.length + xrefObj.length });
  result = Buffer.concat([result, xrefObj, ascii('\n')]);
  let startXref = xrefOffset;
  if (hybrid) {
    startXref = result.length;
    let legacy = 'xref\n0 1\n0000000000 65535 f \n';
    for (const [id, offset] of offsets) legacy += `${id} 1\n${String(offset).padStart(10, '0')} 00000 n \n`;
    result = Buffer.concat([result, ascii(`${legacy}trailer\n<< /Size 8 /Root 1 0 R /XRefStm ${xrefOffset} >>\n`)]);
  }
  result = Buffer.concat([result, ascii(`startxref\n${startXref}\n%%EOF\n`)]);
  return { bytes: new Uint8Array(result), offsets, ranges, locations, xref: startXref, size: 8 };
}
export function incrementalPdf() {
  const base = classicPdf([...baseObjects(), [6, '(obsolete object)']]);
  const update = ascii('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Rotate 90 >>\nendobj\n');
  const offset = base.bytes.length;
  const xref = offset + update.length;
  const tail = ascii(`xref\n3 1\n${String(offset).padStart(10, '0')} 00000 n \n6 1\n0000000000 00001 f \ntrailer\n<< /Size 7 /Root 1 0 R /Prev ${base.xref} >>\nstartxref\n${xref}\n%%EOF\n`);
  return { bytes: new Uint8Array(Buffer.concat([base.bytes, update, tail])), updatedOffset: offset };
}
export function misleadingStreamPdf() {
  const objects = baseObjects();
  const data = 'opaque bytes\nendstream\nendobj\n99 0 obj\n<< /Fake true >>\nendobj\nstill actual data';
  objects[3][1] = stream(data);
  return { ...classicPdf(objects), data };
}
export function filteredPdf(kind) {
  const content = 'BT /F1 12 Tf (Decoded filter chain) Tj ET';
  let encoded;
  let filter;
  let params = '';
  if (kind === 'asciihex-flate') { encoded = Buffer.from(deflateSync(ascii(content))).toString('hex') + '>'; filter = '[/ASCIIHexDecode /FlateDecode]'; }
  else if (kind === 'ascii85') { encoded = '87cURD]j7BEbo80~>'; filter = '/ASCII85Decode'; }
  else if (kind === 'predictor') { encoded = deflateSync(Buffer.from([0, 10, 20, 30, 2, 5, 5, 5])); filter = '/FlateDecode'; params = '/DecodeParms << /Predictor 12 /Columns 3 /Colors 1 /BitsPerComponent 8 >>'; }
  else throw new Error('Unknown fixture');
  const data = typeof encoded === 'string' ? ascii(encoded) : encoded;
  const objects = baseObjects();
  objects[3][1] = Buffer.concat([ascii(`<< /Length ${data.length} /Filter ${filter} ${params} >>\nstream\n`), data, ascii('\nendstream')]);
  return { ...classicPdf(objects), content };
}
export function encryptedPdf() {
  const objects = [...baseObjects(), [6, '<< /Filter /Standard /V 1 /R 2 /Length 40 /O <0000000000000000000000000000000000000000000000000000000000000000> /U <0000000000000000000000000000000000000000000000000000000000000000> /P -4 >>']];
  return classicPdf(objects, { trailer: '/Encrypt 6 0 R /ID [<00112233445566778899AABBCCDDEEFF> <00112233445566778899AABBCCDDEEFF>]' });
}

export function oversizedDecodedPdf() {
  const data = deflateSync(Buffer.alloc(33 * 1024 * 1024, 32));
  const objects = baseObjects();
  objects[3][1] = Buffer.concat([ascii(`<< /Length ${data.length} /Filter /FlateDecode >>\nstream\n`), data, ascii('\nendstream')]);
  return classicPdf(objects);
}
