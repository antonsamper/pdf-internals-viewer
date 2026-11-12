import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

// Resolve the exact validator used by EmbedPDF, including under pnpm’s isolated layout.
const require = createRequire(import.meta.url)
const previewRequire = createRequire(require.resolve('@embedpdf/engine/package.json'))
const engineRequire = createRequire(previewRequire.resolve('@embedpdf/engine-core/package.json'))
const zodRoot = dirname(engineRequire.resolve('zod/package.json'))
const esm = await import(pathToFileURL(join(zodRoot, 'v3/external.js')).href)
const { z: commonjs } = engineRequire('zod')
const oversizedArray = Array.from({ length: 20_000 }, (_, index) => `invalid-${index}`)

const workerRoot = join(dirname(require.resolve('@embedpdf/engine/package.json')), 'workers')
const modificationNotice = '/*! Modified by PDF Internals Viewer: backported early array/Set bounds checks for GHSA-mrhx-c7xc-m3w5. See docs/PREVIEW-VALIDATION.md. */\n'
const workerFiles = ['embedpdf-worker.js', 'inline-transport.js', 'embedpdf-worker.source.js', '../dist/embedpdf-worker.source-B-pv2k2b.js', '../dist/embedpdf-worker.source-DQ7ekBUy.cjs']
const originalArray = 'n.dirty()),r.common.async)return Promise.all([...r.data].map'
const patchedArray = 'n.dirty()),i.exactLength!==null&&r.data.length>i.exactLength.value||i.maxLength!==null&&r.data.length>i.maxLength.value)return ee;if(r.common.async)return Promise.all([...r.data].map'
const originalSet = 'r.dirty());let a=this._def.valueType;function o(A){let d=new Set;'
const patchedSet = 'r.dirty());if(i.maxSize!==null&&n.data.size>i.maxSize.value)return ee;let a=this._def.valueType;function o(A){let d=new Set;'

function bundledSource(filename: string) {
  const source = readFileSync(join(workerRoot, filename), 'utf8')
  expect(source.startsWith(modificationNotice)).toBe(true)
  if (!filename.includes('embedpdf-worker.source')) return source
  if (filename.startsWith('../dist/')) {
    const start = source.indexOf('var embedpdf_worker_source_default = ') + 'var embedpdf_worker_source_default = '.length
    const literal = source.slice(start, source.indexOf(';\n//#endregion', start)).replaceAll('\t', '\\t')
    return JSON.parse(literal) as string
  }
  return JSON.parse(source.slice(source.indexOf('export default ') + 'export default '.length).trim().slice(0, -1)) as string
}
function bundledValidator(filename: string, restoreOriginal = false) {
  let source = bundledSource(filename)
  // The executable Blob payload carries its own notice, not only its wrapper.
  expect(source.startsWith(modificationNotice)).toBe(true)
  if (restoreOriginal) {
    // Verify the complete original asset hash after removing the known notice and two guards.
    // Thus the baseline executes the shipped upstream validator, not a test copy.
    source = source.slice(modificationNotice.length).replace(patchedArray, originalArray).replace(patchedSet, originalSet)
    const expected = filename === 'inline-transport.js' ? '3a5aab3ba9edadd98b6b0eef7ed5e043c7b7f573a1dc79e5a261321f67d880b1' : '2f9c17612b6202a6bb05c16ed9d789c4d47e99e561d79976084f1518de558250'
    expect(createHash('sha256').update(source).digest('hex')).toBe(expected)
  } else {
    expect(source).toContain(patchedArray)
    expect(source).toContain(patchedSet)
  }
  // Evaluate the real self-contained asset but expose its already-declared Zod
  // namespace instead of starting a worker host or transport. No WASM, network,
  // or validation functions are mocked. Runtime aliases remain inside the asset.
  const terminal = filename === 'inline-transport.js' ? 'export{Wse as createInlineTransport};' : 'TD(self);})();'
  expect(source.split(terminal)).toHaveLength(2)
  source = source.replace(terminal, filename === 'inline-transport.js' ? 'globalThis.__previewZod=w;' : 'globalThis.__previewZod=w;})();')
  const context = { console, URL, TextEncoder, TextDecoder, AbortController, Set, Map, Date, Uint8Array, ArrayBuffer, Promise, __previewZod: undefined as typeof commonjs | undefined }
  runInNewContext(source, context, { timeout: 3000 })
  expect(context.__previewZod).toBeDefined()
  return context.__previewZod!
}
const bundledValidators = workerFiles.map(filename => [filename, bundledValidator(filename)] as const)

