/**
 * Expose a pinned engine's existing low-level parser as a generated adapter.
 * Never edits node_modules. Fail closed on dependency changes. See docs/PARSER.md.
 */
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sourceFile = require.resolve('@libpdf/core');
const sourceDir = dirname(sourceFile);
const pkg = JSON.parse(await readFile(join(sourceDir, '../package.json'), 'utf8'));
if (pkg.version !== '0.5.3') throw new Error('Inspection adapter requires @libpdf/core exactly 0.5.3. Review parser instrumentation before upgrading.');
const source = await readFile(sourceFile, 'utf8');
const expected = '7b9b699034c81be2ab6af3337e0d2559df2b91b5016913b2c202cbaafc534400';
const digest = createHash('sha256').update(source).digest('hex');
if (digest !== expected) throw new Error('Pinned parser bundle changed; review instrumentation.');
for (const name of ['Scanner', 'DocumentParser', 'IndirectObjectParser', 'ObjectStreamParser', 'ObjectParser', 'TokenReader', 'XRefParser', 'FlateFilter']) {
  if (!source.includes(`var ${name} = class`)) throw new Error(`Missing pinned parser symbol: ${name}`);
}
const out = new URL('../src/generated/', import.meta.url);
await mkdir(out, { recursive: true });
await copyFile(join(sourceDir, 'rolldown-runtime-D7D4PA-g.mjs'), new URL('rolldown-runtime-D7D4PA-g.mjs', out));
await copyFile(join(sourceDir, '../LICENSE.md'), new URL('LIBPDF-LICENSE.md', out));
const adapter = String.raw`
// Application inspection adapter: low-level engine exports and provenance capture.
// Override only Flate decompression to enforce a bounded output allocation.
const INSPECTION_MAX_DECODED = 32 * 1024 * 1024;
FlateFilter.prototype.inflate = function(data) {
  const chunks = [];
  let size = 0;
  const inf = new pako.Inflate({ chunkSize: 65536 });
  inf.onData = (chunk) => {
    size += chunk.length;
    if (size > INSPECTION_MAX_DECODED) throw new Error('Decoded stream exceeds the 32 MiB inspection limit');
    chunks.push(chunk);
  };
  inf.push(data, true);
  if (inf.err) throw new Error(inf.msg || 'Flate decoding failed');
  const output = new Uint8Array(size);
  let cursor = 0;
  for (const chunk of chunks) { output.set(chunk, cursor); cursor += chunk.length; }
  return output;
};
// Bound all decoded engine streams, including structural xref/object streams.
const inspectionDecodeOriginal = PdfStream.prototype.getDecodedData;
let inspectionDecodedCache = new WeakMap();
let inspectionDecodedBytes = 0;
function inspectionResetDecodedCache() {
  inspectionDecodedCache = new WeakMap();
  inspectionDecodedBytes = 0;
}
PdfStream.prototype.getDecodedData = function() {
  const cached = inspectionDecodedCache.get(this);
  if (cached) return cached;
  const filters = this.get('Filter');
  const names = !filters ? [] : filters.type === 'name' ? [filters.value] : filters.type === 'array' ? filters.toArray().map(filter => filter.value) : ['unknown'];
  for (const name of names) {
    if (!['FlateDecode', 'Fl', 'ASCIIHexDecode', 'AHx', 'ASCII85Decode', 'A85'].includes(name)) throw new Error('Unsupported inspection stream filter: /' + name);
  }
  const decoded = inspectionDecodeOriginal.call(this);
  if (decoded.length > INSPECTION_MAX_DECODED) throw new Error('Decoded stream exceeds the 32 MiB inspection limit');
  if (inspectionDecodedBytes + decoded.length > 128 * 1024 * 1024) throw new Error('Document reached the 128 MiB total decoded-data limit');
  inspectionDecodedCache.set(this, decoded);
  inspectionDecodedBytes += decoded.length;
  return decoded;
};
const inspectionObjectStreamCache = new WeakMap();
/** Parse a verified xref target using the engine, capturing original endobj. */
function inspectionReadIndirect(bytes, offset, lengthResolver) {
  const scanner = new Scanner(bytes);
  const parser = new IndirectObjectParser(scanner, lengthResolver);
  const parsed = parser.parseObjectAt(offset);
  let end;
  if (parsed.value.type === 'stream') {
    const candidate = scanner.position;
    if (String.fromCharCode(...bytes.subarray(candidate - 6, candidate)) === 'endobj') end = candidate;
  } else {
    // The object parser maintains two lookahead tokens. The first unconsumed
    // token has the exact endobj offset, unlike the scanner's lookahead cursor.
    const probe = new Scanner(bytes);
    probe.moveTo(offset);
    const reader = new TokenReader(probe);
    reader.nextToken(); reader.nextToken(); reader.nextToken();
    const objectParser = new ObjectParser(reader);
    objectParser.parseObject();
    const token = objectParser.buf1;
    if (token?.type === 'keyword' && token.value === 'endobj') end = token.position + 6;
  }
  return { ...parsed, end };
}
function inspectionCompressedLocation(stream, index, objectNumber) {
  let parser = inspectionObjectStreamCache.get(stream);
  if (!parser) {
    parser = new ObjectStreamParser(stream);
    parser.parse();
    inspectionObjectStreamCache.set(stream, parser);
  }
  const entry = parser.index[index];
  if (!entry || entry.objNum !== objectNumber) throw new Error('Object stream index does not match xref');
  const start = parser.first + entry.offset;
  const scanner = new Scanner(parser.decodedData);
  scanner.moveTo(start);
  const objectParser = new ObjectParser(new TokenReader(scanner));
  objectParser.parseObject();
  // Exclude trailing whitespace from the object's byte interval.
  let end = objectParser.buf1?.position ?? scanner.position;
  while (end > start && [0, 9, 10, 12, 13, 32].includes(parser.decodedData[end - 1])) end--;
  return { start, end, bytes: parser.decodedData.subarray(start, end) };
}
export { Scanner as InspectionScanner, DocumentParser as InspectionDocumentParser,
  XRefParser as InspectionXRefParser, inspectionReadIndirect, inspectionCompressedLocation, inspectionResetDecodedCache };
`;
const fromEngine = createRequire(sourceFile);
const lruEntry = fromEngine.resolve('lru-cache');
const lruRoot = lruEntry.slice(0, lruEntry.lastIndexOf('/dist/'));
const lruBrowser = join(lruRoot, 'dist/esm/browser/index.min.js');
await readFile(lruBrowser, 'utf8'); // Fail closed if the pinned dependency layout changes.
let browserSource = source;
for (const optional of ['@google-cloud/kms', '@google-cloud/secret-manager']) {
  const expression = `import(${JSON.stringify(optional)})`;
  if (browserSource.split(expression).length !== 2) throw new Error(`Unexpected optional cloud import shape: ${optional}`);
  browserSource = browserSource.replace(expression, `Promise.reject(new Error(${JSON.stringify('Cloud signing is excluded from this read-only browser inspection adapter.')}))`);
}
// Relocating the bundle must preserve every dependency's engine-local resolution.
// The complete upstream source is hash-pinned above; only static bare imports move.
const relocated = browserSource.replace(/^(import .+? from )"([^".][^"]*)";/gm, (_, prefix, specifier) => {
  const target = specifier === 'lru-cache' ? lruBrowser : fromEngine.resolve(specifier);
  const path = relative(fileURLToPath(out), target).split('\\').join('/');
  return `${prefix}${JSON.stringify(path.startsWith('.') ? path : './' + path)};`;
});
await writeFile(new URL('libpdf-inspection.mjs', out), relocated.replace(/\/\/# sourceMappingURL=.*$/m, '') + adapter);
await writeFile(new URL('libpdf-inspection.d.mts', out), `
import type { PdfDict, PdfObject, PdfRef, PdfStream } from '@libpdf/core';
export type XRefEntry = { type:'free'; generation:number; nextFree:number } | { type:'uncompressed'; generation:number; offset:number } | { type:'compressed'; streamObjNum:number; indexInStream:number };
export interface ParsedDocument { version:string; trailer:PdfDict; xref:Map<number,XRefEntry>; warnings:string[]; recoveredViaBruteForce:boolean; isEncrypted:boolean; isAuthenticated:boolean; getObject(ref:PdfRef):PdfObject|null; getCatalog():PdfDict|null; getPageCount():number; getPages():PdfRef[] }
export class InspectionScanner { constructor(bytes:Uint8Array); position:number }
export class InspectionDocumentParser { constructor(scanner:InspectionScanner, options?:{lenient?:boolean}); parse():ParsedDocument }
export class InspectionXRefParser { constructor(scanner:InspectionScanner); findStartXRef():number }
export function inspectionResetDecodedCache():void;
export function inspectionReadIndirect(bytes:Uint8Array, offset:number, lengthResolver?:(ref:PdfRef)=>number|null):{objNum:number;genNum:number;value:PdfObject;end?:number};
export function inspectionCompressedLocation(stream:PdfStream,index:number,objectNumber:number):{start:number;end:number;bytes:Uint8Array};
export { PdfRef } from '@libpdf/core';
`);
console.log(`Prepared LibPDF 0.5.3 inspection adapter (sha256 ${digest})`);
