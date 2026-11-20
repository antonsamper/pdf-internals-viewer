/** Verify the deployed HTML contract, independently of client rendering. */
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

const origin = 'https://pdf-internals-viewer.pages.dev'
const sitemap = await readFile('dist/sitemap.xml', 'utf8')
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => new URL(url))
assert.equal(urls.length, 11, 'Publish home, About, guide, six tutorials, privacy, and limitations')
const routes = new Set(urls.map(url => url.pathname))
for (const url of urls) {
  assert.equal(url.origin, origin)
  const file = join('dist', url.pathname === '/' ? 'index.html' : `${url.pathname.slice(1)}.html`)
  const html = await readFile(file, 'utf8')
  assert.match(html, /<html lang="en">/)
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1, `${url.pathname}: one readable main heading`)
  assert.match(html, /<main\b/)
  assert.doesNotMatch(html, /<div id="root"><\/div>/)
  assert.doesNotMatch(html, /noindex|nosnippet/i)
  assert.equal([...html.matchAll(/<title>/g)].length, 1)
  assert.equal([...html.matchAll(/name="description"/g)].length, 1)
  assert.ok(html.includes(`<link rel="canonical" href="${url.href}"`))
  assert.ok(html.includes(`property="og:url" content="${url.href}"`))
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json" id="site-schema">([\s\S]*?)<\/script>/)?.[1] ?? 'null')
  assert.ok(schema?.['@graph'].some(node => node.url === url.href))
  if (url.pathname !== '/' && url.pathname !== '/about') {
    assert.doesNotMatch(html, /<script[^>]*\bsrc=/, 'Static articles must not require inspector JavaScript')
    assert.ok(html.includes('Back to the workspace'))
  }
  for (const [, href] of html.matchAll(/href="(\/[^"#]*)"/g)) {
    const target = new URL(href.replaceAll('&amp;', '&'), origin)
    if (routes.has(target.pathname)) continue
    assert.ok((await stat(join('dist', target.pathname))).isFile(), `${url.pathname}: missing local link ${href}`)
  }
}
const robots = await readFile('dist/robots.txt', 'utf8')
assert.match(robots, /User-agent: \*\s+Allow: \//)
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`))
const privacy = await readFile('dist/privacy.html', 'utf8')
assert.ok(privacy.includes('Notes created while inspecting an encrypted PDF remain readable'))
const about = await readFile('dist/about.html', 'utf8')
assert.ok(about.includes('Bookmarks and notes are saved in this browser'))
assert.doesNotMatch(about, /Documents, bookmarks, and notes\s+stay in memory/)
console.log(`Verified ${urls.length} readable public pages, canonical metadata, structured data, internal links, sitemap and robots policy.`)
