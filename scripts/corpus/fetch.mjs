/** Explicit opt-in network access. Upstream PDFs are never copied into public/. */
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
const root = fileURLToPath(new URL('../../', import.meta.url))
const cache = join(root, '.context/corpus')
const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url), 'utf8'))
const sha256 = data => createHash('sha256').update(data).digest('hex')
await mkdir(cache, { recursive: true })
for (const entry of manifest.files) {
  const target = join(cache, entry.filename)
  try {
    const existing = await readFile(target)
    if (sha256(existing) === entry.sha256) { console.log(`Cached ${entry.filename}`); continue }
    throw new Error(`Cached file hash mismatch: ${entry.filename}. Remove that cache file to retry.`)
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  const response = await fetch(entry.url, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`${entry.filename}: HTTP ${response.status}`)
  const chunks = []
  let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    if (size > entry.size) throw new Error(`${entry.filename}: download exceeded pinned size`)
    chunks.push(chunk)
  }
  const data = Buffer.concat(chunks)
  if (data.length !== entry.size || sha256(data) !== entry.sha256) throw new Error(`${entry.filename}: downloaded content differs from pinned upstream file`)
  const temporary = `${target}.download`
  try { await writeFile(temporary, data); await rename(temporary, target) }
  finally { await rm(temporary, { force: true }) }
  console.log(`Fetched ${entry.filename} (${entry.size} bytes)`)
}
console.log(`${manifest.files.length} pinned upstream PDFs available in .context/corpus; not bundled or committed.`)
