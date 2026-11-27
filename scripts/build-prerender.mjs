import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createServer } from 'vite'

// Vite compiles the existing TSX and resolves aliases without a second runtime dependency.
const server = await createServer({ appType: 'custom', server: { middlewareMode: true } })
try {
  const { SITE_PAGES, SITE_URL, pageHead, renderPage } = await server.ssrLoadModule('/src/prerender.ts')
  const index = await readFile('dist/index.html', 'utf8')
  const styles = [...index.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map(([tag]) => { return tag }).join('\n')
  if (!styles) { throw new Error('Built stylesheet missing from homepage') }
  for (const page of SITE_PAGES) {
    const interactive = page.path === '/' || page.path === '/about'
    let html
    if (interactive) {
      const file = page.path === '/' ? 'dist/index.html' : 'dist/about.html'
      html = (await readFile(file, 'utf8')).replace('<div id="root"></div>', () => { return `<div id="root">${renderPage(page)}</div>` })
      if (html.includes('<div id="root"></div>')) { throw new Error(`Prerender failed: ${file}`) }
      await writeFile(file, html)
    } else {
      html = `<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><script src="/theme.js"></script>${pageHead(page)}\n${styles}</head><body><div id="root">${renderPage(page)}</div></body></html>\n`
      // Match Pages' extensionless HTML routing, with no SPA fallback required.
      const file = join('dist', `${page.path.slice(1)}.html`)
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, html)
    }
  }
  await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${SITE_PAGES.map(page => { return `  <url><loc>${SITE_URL}${page.path}</loc></url>` }).join('\n')}\n</urlset>\n`)
  console.log(`Prerendered ${SITE_PAGES.length} public pages and generated sitemap.xml`)
} finally { await server.close() }
