/** Validate the static-only Pages upload without credentials or publication. */
import assert from 'node:assert/strict'
import { readFile, readdir, lstat } from 'node:fs/promises'
import { resolve, join, relative } from 'node:path'

const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'))
const dist = resolve('dist')
assert.equal(resolve(config.pages_build_output_dir), dist, 'Pages must upload only dist/')
assert.equal(config.assets, undefined, 'Workers assets config must not be used for Pages')
assert.equal(config.main, undefined, 'No server-side Worker entry point is expected')
await readFile(join(dist, 'index.html'))
await readFile(join(dist, '404.html')) // Prevent Pages from silently using an SPA fallback.
let count = 0
async function walk(directory) {
  for (const name of await readdir(directory)) {
    const path = join(directory, name)
    const info = await lstat(path)
    const local = relative(dist, path).split('\\').join('/')
    assert.ok(!info.isSymbolicLink(), `Upload contains a symlink: ${local}`)
    assert.ok(!name.startsWith('.'), `Upload contains a hidden file: ${local}`)
    assert.ok(!['node_modules', 'functions', '_worker.js', '_worker.js.map'].includes(name), `Unexpected private/server-side upload: ${local}`)
    if (info.isDirectory()) await walk(path)
    else {
      assert.ok(info.size <= 25 * 1024 * 1024, `Pages asset exceeds 25 MiB: ${local}`)
      count++
    }
  }
}
await walk(dist)
assert.ok(count <= 20_000, 'Pages file-count limit exceeded')
console.log(`Validated ${count} static Pages assets, explicit 404 handling, no server-side entry point.`)
