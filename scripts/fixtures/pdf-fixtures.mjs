/** Original project-owned PDF fixtures, generated without third-party assets. */
import { deflateSync } from 'node:zlib';
export const classicPdf = (objects, options = {}) => {
    let result = ascii('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n');
    const offsets = new Map();
    const ranges = new Map();
    for (const [id, value] of objects) {
        const object = Buffer.concat([ascii(`${id} 0 obj\n`), typeof value === 'string' ? ascii(value) : value, ascii('\nendobj')]);
        offsets.set(id, result.length);
        ranges.set(id, { end: result.length + object.length, start: result.length });
        result = Buffer.concat([result, object, ascii('\n')]);
    }
    const xref = result.length;
    const size = Math.max(...offsets.keys()) + 1;
    let table = `xref\n0 ${size}\n0000000000 65535 f \n`;
    for (let id = 1; id < size; id++) {
        table += offsets.has(id) ? `${String(offsets.get(id)).padStart(10, '0')} 00000 n \n` : '0000000000 00000 f \n';
    }
    result = Buffer.concat([result, ascii(`${table}trailer\n<< /Size ${size} /Root 1 0 R ${options.trailer ?? ''} >>\nstartxref\n${xref}\n%%EOF\n`)]);
    return { bytes: new Uint8Array(result), offsets, ranges, size, xref };
};
export const resourcesPdf = () => {
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
};
/** Packs the given objects into one compressed object stream and records where each sits in the decoded data. */
const objectStream = (compressed) => {
    let body = '';
    let index = '';
    const locations = new Map();
    for (const [id, value] of compressed) {
        locations.set(id, { end: body.length + value.length, start: body.length });
        index += `${id} ${body.length} `;
        body += `${value}\n`;
    }
    const first = index.length;
    for (const range of locations.values()) {
        range.start += first;
        range.end += first;
    }
    return { locations, objStream: stream(index + body, `/Type /ObjStm /N ${compressed.length} /First ${first}`, true) };
};
/** Type, second and third field of one cross-reference stream row with /W [1 4 2]. */
const xrefStreamEntry = (id, compressedIndex, offsets) => {
    if (id === 0) {
        return [0, 0, 65535];
    }
    if (compressedIndex >= 0) {
        return [2, 6, compressedIndex];
    }
    return [1, offsets.get(id), 0];
};
const xrefStreamObject = (compressed, offsets) => {
    const table = Buffer.alloc(8 * 7);
    for (let id = 0; id < 8; id++) {
        const position = id * 7;
        const [type, field, generation] = xrefStreamEntry(id, compressed.findIndex(([num]) => { return num === id; }), offsets);
        table[position] = type;
        table.writeUInt32BE(field, position + 1);
        table.writeUInt16BE(generation, position + 5);
    }
    const xrefStream = Buffer.concat([ascii(`<< /Type /XRef /Size 8 /Root 1 0 R /W [1 4 2] /Length ${table.length} >>\nstream\n`), table, ascii('\nendstream')]);
    return Buffer.concat([ascii('7 0 obj\n'), xrefStream, ascii('\nendobj')]);
};
/** Classic table and trailer that point a hybrid-reference reader at the cross-reference stream. */
const legacyXref = (offsets, xrefOffset) => {
    let legacy = 'xref\n0 1\n0000000000 65535 f \n';
    for (const [id, offset] of offsets) {
        legacy += `${id} 1\n${String(offset).padStart(10, '0')} 00000 n \n`;
    }
    return ascii(`${legacy}trailer\n<< /Size 8 /Root 1 0 R /XRefStm ${xrefOffset} >>\n`);
};
export const compressedPdf = (hybrid = false) => {
    const objects = baseObjects();
    const compressed = objects.filter(([id]) => { return id !== 4; });
    const { locations, objStream } = objectStream(compressed);
    let result = ascii('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n');
    const offsets = new Map();
    const ranges = new Map();
    for (const [id, value] of [[4, objects[3][1]], [6, objStream]]) {
        const object = Buffer.concat([ascii(`${id} 0 obj\n`), value, ascii('\nendobj')]);
        offsets.set(id, result.length);
        ranges.set(id, { end: result.length + object.length, start: result.length });
        result = Buffer.concat([result, object, ascii('\n')]);
    }
    const xrefOffset = result.length;
    offsets.set(7, xrefOffset);
    const xrefObj = xrefStreamObject(compressed, offsets);
    ranges.set(7, { end: result.length + xrefObj.length, start: result.length });
    result = Buffer.concat([result, xrefObj, ascii('\n')]);
    let startXref = xrefOffset;
    if (hybrid) {
        startXref = result.length;
        result = Buffer.concat([result, legacyXref(offsets, xrefOffset)]);
    }
    result = Buffer.concat([result, ascii(`startxref\n${startXref}\n%%EOF\n`)]);
    return { bytes: new Uint8Array(result), locations, offsets, ranges, size: 8, xref: startXref };
};
export const incrementalPdf = () => {
    const base = classicPdf([...baseObjects(), [6, '(obsolete object)']]);
    const update = ascii('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Rotate 90 >>\nendobj\n');
    const offset = base.bytes.length;
    const xref = offset + update.length;
    const tail = ascii(`xref\n3 1\n${String(offset).padStart(10, '0')} 00000 n \n6 1\n0000000000 00001 f \ntrailer\n<< /Size 7 /Root 1 0 R /Prev ${base.xref} >>\nstartxref\n${xref}\n%%EOF\n`);
    return { bytes: new Uint8Array(Buffer.concat([base.bytes, update, tail])), updatedOffset: offset };
};
export const misleadingStreamPdf = () => {
    const objects = baseObjects();
    const data = 'opaque bytes\nendstream\nendobj\n99 0 obj\n<< /Fake true >>\nendobj\nstill actual data';
    objects[3][1] = stream(data);
    return { ...classicPdf(objects), data };
};
export const filteredPdf = (kind) => {
    const content = 'BT /F1 12 Tf (Decoded filter chain) Tj ET';
    let encoded;
    let filter;
    let params = '';
    if (kind === 'asciihex-flate') {
        encoded = Buffer.from(deflateSync(ascii(content))).toString('hex') + '>';
        filter = '[/ASCIIHexDecode /FlateDecode]';
    }
    else if (kind === 'ascii85') {
        encoded = '87cURD]j7BEbo80~>';
        filter = '/ASCII85Decode';
    }
    else if (kind === 'predictor') {
        encoded = deflateSync(Buffer.from([0, 10, 20, 30, 2, 5, 5, 5]));
        filter = '/FlateDecode';
        params = '/DecodeParms << /Predictor 12 /Columns 3 /Colors 1 /BitsPerComponent 8 >>';
    }
    else {
        throw new Error('Unknown fixture');
    }
    const data = typeof encoded === 'string' ? ascii(encoded) : encoded;
    const objects = baseObjects();
    objects[3][1] = Buffer.concat([ascii(`<< /Length ${data.length} /Filter ${filter} ${params} >>\nstream\n`), data, ascii('\nendstream')]);
    return { ...classicPdf(objects), content };
};
export const encryptedPdf = () => {
    const objects = [...baseObjects(), [6, '<< /Filter /Standard /V 1 /R 2 /Length 40 /O <0000000000000000000000000000000000000000000000000000000000000000> /U <0000000000000000000000000000000000000000000000000000000000000000> /P -4 >>']];
    return classicPdf(objects, { trailer: '/Encrypt 6 0 R /ID [<00112233445566778899AABBCCDDEEFF> <00112233445566778899AABBCCDDEEFF>]' });
};
export const oversizedDecodedPdf = () => {
    const data = deflateSync(Buffer.alloc(33 * 1024 * 1024, 32));
    const objects = baseObjects();
    objects[3][1] = Buffer.concat([ascii(`<< /Length ${data.length} /Filter /FlateDecode >>\nstream\n`), data, ascii('\nendstream')]);
    return classicPdf(objects);
};
const binaryStream = (bytes, dict) => {
    const encoded = deflateSync(bytes);
    return Buffer.concat([ascii(`<< /Length ${encoded.length} /Filter /FlateDecode ${dict} >>\nstream\n`), encoded, ascii('\nendstream')]);
};
/** Synthetic binary payloads: extraction tests do not install or render this font. */
export const embeddedFilesPdf = () => {
    const attachment = Buffer.from(Array.from({ length: 300000 }, (_, i) => { return i % 256; }));
    const font = Buffer.from([0, 1, 0, 0, 255, 128, 0, 17]);
    return {
        ...classicPdf([
            [1, '<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles 5 0 R >> >>'],
            [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
            [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 8 0 R >> >> >>'],
            [5, '<< /Names [(report.txt) 6 0 R] >>'],
            [6, '<< /Type /Filespec /F (fallback.txt) /UF (report.txt) /EF << /F 7 0 R /UF 7 0 R >> >>'],
            [7, binaryStream(attachment, '/Type /EmbeddedFile')],
            [8, '<< /Type /Font /Subtype /Type0 /BaseFont /ABCDEF+Example /Encoding /Identity-H /DescendantFonts [9 0 R] >>'],
            [9, '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /ABCDEF+Example /FontDescriptor 10 0 R >>'],
            [10, '<< /Type /FontDescriptor /FontName /ABCDEF+Example /FontFile2 11 0 R >>'],
            [11, binaryStream(font, '')],
        ]), attachment, font,
    };
};
export const imageExportPdf = ({ data, filter = 'FlateDecode', width = 400, height = 300, extra = '' } = {}) => {
    const pixels = data ?? Buffer.from(Array.from({ length: width * height * 3 }, (_, i) => { return [32, 117, 214][i % 3]; }));
    const encoded = filter === 'FlateDecode' ? deflateSync(pixels) : pixels;
    const objects = baseObjects();
    objects[2][1] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> /XObject << /Im1 6 0 R >> >> /Contents 4 0 R >>';
    objects.push([6, Buffer.concat([ascii(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${encoded.length} /Filter /${filter} ${extra} >>\nstream\n`), encoded, ascii('\nendstream')])]);
    return { ...classicPdf(objects), pixels };
};
/** Split-word source mapping, with optional compression or an unsupported simple encoding. */
export const pageTextSearchPdf = (compressed = false, customEncoding = false) => {
    const objects = baseObjects();
    objects[3][1] = stream('BT /F1 24 Tf 72 700 Td [(Hel) -20 (lo)] TJ ( world) Tj ET', '', compressed);
    if (customEncoding) {
        objects[4][1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding << /BaseEncoding /WinAnsiEncoding /Differences [32 /space] >> >>';
    }
    return classicPdf(objects);
};
const ascii = value => { return Buffer.from(value, 'latin1'); };
const stream = (text, dict = '', encode = false) => {
    const data = encode ? deflateSync(ascii(text)) : ascii(text);
    return Buffer.concat([ascii(`<< /Length ${data.length} ${encode ? '/Filter /FlateDecode ' : ''}${dict} >>\nstream\n`), data, ascii('\nendstream')]);
};
const baseObjects = () => { return [
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /Font << /F1 5 0 R >> >> >>'],
    [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>'],
    [4, stream('BT\n/F1 24 Tf\n72 700 Td\n(Hello, PDF internals.) Tj\nET\n')],
    [5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'],
]; };
export const minimalPdf = () => { return classicPdf(baseObjects()); };
