/** Read-only Chromium production baseline. No PDF assets are redistributed. */
import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { dirname, resolve } from 'node:path';
const workerHeap = async (forceGC = false) => {
    const { targetInfos } = await rootCDP.send('Target.getTargets');
    const worker = targetInfos.find(target => { return target.type === 'worker' && /pdf\.worker-/.test(target.url); });
    if (!worker) {
        return { unavailable: 'No parser worker target found.' };
    }
    let sessionId;
    try {
        ;
        ({ sessionId } = await rootCDP.send('Target.attachToTarget', { flatten: false, targetId: worker.targetId }));
        let result;
        for (const method of forceGC ? ['HeapProfiler.collectGarbage', 'Runtime.getHeapUsage'] : ['Runtime.getHeapUsage']) {
            const id = ++commandId;
            const response = new Promise((resolveResult, reject) => {
                const receive = (event) => {
                    if (event.sessionId !== sessionId) {
                        return;
                    }
                    const message = JSON.parse(event.message);
                    if (message.id !== id) {
                        return;
                    }
                    clearTimeout(timer);
                    rootCDP.off('Target.receivedMessageFromTarget', receive);
                    if (message.error) {
                        reject(new Error(message.error.message));
                    }
                    else {
                        resolveResult(message.result);
                    }
                };
                const timer = setTimeout(() => { rootCDP.off('Target.receivedMessageFromTarget', receive); reject(new Error('Worker heap query timed out.')); }, 5000);
                rootCDP.on('Target.receivedMessageFromTarget', receive);
            });
            await rootCDP.send('Target.sendMessageToTarget', { message: JSON.stringify({ id, method }), sessionId });
            result = await response;
        }
        return result;
    }
    catch (error) {
        return { unavailable: error.message };
    }
    finally {
        if (sessionId) {
            await rootCDP.send('Target.detachFromTarget', { sessionId }).catch(() => { return undefined; });
        }
    }
};
const save = async () => { await writeFile(output, JSON.stringify(report, null, 2) + '\n'); };
const baseURL = process.env.PERFORMANCE_BASE_URL ?? 'http://127.0.0.1:5174';
const output = resolve(process.env.PERFORMANCE_OUTPUT ?? '.context/browser-performance.json');
const profileDirectory = process.env.PERFORMANCE_PROFILE_DIR ? resolve(process.env.PERFORMANCE_PROFILE_DIR) : null;
const assertCloseRelease = process.env.PERFORMANCE_ASSERT_CLOSE_RELEASE === '1';
const maxMainRetainedMiB = process.env.PERFORMANCE_MAX_MAIN_RETAINED_MIB === undefined ? null : Number(process.env.PERFORMANCE_MAX_MAIN_RETAINED_MIB);
if (maxMainRetainedMiB !== null && (!Number.isFinite(maxMainRetainedMiB) || maxMainRetainedMiB <= 0)) {
    throw new Error('PERFORMANCE_MAX_MAIN_RETAINED_MIB must be a positive number.');
}
const retainedMemory = process.env.PERFORMANCE_RETAINED_MEMORY === '1' || assertCloseRelease || maxMainRetainedMiB !== null;
const probeMessages = process.env.PERFORMANCE_PROBE_MESSAGES === '1';
const repetitions = Number(process.env.PERFORMANCE_RUNS ?? 3);
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10) {
    throw new Error('PERFORMANCE_RUNS must be 1 through 10.');
}
const manifest = JSON.parse(await readFile(new URL('../corpus/manifest.json', import.meta.url), 'utf8'));
const requested = (process.env.PERFORMANCE_FILES ?? 'pdfjs-helloworld,pdfjs-bug1937438_from_word,pdfjs-tracemonkey,pdf-lib-linearized_with_object_streams').split(',');
const fixtures = requested.map(id => {
    const entry = manifest.files.find(file => { return file.id === id; });
    if (!entry) {
        throw new Error(`Unknown corpus id: ${id}`);
    }
    return entry;
});
for (const entry of fixtures) {
    const bytes = await readFile(resolve('.context/corpus', entry.filename));
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) {
        throw new Error(`Invalid corpus cache: ${entry.filename}. Run pnpm run corpus:fetch.`);
    }
}
const distDirectory = resolve(process.env.PERFORMANCE_DIST_DIR ?? 'dist');
const buildHTML = await readFile(resolve(distDirectory, 'index.html'));
if (!buildHTML.length) {
    throw new Error('Build production assets before measuring.');
}
const servedHTML = Buffer.from(await (await fetch(baseURL)).arrayBuffer());
if (createHash('sha256').update(servedHTML).digest('hex') !== createHash('sha256').update(buildHTML).digest('hex')) {
    throw new Error('Served index does not match PERFORMANCE_DIST_DIR. Refusing to measure an unidentified build.');
}
const browser = await chromium.launch();
const rootCDP = await browser.newBrowserCDPSession();
let commandId = 0;
const report = {
    assertCloseRelease,
    baseURL,
    browser: await browser.version(),
    buildIndexSha256: createHash('sha256').update(buildHTML).digest('hex'),
    buildLabel: process.env.PERFORMANCE_BUILD_LABEL ?? 'local production build',
    cpu: os.cpus()[0]?.model,
    cpuThrottling: 'none',
    cpus: os.cpus().length,
    distDirectory,
    headless: true,
    maxMainRetainedMiB,
    messageProbe: probeMessages,
    network: 'localhost, unthrottled',
    node: process.version,
    platform: `${os.platform()}/${os.arch()}`,
    pnpmLockSha256: createHash('sha256').update(await readFile(resolve('pnpm-lock.yaml'))).digest('hex'),
    profiling: Boolean(profileDirectory),
    recordedAt: new Date().toISOString(),
    repetitions,
    results: [],
    retainedMemory,
    sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    totalSystemMemoryBytes: os.totalmem(),
    viewport: { height: 1000, width: 1440 },
};
await mkdir(dirname(output), { recursive: true });
try {
    for (const fixture of fixtures) {
        for (let run = 1; run <= repetitions; run++) {
            const context = await browser.newContext({ viewport: report.viewport });
            const page = await context.newPage();
            page.setDefaultTimeout(25000);
            const mainCDP = await context.newCDPSession(page);
            const pageErrors = [];
            let tracingActive = false;
            page.on('pageerror', error => { return pageErrors.push(error.message); });
            await page.addInitScript(({ enableMessageProbe }) => {
                const frame = (time) => {
                    if (state.lastFrame && state.phase === 'opening') {
                        const gap = time - state.lastFrame;
                        state.maxFrameGap = Math.max(state.maxFrameGap, gap);
                        if (gap > 50) {
                            state.frameGaps.push({ duration: gap, startTime: state.lastFrame });
                        }
                    }
                    state.lastFrame = time;
                    requestAnimationFrame(frame);
                };
                const state = { frameGaps: [], indexedAt: null, lastFrame: 0, lcp: [], longTaskSupported: PerformanceObserver.supportedEntryTypes.includes('longtask'), longTasks: [], maxFrameGap: 0, navigationReadyAt: null, navigationStart: null, openingStart: null, phase: 'startup' };
                state.messageReads = [];
                globalThis.pdfPerformance = state;
                // A separate diagnostic run: read data before the app listener to isolate
                // Chromium's lazy structured-clone deserialisation. Never a baseline timing.
                if (enableMessageProbe) {
                    const NativeWorker = globalThis.Worker;
                    globalThis.Worker = class extends NativeWorker {
                        constructor(...args) {
                            super(...args);
                            this.addEventListener('message', event => {
                                const start = performance.now();
                                const data = event.data;
                                state.messageReads.push({ milliseconds: performance.now() - start, objectCount: data.document?.objects.length, type: data.type });
                            });
                        }
                    };
                }
                try {
                    new PerformanceObserver(list => { for (const entry of list.getEntries()) {
                        state.longTasks.push({ duration: entry.duration, phase: state.phase, startTime: entry.startTime });
                    } }).observe({ buffered: true, type: 'longtask' });
                }
                catch { /* Chromium supports longtask; absence recorded in output. */ }
                requestAnimationFrame(frame);
                try {
                    new PerformanceObserver(list => { for (const entry of list.getEntries()) {
                        state.lcp.push({ size: entry.size, startTime: entry.startTime });
                    } }).observe({ buffered: true, type: 'largest-contentful-paint' });
                }
                catch { /* no LCP observations will be reported */ }
                document.addEventListener('change', event => {
                    if (event.target instanceof HTMLInputElement && event.target.type === 'file') {
                        state.phase = 'opening';
                        state.openingStart = performance.now();
                    }
                }, true);
                document.addEventListener('click', event => {
                    if (event.target instanceof Element && event.target.closest('button')?.textContent?.trim() === 'Document catalogue' && state.phase === 'navigation') {
                        state.navigationStart = performance.now();
                    }
                }, true);
                new MutationObserver(() => {
                    if (state.phase === 'opening' && /\d+ objects indexed/.test(document.querySelector('footer')?.textContent ?? '')) {
                        requestAnimationFrame(() => { return requestAnimationFrame(() => { if (state.phase === 'opening') {
                            state.indexedAt = performance.now();
                            state.phase = 'opened';
                        } }); });
                    }
                    if (state.phase === 'navigation' && document.querySelector('section[aria-label="Object inspector"] h1') && state.navigationStart !== null && state.navigationReadyAt === null) {
                        requestAnimationFrame(() => { return requestAnimationFrame(() => { state.navigationReadyAt ??= performance.now(); }); });
                    }
                }).observe(document, { characterData: true, childList: true, subtree: true });
            }, { enableMessageProbe: probeMessages });
            const result = { bytes: fixture.size, expectedObjects: fixture.oracle.objects, filename: fixture.filename, id: fixture.id, run };
            try {
                await page.goto(baseURL, { waitUntil: 'networkidle' });
                await page.getByRole('heading', { name: 'Look inside a PDF.' }).waitFor();
                result.startup = await page.evaluate(() => { return { lcp: globalThis.pdfPerformance.lcp, longTaskSupported: globalThis.pdfPerformance.longTaskSupported, navigation: performance.getEntriesByType('navigation')[0]?.toJSON(), paint: performance.getEntriesByType('paint').map(entry => { return entry.toJSON(); }), resources: performance.getEntriesByType('resource').map(entry => { return { duration: entry.duration, encodedBodySize: entry.encodedBodySize, name: new URL(entry.name).pathname, transferSize: entry.transferSize, type: entry.initiatorType }; }) }; });
                if (retainedMemory) {
                    await mainCDP.send('HeapProfiler.collectGarbage');
                }
                result.mainHeapBefore = await mainCDP.send('Runtime.getHeapUsage');
                if (profileDirectory) {
                    await mkdir(profileDirectory, { recursive: true });
                    await mainCDP.send('Profiler.enable');
                    await mainCDP.send('Profiler.start');
                    await mainCDP.send('Tracing.start', {
                        categories: 'devtools.timeline,v8,blink.user_timing,toplevel,disabled-by-default-devtools.timeline',
                        transferMode: 'ReturnAsStream',
                    });
                    tracingActive = true;
                }
                await page.getByLabel('Open local PDF').setInputFiles(resolve('.context/corpus', fixture.filename));
                await page.waitForFunction(() => { return globalThis.pdfPerformance.indexedAt !== null; }, null, { timeout: 25000 });
                if (profileDirectory) {
                    const { profile } = await mainCDP.send('Profiler.stop');
                    const completed = new Promise(resolveTrace => { return mainCDP.once('Tracing.tracingComplete', resolveTrace); });
                    await mainCDP.send('Tracing.end');
                    const { stream } = await completed;
                    tracingActive = false;
                    const tracePath = resolve(profileDirectory, `${fixture.id}-${run}.trace.json`);
                    const cpuPath = resolve(profileDirectory, `${fixture.id}-${run}.cpuprofile`);
                    const chunks = [];
                    try {
                        while (true) {
                            const chunk = await mainCDP.send('IO.read', { handle: stream });
                            chunks.push(Buffer.from(chunk.data, chunk.base64Encoded ? 'base64' : 'utf8'));
                            if (chunk.eof) {
                                break;
                            }
                        }
                    }
                    finally {
                        await mainCDP.send('IO.close', { handle: stream });
                    }
                    await writeFile(tracePath, Buffer.concat(chunks));
                    await writeFile(cpuPath, JSON.stringify(profile));
                    result.profile = { cpuPath, tracePath };
                }
                result.statusText = await page.getByRole('contentinfo').innerText();
                result.mainHeapAfterOpen = await mainCDP.send('Runtime.getHeapUsage');
                result.workerHeapAfterOpen = await workerHeap();
                result.opening = await page.evaluate(() => {
                    const state = globalThis.pdfPerformance;
                    return { frameGaps: state.frameGaps, longTasks: state.longTasks.filter(task => { return task.startTime >= state.openingStart && task.startTime <= state.indexedAt; }), maxFrameGapMs: state.maxFrameGap, messageReads: state.messageReads, milliseconds: state.indexedAt - state.openingStart };
                });
                const navigation = [];
                for (let index = 0; index < 5; index++) {
                    if (index) {
                        await page.getByRole('button', { exact: true, name: 'Overview' }).click();
                    }
                    await page.evaluate(() => { const state = globalThis.pdfPerformance; state.phase = 'navigation'; state.navigationStart = null; state.navigationReadyAt = null; });
                    await page.getByRole('button', { exact: true, name: 'Document catalogue' }).first().click();
                    await page.waitForFunction(() => { return globalThis.pdfPerformance.navigationReadyAt !== null; });
                    navigation.push(await page.evaluate(() => { return globalThis.pdfPerformance.navigationReadyAt - globalThis.pdfPerformance.navigationStart; }));
                    await page.evaluate(() => { globalThis.pdfPerformance.phase = 'opened'; });
                }
                result.cachedNavigationMs = navigation;
                result.mainHeapAfterNavigation = await mainCDP.send('Runtime.getHeapUsage');
                // Diagnostic only: retained samples follow all opening/navigation timings.
                // Separate isolates, excluding preview/WASM and whole-process peak memory.
                if (retainedMemory) {
                    await mainCDP.send('HeapProfiler.collectGarbage');
                    result.mainHeapRetained = await mainCDP.send('Runtime.getHeapUsage');
                    result.workerHeapRetained = await workerHeap(true);
                    if (maxMainRetainedMiB !== null && result.mainHeapRetained.usedSize > maxMainRetainedMiB * 1024 * 1024) {
                        throw new Error(`Main-page retained heap exceeds ${maxMainRetainedMiB} MiB: ${(result.mainHeapRetained.usedSize / 1024 / 1024).toFixed(2)} MiB.`);
                    }
                    await page.getByRole('button', { exact: true, name: 'Close PDF' }).click();
                    await page.getByRole('heading', { name: 'Look inside a PDF.' }).waitFor();
                    await mainCDP.send('HeapProfiler.collectGarbage');
                    result.mainHeapAfterClose = await mainCDP.send('Runtime.getHeapUsage');
                    result.workerHeapAfterClose = await workerHeap();
                    // A further app render distinguishes immediate close retention from
                    // allocations that persist through subsequent use of the empty app.
                    await page.getByRole('link', { exact: true, name: 'About' }).click();
                    await page.waitForURL('**/about');
                    await mainCDP.send('HeapProfiler.collectGarbage');
                    result.mainHeapAfterCloseAndNavigation = await mainCDP.send('Runtime.getHeapUsage');
                    if (assertCloseRelease) {
                        // Compare two empty-app states, allowing 10 MiB for rendering variance.
                        // A closed large document must not wait for navigation to be released.
                        const retainedUntilNavigation = result.mainHeapAfterClose.usedSize - result.mainHeapAfterCloseAndNavigation.usedSize;
                        if (retainedUntilNavigation > 10 * 1024 * 1024) {
                            throw new Error(`Closing the PDF retains ${(retainedUntilNavigation / 1024 / 1024).toFixed(2)} MiB until another navigation (maximum 10 MiB).`);
                        }
                    }
                }
                result.pageErrors = pageErrors;
                result.status = 'measured';
            }
            catch (error) {
                result.status = 'failed';
                result.error = error.message;
                result.statusText = await page.getByRole('contentinfo').innerText().catch(() => { return ''; });
                result.alert = await page.getByRole('alert').allTextContents().catch(() => { return []; });
                result.pageErrors = pageErrors;
            }
            finally {
                if (tracingActive) {
                    const completed = new Promise(resolveTrace => { return mainCDP.once('Tracing.tracingComplete', resolveTrace); });
                    await mainCDP.send('Tracing.end');
                    const { stream } = await completed;
                    await mainCDP.send('IO.close', { handle: stream });
                    await mainCDP.send('Profiler.stop').catch(() => { return undefined; });
                }
                report.results.push(result);
                await save();
                await context.close();
            }
            console.log(JSON.stringify({ error: result.error, id: fixture.id, navigationMs: result.cachedNavigationMs, openingMs: result.opening?.milliseconds, run, status: result.status }));
        }
    }
}
finally {
    await rootCDP.detach();
    await browser.close();
    await save();
}
console.log(`Saved ${report.results.length} observations to ${output}`);
if (report.results.some(result => { return result.status !== 'measured'; })) {
    process.exitCode = 1;
}