describe.each([['ESM', esm], ['CommonJS', commonjs], ...bundledValidators])('EmbedPDF validator %s collection bounds', (_format, z) => {
  it.each(['max', 'length'])('rejects an oversized array .%s() before visiting elements', (bound) => {
    let visits = 0
    const element = z.preprocess((value: unknown) => { visits++; return value }, z.number())
    const result = z.array(element)[bound](2).safeParse(oversizedArray)
    expect(result.success).toBe(false)
    expect(visits).toBe(0)
    expect(result.error.issues).toHaveLength(1)
    expect(result.error.issues[0]).toMatchObject({ code: 'too_big', maximum: 2, type: 'array' })
  })

  it.each(['max', 'length'])('rejects an async oversized array .%s() before scheduling element work', async (bound) => {
    let visits = 0
    const element = z.preprocess(async (value: unknown) => { visits++; return value }, z.number())
    const result = await z.array(element)[bound](2).safeParseAsync(oversizedArray)
    expect(result.success).toBe(false)
    expect(visits).toBe(0)
    expect(result.error.issues).toHaveLength(1)
    expect(result.error.issues[0].code).toBe('too_big')
  })

  it('rejects an oversized Set before visiting or allocating results for its elements', () => {
    let visits = 0
    const element = z.preprocess((value: unknown) => { visits++; return value }, z.number())
    const result = z.set(element).max(2).safeParse(new Set(oversizedArray))
    expect(result.success).toBe(false)
    expect(visits).toBe(0)
    expect(result.error.issues).toHaveLength(1)
    expect(result.error.issues[0]).toMatchObject({ code: 'too_big', maximum: 2, type: 'set' })
  })

  it('rejects an async oversized Set before scheduling element work', async () => {
    let visits = 0
    const element = z.preprocess(async (value: unknown) => { visits++; return value }, z.number())
    const result = await z.set(element).size(2).safeParseAsync(new Set(oversizedArray))
    expect(result.success).toBe(false)
    expect(visits).toBe(0)
    expect(result.error.issues).toHaveLength(1)
    expect(result.error.issues[0].code).toBe('too_big')
  })

  it('preserves valid transformations and ordinary validation failures within the bounds', async () => {
    const element = z.number().transform((value: number) => value + 1)
    expect(z.array(element).max(2).parse([1, 2])).toEqual([2, 3])
    expect(z.array(element).length(2).parse([1, 2])).toEqual([2, 3])
    expect([...z.set(element).size(2).parse(new Set([1, 2]))]).toEqual([2, 3])
    expect(z.array(z.number()).max(2).safeParse(['bad']).error.issues[0].code).toBe('invalid_type')
    expect(z.array(z.number()).min(2).safeParse([1]).error.issues[0].code).toBe('too_small')
    expect(z.set(z.number()).min(2).safeParse(new Set([1])).error.issues[0].code).toBe('too_small')
    expect(await z.array(z.number()).max(2).parseAsync([1, 2])).toEqual([1, 2])
  })
})


describe.each(workerFiles)('upstream bundled regression baseline: %s', filename => {
  it('reproduces the original oversized-array work before the two local guards', () => {
    const z = bundledValidator(filename, true)
    let visits = 0
    const element = z.preprocess((value: unknown) => { visits++; return value }, z.number())
    const result = z.array(element).max(2).safeParse(oversizedArray)
    expect(result.success).toBe(false)
    expect(visits).toBe(20_000)
    expect(result.error.issues).toHaveLength(20_001)
  })
})
