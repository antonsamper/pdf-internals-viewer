/** Release check for the exact preview binary and its reviewed native notice bundle. */
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'

const root = new URL('../', import.meta.url)
const read = path => readFile(new URL(path, root))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
let manifest
try {
  manifest = JSON.parse(await read('public/licenses/native-notice-manifest.json'))
} catch {
  throw new Error('Native notice inventory is not complete. See docs/NOTICES.md before publishing.')
}
if (manifest.status !== 'verified-source-superset') {
  throw new Error('Native notice inventory still has unresolved coverage. See docs/NOTICES.md.')
}
const require = createRequire(import.meta.url)
const fromPreview = createRequire(require.resolve('@embedpdf/engine/package.json'))
const wasm = await readFile(fromPreview.resolve('@embedpdf/engine-runtime-wasm32/embedpdf.wasm'))
if (sha(wasm) !== manifest.wasmSha256) throw new Error('Preview binary changed. Re-review native license coverage before publishing.')
if (!manifest.files?.length || !manifest.components?.length) throw new Error('Empty native notice inventory.')
for (const entry of manifest.files) {
  if (!entry.file.startsWith('public/licenses/') || entry.file.includes('..')) throw new Error('Unexpected notice path.')
  if (sha(await read(entry.file)) !== entry.sha256) throw new Error(`Native notice hash mismatch: ${entry.file}`)
}
const bundle = await read('public/licenses/embedpdf-native-notices.txt')
if (sha(bundle) !== manifest.bundleSha256) throw new Error('Native notice bundle changed without updating its reviewed hash.')
const combined = await read('public/THIRD-PARTY-NOTICES.txt')
if (!combined.includes(bundle)) throw new Error('Combined third-party notices do not include the complete native notice bundle.')
if (process.argv.includes('--dist')) {
  if (sha(await read('dist/licenses/native-notice-manifest.json')) !== sha(await read('public/licenses/native-notice-manifest.json'))) throw new Error('Built native notice manifest is stale.')
  if (!(await read('dist/THIRD-PARTY-NOTICES.txt')).includes(bundle)) throw new Error('Built combined notices omit the native bundle.')
  for (const entry of manifest.files) {
    if (sha(await read(entry.file.replace('public/', 'dist/'))) !== entry.sha256) throw new Error(`Built notice hash mismatch: ${entry.file}`)
  }
  if (sha(await read('dist/licenses/embedpdf-native-notices.txt')) !== manifest.bundleSha256) throw new Error('Built native notice bundle is stale.')
  const assets = await readdir(new URL('dist/assets/', root))
  const builtWasm = assets.filter(name => name.endsWith('.wasm'))
  if (builtWasm.length !== 1 || sha(await read(`dist/assets/${builtWasm[0]}`)) !== manifest.wasmSha256) throw new Error('Built preview WASM does not match the reviewed artifact.')
}
console.log(`Verified native notices: ${manifest.components.length} components, ${manifest.files.length} source texts, exact preview WASM.`)
