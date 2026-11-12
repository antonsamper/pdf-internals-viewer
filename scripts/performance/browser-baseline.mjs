/** Read-only Chromium production baseline. No PDF assets are redistributed. */
import { chromium } from '@playwright/test'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import os from 'node:os'
import { dirname, resolve } from 'node:path'

const baseURL = process.env.PERFORMANCE_BASE_URL ?? 'http://127.0.0.1:5174'
const output = resolve(process.env.PERFORMANCE_OUTPUT ?? '.context/browser-performance.json')
const repetitions = Number(process.env.PERFORMANCE_RUNS ?? 3)
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10) throw new Error('PERFORMANCE_RUNS must be 1 through 10.')
const manifest = JSON.parse(await readFile(new URL('../corpus/manifest.json', import.meta.url), 'utf8'))
const requested = (process.env.PERFORMANCE_FILES ?? 'pdfjs-helloworld,pdfjs-bug1937438_from_word,pdfjs-tracemonkey,pdf-lib-linearized_with_object_streams').split(',')
const fixtures = requested.map(id => {
  const entry = manifest.files.find(file => file.id === id)
  if (!entry) throw new Error(`Unknown corpus id: ${id}`)
  return entry
})
for (const entry of fixtures) {
  const bytes = await readFile(resolve('.context/corpus', entry.filename))
  if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Invalid corpus cache: ${entry.filename}. Run pnpm run corpus:fetch.`)
}
const distDirectory = resolve(process.env.PERFORMANCE_DIST_DIR ?? 'dist')
const buildHTML = await readFile(resolve(distDirectory, 'index.html'))
if (!buildHTML.length) throw new Error('Build production assets before measuring.')
const servedHTML = Buffer.from(await (await fetch(baseURL)).arrayBuffer())
if (createHash('sha256').update(servedHTML).digest('hex') !== createHash('sha256').update(buildHTML).digest('hex')) throw new Error('Served index does not match PERFORMANCE_DIST_DIR. Refusing to measure an unidentified build.')
const browser = await chromium.launch()
const rootCDP = await browser.newBrowserCDPSession()
let commandId = 0
async function workerHeap() {
  const { targetInfos } = await rootCDP.send('Target.getTargets')
  const worker = targetInfos.find(target => target.type === 'worker' && /pdf\.worker-/.test(target.url))
  if (!worker) return { unavailable: 'No parser worker target found.' }
  let sessionId
  try {
    ;({ sessionId } = await rootCDP.send('Target.attachToTarget', { targetId: worker.targetId, flatten: false }))
    const id = ++commandId
    const response = new Promise((resolveResult, reject) => {
      const timer = setTimeout(() => { rootCDP.off('Target.receivedMessageFromTarget', receive); reject(new Error('Worker heap query timed out.')) }, 5000)
      function receive(event) {
        if (event.sessionId !== sessionId) return
        const message = JSON.parse(event.message)
        if (message.id !== id) return
        clearTimeout(timer); rootCDP.off('Target.receivedMessageFromTarget', receive)
        if (message.error) reject(new Error(message.error.message)); else resolveResult(message.result)
      }
      rootCDP.on('Target.receivedMessageFromTarget', receive)
    })
    await rootCDP.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method: 'Runtime.getHeapUsage' }) })
    return await response
  } catch (error) { return { unavailable: error.message } }
  finally { if (sessionId) await rootCDP.send('Target.detachFromTarget', { sessionId }).catch(() => undefined) }
}
const report = {
  recordedAt: new Date().toISOString(),
  baseURL, repetitions, browser: await browser.version(), node: process.version,
  platform: `${os.platform()}/${os.arch()}`, cpus: os.cpus().length,
  cpu: os.cpus()[0]?.model, totalSystemMemoryBytes: os.totalmem(),
  viewport: { width: 1440, height: 1000 }, headless: true, cpuThrottling: 'none', network: 'localhost, unthrottled',
  buildLabel: process.env.PERFORMANCE_BUILD_LABEL ?? 'local production build', distDirectory,
  pnpmLockSha256: createHash('sha256').update(await readFile(resolve('pnpm-lock.yaml'))).digest('hex'),
  buildIndexSha256: createHash('sha256').update(buildHTML).digest('hex'),
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  results: [],
}
await mkdir(dirname(output), { recursive: true })
async function save() { await writeFile(output, JSON.stringify(report, null, 2) + '\n') }
try {
  for (const fixture of fixtures) for (let run = 1; run <= repetitions; run++) {
    const context = await browser.newContext({ viewport: report.viewport })
    const page = await context.newPage()
    page.setDefaultTimeout(25_000)
    const mainCDP = await context.newCDPSession(page)
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.addInitScript(() => {
      const state = { phase: 'startup', openingStart: null, indexedAt: null, longTasks: [], frameGaps: [], maxFrameGap: 0, lastFrame: 0, navigationStart: null, navigationReadyAt: null, lcp: [], longTaskSupported: PerformanceObserver.supportedEntryTypes.includes('longtask') }
      globalThis.__pdfPerformance = state
      try { new PerformanceObserver(list => { for (const entry of list.getEntries()) state.longTasks.push({ phase: state.phase, startTime: entry.startTime, duration: entry.duration }) }).observe({ type: 'longtask', buffered: true }) } catch { /* Chromium supports longtask; absence recorded in output. */ }
      function frame(time) {
        if (state.lastFrame && state.phase === 'opening') {
          const gap = time - state.lastFrame
          state.maxFrameGap = Math.max(state.maxFrameGap, gap)
          if (gap > 50) state.frameGaps.push({ startTime: state.lastFrame, duration: gap })
        }
        state.lastFrame = time; requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
      try { new PerformanceObserver(list => { for (const entry of list.getEntries()) state.lcp.push({ startTime: entry.startTime, size: entry.size }) }).observe({ type: 'largest-contentful-paint', buffered: true }) } catch { /* no LCP observations will be reported */ }
      document.addEventListener('change', event => {
        if (event.target instanceof HTMLInputElement && event.target.type === 'file') { state.phase = 'opening'; state.openingStart = performance.now() }
      }, true)
      document.addEventListener('click', event => {
        if (event.target instanceof Element && event.target.closest('button')?.textContent?.trim() === 'Document catalog' && state.phase === 'navigation') state.navigationStart = performance.now()
      }, true)
      new MutationObserver(() => {
        if (state.phase === 'opening' && /\d+ objects indexed/.test(document.querySelector('.status-bar')?.textContent ?? '')) {
          requestAnimationFrame(() => requestAnimationFrame(() => { if (state.phase === 'opening') { state.indexedAt = performance.now(); state.phase = 'opened' } }))
        }
        if (state.phase === 'navigation' && document.querySelector('.object-title h1') && state.navigationStart !== null && state.navigationReadyAt === null) requestAnimationFrame(() => requestAnimationFrame(() => { state.navigationReadyAt ??= performance.now() }))
      }).observe(document, { childList: true, subtree: true, characterData: true })
    })
    const result = { id: fixture.id, filename: fixture.filename, bytes: fixture.size, expectedObjects: fixture.oracle.objects, run }
    try {
      await page.goto(baseURL, { waitUntil: 'networkidle' })
      await page.getByRole('heading', { name: 'Look inside a PDF.' }).waitFor()
      result.startup = await page.evaluate(() => ({ navigation: performance.getEntriesByType('navigation')[0]?.toJSON(), lcp: globalThis.__pdfPerformance.lcp, longTaskSupported: globalThis.__pdfPerformance.longTaskSupported, paint: performance.getEntriesByType('paint').map(entry => entry.toJSON()), resources: performance.getEntriesByType('resource').map(entry => ({ name: new URL(entry.name).pathname, type: entry.initiatorType, transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize, duration: entry.duration })) }))
      result.mainHeapBefore = await mainCDP.send('Runtime.getHeapUsage')
      await page.getByLabel('Open local PDF').setInputFiles(resolve('.context/corpus', fixture.filename))
      await page.waitForFunction(() => globalThis.__pdfPerformance.indexedAt !== null, null, { timeout: 25_000 })
      result.statusText = await page.locator('.status-bar').innerText()
      result.mainHeapAfterOpen = await mainCDP.send('Runtime.getHeapUsage')
      result.workerHeapAfterOpen = await workerHeap()
      result.opening = await page.evaluate(() => {
        const state = globalThis.__pdfPerformance
        return { milliseconds: state.indexedAt - state.openingStart, longTasks: state.longTasks.filter(task => task.startTime >= state.openingStart && task.startTime <= state.indexedAt), maxFrameGapMs: state.maxFrameGap, frameGaps: state.frameGaps }
      })
      const navigation = []
      for (let index = 0; index < 5; index++) {
        if (index) await page.getByRole('button', { name: 'Overview', exact: true }).click()
        await page.evaluate(() => { const state = globalThis.__pdfPerformance; state.phase = 'navigation'; state.navigationStart = null; state.navigationReadyAt = null })
        await page.getByRole('button', { name: 'Document catalog', exact: true }).first().click()
        await page.waitForFunction(() => globalThis.__pdfPerformance.navigationReadyAt !== null)
        navigation.push(await page.evaluate(() => globalThis.__pdfPerformance.navigationReadyAt - globalThis.__pdfPerformance.navigationStart))
        await page.evaluate(() => { globalThis.__pdfPerformance.phase = 'opened' })
      }
      result.cachedNavigationMs = navigation
      result.mainHeapAfterNavigation = await mainCDP.send('Runtime.getHeapUsage')
      result.pageErrors = pageErrors
      result.status = 'measured'
    } catch (error) {
      result.status = 'failed'; result.error = error.message
      result.statusText = await page.locator('.status-bar').innerText().catch(() => '')
      result.alert = await page.getByRole('alert').allTextContents().catch(() => [])
      result.pageErrors = pageErrors
    } finally {
      report.results.push(result); await save(); await context.close()
    }
    console.log(JSON.stringify({ id: fixture.id, run, status: result.status, openingMs: result.opening?.milliseconds, navigationMs: result.cachedNavigationMs, error: result.error }))
  }
} finally { await rootCDP.detach(); await browser.close(); await save() }
console.log(`Saved ${report.results.length} observations to ${output}`)
if (report.results.some(result => result.status !== 'measured')) process.exitCode = 1
