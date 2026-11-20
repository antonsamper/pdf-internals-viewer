import { test, expect, type Page } from '@playwright/test'
import { resolve } from 'node:path'
import { mkdir, readFile } from 'node:fs/promises'
// @ts-expect-error local JavaScript fixture helpers have no declaration file
import { classicPdf, encryptedPdf, embeddedFilesPdf, imageExportPdf } from '../scripts/fixtures/pdf-fixtures.mjs'

const samplePath = (name: string) => resolve('public/samples', name)
// Keep artifacts separate when --browser=all runs engines concurrently.
const screenshotPath = (name: string) => resolve('.context', test.info().project.use.browserName ?? 'chromium', name)

async function upload(page: Page, name: string) {
  await page.getByLabel('Open local PDF').setInputFiles(samplePath(name))
  await expect(page.getByRole('heading', { name: 'Document overview' })).toBeVisible()
  await expect(page.locator('.filename')).toContainText(name)
  await expect(page.locator('.status-bar')).toContainText('objects indexed')
}

async function openMinimal(page: Page) {
  await page.getByRole('button', { name: /^A simple page/ }).click()
  await expect(page.getByRole('heading', { name: 'Document overview' })).toBeVisible()
  await expect(page.locator('.status-bar')).toContainText('5 objects indexed')
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('opens with an accessible empty workspace and sample choices', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Look inside a PDF.' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Open a PDF/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^A simple page/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Fonts & resources/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Compressed objects/ })).toBeVisible()
  await expect(page.locator('.status-bar')).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Project', exact: true })).toBeVisible()
  await mkdir(resolve('.context'), { recursive: true })
  await page.screenshot({ path: screenshotPath('empty.png'), fullPage: true, animations: 'disabled' })
})

test('shows document status only in an active PDF workspace', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await expect(page.locator('.status-bar')).toHaveCount(0)
    await openMinimal(page)
    await expect(page.getByRole('navigation', { name: 'Project', exact: true })).toHaveCount(0)
    await page.getByRole('link', { name: 'User guide', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('How to inspect a PDF in your browser')
    await expect(page.locator('.status-bar')).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Project', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Back to the workspace', exact: true }).click()
    await expect(page.locator('.status-bar')).toContainText('5 objects indexed')
    await page.getByRole('button', { name: 'Close PDF', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Look inside a PDF.' })).toBeVisible()
    await expect(page.locator('.status-bar')).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Project', exact: true })).toBeVisible()
  }
})

