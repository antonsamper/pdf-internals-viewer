/** Read-only assertion over already-built output; never rewrites hashed files. */
import { readFile, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { parse } from 'acorn'

const dist = resolve(process.argv[2] ?? 'dist')
const assets = join(dist, 'assets')
const notice = '/*! Modified by PDF Internals Viewer: backported early array/Set bounds checks for GHSA-mrhx-c7xc-m3w5. See docs/PREVIEW-VALIDATION.md. */'
const files = await readdir(assets)
const groups = [
  { label: 'standalone worker', pattern: /^embedpdf-worker-[\w-]+\.js$/ },
  { label: 'inline transport', pattern: /^inline-transport-[\w-]+\.js$/ },
  { embedded: true, label: 'embedded worker source', pattern: /^embedpdf-worker\.source-[\w.-]+\.js$/ },
]
let checked = 0
for (const group of groups) {
  const matches = files.filter(file => group.pattern.test(file))
  if (matches.length === 0) throw new Error(`No emitted ${group.label} asset found in ${assets}; review build layout.`)
  for (const file of matches) {
    const code = await readFile(join(assets, file), 'utf8')
    // Lex actual comments and string tokens: a notice only inside an encoded
    // string is not an outer-module modification notice.
    let outerNotice = false
    const tokens = []
    try {
      parse(code, {
        ecmaVersion: 'latest',
        onComment: (block, text) => {
          if (block && `/*${text}*/` === notice) outerNotice = true
        },
        onToken: token => tokens.push(token),
        sourceType: 'module',
      })
    } catch (error) {
      throw new Error(`${file}: could not parse the built asset: ${error.message}`, { cause: error })
    }
    // A string literal, or a template with no substitutions (one chunk between two backquotes).
    const isPayloadNotice = (token, index) => {
      const plainTemplate = token.type.label === 'template' && tokens[index - 1]?.type.label === '`' && tokens[index + 1]?.type.label === '`'
      return (token.type.label === 'string' || plainTemplate) && token.value.startsWith(notice + '\n')
    }
    const workerPayloadNotice = tokens.some(isPayloadNotice)
    if (!outerNotice) throw new Error(`${file}: missing executable file modification notice.`)
    if (group.embedded && !workerPayloadNotice) {
      throw new Error(`${file}: embedded Blob-worker payload lost its own modification notice.`)
    }
    console.log(`Verified modification notice: ${file}`)
    checked++
  }
}
console.log(`Verified ${checked} production preview assets without modifying output.`)
