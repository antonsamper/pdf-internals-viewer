/**
 * Narrow Zod v3 collection-bound backport for EmbedPDF 3.1.0.
 * Reproducible, idempotent, and fail-closed. See docs/PREVIEW-VALIDATION.md.
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
// Resolve through the real dependency chain, including pnpm's isolated layout.
const previewPackageFile = require.resolve('@embedpdf/engine/package.json')
const previewRequire = createRequire(previewPackageFile)
const enginePackageFile = previewRequire.resolve('@embedpdf/engine-core/package.json')
const enginePackage = JSON.parse(await readFile(enginePackageFile, 'utf8'))
if (enginePackage.version !== '3.1.0') {
  throw new Error('Preview validation backport requires @embedpdf/engine-core exactly 3.1.0; review before upgrading.')
}
const engineRequire = createRequire(enginePackageFile)
const zodPackageFile = engineRequire.resolve('zod/package.json')
const zodPackage = JSON.parse(await readFile(zodPackageFile, 'utf8'))
if (zodPackage.version !== '3.25.76') {
  throw new Error('Preview validation backport requires the engine-resolved Zod exactly 3.25.76; review before upgrading.')
}
const sha = source => createHash('sha256').update(source).digest('hex')
const files = [
  { name: 'types.js', format: 'esm', original: '9763a2938f0e7f983363ef4bf6530e7583e3f2d54f8a4a6684efad58febc6e8e', patched: '839a85dd365ba812fea06fa30679a8fea3e3fbde2c046880aabd39c355ccac54' },
  { name: 'types.cjs', format: 'cjs', original: '06487cc05ed45c5dd29789bf0aa75734d1ce06592a7f2665ba4ca90a68e8a3e1', patched: '3cf668c0a5db2739d087049d1191bbf6af3bfb581d95d6dcb5b89bc5031603f7' },
]

function insertInClass(source, className, tail, needle, insertion, format) {
  const startMarker = `${format === 'esm' ? 'export ' : ''}class ${className} extends ZodType {`
  const start = source.indexOf(startMarker)
  const end = source.indexOf(tail, start)
  if (start < 0 || end < 0 || source.indexOf(startMarker, start + 1) >= 0) {
    throw new Error(`Unexpected ${className} shape in pinned ${format} validator`)
  }
  const region = source.slice(start, end)
  if (region.split(needle).length !== 2) throw new Error(`Unexpected ${className} bound insertion target`)
  return source.slice(0, start) + region.replace(needle, insertion + needle) + source.slice(end)
}
function backport(source, format) {
  const invalid = format === 'esm' ? 'INVALID' : 'parseUtil_js_1.INVALID'
  let result = insertInClass(source, 'ZodArray', '    get element()', '        if (ctx.common.async) {',
    `        // GHSA-mrhx-c7xc-m3w5: reject oversized constrained arrays before walking elements.\n` +
    `        if ((def.exactLength !== null && ctx.data.length > def.exactLength.value) ||\n` +
    `            (def.maxLength !== null && ctx.data.length > def.maxLength.value)) return ${invalid};\n`, format)
  result = insertInClass(result, 'ZodSet', '    min(minSize', '        const valueType = this._def.valueType;',
    `        // GHSA-mrhx-c7xc-m3w5: reject oversized constrained sets before walking elements.\n` +
    `        if (def.maxSize !== null && ctx.data.size > def.maxSize.value) return ${invalid};\n`, format)
  return result
}

const previewPackage = JSON.parse(await readFile(previewPackageFile, 'utf8'))
if (previewPackage.version !== '3.1.0') throw new Error('Bundled preview backport requires @embedpdf/engine exactly 3.1.0; review before upgrading.')
const workerRoot = join(dirname(previewPackageFile), 'workers')
const modificationNotice = '/*! Modified by PDF Internals Viewer: backported early array/Set bounds checks for GHSA-mrhx-c7xc-m3w5. See docs/PREVIEW-VALIDATION.md. */\n'
const workers = [
  { name: 'embedpdf-worker.js', original: '2f9c17612b6202a6bb05c16ed9d789c4d47e99e561d79976084f1518de558250', previous: '30e9f7593f9b9adc2d7595a0e8043d5aae8cb65d1421f9523655a3c3558319dd', patched: '98198d3594bd386cba0563132c17a4c9cb852db29cb34c60965bf91e29f7c247' },
  { name: 'inline-transport.js', original: '3a5aab3ba9edadd98b6b0eef7ed5e043c7b7f573a1dc79e5a261321f67d880b1', previous: 'd3eee78ad9f23b709cc3e4550c163d87601b06182d585b6bf2a8b704aa9fbd77', patched: 'fe8076b0a20d0d00df10fd87cc1f7102d55e31bc82538a6dca5efcf8ba4eb6e1' },
  { name: 'embedpdf-worker.source.js', original: '920177f45d562dcd7f7cebfd62970ec2e01eb8a01ca667911999b728c51d041d', previous: '2381e795aad5698277d96271ec1abf42414ec764cfb500a94963a1053e59f863', patched: 'ec48d13e4bdc33f34d7097f580f8c2e407a91d8774b16ee1762a3c301aaf25fa', escaped: true },
  { name: '../dist/embedpdf-worker.source-B-pv2k2b.js', original: 'e3066e27ed506f3a282af0bd38c9d1ee112587ab324cda8c5c17d6b09af028c2', previous: 'bc86b234b0db8b9b3b296f3554fbab41fc513428a482e9e83fe0dc03a9764427', patched: '23de65cc776a81fe715fc93a09492b8aa1d9c30d1feef1dd06dbc26157aad805', escaped: 'dist' },
  { name: '../dist/embedpdf-worker.source-DQ7ekBUy.cjs', original: '4689e1b21fb62e277dd0bc29b5ec0dc532fe657e6d48cd98eb444c23c60e5fe9', previous: '257b4522718036e52409d4a26576df29e3fd94f0b581bf1bcfc36f4748f39617', patched: 'aaecba37cb4b7b25af321b4b7f2efa46b8ddc29a4f701e4ae991b1466cb1183b', escaped: 'dist' },
]
function replaceExactlyOnce(source, needle, replacement) {
  if (source.split(needle).length !== 2) throw new Error('Pinned bundled validator shape changed; refusing to patch.')
  return source.replace(needle, replacement)
}
function backportBundled(source) {
  let patched = replaceExactlyOnce(source,
    'n.dirty()),r.common.async)return Promise.all([...r.data].map',
    'n.dirty()),i.exactLength!==null&&r.data.length>i.exactLength.value||i.maxLength!==null&&r.data.length>i.maxLength.value)return ee;if(r.common.async)return Promise.all([...r.data].map')
  patched = replaceExactlyOnce(patched,
    'r.dirty());let a=this._def.valueType;function o(A){let d=new Set;',
    'r.dirty());if(i.maxSize!==null&&n.data.size>i.maxSize.value)return ee;let a=this._def.valueType;function o(A){let d=new Set;')
  return modificationNotice + patched
}
function originalWorkerPayload(source, target = workers[0]) {
  if (sha(source) === target.original) return source
  if (sha(source) !== target.previous) throw new Error('Embedded worker payload does not match pinned original or previous backport.')
  const original = replaceExactlyOnce(replaceExactlyOnce(source,
    'n.dirty()),i.exactLength!==null&&r.data.length>i.exactLength.value||i.maxLength!==null&&r.data.length>i.maxLength.value)return ee;if(r.common.async)return Promise.all([...r.data].map',
    'n.dirty()),r.common.async)return Promise.all([...r.data].map'),
    'r.dirty());if(i.maxSize!==null&&n.data.size>i.maxSize.value)return ee;let a=this._def.valueType;function o(A){let d=new Set;',
    'r.dirty());let a=this._def.valueType;function o(A){let d=new Set;')
  if (sha(original) !== target.original) throw new Error('Previous worker backport did not restore the exact pinned original.')
  return original
}
function backportWorkerSource(source) {
  const marker = 'export default '
  const prefixEnd = source.indexOf(marker) + marker.length
  if (prefixEnd < marker.length || !source.endsWith(';\n')) throw new Error('Pinned escaped worker source shape changed.')
  const decoded = JSON.parse(source.slice(prefixEnd, -2))
  return modificationNotice + source.slice(0, prefixEnd) + JSON.stringify(backportBundled(originalWorkerPayload(decoded))) + ';\n'
}
function backportDistWorkerSource(source) {
  const marker = 'var embedpdf_worker_source_default = '
  const prefixEnd = source.indexOf(marker) + marker.length
  const suffixStart = source.indexOf(';\n//#endregion', prefixEnd)
  if (prefixEnd < marker.length || suffixStart < prefixEnd) throw new Error('Pinned distribution worker source shape changed.')
  // The distribution literal contains legal raw tab characters, unlike JSON.
  // Normalize those tabs as escapes; the decoded whole-worker hash
  // below proves this preserved its exact JavaScript payload.
  const literal = source.slice(prefixEnd, suffixStart).replaceAll('\t', '\\t')
  const decoded = JSON.parse(literal)
  return modificationNotice + source.slice(0, prefixEnd) + JSON.stringify(backportBundled(originalWorkerPayload(decoded))) + source.slice(suffixStart)
}
// The Node entry is a thin import wrapper, not another vendored validator.
const nodeWrapper = await readFile(join(workerRoot, 'inline-transport.node.js'), 'utf8')
if (sha(nodeWrapper) !== 'dc3dc9bf66d9e7c4b5f5726d157f8fe6a758b6f6ae87b828e85d52e5d73350eb') {
  throw new Error('Pinned Node transport wrapper changed; check whether it now embeds a validator.')
}

