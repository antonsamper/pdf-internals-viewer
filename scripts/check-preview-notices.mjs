/** Read-only assertion over already-built output; never rewrites hashed files. */
import { readFile, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import ts from 'typescript'

const dist = resolve(process.argv[2] ?? 'dist')
const assets = join(dist, 'assets')
const notice = '/*! Modified by PDF Internals Viewer: backported early array/Set bounds checks for GHSA-mrhx-c7xc-m3w5. See docs/PREVIEW-VALIDATION.md. */'
const files = await readdir(assets)
const groups = [
  { label: 'standalone worker', pattern: /^embedpdf-worker-[\w-]+\.js$/ },
  { label: 'inline transport', pattern: /^inline-transport-[\w-]+\.js$/ },
  { label: 'embedded worker source', pattern: /^embedpdf-worker\.source-[\w.-]+\.js$/, embedded: true },
]
let checked = 0
for (const group of groups) {
  const matches = files.filter(file => group.pattern.test(file))
  if (matches.length === 0) throw new Error(`No emitted ${group.label} asset found in ${assets}; review build layout.`)
  for (const file of matches) {
    const code = await readFile(join(assets, file), 'utf8')
    // Lex actual comments: a notice only inside an encoded string is not an
    // outer-module modification notice. The scanner excludes string literals.
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, code)
    let outerNotice = false
    for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
      if (token === ts.SyntaxKind.MultiLineCommentTrivia && scanner.getTokenText() === notice) outerNotice = true
    }
    if (!outerNotice) throw new Error(`${file}: missing executable file modification notice.`)
    if (group.embedded) {
      const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS)
      let workerPayloadNotice = false
      const visit = node => {
        if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && node.text.startsWith(notice + '\n')) workerPayloadNotice = true
        ts.forEachChild(node, visit)
      }
      visit(source)
      if (!workerPayloadNotice) throw new Error(`${file}: embedded Blob-worker payload lost its own modification notice.`)
    }
    console.log(`Verified modification notice: ${file}`)
    checked++
  }
}
console.log(`Verified ${checked} production preview assets without modifying output.`)