test('ends sample sessions without reopening them and preserves the current public route', async ({ page }) => {
  await page.goto('/?sample=compressed')
  await expect(page.locator('.filename')).toContainText('compressed.pdf')
  await expect(page.locator('.status-bar')).toContainText('7 objects indexed')
  await page.getByRole('button', { name: 'Close PDF', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Look inside a PDF.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Close PDF', exact: true })).toHaveCount(0)
  // A new session can open normally, even though the initial sample query remains.
  await upload(page, 'minimal.pdf')
  await expect(page.locator('.status-bar')).toContainText('5 objects indexed')
  await page.getByRole('link', { name: 'User guide', exact: true }).click()
  await expect(page).toHaveURL(/\/guide$/)
  await page.getByRole('button', { name: 'Close PDF', exact: true }).click()
  await expect(page).toHaveURL(/\/guide$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How to inspect a PDF in your browser')
  await page.getByRole('link', { name: 'Back to the workspace', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Look inside a PDF.' })).toBeVisible()
  await expect(page.locator('.status-bar')).toHaveCount(0)
})

test('summarizes page rotation in the document overview', async ({ page }) => {
  const rotation = page.locator('.document-facts > div').filter({ has: page.getByText('Page rotation', { exact: true }) }).locator('dd')
  await openMinimal(page)
  await expect(rotation).toHaveText('0°')
  for (const [override, expected] of [['', '90°'], ['/Rotate 180', 'Mixed (90°, 180°)']]) {
    const fixture = classicPdf([
      [1, '<< /Type /Catalog /Pages 2 0 R >>'],
      [2, '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 /Rotate 90 >>'],
      [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>'],
      [4, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] ${override} >>`],
    ])
    await page.getByLabel('Open local PDF').setInputFiles({ name: 'rotated.pdf', mimeType: 'application/pdf', buffer: Buffer.from(fixture.bytes) })
    await expect(rotation).toHaveText(expected)
  }
})

test('follows page references, reads stream representations, and navigates history', async ({ page }) => {
  await openMinimal(page)
  await page.getByRole('button', { name: 'First page', exact: true }).click()
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Explain /Contents', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '4 0 R', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: /4 0\s+obj/ })).toBeVisible()
  await expect(page.locator('.hex-byte.hex-selected').first()).toBeVisible()
  await page.getByRole('tab', { name: 'Raw stream', exact: true }).click()
  await expect(page.getByRole('tabpanel', { name: 'Raw stream', exact: true })).toContainText('Hello, PDF internals.')
  await page.getByRole('tab', { name: 'Decoded', exact: true }).click()
  await expect(page.getByRole('tabpanel', { name: 'Decoded', exact: true })).toContainText('Hello, PDF internals.')
  await expect(page.getByRole('tabpanel', { name: 'Decoded', exact: true })).toContainText('Decoded offsets differ from original file offsets.')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Raw stream', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Properties', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible()
  await page.getByRole('button', { name: 'Forward', exact: true }).click()
  await expect(page.getByRole('heading', { name: /4 0\s+obj/ })).toBeVisible()
  await page.getByRole('tab', { name: 'Decoded', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Decoded', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel', { name: 'Decoded', exact: true })).toContainText('Hello, PDF internals.')
  await page.screenshot({ path: screenshotPath('desktop.png'), fullPage: true, animations: 'disabled' })
})

test('shows a prominent loading state and allows cancelling a slow open', async ({ page }) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/samples/minimal.pdf', async route => {
    await pending
    await route.continue()
  })
  await page.getByRole('button', { name: /^A simple page/ }).click()
  const loading = page.getByRole('status', { name: 'Opening PDF', exact: true })
  await expect(loading).toBeVisible()
  await expect(loading).toContainText('Larger documents can take a few seconds.')
  await expect(page.getByRole('main', { name: 'Document inspection' })).toHaveAttribute('aria-busy', 'true')
  await expect(loading.locator('svg')).toHaveClass(/animate-spin/)
  await page.screenshot({ path: screenshotPath('opening-pdf.png'), fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(loading).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Look inside a PDF.' })).toBeVisible()
  release()
  await page.unrouteAll({ behavior: 'wait' })
  await openMinimal(page)
  await expect(loading).toHaveCount(0)
  await expect(page.getByRole('main', { name: 'Document inspection' })).toHaveAttribute('aria-busy', 'false')
})

test('explains parsing failures and retains the reason after dismissing the banner', async ({ page }) => {
  await page.getByLabel('Open local PDF').setInputFiles({ name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF') })
  const explanation = page.getByRole('region', { name: 'Why structure is unavailable' })
  await expect(explanation).toBeVisible()
  await expect(explanation).toContainText('could not determine whether it is encrypted')
  await expect(explanation).toContainText('export a fresh copy')
  await page.getByRole('button', { name: 'Dismiss error', exact: true }).click()
  await explanation.getByText('Technical details', { exact: true }).click()
  await expect(explanation.locator('pre')).toContainText('Could not recover PDF structure: no objects found')
  await page.screenshot({ path: screenshotPath('structure-unavailable.png'), fullPage: true, animations: 'disabled' })
  await explanation.getByRole('button', { name: 'Inspect original bytes', exact: true }).click()
  await expect(page.locator('.hex-status')).toContainText('1 bytes selected')
  await upload(page, 'minimal.pdf')
  await expect(explanation).toHaveCount(0)
})

test('distinguishes confirmed encryption from an unknown parsing failure', async ({ page }) => {
  await page.getByLabel('Open local PDF').setInputFiles({ name: 'encrypted.pdf', mimeType: 'application/pdf', buffer: Buffer.from(encryptedPdf().bytes) })
  await expect(page.getByRole('heading', { name: 'Document overview' })).toBeVisible()
  await expect(page.locator('.warning-inline')).toContainText('This PDF is encrypted')
  await expect(page.getByLabel('PDF password', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Why structure is unavailable' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'First page', exact: true })).toBeDisabled()
  await expect(page.getByRole('region', { name: 'Original file bytes', exact: true })).toBeVisible()
})

test('validates hex offsets and supports keyboard byte navigation', async ({ page }) => {
  await openMinimal(page)
  const offset = page.getByRole('textbox', { name: 'Go to offset', exact: true })
  await offset.fill('nope')
  await page.getByRole('button', { name: 'Jump to offset', exact: true }).click()
  await expect(page.locator('.hex-status')).toContainText('Enter a decimal offset')
  await offset.fill('999999')
  await page.getByRole('button', { name: 'Jump to offset', exact: true }).click()
  await expect(page.locator('.hex-status')).toContainText('Offset must be between')
  await offset.fill('0x0')
  await page.getByRole('button', { name: 'Jump to offset', exact: true }).click()
  await expect(page.locator('.hex-status')).toContainText('Jumped to 0x0')
  const bytes = page.getByRole('region', { name: /^Hexadecimal bytes/ })
  await expect(bytes).toBeFocused()
  await bytes.press('ArrowRight')
  await expect(page.locator('.hex-cursor')).toHaveAttribute('aria-label', /^Offset 1,/)
  await bytes.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'no known containing object' })).toBeVisible()
  await page.getByRole('button', { name: /Offsets in hexadecimal; switch to decimal/ }).click()
  await expect(page.getByRole('button', { name: /Offsets in decimal; switch to hexadecimal/ })).toBeVisible()
})

test('keeps a clicked byte in place while selecting its containing object', async ({ page }) => {
  const data = 'x'.repeat(20000)
  const fixture = classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>'],
    [4, `<< /Length ${data.length} >>\nstream\n${data}\nendstream`],
  ])
  await page.getByLabel('Open local PDF').setInputFiles({ name: 'long-stream.pdf', mimeType: 'application/pdf', buffer: Buffer.from(fixture.bytes) })
  await expect(page.locator('.status-bar')).toContainText('4 objects indexed')
  const viewport = page.locator('.hex-viewport')
  await viewport.evaluate(element => { element.scrollTop = 2600 })
  const chooseMiddleByte = () => viewport.evaluate(element => {
    const viewport = element.getBoundingClientRect()
    const target = Array.from(element.querySelectorAll('button.hex-byte')).find(element => {
      const rect = element.getBoundingClientRect()
      return rect.top > viewport.top + viewport.height / 2 && rect.bottom < viewport.bottom
    })
    return target ? { label: target.getAttribute('aria-label')!, top: target.getBoundingClientRect().top } : null
  })
  // Wait for the virtualized rows to reflect the scrolled viewport.
  await expect.poll(() => viewport.evaluate(element => element.scrollTop)).toBe(2600)
  await expect.poll(chooseMiddleByte).not.toBeNull()
  const target = (await chooseMiddleByte())!
  const byte = page.getByRole('button', { name: target.label, exact: true })
  await byte.click()
  await expect(page.getByRole('heading', { name: /4 0\s+obj/ })).toBeVisible()
  await expect.poll(() => viewport.evaluate(element => element.scrollTop)).toBe(2600)
  await expect.poll(() => byte.evaluate(element => element.getBoundingClientRect().top)).toBeCloseTo(target.top, 0)
  await expect(byte).toHaveClass(/hex-cursor/)
  // Keyboard selection inside the same object should preserve the viewport too.
  await viewport.focus()
  await viewport.press('ArrowDown')
  await viewport.press('Enter')
  await expect.poll(() => viewport.evaluate(element => element.scrollTop)).toBe(2600)
  // External object navigation should still reveal its original file range.
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { name: 'Document catalogue', exact: true }).click()
  await expect(page.getByRole('heading', { name: /1 0\s+obj/ })).toBeVisible()
  await expect.poll(() => viewport.evaluate(element => element.scrollTop)).toBeLessThan(2600)
})

test('keeps exploration paths and expands cyclic references without leaving the object', async ({ page }) => {
  await openMinimal(page)
  await page.getByRole('button', { name: 'First page', exact: true }).click()
  const inspector = page.getByRole('region', { name: 'Object inspector', exact: true })
  await inspector.getByText('Expand 2 0 inline', { exact: true }).click()
  await expect(inspector).toContainText('already in this path')
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible()
  await inspector.getByRole('button', { name: '4 0 R', exact: true }).first().click()
  const trail = page.getByRole('navigation', { name: 'Exploration trail' })
  await expect(trail).toContainText('Page 1')
  await expect(trail).toContainText('/Contents')
  await expect(trail).toContainText('4 0 obj')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(trail).not.toContainText('/Contents')
  await page.getByRole('button', { name: 'Forward', exact: true }).click()
  await expect(trail).toContainText('/Contents')
  await trail.getByRole('button', { name: 'Page 1', exact: true }).click()
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible()
})

test('bookmarks objects and byte ranges with notes and restores them for the same PDF', async ({ page }) => {
  await openMinimal(page)
  await page.getByRole('button', { name: 'First page', exact: true }).click()
  await page.getByRole('button', { name: 'Bookmark', exact: true }).click()
  const bookmarks = page.getByRole('region', { name: 'Bookmarks' })
  await bookmarks.getByRole('textbox', { name: 'Note for 3 0 obj · properties' }).fill('Check inherited fonts')
  await page.getByRole('button', { name: '4 0 R', exact: true }).first().click()
  await bookmarks.getByRole('button', { name: '3 0 obj · properties', exact: true }).click()
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible()
  await expect(bookmarks.getByRole('textbox')).toHaveValue('Check inherited fonts')
  await page.getByRole('textbox', { name: 'Go to offset', exact: true }).fill('0')
  await page.getByRole('button', { name: 'Jump to offset', exact: true }).click()
  await page.getByRole('button', { name: 'Offset 0, byte 25', exact: true }).click()
  await page.getByRole('button', { name: 'Bookmark', exact: true }).click()
  await page.getByRole('button', { name: '4 0 R', exact: true }).first().click()
  await bookmarks.getByRole('button', { name: /^Bytes 0x0/ }).click()
  await expect(page.locator('.hex-status')).toContainText('1 bytes selected')
  await upload(page, 'resources.pdf')
  await expect(bookmarks.getByRole('textbox')).toHaveCount(0)
  await page.reload()
  const data = await (await import('node:fs/promises')).readFile(samplePath('minimal.pdf'))
  await page.getByLabel('Open local PDF').setInputFiles({ name: 'renamed.pdf', mimeType: 'application/pdf', buffer: data })
  await expect(bookmarks.getByRole('textbox', { name: 'Note for 3 0 obj · properties' })).toHaveValue('Check inherited fonts')
  await bookmarks.getByRole('button', { name: /^Bytes 0x0/ }).click()
  await expect(page.locator('.hex-status')).toContainText('1 bytes selected')
  await bookmarks.getByRole('button', { name: 'Remove bookmark 3 0 obj · properties' }).click()
  await expect(bookmarks.getByRole('textbox')).toHaveCount(1)
  await page.reload()
  await upload(page, 'minimal.pdf')
  await expect(bookmarks.getByRole('textbox')).toHaveCount(1)
  // A different PDF with an identical filename must not inherit the bookmarks.
  const other = await (await import('node:fs/promises')).readFile(samplePath('resources.pdf'))
  await page.getByLabel('Open local PDF').setInputFiles({ name: 'minimal.pdf', mimeType: 'application/pdf', buffer: other })
  await expect(bookmarks.getByRole('textbox')).toHaveCount(0)
})

test('pins an object and compares typed dictionary differences', async ({ page }) => {
  await openMinimal(page)
  await page.getByRole('button', { name: 'First page', exact: true }).click()
  await page.getByRole('button', { name: 'Pin to compare', exact: true }).click()
  await page.getByRole('button', { name: '4 0 R', exact: true }).first().click()
  const comparison = page.getByRole('region', { name: 'Object comparison' })
  await expect(comparison).toContainText('3 0')
  await expect(comparison).toContainText('4 0')
  await expect(comparison).toContainText('removed')
  await expect(comparison).toContainText('added')
  const divider = page.getByRole('separator', { name: 'Resize comparison and inspector' })
  const initial = await comparison.boundingBox()
  await divider.focus()
  await page.keyboard.press('ArrowDown')
  await expect.poll(async () => (await comparison.boundingBox())!.height).toBeGreaterThan(initial!.height)
  const handle = (await divider.boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 + 60, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await comparison.boundingBox())!.height).toBeGreaterThan(initial!.height + 40)
  expect(await comparison.evaluate(el => el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY === 'auto')).toBe(true)
  await comparison.getByRole('checkbox', { name: 'Show differences only' }).check()
  await page.screenshot({ path: screenshotPath('object-comparison.png'), fullPage: true, animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(comparison).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: screenshotPath('comparison-mobile.png'), fullPage: true, animations: 'disabled' })
  await comparison.getByRole('button', { name: /Unpin/ }).click()
  await expect(comparison).toHaveCount(0)
})

test('explains decoded instructions and follows resources in their page context', async ({ page }) => {
  await openMinimal(page)
  await page.getByRole('button', { name: 'First page', exact: true }).click()
  await page.getByRole('button', { name: '4 0 R', exact: true }).first().click()
  await page.getByRole('tab', { name: 'Decoded', exact: true }).click()
  const decoded = page.getByRole('tabpanel', { name: 'Decoded', exact: true })
  await decoded.getByRole('button', { name: 'Readable instructions', exact: true }).click()
  await expect(decoded).toContainText('Select font /F1 at size 24')
  await page.screenshot({ path: screenshotPath('readable-instructions.png'), fullPage: true, animations: 'disabled' })
  await decoded.getByRole('button', { name: 'Decoded byte text', exact: true }).click()
  await expect(decoded.locator('pre')).toContainText('/F1 24 Tf')
  await decoded.getByRole('button', { name: 'Readable instructions', exact: true }).click()
  await decoded.getByRole('button', { name: 'Inspect /F1 resource', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: /5 0\s+obj/ })).toBeVisible()
})

test('browses font details, generates local image thumbnails and follows using pages', async ({ page }) => {
  const remote: string[] = []
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(page.url()).origin) remote.push(request.url())
  })
  await upload(page, 'resources.pdf')
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { name: 'Resources', exact: true }).click()
  const browser = page.getByRole('region', { name: 'Visual resource browser' })
  await expect(browser).toContainText('Helvetica')
  await expect(browser.getByRole('button', { name: 'Preview image 6 0', exact: true })).toHaveCount(0)
  const image = browser.getByRole('img', { name: 'Image object 6 0', exact: true })
  await expect(image).toBeVisible()
  expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
  await mkdir(resolve('.context'), { recursive: true })
  await page.screenshot({ path: screenshotPath('resource-browser.png'), fullPage: true, animations: 'disabled' })
  await browser.getByRole('button', { name: 'Page 1', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible()
  expect(remote).toEqual([])
})

test('uploads and replaces local PDFs while clearing stale navigation', async ({ page }) => {
  await upload(page, 'minimal.pdf')
  await page.getByRole('button', { name: 'First page', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeEnabled()
  await upload(page, 'resources.pdf')
  await expect(page.locator('.status-bar')).toContainText('10 objects indexed')
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeDisabled()
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Close PDF', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Look inside a PDF.' })).toBeVisible()
  await page.getByLabel('Open local PDF').setInputFiles({ name: 'empty.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) })
  await expect(page.getByRole('alert')).toContainText('This file is empty.')
  await upload(page, 'minimal.pdf')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('distinguishes compressed-object provenance and decodes filtered streams', async ({ page }) => {
  await upload(page, 'compressed.pdf')
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { name: 'Document catalogue', exact: true }).click()
  await expect(page.getByRole('heading', { name: /1 0\s+obj/ })).toBeVisible()
  await expect(page.locator('.provenance')).toContainText('Decoded object stream')
  await expect(page.locator('.provenance')).toContainText('6 0')
  await page.getByRole('tab', { name: 'Source', exact: true }).click()
  await expect(page.getByRole('tabpanel', { name: 'Source', exact: true })).toContainText('These are not original file bytes.')
  await upload(page, 'resources.pdf')
  await page.getByRole('button', { name: 'First page', exact: true }).click()
  await page.getByRole('button', { name: '4 0 R', exact: true }).first().click()
  await page.getByRole('tab', { name: 'Decoded', exact: true }).click()
  await expect(page.getByRole('tabpanel', { name: 'Decoded', exact: true })).toContainText('Resources and references')
  await expect(page.getByRole('tabpanel', { name: 'Decoded', exact: true })).toContainText('FlateDecode')
})

test('searches keys and original hex bytes with distinct navigation', async ({ page }) => {
  await openMinimal(page)
  const search = page.getByRole('textbox', { name: 'Search document', exact: true })
  const scope = page.getByRole('combobox', { name: 'Search scope', exact: true })
  await scope.selectOption('keys')
  await search.fill('Contents')
  await page.getByRole('button', { name: 'Run search', exact: true }).click()
  const results = page.getByRole('region', { name: 'Search results', exact: true })
  await expect(results).toContainText('1 match')
  await results.getByRole('button', { name: /3 0 obj/ }).click()
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible()
  await scope.selectOption('hex')
  await search.fill('25 50 44 46')
  await page.getByRole('button', { name: 'Run search', exact: true }).click()
  await expect(results).toContainText('1 match')
  await results.getByRole('button', { name: /0x0/ }).click()
  await expect(page.locator('.hex-status')).toContainText('4 bytes selected')
})

test('steps through search results, wraps, and resets for a new search', async ({ page }) => {
  await openMinimal(page)
  const search = page.getByRole('textbox', { name: 'Search document', exact: true })
  const results = page.getByRole('region', { name: 'Search results', exact: true })
  await search.fill('0')
  await search.press('Enter')
  const matches = results.locator('.search-matches button')
  const count = await matches.count()
  expect(count).toBeGreaterThan(1)
  await expect(results.getByRole('group')).toContainText(`1 of ${count}`)
  await expect(matches.first()).toHaveAttribute('aria-current', 'true')
  await results.getByRole('button', { name: 'Next search result', exact: true }).click()
  await expect(results.getByRole('group')).toContainText(`2 of ${count}`)
  await expect(matches.nth(1)).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('heading', { name: /2 0\s+obj/ })).toBeVisible()
  await matches.last().click()
  await results.getByRole('button', { name: 'Next search result', exact: true }).click()
  await expect(matches.first()).toHaveAttribute('aria-current', 'true')
  await results.getByRole('button', { name: 'Previous search result', exact: true }).click()
  await expect(matches.last()).toHaveAttribute('aria-current', 'true')
  await search.fill('no-such-object')
  await search.press('Enter')
  await expect(results.getByRole('group')).toContainText('0 of 0')
  await expect(results.getByRole('button', { name: 'Next search result', exact: true })).toBeDisabled()
  await page.getByRole('combobox', { name: 'Search scope', exact: true }).selectOption('text')
  await search.fill('obj')
  await search.press('Enter')
  await expect(results.getByRole('group')).toContainText('1 of 10')
  await expect(page.locator('.hex-status')).toContainText('3 bytes selected')
  await results.getByRole('button', { name: 'Next search result', exact: true }).click()
  await expect(results.getByRole('group')).toContainText('2 of 10')
  await expect(matches.nth(1)).toHaveAttribute('aria-current', 'true')
})

test('preserves intervening navigation when an asynchronous search finishes', async ({ page }) => {
  await page.addInitScript(() => {
    const postMessage = Worker.prototype.postMessage
    const pending: { worker: Worker; message: unknown }[] = []
    let released = false
    Worker.prototype.postMessage = function (message) {
      if (!released && message?.type === 'stream') pending.push({ worker: this, message })
      else postMessage.call(this, message, [])
    }
    window.addEventListener('release-search', () => {
      released = true
      for (const { worker, message } of pending) postMessage.call(worker, message, [])
    })
  })
  await page.reload()
  await openMinimal(page)
  await page.getByRole('combobox', { name: 'Search scope', exact: true }).selectOption('decoded')
  await page.getByRole('textbox', { name: 'Search document', exact: true }).fill('Hello')
  await page.getByRole('button', { name: 'Run search', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Search results', exact: true })).toContainText('Searching…')
  await page.getByRole('button', { name: 'First page', exact: true }).click()
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new Event('release-search')))
  await expect(page.getByRole('heading', { name: /4 0\s+obj/ })).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible()
})

test('keeps the mobile header compact with a long filename and search results', async ({ page }) => {
  for (const width of [320, 390, 600]) {
    await page.setViewportSize({ width, height: 844 })
    await page.getByLabel('Open local PDF').setInputFiles({
      name: 'a-very-long-document-filename-for-mobile-layout-testing.pdf',
      mimeType: 'application/pdf',
      buffer: await readFile(samplePath('minimal.pdf')),
    })
    await expect(page.locator('.status-bar')).toContainText('objects indexed')
    const header = page.locator('.app-header')
    const identity = await header.locator('.app-identity').boundingBox()
    const actions = await header.locator('.header-actions').boundingBox()
    expect(Math.abs(identity!.y - actions!.y)).toBeLessThan(10)
    const filename = await header.locator('.filename').boundingBox()
    expect(Math.abs(filename!.y + filename!.height / 2 - actions!.y - actions!.height / 2)).toBeLessThan(2)
    expect(filename!.x).toBeGreaterThanOrEqual(identity!.x + identity!.width)
    expect(filename!.x + filename!.width).toBeLessThanOrEqual(actions!.x)
    expect((await header.boundingBox())!.height).toBe(58)
    if (width <= 390) expect(await header.locator('.filename > span[title]').evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
    await expect(header.getByRole('button', { name: 'Close PDF', exact: true })).toBeVisible()
    await expect(header.locator('.header-action-label').first()).toBeHidden()
    await page.getByRole('textbox', { name: 'Search document', exact: true }).fill('0')
    await page.getByRole('button', { name: 'Run search', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Next search result', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await expect(page.locator('.mobile-workspace')).toBeVisible()
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: screenshotPath('mobile-search.png'), animations: 'disabled' })
})

test('restores sections and exact byte selections through history', async ({ page }) => {
  await openMinimal(page)
  const back = page.getByRole('button', { name: 'Back', exact: true })
  const forward = page.getByRole('button', { name: 'Forward', exact: true })
  const sections = page.getByRole('navigation', { name: 'Document sections' })
  await sections.getByRole('button', { name: 'File structure', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Cross-reference entry point' })).toBeVisible()
  await page.getByRole('button', { name: /startxref →/ }).click()
  const xrefSelection = await page.locator('.hex-status').innerText()
  expect(xrefSelection).toContain('32 bytes selected')

  await sections.getByRole('button', { name: 'Document catalogue', exact: true }).click()
  await expect(page.getByRole('heading', { name: /1 0\s+obj/ })).toBeVisible()
  await back.click()
  await expect(page.getByRole('heading', { name: 'Cross-reference entry point' })).toBeVisible()
  await expect(page.locator('.hex-status')).toHaveText(xrefSelection)
  await back.click()
  await expect(page.locator('.hex-status')).toContainText('offsets are zero-based')
  await back.click()
  await expect(page.getByRole('heading', { name: 'Document overview' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cross-reference entry point' })).toHaveCount(0)
  await forward.click()
  await expect(page.getByRole('heading', { name: 'Cross-reference entry point' })).toBeVisible()
  await forward.click()
  await expect(page.locator('.hex-status')).toHaveText(xrefSelection)

  // A new visit from the middle replaces the abandoned forward branch.
  await sections.getByRole('button', { name: 'Overview', exact: true }).click()
  await expect(forward).toBeDisabled()
})

test('restores byte-search results and unknown-byte selections', async ({ page }) => {
  await openMinimal(page)
  await page.getByRole('button', { name: 'First page', exact: true }).click()
  const back = page.getByRole('button', { name: 'Back', exact: true })
  const forward = page.getByRole('button', { name: 'Forward', exact: true })
  await page.getByRole('combobox', { name: 'Search scope', exact: true }).selectOption('hex')
  await page.getByRole('textbox', { name: 'Search document', exact: true }).fill('25 50 44 46')
  await page.getByRole('button', { name: 'Run search', exact: true }).click()
  await page.getByRole('region', { name: 'Search results', exact: true }).getByRole('button', { name: /0x0/ }).click()
  await expect(page.locator('.hex-status')).toContainText('4 bytes selected')
  await back.click()
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible()
  await expect(page.locator('.hex-status')).not.toContainText('4 bytes selected')
  await forward.click()
  await expect(page.locator('.hex-status')).toContainText('4 bytes selected')
  await page.getByRole('button', { name: 'Offset 0, byte 25', exact: true }).click()
  await expect(page.locator('.hex-status')).toContainText('1 bytes selected')
  await expect(page.getByRole('status').filter({ hasText: 'no known containing object' })).toBeVisible()
  await back.click()
  await expect(page.locator('.hex-status')).toContainText('4 bytes selected')
  await expect(page.getByRole('status').filter({ hasText: 'no known containing object' })).toHaveCount(0)
  await forward.click()
  await expect(page.getByRole('status').filter({ hasText: 'no known containing object' })).toBeVisible()
})

test('restores inspector tabs and byte viewports per history visit', async ({ page }) => {
  const stream = 'q Q\n'.repeat(2000)
  const fixture = classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [3, '<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>'],
    [4, `<< /Length ${stream.length} >>\nstream\n${stream}endstream`],
  ])
  await page.getByLabel('Open local PDF').setInputFiles({ name: 'scroll.pdf', mimeType: 'application/pdf', buffer: Buffer.from(fixture.bytes) })
  await page.getByRole('button', { name: 'First page', exact: true }).click()
  await page.getByRole('button', { name: '4 0 R', exact: true }).first().click()
  const back = page.getByRole('button', { name: 'Back', exact: true })
  const forward = page.getByRole('button', { name: 'Forward', exact: true })
  const hex = page.locator('.hex-viewport')
  const source = page.getByRole('tabpanel', { name: 'Source', exact: true })
  await page.getByRole('tab', { name: 'Source', exact: true }).click()
  await expect(source).toContainText('endstream')
  await source.evaluate(el => { el.scrollTop = 1200 })
  await hex.evaluate(el => { el.scrollTop = 2600 })
  await expect.poll(() => source.evaluate(el => el.scrollTop)).toBe(1200)
  await page.getByRole('tab', { name: 'Raw stream', exact: true }).click()
  const raw = page.getByRole('tabpanel', { name: 'Raw stream', exact: true })
  await expect(raw).toContainText('q Q')
  await expect.poll(() => raw.evaluate(el => el.scrollTop)).toBe(0)
  await raw.evaluate(el => { el.scrollTop = 1800 })
  await hex.evaluate(el => { el.scrollTop = 5200 })
  await back.click()
  await expect(source).toBeVisible()
  await expect.poll(() => source.evaluate(el => el.scrollTop)).toBe(1200)
  await expect.poll(() => hex.evaluate(el => el.scrollTop)).toBe(2600)
  await forward.click()
  await expect(raw).toContainText('q Q')
  await expect.poll(() => raw.evaluate(el => el.scrollTop)).toBe(1800)
  await expect.poll(() => hex.evaluate(el => el.scrollTop)).toBe(5200)

  // Decoded content arrives asynchronously too; switching away unmounts it.
  await page.getByRole('tab', { name: 'Decoded', exact: true }).click()
  const decoded = page.getByRole('tabpanel', { name: 'Decoded', exact: true })
  await expect(decoded).toContainText('Decoded stream bytes')
  await expect(decoded.getByRole('button', { name: 'Decoded byte text', exact: true })).toBeVisible()
  await decoded.getByRole('button', { name: 'Decoded byte text', exact: true }).click()
  await decoded.evaluate(el => { el.scrollTop = 1100 })
  await back.click()
  await expect.poll(() => raw.evaluate(el => el.scrollTop)).toBe(1800)
  await forward.click()
  await expect.poll(() => decoded.evaluate(el => el.scrollTop)).toBe(1100)
  await back.click()

  // A second visit to the same tab starts at the top and replaces Forward.
  await back.click()
  await page.getByRole('tab', { name: 'Raw stream', exact: true }).click()
  await expect(raw).toContainText('q Q')
  await expect.poll(() => raw.evaluate(el => el.scrollTop)).toBe(0)
  await expect(forward).toBeDisabled()

  // Mobile pane unmounts retain the current visit, including async streams.
  await raw.evaluate(el => { el.scrollTop = 900 })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(raw).toContainText('q Q')
  await expect.poll(() => raw.evaluate(el => el.scrollTop)).toBe(900)
  const panes = page.getByRole('navigation', { name: 'Workspace pane' })
  await panes.getByRole('button', { name: 'Original bytes', exact: true }).click()
  await hex.evaluate(el => { el.scrollTop = 3900 })
  await panes.getByRole('button', { name: 'Inspector', exact: true }).click()
  await expect(raw).toContainText('q Q')
  await expect.poll(() => raw.evaluate(el => el.scrollTop)).toBe(900)
  await panes.getByRole('button', { name: 'Original bytes', exact: true }).click()
  await expect.poll(() => hex.evaluate(el => el.scrollTop)).toBe(3900)

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: 'Close PDF', exact: true }).click()
  await openMinimal(page)
  await expect.poll(() => hex.evaluate(el => el.scrollTop)).toBe(0)
  await expect(back).toBeDisabled()
})

test('restores the resource browser scroll and expanded list after inspecting an object', async ({ page }) => {
  const fonts = Array.from({ length: 70 }, (_, index) => [index + 4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'])
  const fixture = classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [3, '<< /Type /Page /Parent 2 0 R >>'],
    ...fonts,
  ])
  await page.getByLabel('Open local PDF').setInputFiles({ name: 'fonts.pdf', mimeType: 'application/pdf', buffer: Buffer.from(fixture.bytes) })
  await expect(page.locator('.status-bar')).toContainText('73 objects indexed')
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { name: 'Resources', exact: true }).click()
  const browser = page.getByRole('region', { name: 'Visual resource browser' })
  await browser.getByRole('button', { name: /Show.*more/i }).click()
  const target = browser.getByRole('button', { name: '73 0 obj', exact: true })
  await target.scrollIntoViewIfNeeded()
  const top = await browser.evaluate(el => el.scrollTop)
  expect(top).toBeGreaterThan(1200)
  await target.click()
  await expect(page.getByRole('heading', { name: /73 0\s+obj/ })).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(target).toBeVisible()
  await expect.poll(() => browser.evaluate(el => el.scrollTop)).toBe(top)
})

test('keeps smaller object lists visible when history changes sections', async ({ page }) => {
  const fixture = classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>'],
    ...Array.from({ length: 200 }, (_, index) => [index + 4, 'null']),
  ])
  await page.getByLabel('Open local PDF').setInputFiles({
    name: 'many-objects.pdf', mimeType: 'application/pdf', buffer: Buffer.from(fixture.bytes),
  })
  await expect(page.locator('.status-bar')).toContainText('203 objects indexed')
  const sections = page.getByRole('navigation', { name: 'Document sections' })
  await sections.getByRole('button', { name: /^Pages/ }).click()
  await expect(page.getByRole('navigation', { name: 'Page relationships' }).getByRole('button', { name: 'Page 1 3 0 obj', exact: true })).toBeVisible()
  await sections.getByRole('button', { name: 'All objects', exact: true }).click()
  await page.locator('.object-list').evaluate(element => { element.scrollTop = 3000 })
  await expect(page.locator('.object-row').first()).not.toContainText('1 0')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Page relationships' }).getByRole('button', { name: 'Page 1 3 0 obj', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Page relationships' })).toContainText('3 0 obj')
  await page.getByRole('button', { name: 'Forward', exact: true }).click()
  await expect(page.locator('.object-row').first()).toContainText('1 0')
})

test('renders a local EmbedPDF preview without external requests or runtime errors', async ({ page }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  const externalRequests: string[] = []
  const writes: string[] = []
  const appOrigin = new URL(page.url()).origin
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    if (!request.url().startsWith(`${appOrigin}/`) && !/^(?:blob:|data:)/.test(request.url())) externalRequests.push(request.url())
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(`${request.method()} ${request.url()}`)
  })
  await upload(page, 'minimal.pdf')
  await page.getByRole('button', { name: 'Page preview', exact: true }).click()
  const image = page.getByRole('img', { name: 'minimal.pdf, page 1', exact: true })
  await expect(image).toBeVisible({ timeout: 60_000 })
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true)
  await expect(page.getByRole('button', { name: 'Previous preview page', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Next preview page', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Zoom in preview', exact: true }).click()
  await expect(page.getByText('125%', { exact: true })).toBeVisible()
  await expect(image).toBeVisible()
  await page.getByRole('button', { name: 'Inspect', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Document overview' })).toBeVisible()
  expect(errors).toEqual([])
  expect(externalRequests).toEqual([])
  expect(writes).toEqual([])
})

test('uses pane navigation at mobile widths without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openMinimal(page)
  const panes = page.getByRole('navigation', { name: 'Workspace pane', exact: true })
  await expect(panes).toBeVisible()
  await page.getByRole('button', { name: 'First page', exact: true }).click()
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible()
  await panes.getByRole('button', { name: 'Original bytes', exact: true }).click()
  await expect(page.getByRole('region', { name: /^Hexadecimal bytes/ })).toBeVisible()
  await expect(page.locator('.hex-byte.hex-selected').first()).toBeVisible()
  await panes.getByRole('button', { name: 'Explorer', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Structure explorer', exact: true })).toBeVisible()
  await panes.getByRole('button', { name: 'Inspector', exact: true }).click()
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: screenshotPath('mobile.png'), fullPage: true, animations: 'disabled' })
})

test('keeps limitations accessible before opening a file and throughout the workspace', async ({ page }) => {
  const dialog = page.getByRole('dialog', { name: 'About & limitations', exact: true })
  const footerLink = page.getByRole('button', { name: 'About & limitations', exact: true })
  await expect(dialog).not.toBeVisible()
  await page.getByRole('button', { name: 'Early version · View limitations', exact: true }).click()
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Files that open without a password unlock automatically')
  await expect(dialog).toContainText('Decoded search only checks that preview')
  await expect(dialog).toContainText('64 MiB')
  await expect(dialog).toContainText('128 MiB')
  await expect(dialog).toContainText('15 seconds')
  await expect(dialog).toContainText('The app does not upload or save it.')
  await mkdir(resolve('.context'), { recursive: true })
  await page.screenshot({ path: screenshotPath('limitations-desktop.png'), animations: 'disabled' })
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Early version · View limitations', exact: true })).toBeFocused()
  await openMinimal(page)
  await footerLink.click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Close', exact: true }).last().click()
  await expect(footerLink).toBeFocused()
  await expect(page.locator('.status-bar')).toContainText('5 objects indexed')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(footerLink).toBeVisible()
  await footerLink.click()
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.y).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844)
  const content = dialog.getByLabel('Limitations details')
  await content.focus()
  await content.evaluate(element => { element.scrollTop = element.scrollHeight })
  await expect(dialog.getByText('Your PDF is processed on this device.', { exact: false })).toBeInViewport()
  await page.screenshot({ path: screenshotPath('limitations-mobile.png'), animations: 'disabled' })
  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).toHaveCount(1)
  expect(await page.locator(':focus').evaluate(element => !!element.closest('[role="dialog"]'))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(footerLink).toBeFocused()
})


test('explores a page tree with inherited resources, explanations and labelled connections', async ({ page }) => {
  await openMinimal(page)
  const sections = page.getByRole('navigation', { name: 'Document sections' })
  await sections.getByRole('button', { name: /^Pages/ }).click()
  const tree = page.getByRole('navigation', { name: 'Page relationships' })
  const expand = tree.getByRole('button', { name: 'Expand Page 1 3 0', exact: true })
  await expand.focus()
  await page.keyboard.press('Enter')
  await expect(tree).toContainText('/Resources (inherited)')
  await tree.getByRole('button', { name: 'Content streams · /Contents 4 0 obj', exact: true }).click()
  await expect(page.locator('.object-explanation')).toContainText('content stream referenced by Page 1')
  await expect(page.locator('.relationship-links').last()).toContainText('via /Contents')
  await expect(page.getByRole('navigation', { name: 'Exploration trail' })).toContainText('/Contents')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(tree.getByRole('button', { name: 'Collapse Page 1 3 0', exact: true })).toBeVisible()
  await tree.getByRole('button', { name: 'Expand Resources · /Resources (inherited)', exact: true }).click()
  await tree.getByRole('button', { name: 'Expand Fonts · /Font', exact: true }).click()
  await tree.getByRole('button', { name: '/F1 5 0 obj', exact: true }).click()
  await expect(page.locator('.object-explanation')).toContainText('font dictionary for Helvetica')
  await expect(page.locator('.relationship-links').last()).toContainText('via /Resources → /Font → /F1')
  await expect(page.getByRole('navigation', { name: 'Exploration trail' })).toContainText('Inherited from 2 0 obj')
  await page.screenshot({ path: screenshotPath('page-tree-desktop.png'), fullPage: true, animations: 'disabled' })
  // Reverse links select the actual owning object, without inventing a forward path.
  await page.locator('.relationship-link').filter({ hasText: 'via /Resources' }).click()
  await expect(page.getByRole('heading', { name: /2 0\s+obj/ })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Exploration trail' })).not.toContainText('/F1')
  await sections.getByRole('button', { name: 'All objects', exact: true }).click()
  await sections.getByRole('button', { name: /^Pages/ }).click()
  await expect(tree.getByRole('button', { name: '/F1 5 0 obj', exact: true })).toBeVisible()
  // Lifted expansion state survives mobile pane unmounts.
  await page.setViewportSize({ width: 390, height: 844 })
  const panes = page.getByRole('navigation', { name: 'Workspace pane' })
  await panes.getByRole('button', { name: 'Explorer', exact: true }).click()
  await tree.getByRole('button', { name: '/F1 5 0 obj', exact: true }).click()
  await expect(page.locator('.object-explanation')).toContainText('font dictionary')
  await panes.getByRole('button', { name: 'Explorer', exact: true }).click()
  await expect(tree.getByRole('button', { name: '/F1 5 0 obj', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: screenshotPath('page-tree-mobile.png'), fullPage: true, animations: 'disabled' })
  await panes.getByRole('button', { name: 'Inspector', exact: true }).click()
  await upload(page, 'resources.pdf')
  await panes.getByRole('button', { name: 'Explorer', exact: true }).click()
  await sections.getByRole('button', { name: /^Pages/ }).click()
  await expect(tree.getByRole('button', { name: 'Expand Page 1 3 0', exact: true })).toBeVisible()
})

test('labels cyclic, shared and unavailable page connections', async ({ page }) => {
  const fixture = classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>'],
    [3, '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /Annots [99 0 R] >>'],
    [4, '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> >>'],
    [5, '<< /Type /Font /BaseFont /Example /Self 5 0 R >>'],
  ])
  await page.getByLabel('Open local PDF').setInputFiles({ name: 'graph.pdf', mimeType: 'application/pdf', buffer: Buffer.from(fixture.bytes) })
  await expect(page.locator('.status-bar')).toContainText('5 objects indexed')
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { name: /^Pages/ }).click()
  const tree = page.getByRole('navigation', { name: 'Page relationships' })
  await tree.getByRole('button', { name: 'Expand Page 1 3 0', exact: true }).click()
  await tree.getByRole('button', { name: 'Expand Resources · /Resources', exact: true }).click()
  await tree.getByRole('button', { name: 'Expand Fonts · /Font', exact: true }).click()
  await expect(tree).toContainText('Shared reference')
  await tree.getByRole('button', { name: 'Expand /F1 5 0', exact: true }).click()
  await expect(tree).toContainText('Already in this path')
  await expect(tree.getByRole('button', { name: 'Expand /Self 5 0', exact: true })).toHaveCount(0)
  await tree.getByRole('button', { name: 'Expand Annotations · /Annots', exact: true }).click()
  await expect(tree).toContainText('99 0 R')
  await expect(tree).toContainText('Unavailable reference')
})

test('pages large trees and preserves later-page expansion through navigation', async ({ page }) => {
  const ids = Array.from({ length: 52 }, (_, index) => index + 3)
  const fixture = classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, `<< /Type /Pages /Kids [${ids.map(id => `${id} 0 R`).join(' ')}] /Count 52 >>`],
    ...ids.map(id => [id, '<< /Type /Page /Parent 2 0 R /Annots [55 0 R] >>']),
    [55, '<< /Subtype /Text /Contents (A note) >>'],
  ])
  await page.getByLabel('Open local PDF').setInputFiles({ name: 'pages.pdf', mimeType: 'application/pdf', buffer: Buffer.from(fixture.bytes) })
  await expect(page.locator('.status-bar')).toContainText('55 objects indexed')
  const sections = page.getByRole('navigation', { name: 'Document sections' })
  await sections.getByRole('button', { name: /^Pages/ }).click()
  const tree = page.getByRole('navigation', { name: 'Page relationships' })
  await expect(tree.getByRole('button', { name: 'Page 52 54 0 obj', exact: true })).toHaveCount(0)
  await tree.getByRole('button', { name: 'Show 2 more pages', exact: true }).click()
  await tree.getByRole('button', { name: 'Expand Page 52 54 0', exact: true }).click()
  await tree.getByRole('button', { name: 'Page 52 54 0 obj', exact: true }).click()
  await expect(page.locator('.object-explanation')).toContainText('Page 52 of 52')
  await sections.getByRole('button', { name: 'All objects', exact: true }).click()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(tree.getByRole('button', { name: 'Collapse Page 52 54 0', exact: true })).toBeVisible()
})


test('unlocks a password PDF after an incorrect attempt, previews it, and clears the password on replacement', async ({ page }) => {
  await page.getByLabel('Open local PDF').setInputFiles(resolve('tests/fixtures/encryption/AES-256-password.pdf'))
  const password = page.getByLabel('PDF password', { exact: true })
  await password.fill('wrong')
  await password.press('Enter')
  await expect(page.getByRole('alert')).toContainText('That password did not unlock')
  await password.fill('secret')
  await page.screenshot({ path: screenshotPath('encrypted-password.png'), fullPage: true })
  await password.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Encrypted PDF unlocked locally' })).toBeVisible()
  await expect(password).toHaveCount(0)
  await page.getByRole('button', { name: 'First page', exact: true }).click()
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await expect(page.getByRole('img', { name: /AES-256-password.pdf, page 1/ })).toBeVisible()
  await page.screenshot({ path: screenshotPath('encrypted-unlocked-preview.png'), fullPage: true })
  await page.getByLabel('Open local PDF').setInputFiles(resolve('tests/fixtures/encryption/AES-256-password.pdf'))
  await expect(password).toHaveValue('')
  await expect(page.getByRole('button', { name: 'First page', exact: true })).toBeDisabled()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: screenshotPath('encrypted-password-mobile.png'), fullPage: true })
})

test('automatically inspects encrypted PDFs with an empty opening password', async ({ page }) => {
  await page.getByLabel('Open local PDF').setInputFiles(resolve('tests/fixtures/encryption/AES-128-empty.pdf'))
  await expect(page.getByRole('status').filter({ hasText: 'Encrypted PDF unlocked locally' })).toBeVisible()
  await expect(page.getByLabel('PDF password', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'First page', exact: true })).toBeEnabled()
})

test('navigates About with browser history and retains the local document', async ({ page }) => {
  const projectLinks = page.getByRole('navigation', { name: 'Project', exact: true })
  await expect(projectLinks.getByRole('link', { name: 'Feedback', exact: true })).toHaveAttribute('href', 'https://github.com/antonsamper/pdf-internals-viewer/issues')
  await projectLinks.getByRole('link', { name: 'About', exact: true }).click()
  await expect(page).toHaveURL(/\/about$/)
  await expect(page).toHaveTitle('About · PDF Internals')
  await expect(page.getByRole('heading', { name: 'A closer look at PDF.' })).toBeVisible()
  await expect(page.getByRole('main')).toBeFocused()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Your files stay with you' })).toBeVisible()
  await page.getByRole('button', { name: 'Read the limitations and credits' }).click()
  await expect(page.getByRole('dialog', { name: 'About & limitations' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Back to the workspace' }).click()
  await openMinimal(page)
  await page.getByRole('button', { name: 'First page', exact: true }).click()
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'A closer look at PDF.' })).toBeVisible()
  await page.goForward()
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible()
  await expect(page.locator('.filename')).toContainText('minimal.pdf')
  await expect(page.locator('.status-bar')).toContainText('5 objects indexed')
  await page.goBack()
  await page.getByLabel('Open local PDF').setInputFiles(samplePath('resources.pdf'))
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Document overview' })).toBeVisible()
  await expect(page.locator('.filename')).toContainText('resources.pdf')
})


test('opens task guides and returns to the selected PDF object', async ({ page }) => {
  await openMinimal(page)
  await page.getByRole('button', { name: 'First page', exact: true }).click()
  await page.getByRole('link', { name: 'User guide', exact: true }).click()
  await expect(page).toHaveURL(/\/guide$/)
  await expect(page.getByRole('main')).toBeFocused()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('link', { name: 'Investigate suspicious features', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Investigate suspicious PDF features')
  await expect(page.getByRole('main')).toContainText('An empty search does not establish safety')
  await page.goBack()
  await expect(page).toHaveURL(/\/guide$/)
  await page.goForward()
  await expect(page).toHaveURL(/\/guides\/investigate-suspicious-features$/)
  await page.getByRole('link', { name: 'Back to the workspace', exact: true }).click()
  await expect(page.locator('.filename')).toContainText('minimal.pdf')
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible()
})


test('keeps bookmarks usable when browser storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked') } })
  })
  await page.reload()
  await openMinimal(page)
  await page.getByRole('button', { name: 'First page', exact: true }).click()
  await page.getByRole('button', { name: 'Bookmark', exact: true }).click()
  const bookmarks = page.getByRole('region', { name: 'Bookmarks' })
  await expect(bookmarks).toContainText('Browser storage unavailable')
  await bookmarks.getByRole('textbox').fill('Temporary note')
  await expect(bookmarks.getByRole('textbox')).toHaveValue('Temporary note')
})


test('synchronizes bookmarks and notes across tabs without overwriting additions', async ({ browserName, page, context }) => {
  await openMinimal(page)
  await page.getByRole('button', { name: 'First page', exact: true }).click()
  const other = await context.newPage()
  await other.goto('/')
  await openMinimal(other)
  await other.getByRole('button', { name: 'First page', exact: true }).click()
  const first = page.getByRole('region', { name: 'Bookmarks' })
  const second = other.getByRole('region', { name: 'Bookmarks' })
  const addFirst = () => page.getByRole('button', { name: 'Bookmark', exact: true }).click()
  const addSecond = () => other.getByRole('button', { name: 'Bookmark', exact: true }).click()
  if (browserName === 'webkit') {
    // WebKit propagates localStorage writes to other tab processes asynchronously, so a Web Lock
    // alone cannot guarantee a fresh snapshot for near-simultaneous additions. Wait until the
    // other tab has received the first addition before adding the second.
    await addFirst()
    await expect(second.getByRole('textbox')).toHaveCount(1)
    await addSecond()
  } else {
    await Promise.all([addFirst(), addSecond()])
  }
  await expect(first.getByRole('textbox')).toHaveCount(2)
  await expect(second.getByRole('textbox')).toHaveCount(2)
  await first.getByRole('textbox').first().fill('Shared finding')
  await expect(second.getByRole('textbox').first()).toHaveValue('Shared finding')
  await second.getByRole('textbox').last().fill('Second finding')
  await expect(first.getByRole('textbox').last()).toHaveValue('Second finding')
  await other.reload()
  await upload(other, 'minimal.pdf')
  await expect(second.getByRole('textbox').first()).toHaveValue('Shared finding')
  await expect(second.getByRole('textbox').last()).toHaveValue('Second finding')
  await second.getByRole('button', { name: /^Remove bookmark/ }).first().click()
  await expect(first.getByRole('textbox')).toHaveCount(1)
  await other.close()
})


test('downloads complete attachments and embedded subset fonts', async ({ page }) => {
  const fixture = embeddedFilesPdf()
  await page.getByLabel('Open local PDF').setInputFiles({ name: 'embedded.pdf', mimeType: 'application/pdf', buffer: Buffer.from(fixture.bytes) })
  await expect(page.getByRole('heading', { name: 'Document overview', exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { name: 'Document catalogue', exact: true }).click()
  await page.getByRole('button', { name: '5 0 R', exact: true }).first().click()
  await page.getByRole('button', { name: '6 0 R', exact: true }).first().click()
  const [attachment] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download attachment', exact: true }).click(),
  ])
  expect(attachment.suggestedFilename()).toBe('report.txt')
  await expect(page.getByRole('region', { name: 'Embedded file downloads' })).toContainText('Download: 293.0 KiB')
  const attachmentStream = await attachment.createReadStream()
  const attachmentChunks: Buffer[] = []
  for await (const chunk of attachmentStream!) attachmentChunks.push(Buffer.from(chunk))
  expect(Buffer.concat(attachmentChunks)).toEqual(fixture.attachment)
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { name: 'Resources', exact: true }).click()
  await page.getByRole('button', { name: '8 0 obj', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Embedded file downloads' })).toContainText('Fonts may be partial')
  await expect(page.getByRole('region', { name: 'Embedded file downloads' })).toContainText('subset indicated')
  const [font] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download font', exact: true }).click(),
  ])
  expect(font.suggestedFilename()).toBe('ABCDEF+Example.ttf')
  await expect(page.getByRole('region', { name: 'Embedded file downloads' })).toContainText('Download: 8 B')
  const fontStream = await font.createReadStream()
  const fontChunks: Buffer[] = []
  for await (const chunk of fontStream!) fontChunks.push(Buffer.from(chunk))
  expect(Buffer.concat(fontChunks)).toEqual(fixture.font)
  await page.screenshot({ path: screenshotPath('font-download.png'), fullPage: true, animations: 'disabled' })
})


test('finds attachments and fonts through resource categories with direct downloads', async ({ page }) => {
  const fixture = embeddedFilesPdf()
  await page.getByLabel('Open local PDF').setInputFiles({ name: 'embedded.pdf', mimeType: 'application/pdf', buffer: Buffer.from(fixture.bytes) })
  await expect(page.getByRole('heading', { name: 'Document overview', exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { name: 'Resources', exact: true }).click()
  const resources = page.getByRole('region', { name: 'Visual resource browser' })
  await resources.getByRole('button', { name: /^Attachments 1$/ }).click()
  await expect(resources.getByRole('article')).toHaveCount(1)
  await expect(resources.getByRole('article')).toContainText('report.txt')
  await resources.getByLabel('Filter resources').fill('report.txt')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    resources.getByRole('button', { name: 'Download attachment', exact: true }).click(),
  ])
  expect(download.suggestedFilename()).toBe('report.txt')
  await page.screenshot({ path: screenshotPath('resource-attachments.png'), fullPage: true, animations: 'disabled' })
  await resources.getByRole('button', { name: '6 0 obj', exact: true }).click()
  await page.getByRole('button', { name: 'Browse resources', exact: true }).click()
  await expect(resources.getByRole('button', { name: /^Attachments 1$/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(resources.getByLabel('Filter resources')).toHaveValue('report.txt')
  await resources.getByRole('button', { name: 'Clear search', exact: true }).click()
  await resources.getByRole('button', { name: /^Fonts 2$/ }).click()
  await expect(resources.getByRole('article')).toHaveCount(2)
  await expect(resources.getByRole('button', { name: 'Download font', exact: true })).toHaveCount(2)
  await resources.getByLabel('Filter resources').fill('ABCDEF')
  await expect(resources.getByRole('article')).toHaveCount(2)
  const [font] = await Promise.all([
    page.waitForEvent('download'),
    resources.getByRole('button', { name: 'Download font', exact: true }).first().click(),
  ])
  expect(font.suggestedFilename()).toBe('ABCDEF+Example.ttf')
  await resources.getByRole('button', { name: /^Images 0$/ }).click()
  await expect(resources).toContainText('No resources match this filter.')
  await resources.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await expect(resources.getByRole('article')).toHaveCount(3)
  await page.getByRole('button', { name: 'Close PDF', exact: true }).click()
  await openMinimal(page)
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { name: 'Resources', exact: true }).click()
  await expect(resources.getByLabel('Filter resources')).toHaveValue('')
  await expect(resources.getByRole('button', { name: /^All 1$/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(resources).toContainText('No embedded font file available to download.')
})


test('downloads full-size PNG images from Resources and the object inspector', async ({ page }) => {
  await page.getByLabel('Open local PDF').setInputFiles({ name: 'images.pdf', mimeType: 'application/pdf', buffer: Buffer.from(imageExportPdf().bytes) })
  await expect(page.getByRole('heading', { name: 'Document overview', exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { name: 'Resources', exact: true }).click()
  const resources = page.getByRole('region', { name: 'Visual resource browser' })
  await resources.getByRole('button', { name: /^Images 1$/ }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    resources.getByRole('button', { name: 'Download image', exact: true }).click(),
  ])
  expect(download.suggestedFilename()).toBe('image-6-0.png')
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  const png = Buffer.concat(chunks)
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  const exported = await page.evaluate(async base64 => {
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0))
    const image = await createImageBitmap(new Blob([bytes], {type: 'image/png'}))
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const result = {width: image.width, height: image.height, pixel: [...context.getImageData(image.width - 1, image.height - 1, 1, 1).data]}
    image.close()
    return result
  }, png.toString('base64'))
  expect(exported).toEqual({width: 400, height: 300, pixel: [32, 117, 214, 255]})
  await expect(resources.getByRole('img', {name: 'Image object 6 0', exact: true})).toBeVisible()
  await expect(resources.locator('.image-file-size')).toHaveAttribute('title', `${png.length.toLocaleString()} bytes`)
  await expect(resources.locator('.image-file-size')).toContainText('In PDF:')
  await page.screenshot({path: screenshotPath('image-download.png'), fullPage: true, animations: 'disabled'})
  await resources.getByRole('button', {name: '6 0 obj', exact: true}).click()
  const [inspectorDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download image', exact: true }).click(),
  ])
  expect(inspectorDownload.suggestedFilename()).toBe('image-6-0.png')
})

test('extracts embedded JPEG bytes unchanged and explains unsupported image export', async ({ page }) => {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 2
    const context = canvas.getContext('2d')!
    context.fillStyle = '#e97820'
    context.fillRect(0, 0, 2, 2)
    return canvas.toDataURL('image/jpeg').split(',')[1]
  })
  const jpeg = Buffer.from(base64, 'base64')
  const fixture = imageExportPdf({data: jpeg, filter: 'DCTDecode', width: 2, height: 2})
  await page.getByLabel('Open local PDF').setInputFiles({name:'jpeg.pdf', mimeType:'application/pdf', buffer:Buffer.from(fixture.bytes)})
  await expect(page.getByRole('heading', { name: 'Document overview', exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { name: 'Resources', exact: true }).click()
  const resources = page.getByRole('region', { name: 'Visual resource browser' })
  await resources.getByRole('button', { name: /^Images 1$/ }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    resources.getByRole('button', { name: 'Download image', exact: true }).click(),
  ])
  expect(download.suggestedFilename()).toBe('image-6-0.jpg')
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  expect(Buffer.concat(chunks)).toEqual(jpeg)
  await expect(resources.getByRole('img', {name: 'Image object 6 0', exact: true})).toBeVisible()
  await expect(resources.locator('.image-file-size')).toHaveAttribute('title', `${jpeg.length.toLocaleString()} bytes`)
  await page.getByLabel('Open local PDF').setInputFiles({name:'masked.pdf', mimeType:'application/pdf', buffer:Buffer.from(imageExportPdf({extra: '/SMask 5 0 R'}).bytes)})
  await expect(page.getByRole('heading', { name: 'Document overview', exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { name: 'Resources', exact: true }).click()
  await expect(resources.getByRole('button', {name:'Download image', exact:true})).toBeDisabled()
  await expect(resources).toContainText('Image export unavailable: custom decoding or image masks')
  await expect(resources).toContainText('Preview unavailable: custom decoding or image masks')
  await expect(resources.getByRole('img', {name: 'Image object 6 0', exact: true})).toHaveCount(0)
})


test('lists and downloads inline attachment file specifications', async ({ page }) => {
  const fixture = classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles << /Names [(inline.txt) << /Type /Filespec /F (inline.txt) /EF << /F 4 0 R >> >>] >> >> >>'],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> >>'],
    [4, '<< /Length 3 >>\nstream\nabc\nendstream'],
  ])
  await page.getByLabel('Open local PDF').setInputFiles({name: 'inline-attachment.pdf', mimeType: 'application/pdf', buffer: Buffer.from(fixture.bytes)})
  await expect(page.getByRole('heading', {name: 'Document overview', exact: true})).toBeVisible()
  await page.getByRole('navigation', {name: 'Document sections'}).getByRole('button', {name: 'Resources', exact: true}).click()
  const resources = page.getByRole('region', {name: 'Visual resource browser'})
  await resources.getByRole('button', {name: /^Attachments 1$/}).click()
  await expect(resources.getByRole('article')).toHaveCount(1)
  await expect(resources.getByRole('article')).toContainText('inline.txt')
  await expect(resources.getByRole('article')).toContainText('Download: 3 B')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    resources.getByRole('button', {name: 'Download attachment', exact: true}).click(),
  ])
  expect(download.suggestedFilename()).toBe('inline.txt')
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  expect(Buffer.concat(chunks).toString()).toBe('abc')
})

test('serves public answers without JavaScript and keeps articles free of inspector requests', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL })
  const reader = await context.newPage()
  for (const [path, heading] of [
    ['/guide', 'How to inspect a PDF in your browser'],
    ['/guides/inspect-pdf-objects', 'PDF objects and references: what does 3 0 R mean?'],
    ['/guides/decode-pdf-streams', 'How to inspect and decode PDF streams'],
    ['/guides/find-pdf-fonts-images', 'How to find fonts and images in a PDF'],
    ['/guides/find-pdf-attachments', 'Find and extract PDF attachments'],
    ['/guides/search-bookmark-compare', 'Search, bookmark, and compare PDF objects'],
    ['/guides/investigate-suspicious-features', 'Investigate suspicious PDF features'],
    ['/privacy', 'Your PDFs and browser storage'],
    ['/limitations', 'Supported features and limitations'],
  ]) {
    const response = await reader.goto(path)
    expect(response?.status()).toBe(200)
    await expect(reader.getByRole('heading', { level: 1 })).toHaveText(heading!)
    await expect(reader.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://pdf-internals-viewer.pages.dev${path}`)
    await expect(reader.locator('main')).toContainText(path === '/privacy' ? 'Notes created while inspecting an encrypted PDF remain readable' : path === '/limitations' ? '64 MiB' : path === '/guides/find-pdf-attachments' ? 'Download attachment' : path === '/guides/search-bookmark-compare' ? 'Pin to compare' : 'sample')
  }
  await context.close()
  const requests: string[] = []
  {
    const article = await browser.newPage({ baseURL })
    article.on('request', request => requests.push(request.url()))
    await article.goto('/guides/decode-pdf-streams')
    await expect(article.getByRole('heading', { level: 1 })).toBeVisible()
    expect(requests.filter(url => /\.wasm|pdf\.worker|assets\/main-.*\.js/.test(url))).toEqual([])
    await article.close()
  }
})

test('opens each public page at the top when following links from the bottom', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/')
    await page.getByRole('link', { name: 'User guide', exact: true }).click()
    const main = page.getByRole('main')
    await main.evaluate(element => { element.scrollTop = element.scrollHeight })
    expect(await main.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
    await page.getByRole('link', { name: 'Investigate suspicious features', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Investigate suspicious PDF features')
    await expect.poll(() => main.evaluate(element => element.scrollTop)).toBe(0)
    await expect(main).toBeFocused()

    await main.evaluate(element => { element.scrollTop = element.scrollHeight })
    await main.getByRole('link', { name: 'Your PDFs and browser storage', exact: true }).click()
    await expect(page).toHaveURL(/\/privacy$/)
    await expect.poll(() => main.evaluate(element => element.scrollTop)).toBe(0)
    await expect(main).toBeFocused()
  }
})

test('keeps document state and route metadata across public content navigation', async ({ page }) => {
  await openMinimal(page)
  await page.getByRole('button', { name: 'First page', exact: true }).click()
  await page.getByRole('link', { name: 'User guide', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How to inspect a PDF in your browser')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Start with a sample/)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://pdf-internals-viewer.pages.dev/guide')
  await page.getByRole('link', { name: 'Understand objects and references such as 3 0 R' }).click()
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article')
  await page.getByRole('link', { name: 'Back to the workspace', exact: true }).click()
  await expect(page.locator('.filename')).toContainText('minimal.pdf')
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible()
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /An open-source, read-only PDF inspector/)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://pdf-internals-viewer.pages.dev/')
})

test('opens only bundled samples from tutorial links and reports no hydration errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('/guides/decode-pdf-streams')
  await page.getByRole('link', { name: 'Explore Fonts & resources', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Document overview' })).toBeVisible()
  await expect(page.locator('.filename')).toContainText('resources.pdf')
  await page.goto('/?sample=compressed')
  await expect(page.getByRole('heading', { name: 'Document overview' })).toBeVisible()
  await expect(page.locator('.filename')).toContainText('compressed.pdf')
  await page.goto('/?sample=https://example.com/private.pdf')
  await expect(page.getByRole('heading', { name: 'Look inside a PDF.' })).toBeVisible()
  expect(errors).toEqual([])
})

test('prerenders home and About for readers without JavaScript', async ({ browser, baseURL }) => {
  test.skip(!process.env.PLAYWRIGHT_CLOUDFLARE && !process.env.PLAYWRIGHT_PREVIEW && !process.env.PLAYWRIGHT_BASE_URL, 'Build-time HTML is checked against the production build')
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false })
  const reader = await context.newPage()
  await reader.goto('/')
  await expect(reader.getByRole('heading', { level: 1 })).toHaveText('Look inside a PDF.')
  await expect(reader.locator('.status-bar')).toHaveCount(0)
  await reader.getByRole('navigation', { name: 'Project', exact: true }).getByRole('link', { name: 'About', exact: true }).click()
  await expect(reader.getByRole('heading', { level: 1 })).toHaveText('A closer look at PDF.')
  await expect(reader.locator('main')).toContainText('Bookmarks and notes are saved in this browser')
  await reader.getByRole('link', { name: 'workspace guide', exact: true }).click()
  await expect(reader.getByRole('heading', { level: 1 })).toHaveText('How to inspect a PDF in your browser')
  await reader.screenshot({ path: screenshotPath('public-guide-desktop.png'), fullPage: false })
  await reader.setViewportSize({ width: 390, height: 844 })
  await reader.goto('/guides/decode-pdf-streams')
  await expect(reader.getByRole('heading', { level: 1 })).toBeVisible()
  expect(await reader.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await reader.screenshot({ path: screenshotPath('public-stream-guide-mobile.png'), fullPage: true })
  await context.close()
})

test('replaces a document during an acknowledged object transfer without exposing its partial graph', async ({ page }) => {
  await page.evaluate(() => {
    const NativeWorker = window.Worker
    let first = true
    window.Worker = class extends NativeWorker {
      constructor(...args: ConstructorParameters<typeof Worker>) {
        super(...args)
        if (!first) return
        first = false
        const send = this.postMessage.bind(this)
        this.postMessage = (...args: Parameters<Worker['postMessage']>) => {
          if ((args[0] as { type?: string }).type === 'open-next') {
            // Hold the acknowledgement deterministically, rather than racing parsing.
            document.documentElement.dataset.batchPaused = 'true'
            return
          }
          send(...args)
        }
      }
    }
  })
  const objects: [number, string][] = [
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [] /Count 0 >>'],
    ...Array.from({ length: 300 }, (_, i): [number, string] => [i + 3, '<< /Marker (old document) >>']),
  ]
  const fixture = classicPdf(objects)
  await page.getByLabel('Open local PDF').setInputFiles({ name: 'batched.pdf', mimeType: 'application/pdf', buffer: Buffer.from(fixture.bytes) })
  await expect(page.locator('html')).toHaveAttribute('data-batch-paused', 'true')
  await expect(page.getByRole('heading', { name: 'Opening PDF…' })).toBeVisible()
  await expect(page.locator('.status-bar')).not.toContainText('objects indexed')
  await upload(page, 'minimal.pdf')
  await expect(page.locator('.status-bar')).toContainText('5 objects indexed')
  await page.getByRole('button', { name: 'Document catalogue', exact: true }).first().click()
  await expect(page.locator('.object-title h1')).toContainText('1 0')
  await expect(page.locator('.filename')).toContainText('minimal.pdf')
})