// Validate all module and bundled-worker copies before writing any file.

const prepared = []
for (const file of files) {
  const path = join(dirname(zodPackageFile), 'v3', file.name)
  const original = await readFile(path, 'utf8')
  const hash = sha(original)
  if (hash === file.patched) continue
  if (hash !== file.original) throw new Error(`Pinned Zod ${file.name} changed unexpectedly; refusing to patch.`)
  const patched = backport(original, file.format)
  if (process.argv.includes('--print-patched-hashes')) {
    console.log(`${file.name} ${sha(patched)}`)
    continue
  }
  if (sha(patched) !== file.patched) throw new Error(`Backport output hash mismatch for ${file.name}; refusing to write.`)
  prepared.push({ path, patched })
}
for (const file of workers) {
  const path = join(workerRoot, file.name)
  const original = await readFile(path, 'utf8')
  const hash = sha(original)
  if (hash === file.patched) continue
  if (hash !== file.original && hash !== file.previous) throw new Error(`Pinned preview ${file.name} changed unexpectedly; refusing to patch.`)
  const patched = file.escaped === 'dist' ? backportDistWorkerSource(original) : file.escaped ? backportWorkerSource(original) : backportBundled(originalWorkerPayload(original, file))
  if (process.argv.includes('--print-patched-hashes')) { console.log(`${file.name} ${sha(patched)}`); continue }
  if (sha(patched) !== file.patched) throw new Error(`Bundled backport output hash mismatch for ${file.name}; refusing to write.`)
  prepared.push({ path, patched })
}
for (const { path, patched } of prepared) await writeFile(path, patched)
if (!process.argv.includes('--print-patched-hashes')) {
  console.log('Prepared EmbedPDF collection-bound backport (Zod ESM/CommonJS + bundled worker/inline copies).')
}
