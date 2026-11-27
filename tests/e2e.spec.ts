import type { Locator, Page, Route } from '@playwright/test';

import { test, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// @ts-expect-error local JavaScript fixture helpers have no declaration file
import { classicPdf, encryptedPdf, embeddedFilesPdf, imageExportPdf, pageTextSearchPdf } from '../scripts/fixtures/pdf-fixtures.mjs';
const upload = async (page: Page, name: string) => {
  await page.getByLabel('Open local PDF').setInputFiles(samplePath(name));
  await expect(page.getByRole('heading', { name: 'Document overview' })).toBeVisible();
  await expect(page.locator('[data-filename]')).toContainText(name);
  await expect(page.getByRole('contentinfo')).toContainText('objects indexed');
};
const selectSearchScope = async (page: Page, value: string) => {
  const labels: Record<string, string> = {
    decoded: 'Decoded streams',
    hex: 'File hex',
    keys: 'Keys',
    objects: 'Objects',
    pageText: 'Page text',
    text: 'File text',
  };
  await page.getByRole('combobox', { exact: true, name: 'Search scope' }).click();
  await page.getByRole('option', { exact: true, name: labels[value] }).click();
};
/** `saveFile` clicks a temporary download link; count those clicks without waiting for a download event. */
const countSaves = async (page: Page) => {
  await page.evaluate(() => {
    const target = window as typeof window & { saves: number };
    target.saves = 0;
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      if (this.download) target.saves += 1;
      click.call(this);
    };
  });
  return () => page.evaluate(() => (window as typeof window & { saves: number }).saves);
};
const openMinimal = async (page: Page) => {
  await page.getByRole('button', { name: /^A simple page/ }).click();
  await expect(page.getByRole('heading', { name: 'Document overview' })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toContainText('5 objects indexed');
};
/** Outline style, width and offset, then box-shadow: one string to compare focus rings. */
const focusRing = (element: Locator) =>
  element.evaluate((node) => {
    const style = getComputedStyle(node);
    return `${style.outlineStyle} ${style.outlineWidth} ${style.outlineOffset} | ${style.boxShadow}`;
  });
const samplePath = (name: string) => resolve('public/samples', name);
// Keep artifacts separate when --browser=all runs engines concurrently.
const screenshotPath = (name: string) => resolve('.context', test.info().project.use.browserName ?? 'chromium', name);
type CachedAsset = { body: Buffer; headers: Record<string, string>; status: number };
const engineAssets = new Map<string, Promise<CachedAsset>>();
const serveEngineAsset = async (route: Route) => {
  const url = route.request().url();
  if (!engineAssets.has(url)) {
    const cached = route.fetch().then(async (response) => {
      const { 'content-encoding': _encoding, 'content-length': _length, 'transfer-encoding': _transfer, ...headers } = response.headers();
      return { body: await response.body(), headers, status: response.status() };
    });
    engineAssets.set(url, cached);
    // A failed or partial fetch is not cached, so a later boot retries the server.
    cached.then(
      (asset) => asset.status === 200 || engineAssets.delete(url),
      () => engineAssets.delete(url)
    );
  }
  try {
    await route.fulfill(await engineAssets.get(url)!);
  } catch (error) {
    // The page closed or the fetch failed; let the request fail as it would without the cache.
    console.warn(`Engine asset ${url} not served: ${error instanceof Error ? error.message : error}`);
    await route.abort().catch(() => undefined);
  }
};
/**
 * Browser contexts don't share an HTTP cache, so every PDFium engine boot downloads the 7.8 MB wasm again, and
 * `wrangler pages dev` compresses each response on one thread. Concurrent page-text searches then queue behind it
 * past the expect timeout. Call this in tests that boot the engine: it fetches each hashed engine asset once per
 * test worker and serves repeats from memory. Routing turns off the HTTP cache for the context, so other tests skip it.
 */
const cacheEngineAssets = (page: Page) => page.context().route('**/assets/embedpdf*', serveEngineAsset);
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});
test('opens with an accessible empty workspace and sample choices', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Look inside a PDF.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Open a PDF/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^A simple page/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Fonts & resources/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Compressed objects/ })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toHaveCount(0);
  await expect(page.getByRole('navigation', { exact: true, name: 'Project' })).toBeVisible();
  await mkdir(resolve('.context'), { recursive: true });
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: screenshotPath('empty.png'),
  });
});
test('uses the matching logo on the welcome and About pages in each theme', async ({ page }) => {
  for (const path of ['/', '/about']) {
    await page.goto(path);
    for (const mode of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: mode });
      const visibleLogo = page.locator(`[data-brand-artwork=${mode}]`);
      await expect(visibleLogo).toBeVisible();
      await expect(page.locator(`[data-brand-artwork=${mode === 'light' ? 'dark' : 'light'}]`)).toBeHidden();
      await expect.poll(() => visibleLogo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
      await expect(visibleLogo).toHaveAttribute('src', `/brand/pdf-internals-logo${mode === 'dark' ? '-dark' : ''}.png`);
    }
  }
});
test('shows the mascot drop target, dismisses on leaving, and opens a dropped PDF', async ({ page }) => {
  const dataTransfer = await page.evaluateHandle(
    (bytes) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([new Uint8Array(bytes)], 'minimal.pdf', {
          type: 'application/pdf',
        })
      );
      return transfer;
    },
    [...(await readFile(samplePath('minimal.pdf')))]
  );
  const shell = page.getByRole('main');
  const overlay = page.getByTestId('drop-overlay');
  for (const mode of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: mode });
    await shell.dispatchEvent('dragover', { dataTransfer });
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('Processed locally · up to 64 MiB');
    await expect
      .poll(() => overlay.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0))
      .toBe(true);
    await shell.dispatchEvent('dragleave', { relatedTarget: null });
    await expect(overlay).toHaveCount(0);
  }
  await page.setViewportSize({ height: 844, width: 390 });
  await shell.dispatchEvent('dragover', { dataTransfer });
  await expect(page.getByTestId('drop-target')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await shell.dispatchEvent('drop', { dataTransfer });
  await expect(overlay).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Document overview' })).toBeVisible();
  await expect(page.locator('[data-filename]')).toContainText('minimal.pdf');
  await expect(page.getByRole('contentinfo')).toContainText('5 objects indexed');
});
test('shows document status only in an active PDF workspace', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ height: 844, width });
    await expect(page.getByRole('contentinfo')).toHaveCount(0);
    await openMinimal(page);
    await expect(page.getByRole('navigation', { exact: true, name: 'Project' })).toHaveCount(0);
    await page.getByRole('link', { exact: true, name: 'User guide' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('How to inspect a PDF in your browser');
    await expect(page.getByRole('contentinfo')).toHaveCount(0);
    await expect(page.getByRole('navigation', { exact: true, name: 'Project' })).toBeVisible();
    await page.getByRole('link', { exact: true, name: 'Back to the workspace' }).click();
    await expect(page.getByRole('contentinfo')).toContainText('5 objects indexed');
    await page.getByRole('button', { exact: true, name: 'Close PDF' }).click();
    await expect(page.getByRole('heading', { name: 'Look inside a PDF.' })).toBeVisible();
    await expect(page.getByRole('contentinfo')).toHaveCount(0);
    await expect(page.getByRole('navigation', { exact: true, name: 'Project' })).toBeVisible();
  }
});
test('ends sample sessions without reopening them and preserves the current public route', async ({ page }) => {
  await page.goto('/?sample=compressed');
  await expect(page.locator('[data-filename]')).toContainText('compressed.pdf');
  await expect(page.getByRole('contentinfo')).toContainText('7 objects indexed');
  await page.getByRole('button', { exact: true, name: 'Close PDF' }).click();
  await expect(page.getByRole('heading', { name: 'Look inside a PDF.' })).toBeVisible();
  await expect(page.getByRole('button', { exact: true, name: 'Close PDF' })).toHaveCount(0);
  // A new session can open normally, even though the initial sample query remains.
  await upload(page, 'minimal.pdf');
  await expect(page.getByRole('contentinfo')).toContainText('5 objects indexed');
  await page.getByRole('link', { exact: true, name: 'User guide' }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await page.getByRole('button', { exact: true, name: 'Close PDF' }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How to inspect a PDF in your browser');
  await page.getByRole('link', { exact: true, name: 'Back to the workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Look inside a PDF.' })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toHaveCount(0);
});
test('summarizes page rotation in the document overview', async ({ page }) => {
  const rotation = page
    .locator('[data-document-facts] > div')
    .filter({ has: page.getByText('Page rotation', { exact: true }) })
    .locator('dd');
  await openMinimal(page);
  await expect(rotation).toHaveText('0°');
  for (const [override, expected] of [
    ['', '90°'],
    ['/Rotate 180', 'Mixed (90°, 180°)'],
  ]) {
    const fixture = classicPdf([
      [1, '<< /Type /Catalog /Pages 2 0 R >>'],
      [2, '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 /Rotate 90 >>'],
      [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>'],
      [4, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] ${override} >>`],
    ]);
    await page.getByLabel('Open local PDF').setInputFiles({
      buffer: Buffer.from(fixture.bytes),
      mimeType: 'application/pdf',
      name: 'rotated.pdf',
    });
    await expect(rotation).toHaveText(expected);
  }
});
test('follows page references, reads stream representations, and navigates history', async ({ page }) => {
  await openMinimal(page);
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible();
  await expect(page.getByRole('button', { exact: true, name: 'Explain /Contents' })).toBeVisible();
  await page.getByRole('button', { exact: true, name: '4 0 R' }).first().click();
  await expect(page.getByRole('heading', { name: /4 0\s+obj/ })).toBeVisible();
  await expect(page.locator('[data-hex-byte][data-selected]').first()).toBeVisible();
  await page.getByRole('tab', { exact: true, name: 'Raw stream' }).click();
  await expect(page.getByRole('tabpanel', { exact: true, name: 'Raw stream' })).toContainText('Hello, PDF internals.');
  await page.getByRole('tab', { exact: true, name: 'Decoded' }).click();
  await expect(page.getByRole('tabpanel', { exact: true, name: 'Decoded' })).toContainText('Hello, PDF internals.');
  await expect(page.getByRole('tabpanel', { exact: true, name: 'Decoded' })).toContainText(
    'Decoded offsets differ from original file offsets.'
  );
  await page.getByRole('button', { exact: true, name: 'Back' }).click();
  await expect(page.getByRole('tab', { exact: true, name: 'Raw stream' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { exact: true, name: 'Back' }).click();
  await expect(page.getByRole('tab', { exact: true, name: 'Properties' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { exact: true, name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible();
  await page.getByRole('button', { exact: true, name: 'Forward' }).click();
  await expect(page.getByRole('heading', { name: /4 0\s+obj/ })).toBeVisible();
  await page.getByRole('tab', { exact: true, name: 'Decoded' }).click();
  await expect(page.getByRole('tab', { exact: true, name: 'Decoded' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { exact: true, name: 'Decoded' })).toContainText('Hello, PDF internals.');
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: screenshotPath('desktop.png'),
  });
});
test('renders pdf syntax, references, bytes and code in the monospace token', async ({ page }) => {
  // Each element reaches the token by a different route: a utility, a utility on a button, the
  // hex row the byte buttons inherit from, and the base-layer `code, pre` rule.
  const monospace = /^ui-monospace,/;
  await openMinimal(page);
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toHaveCSS('font-family', monospace);
  const reference = page.getByRole('button', { exact: true, name: '4 0 R' }).first();
  await expect(reference).toHaveCSS('font-family', monospace);
  await reference.click();
  await expect(page.locator('[data-hex-byte]').first()).toHaveCSS('font-family', monospace);
  await page.getByRole('tab', { exact: true, name: 'Decoded' }).click();
  const decoded = page.getByRole('tabpanel', { exact: true, name: 'Decoded' });
  await expect(decoded.locator('code, pre').first()).toHaveCSS('font-family', monospace);
});
test('shows a prominent loading state and allows cancelling a slow open', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((done) => {
    release = done;
  });
  await page.route('**/samples/minimal.pdf', async (route) => {
    await pending;
    await route.continue();
  });
  await page.getByRole('button', { name: /^A simple page/ }).click();
  const loading = page.getByRole('status', { exact: true, name: 'Opening PDF' });
  await expect(loading).toBeVisible();
  await expect(loading).toContainText('Larger documents can take a few seconds.');
  await expect(page.getByRole('main', { name: 'Document inspection' })).toHaveAttribute('aria-busy', 'true');
  await expect(loading.locator('svg')).toHaveClass(/animate-spin/);
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: screenshotPath('opening-pdf.png'),
  });
  await page.getByRole('button', { exact: true, name: 'Cancel' }).click();
  await expect(loading).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Look inside a PDF.' })).toBeVisible();
  release();
  await page.unrouteAll({ behavior: 'wait' });
  await openMinimal(page);
  await expect(loading).toHaveCount(0);
  await expect(page.getByRole('main', { name: 'Document inspection' })).toHaveAttribute('aria-busy', 'false');
});
test('shows an error and clears the loading state when a sample fails to load', async ({ page }) => {
  await page.route('**/samples/minimal.pdf', (route) => route.fulfill({ body: '', status: 404 }));
  await page.getByRole('button', { name: /^A simple page/ }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'The sample could not be loaded. Try opening a local PDF.' })).toBeVisible();
  await expect(page.getByRole('status', { exact: true, name: 'Opening PDF' })).toHaveCount(0);
  await page.unrouteAll({ behavior: 'wait' });
  await openMinimal(page);
});
test('explains parsing failures and retains the reason after dismissing the banner', async ({ page }) => {
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from('not a PDF'),
    mimeType: 'application/pdf',
    name: 'broken.pdf',
  });
  const explanation = page.getByRole('region', {
    name: 'Why structure is unavailable',
  });
  await expect(explanation).toBeVisible();
  await expect(explanation).toContainText('could not determine whether it is encrypted');
  await expect(explanation).toContainText('export a fresh copy');
  await page.getByRole('button', { exact: true, name: 'Dismiss error' }).click();
  await explanation.getByText('Technical details', { exact: true }).click();
  await expect(explanation.locator('pre')).toContainText('Could not recover PDF structure: no objects found');
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: screenshotPath('structure-unavailable.png'),
  });
  await explanation.getByRole('button', { exact: true, name: 'Inspect original bytes' }).click();
  await expect(page.locator('[data-hex-status]')).toContainText('1 byte selected');
  await upload(page, 'minimal.pdf');
  await expect(explanation).toHaveCount(0);
});
test('distinguishes confirmed encryption from an unknown parsing failure', async ({ page }) => {
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(encryptedPdf().bytes),
    mimeType: 'application/pdf',
    name: 'encrypted.pdf',
  });
  await expect(page.getByRole('heading', { name: 'Document overview' })).toBeVisible();
  await expect(page.getByText('This PDF is encrypted')).toBeVisible();
  await expect(page.getByLabel('PDF password', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Why structure is unavailable' })).toHaveCount(0);
  await expect(page.getByRole('button', { exact: true, name: 'First page' })).toBeDisabled();
  await expect(page.getByRole('region', { exact: true, name: 'Original file bytes' })).toBeVisible();
});
test('validates hex offsets and supports keyboard byte navigation', async ({ page }) => {
  await openMinimal(page);
  const offset = page.getByRole('textbox', {
    exact: true,
    name: 'Go to offset',
  });
  await offset.fill('nope');
  await page.getByRole('button', { exact: true, name: 'Jump to offset' }).click();
  await expect(page.locator('[data-hex-status]')).toContainText('Enter a decimal offset');
  await offset.fill('999999');
  await page.getByRole('button', { exact: true, name: 'Jump to offset' }).click();
  await expect(page.locator('[data-hex-status]')).toContainText('Offset must be between');
  await offset.fill('0x0');
  await page.getByRole('button', { exact: true, name: 'Jump to offset' }).click();
  await expect(page.locator('[data-hex-status]')).toContainText('Jumped to 0x0');
  const bytes = page.getByRole('region', { name: /^Hexadecimal bytes/ });
  await expect(bytes).toBeFocused();
  await bytes.press('ArrowRight');
  await expect(page.locator('[data-hex-byte][data-cursor]')).toHaveAttribute('aria-label', /^Offset 1,/);
  await bytes.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'no known containing object' })).toBeVisible();
  await page.getByRole('button', { name: /Offsets in hexadecimal; switch to decimal/ }).click();
  await expect(
    page.getByRole('button', {
      name: /Offsets in decimal; switch to hexadecimal/,
    })
  ).toBeVisible();
});
test('keeps a clicked byte in place while selecting its containing object', async ({ page }) => {
  const data = 'x'.repeat(20000);
  const fixture = classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>'],
    [4, `<< /Length ${data.length} >>\nstream\n${data}\nendstream`],
  ]);
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(fixture.bytes),
    mimeType: 'application/pdf',
    name: 'long-stream.pdf',
  });
  await expect(page.getByRole('contentinfo')).toContainText('4 objects indexed');
  const viewport = page.locator('[data-hex-viewport]');
  await viewport.evaluate((element) => {
    element.scrollTop = 2600;
  });
  const chooseMiddleByte = () =>
    viewport.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const target = Array.from(element.querySelectorAll('button[data-hex-byte]')).find((byteElement) => {
        const rect = byteElement.getBoundingClientRect();
        return rect.top > bounds.top + bounds.height / 2 && rect.bottom < bounds.bottom;
      });
      return target
        ? {
            label: target.getAttribute('aria-label')!,
            top: target.getBoundingClientRect().top,
          }
        : null;
    });
  // Wait for the virtualized rows to reflect the scrolled viewport.
  await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBe(2600);
  await expect.poll(chooseMiddleByte).not.toBeNull();
  const target = (await chooseMiddleByte())!;
  const byte = page.getByRole('button', { exact: true, name: target.label });
  await byte.click();
  await expect(page.getByRole('heading', { name: /4 0\s+obj/ })).toBeVisible();
  await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBe(2600);
  await expect.poll(() => byte.evaluate((element) => element.getBoundingClientRect().top)).toBeCloseTo(target.top, 0);
  await expect(byte).toHaveAttribute('data-cursor', '');
  // Keyboard selection inside the same object should preserve the viewport too.
  await viewport.focus();
  await viewport.press('ArrowDown');
  await viewport.press('Enter');
  await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBe(2600);
  // External object navigation should still reveal its original file range.
  await page
    .getByRole('navigation', { name: 'Document sections' })
    .getByRole('button', { exact: true, name: 'Document catalogue' })
    .click();
  await expect(page.getByRole('heading', { name: /1 0\s+obj/ })).toBeVisible();
  await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBeLessThan(2600);
});
test('keeps exploration paths and expands cyclic references without leaving the object', async ({ page }) => {
  await openMinimal(page);
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  const inspector = page.getByRole('region', {
    exact: true,
    name: 'Object inspector',
  });
  await inspector.getByText('Expand 2 0 inline', { exact: true }).click();
  await expect(inspector).toContainText('already in this path');
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible();
  await inspector.getByRole('button', { exact: true, name: '4 0 R' }).first().click();
  const trail = page.getByRole('navigation', { name: 'Exploration trail' });
  await expect(trail).toContainText('Page 1');
  await expect(trail).toContainText('/Contents');
  await expect(trail).toContainText('4 0 obj');
  await page.getByRole('button', { exact: true, name: 'Back' }).click();
  await expect(trail).not.toContainText('/Contents');
  await page.getByRole('button', { exact: true, name: 'Forward' }).click();
  await expect(trail).toContainText('/Contents');
  await trail.getByRole('button', { exact: true, name: 'Page 1' }).click();
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible();
});
test('bookmarks objects and byte ranges with notes and restores them for the same PDF', async ({ page }) => {
  await openMinimal(page);
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  await page.getByRole('button', { exact: true, name: 'Bookmark' }).click();
  const bookmarks = page.getByRole('region', { name: 'Bookmarks' });
  await bookmarks.getByRole('textbox', { name: 'Note for 3 0 obj · properties' }).fill('Check inherited fonts');
  await page.getByRole('button', { exact: true, name: '4 0 R' }).first().click();
  await bookmarks.getByRole('button', { exact: true, name: '3 0 obj · properties' }).click();
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible();
  await expect(bookmarks.getByRole('textbox')).toHaveValue('Check inherited fonts');
  await page.getByRole('textbox', { exact: true, name: 'Go to offset' }).fill('0');
  await page.getByRole('button', { exact: true, name: 'Jump to offset' }).click();
  await page.getByRole('button', { exact: true, name: 'Offset 0, byte 25' }).click();
  await page.getByRole('button', { exact: true, name: 'Bookmark' }).click();
  await page.getByRole('button', { exact: true, name: '4 0 R' }).first().click();
  await bookmarks.getByRole('button', { name: /^Bytes 0x0/ }).click();
  await expect(page.locator('[data-hex-status]')).toContainText('1 byte selected');
  await upload(page, 'resources.pdf');
  await expect(bookmarks.getByRole('textbox')).toHaveCount(0);
  await page.reload();
  const data = await (await import('node:fs/promises')).readFile(samplePath('minimal.pdf'));
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: data,
    mimeType: 'application/pdf',
    name: 'renamed.pdf',
  });
  await expect(bookmarks.getByRole('textbox', { name: 'Note for 3 0 obj · properties' })).toHaveValue('Check inherited fonts');
  await bookmarks.getByRole('button', { name: /^Bytes 0x0/ }).click();
  await expect(page.locator('[data-hex-status]')).toContainText('1 byte selected');
  await bookmarks.getByRole('button', { name: 'Remove bookmark 3 0 obj · properties' }).click();
  await expect(bookmarks.getByRole('textbox')).toHaveCount(1);
  await page.reload();
  await upload(page, 'minimal.pdf');
  await expect(bookmarks.getByRole('textbox')).toHaveCount(1);
  // A different PDF with an identical filename must not inherit the bookmarks.
  const other = await (await import('node:fs/promises')).readFile(samplePath('resources.pdf'));
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: other,
    mimeType: 'application/pdf',
    name: 'minimal.pdf',
  });
  await expect(bookmarks.getByRole('textbox')).toHaveCount(0);
});
test('pins an object and compares typed dictionary differences', async ({ page }) => {
  await openMinimal(page);
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  await page.getByRole('button', { exact: true, name: 'Pin to compare' }).click();
  await page.getByRole('button', { exact: true, name: '4 0 R' }).first().click();
  const comparison = page.getByRole('region', { name: 'Object comparison' });
  await expect(comparison).toContainText('3 0');
  await expect(comparison).toContainText('4 0');
  await expect(comparison).toContainText('removed');
  await expect(comparison).toContainText('added');
  const divider = page.getByRole('separator', {
    name: 'Resize comparison and inspector',
  });
  const initial = await comparison.boundingBox();
  await divider.focus();
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await comparison.boundingBox())!.height).toBeGreaterThan(initial!.height);
  const handle = (await divider.boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 + 60, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await comparison.boundingBox())!.height).toBeGreaterThan(initial!.height + 40);
  expect(await comparison.evaluate((el) => el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY === 'auto')).toBe(true);
  await comparison.getByRole('checkbox', { name: 'Show differences only' }).check();
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: screenshotPath('object-comparison.png'),
  });
  await page.setViewportSize({ height: 844, width: 390 });
  await expect(comparison).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: screenshotPath('comparison-mobile.png'),
  });
  await comparison.getByRole('button', { name: /Unpin/ }).click();
  await expect(comparison).toHaveCount(0);
});
test('explains decoded instructions and follows resources in their page context', async ({ page }) => {
  await openMinimal(page);
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  await page.getByRole('button', { exact: true, name: '4 0 R' }).first().click();
  await page.getByRole('tab', { exact: true, name: 'Decoded' }).click();
  const decoded = page.getByRole('tabpanel', { exact: true, name: 'Decoded' });
  await decoded.getByRole('button', { exact: true, name: 'Readable instructions' }).click();
  await expect(decoded).toContainText('Select font /F1 at size 24');
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: screenshotPath('readable-instructions.png'),
  });
  await decoded.getByRole('button', { exact: true, name: 'Decoded byte text' }).click();
  await expect(decoded.locator('pre')).toContainText('/F1 24 Tf');
  await decoded.getByRole('button', { exact: true, name: 'Readable instructions' }).click();
  await decoded.getByRole('button', { exact: true, name: 'Inspect /F1 resource' }).first().click();
  await expect(page.getByRole('heading', { name: /5 0\s+obj/ })).toBeVisible();
});
test('explains split text and returns from the guide to the loaded PDF', async ({ page }) => {
  await openMinimal(page);
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  await page.getByRole('button', { exact: true, name: '4 0 R' }).first().click();
  await page.getByRole('tab', { exact: true, name: 'Decoded' }).click();
  const decoded = page.getByRole('tabpanel', { exact: true, name: 'Decoded' });
  // A plain Tj instruction does not need the split-string explanation.
  await expect(decoded.getByRole('list', { name: 'Content stream instructions' })).toBeVisible();
  await expect(decoded.locator('[data-text-help]')).toHaveCount(0);
  const content = 'BT /F1 12 Tf [(lor) 17 (em)] TJ ET';
  const fixture = classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>'],
    [4, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`],
    [5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'],
  ]);
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(fixture.bytes),
    mimeType: 'application/pdf',
    name: 'split-text.pdf',
  });
  await expect(page.locator('[data-filename]')).toContainText('split-text.pdf');
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  await page.getByRole('button', { exact: true, name: '4 0 R' }).first().click();
  await page.getByRole('tab', { exact: true, name: 'Decoded' }).click();
  const help = decoded.locator('[data-text-help]');
  await help.locator('summary').click();
  await expect(help).toContainText('17 shifts where “em” starts');
  const reference = decoded.getByRole('link', {
    exact: true,
    name: 'PDF operator reference',
  });
  await expect(reference).toHaveAttribute('href', 'https://pdfa.org/download-area/cheat-sheets/OperatorsAndOperands.pdf');
  await expect(reference).toHaveAttribute('target', '_blank');
  await expect(reference).toHaveAttribute('rel', 'noopener noreferrer');
  await help.getByRole('link', { exact: true, name: 'Read the Streams guide' }).click();
  await expect(
    page.getByRole('heading', {
      exact: true,
      name: 'Find visible text in a decoded stream',
    })
  ).toBeVisible();
  await page.getByText('Convert a spacing adjustment to a distance').click();
  await expect(page.locator('details', { hasText: 'Convert a spacing adjustment' })).toContainText('0.204');
  await expect(page.getByRole('link', { exact: true, name: 'PDF operator reference' })).toHaveAttribute('target', '_blank');
  await page.getByRole('link', { exact: true, name: 'Back to the workspace' }).click();
  await expect(page.locator('[data-filename]')).toContainText('split-text.pdf');
  await expect(
    decoded.getByRole('list', { name: 'Content stream instructions' }).locator('code').filter({ hasText: '[(lor) 17 (em)] TJ' })
  ).toBeVisible();
});
test('browses font details, generates local image thumbnails and follows using pages', async ({ page }) => {
  const remote: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(page.url()).origin) remote.push(request.url());
  });
  await upload(page, 'resources.pdf');
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { exact: true, name: 'Resources' }).click();
  const browser = page.getByRole('region', { name: 'Visual resource browser' });
  await expect(browser).toContainText('Helvetica');
  await expect(browser.getByRole('button', { exact: true, name: 'Preview image 6 0' })).toHaveCount(0);
  const image = browser.getByRole('img', {
    exact: true,
    name: 'Image object 6 0',
  });
  await expect(image).toBeVisible();
  expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  await mkdir(resolve('.context'), { recursive: true });
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: screenshotPath('resource-browser.png'),
  });
  await browser.getByRole('button', { exact: true, name: 'Page 1' }).first().click();
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible();
  expect(remote).toEqual([]);
});
test('uploads and replaces local PDFs while clearing stale navigation', async ({ page }) => {
  await upload(page, 'minimal.pdf');
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  await expect(page.getByRole('button', { exact: true, name: 'Back' })).toBeEnabled();
  await upload(page, 'resources.pdf');
  await expect(page.getByRole('contentinfo')).toContainText('10 objects indexed');
  await expect(page.getByRole('button', { exact: true, name: 'Back' })).toBeDisabled();
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toHaveCount(0);
  await page.getByRole('button', { exact: true, name: 'Close PDF' }).click();
  await expect(page.getByRole('heading', { name: 'Look inside a PDF.' })).toBeVisible();
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.alloc(0),
    mimeType: 'application/pdf',
    name: 'empty.pdf',
  });
  await expect(page.getByRole('alert')).toContainText('This file is empty.');
  await upload(page, 'minimal.pdf');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
test('distinguishes compressed-object provenance and decodes filtered streams', async ({ page }) => {
  await upload(page, 'compressed.pdf');
  await page
    .getByRole('navigation', { name: 'Document sections' })
    .getByRole('button', { exact: true, name: 'Document catalogue' })
    .click();
  await expect(page.getByRole('heading', { name: /1 0\s+obj/ })).toBeVisible();
  await expect(page.locator('[data-provenance]')).toContainText('Decoded object stream');
  await expect(page.locator('[data-provenance]')).toContainText('6 0');
  await page.getByRole('tab', { exact: true, name: 'Source' }).click();
  await expect(page.getByRole('tabpanel', { exact: true, name: 'Source' })).toContainText('These are not original file bytes.');
  await upload(page, 'resources.pdf');
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  await page.getByRole('button', { exact: true, name: '4 0 R' }).first().click();
  await page.getByRole('tab', { exact: true, name: 'Decoded' }).click();
  await expect(page.getByRole('tabpanel', { exact: true, name: 'Decoded' })).toContainText('Resources and references');
  await expect(page.getByRole('tabpanel', { exact: true, name: 'Decoded' })).toContainText('FlateDecode');
});
for (const width of [1440, 390]) {
  test(`custom search scope supports keyboard selection and keeps results open at ${width}px`, async ({ page }) => {
    await cacheEngineAssets(page);
    await page.setViewportSize({ height: 1000, width });
    await openMinimal(page);
    const scope = page.getByRole('combobox', {
      exact: true,
      name: 'Search scope',
    });
    const search = page.getByRole('textbox', {
      exact: true,
      name: 'Search document',
    });
    const form = page.locator('form', { has: page.getByRole('textbox', { name: 'Search document' }) });
    const empty = (await form.boundingBox())!;
    const submit = (await page.getByRole('button', { exact: true, name: 'Run search' }).boundingBox())!;
    expect(empty.x + empty.width - submit.x - submit.width).toBeLessThan(12);
    await expect(scope).toHaveJSProperty('tagName', 'BUTTON');
    await scope.press('ArrowDown');
    await expect(page.getByRole('listbox')).toBeVisible();
    const first = page.getByRole('option', { exact: true, name: 'Objects' });
    await expect(first).toHaveAttribute('data-highlighted', '');
    // Base UI highlights the first option a few milliseconds before it moves focus there.
    // Wait for focus, otherwise a slow runner sends End to the trigger, which ignores it.
    await expect(first).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByRole('option', { exact: true, name: 'Decoded streams' })).toHaveAttribute('data-highlighted', '');
    await page.keyboard.press('Enter');
    await expect(scope).toContainText('Decoded streams');
    await expect(page.getByRole('region', { exact: true, name: 'Search results' })).toHaveCount(0);
    await expect(scope).toBeFocused();
    await scope.press('ArrowDown');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(scope).toContainText('Decoded streams');
    await search.fill('Hello');
    await expect(page.getByRole('button', { exact: true, name: 'Clear search' })).toBeVisible();
    expect((await form.boundingBox())!.height).toBe(empty.height);
    await page.getByRole('button', { exact: true, name: 'Clear search' }).click();
    await expect(search).toBeFocused();
    await expect(search).toHaveValue('');
    await search.fill('Hello');
    await selectSearchScope(page, 'text');
    const results = page.getByRole('region', {
      exact: true,
      name: 'Search results',
    });
    await expect(results).toContainText('1 match');
    await results.locator('[data-search-result]').first().focus();
    await scope.click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await expect(results).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(results).toBeVisible();
    await selectSearchScope(page, 'pageText');
    await expect(results).toBeVisible();
    await expect(search).toHaveValue('Hello');
    await expect(results).toContainText('1 page');
    await expect(results.locator('[data-search-result] mark')).toHaveText('Hello');
  });
}
for (const width of [1440, 390]) {
  test(`search selection preserves focus and labels single-page navigation at ${width}px`, async ({ page }) => {
    await cacheEngineAssets(page);
    await page.setViewportSize({ height: 1000, width });
    const fixture = pageTextSearchPdf(true);
    await page.getByLabel('Open local PDF').setInputFiles({
      buffer: Buffer.from(fixture.bytes),
      mimeType: 'application/pdf',
      name: 'focus-search.pdf',
    });
    await expect(page.getByRole('contentinfo')).toContainText('5 objects indexed');
    await selectSearchScope(page, 'pageText');
    const query = page.getByRole('textbox', {
      exact: true,
      name: 'Search document',
    });
    await query.fill('Hello');
    await expect
      .poll(() =>
        page
          .locator('form', { has: page.getByRole('textbox', { name: 'Search document' }) })
          .evaluate((el) => getComputedStyle(el).boxShadow)
      )
      .toContain('0px 0px 0px 2px');
    await query.press('Enter');
    const results = page.getByRole('region', {
      exact: true,
      name: 'Search results',
    });
    const row = results.locator('[data-search-result]');
    await expect(row).toHaveCount(1);
    await expect(
      results.getByRole('group', {
        exact: true,
        name: 'Search result navigation',
      })
    ).toContainText('Page 1 of 1');
    await expect(results.getByRole('button', { exact: true, name: 'Next search result' })).toBeDisabled();
    await expect(
      results.getByRole('button', {
        exact: true,
        name: 'Previous search result',
      })
    ).toBeDisabled();
    const showResults = page.getByRole('button', {
      exact: true,
      name: 'Show search results',
    });
    await expect(showResults).toContainText('1 page');
    await query.press('ArrowDown');
    await expect(row).toBeFocused();
    await row.press('Enter');
    await expect(results).toHaveCount(0);
    await expect(query).toBeFocused();
    await query.press('Tab');
    await expect(page.getByRole('combobox', { exact: true, name: 'Search scope' })).toBeFocused();
    await showResults.click();
    await row.click();
    await expect(showResults).toBeFocused();
    await showResults.click();
    await results.getByRole('button', { name: /Show bytes/ }).click();
    const bytes = page.getByRole('region', {
      exact: true,
      name: 'Decoded stream bytes',
    });
    await expect(bytes.locator('[data-hex-viewport]')).toBeFocused();
    await expect(bytes.locator('button[data-hex-byte][data-selected]')).toHaveCount(5);
    await expect(bytes.locator('button[data-hex-byte][data-selected]').first()).toBeInViewport();
    await showResults.click();
    const openPreview = results.getByRole('button', {
      exact: true,
      name: 'Open page preview',
    });
    await openPreview.focus();
    await openPreview.press('Enter');
    await expect(results).toHaveCount(0);
    await expect(page.getByRole('img', { exact: true, name: 'focus-search.pdf, page 1' })).toBeVisible();
    await expect(showResults).toBeFocused();
  });
}
for (const colorScheme of ['light', 'dark'] as const) {
  test(`focused buttons and tabs show one focus ring in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await openMinimal(page);
    const form = page.locator('form', { has: page.getByRole('textbox', { name: 'Search document' }) });
    const formShadow = () => form.evaluate((node) => getComputedStyle(node).boxShadow);

    await page.getByRole('textbox', { exact: true, name: 'Search document' }).focus();
    await expect.poll(formShadow).toContain('0px 0px 0px 2px');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const runSearch = page.getByRole('button', { exact: true, name: 'Run search' });
    await expect(runSearch).toBeFocused();
    await expect.poll(() => focusRing(runSearch)).toBe('solid 2px 2px | none');
    await expect.poll(formShadow).toBe('none');

    await page.getByRole('complementary', { name: 'Structure explorer' }).locator('button:has(code)').first().click();
    const sourceTab = page.getByRole('tab', { name: /^Source/ });
    // Firefox shows a ring after scripted focus only when focus already had one, so reach the tabs with the keyboard.
    await page.getByRole('tab', { name: /^Properties/ }).focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('ArrowRight');
    await expect(sourceTab).toBeFocused();
    await expect.poll(() => focusRing(sourceTab)).toBe('solid 2px 2px | none');
  });
}
test('searches keys and original hex bytes with distinct navigation', async ({ page }) => {
  await openMinimal(page);
  const search = page.getByRole('textbox', {
    exact: true,
    name: 'Search document',
  });
  await selectSearchScope(page, 'keys');
  await search.fill('Contents');
  await page.getByRole('button', { exact: true, name: 'Run search' }).click();
  const results = page.getByRole('region', {
    exact: true,
    name: 'Search results',
  });
  await expect(results).toContainText('1 match');
  await results.getByRole('button', { name: /3 0 obj/ }).click();
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible();
  await selectSearchScope(page, 'hex');
  await search.fill('25 50 44 46');
  await page.getByRole('button', { exact: true, name: 'Run search' }).click();
  await expect(results).toContainText('1 match');
  await results.getByRole('button', { name: /0x0/ }).click();
  await expect(page.locator('[data-hex-status]')).toContainText('4 bytes selected');
});
test('steps through search results, wraps, and resets for a new search', async ({ page }) => {
  await openMinimal(page);
  const search = page.getByRole('textbox', {
    exact: true,
    name: 'Search document',
  });
  const results = page.getByRole('region', {
    exact: true,
    name: 'Search results',
  });
  await search.fill('0');
  await search.press('Enter');
  const matches = results.locator('[data-search-matches] button');
  await expect.poll(() => matches.count()).toBeGreaterThan(1);
  const count = await matches.count();
  await expect(results.getByRole('group')).toContainText(`1 of ${count}`);
  await expect(matches.first()).toHaveAttribute('aria-current', 'true');
  await results.getByRole('button', { exact: true, name: 'Next search result' }).click();
  await expect(results.getByRole('group')).toContainText(`2 of ${count}`);
  await expect(matches.nth(1)).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('heading', { name: /2 0\s+obj/ })).toBeVisible();
  await matches.last().click();
  await page.getByRole('button', { exact: true, name: 'Show search results' }).click();
  await results.getByRole('button', { exact: true, name: 'Next search result' }).click();
  await expect(matches.first()).toHaveAttribute('aria-current', 'true');
  await results.getByRole('button', { exact: true, name: 'Previous search result' }).click();
  await expect(matches.last()).toHaveAttribute('aria-current', 'true');
  await search.fill('no-such-object');
  await search.press('Enter');
  await expect(results.getByRole('group')).toContainText('0 of 0');
  await expect(results.getByRole('button', { exact: true, name: 'Next search result' })).toBeDisabled();
  await selectSearchScope(page, 'text');
  await search.fill('obj');
  await search.press('Enter');
  await expect(results.getByRole('group')).toContainText('1 of 10');
  await expect(page.locator('[data-hex-status]')).toContainText('3 bytes selected');
  await results.getByRole('button', { exact: true, name: 'Next search result' }).click();
  await expect(results.getByRole('group')).toContainText('2 of 10');
  await expect(matches.nth(1)).toHaveAttribute('aria-current', 'true');
});
test('preserves intervening navigation when an asynchronous search finishes', async ({ page }) => {
  await page.addInitScript(() => {
    const postMessage = Worker.prototype.postMessage;
    const pending: {
      worker: Worker;
      message: unknown;
    }[] = [];
    let released = false;
    Worker.prototype.postMessage = function (message) {
      if (!released && message?.type === 'stream') pending.push({ message, worker: this });
      else postMessage.call(this, message, []);
    };
    window.addEventListener('release-search', () => {
      released = true;
      for (const { worker, message } of pending) postMessage.call(worker, message, []);
    });
  });
  await page.reload();
  await openMinimal(page);
  await selectSearchScope(page, 'decoded');
  await page.getByRole('textbox', { exact: true, name: 'Search document' }).fill('Hello');
  await page.getByRole('button', { exact: true, name: 'Run search' }).click();
  await expect(page.getByRole('region', { exact: true, name: 'Search results' })).toContainText('Searching for “Hello”…');
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('release-search')));
  await expect(page.getByRole('heading', { name: /4 0\s+obj/ })).toBeVisible();
  await page.getByRole('button', { exact: true, name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible();
});
test('keeps the mobile header compact with a long filename and search results', async ({ page }) => {
  for (const width of [320, 390, 600]) {
    await page.setViewportSize({ height: 844, width });
    await page.getByLabel('Open local PDF').setInputFiles({
      buffer: await readFile(samplePath('minimal.pdf')),
      mimeType: 'application/pdf',
      name: 'a-very-long-document-filename-for-mobile-layout-testing.pdf',
    });
    await expect(page.getByRole('contentinfo')).toContainText('objects indexed');
    const header = page.getByRole('banner');
    const identity = await header.getByRole('link', { exact: true, name: 'PDF Internals' }).boundingBox();
    const actions = await header.locator('[data-header-actions]').boundingBox();
    expect(Math.abs(identity!.y - actions!.y)).toBeLessThan(10);
    const filename = await header.locator('[data-filename]').boundingBox();
    expect(Math.abs(filename!.y + filename!.height / 2 - actions!.y - actions!.height / 2)).toBeLessThan(2);
    expect(filename!.x).toBeGreaterThanOrEqual(identity!.x + identity!.width);
    expect(filename!.x + filename!.width).toBeLessThanOrEqual(actions!.x);
    expect((await header.boundingBox())!.height).toBe(58);
    if (width <= 390)
      expect(await header.locator('[data-filename] > span[title]').evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
        true
      );
    await expect(header.getByRole('button', { exact: true, name: 'Close PDF' })).toBeVisible();
    await expect(header.locator('[data-action-label]').first()).toBeHidden();
    await page.getByRole('textbox', { exact: true, name: 'Search document' }).fill('0');
    await page.getByRole('button', { exact: true, name: 'Run search' }).click();
    await expect(page.getByRole('button', { exact: true, name: 'Next search result' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('[data-workspace="mobile"]')).toBeVisible();
  }
  await page.setViewportSize({ height: 844, width: 390 });
  await page.screenshot({
    animations: 'disabled',
    path: screenshotPath('mobile-search.png'),
  });
});
test('restores sections and exact byte selections through history', async ({ page }) => {
  await openMinimal(page);
  const back = page.getByRole('button', { exact: true, name: 'Back' });
  const forward = page.getByRole('button', { exact: true, name: 'Forward' });
  const sections = page.getByRole('navigation', { name: 'Document sections' });
  await sections.getByRole('button', { exact: true, name: 'File structure' }).click();
  await expect(page.getByRole('heading', { name: 'Cross-reference entry point' })).toBeVisible();
  await page.getByRole('button', { name: /startxref →/ }).click();
  const xrefSelection = await page.locator('[data-hex-status]').innerText();
  expect(xrefSelection).toContain('32 bytes selected');
  await sections.getByRole('button', { exact: true, name: 'Document catalogue' }).click();
  await expect(page.getByRole('heading', { name: /1 0\s+obj/ })).toBeVisible();
  await back.click();
  await expect(page.getByRole('heading', { name: 'Cross-reference entry point' })).toBeVisible();
  await expect(page.locator('[data-hex-status]')).toHaveText(xrefSelection);
  await back.click();
  await expect(page.locator('[data-hex-status]')).toContainText('offsets are zero-based');
  await back.click();
  await expect(page.getByRole('heading', { name: 'Document overview' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cross-reference entry point' })).toHaveCount(0);
  await forward.click();
  await expect(page.getByRole('heading', { name: 'Cross-reference entry point' })).toBeVisible();
  await forward.click();
  await expect(page.locator('[data-hex-status]')).toHaveText(xrefSelection);
  // A new visit from the middle replaces the abandoned forward branch.
  await sections.getByRole('button', { exact: true, name: 'Overview' }).click();
  await expect(forward).toBeDisabled();
});
test('restores byte-search results and unknown-byte selections', async ({ page }) => {
  await openMinimal(page);
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  const back = page.getByRole('button', { exact: true, name: 'Back' });
  const forward = page.getByRole('button', { exact: true, name: 'Forward' });
  await selectSearchScope(page, 'hex');
  await page.getByRole('textbox', { exact: true, name: 'Search document' }).fill('25 50 44 46');
  await page.getByRole('button', { exact: true, name: 'Run search' }).click();
  await page.getByRole('region', { exact: true, name: 'Search results' }).getByRole('button', { name: /0x0/ }).click();
  await expect(page.locator('[data-hex-status]')).toContainText('4 bytes selected');
  await back.click();
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible();
  await expect(page.locator('[data-hex-status]')).not.toContainText('4 bytes selected');
  await forward.click();
  await expect(page.locator('[data-hex-status]')).toContainText('4 bytes selected');
  await page.getByRole('button', { exact: true, name: 'Offset 0, byte 25' }).click();
  await expect(page.locator('[data-hex-status]')).toContainText('1 byte selected');
  await expect(page.getByRole('status').filter({ hasText: 'no known containing object' })).toBeVisible();
  await back.click();
  await expect(page.locator('[data-hex-status]')).toContainText('4 bytes selected');
  await expect(page.getByRole('status').filter({ hasText: 'no known containing object' })).toHaveCount(0);
  await forward.click();
  await expect(page.getByRole('status').filter({ hasText: 'no known containing object' })).toBeVisible();
});
test('restores inspector tabs and byte viewports per history visit', async ({ page }) => {
  const stream = 'q Q\n'.repeat(2000);
  const fixture = classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [3, '<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>'],
    [4, `<< /Length ${stream.length} >>\nstream\n${stream}endstream`],
  ]);
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(fixture.bytes),
    mimeType: 'application/pdf',
    name: 'scroll.pdf',
  });
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  await page.getByRole('button', { exact: true, name: '4 0 R' }).first().click();
  const back = page.getByRole('button', { exact: true, name: 'Back' });
  const forward = page.getByRole('button', { exact: true, name: 'Forward' });
  const hex = page.locator('[data-hex-viewport]');
  const source = page.getByRole('tabpanel', { exact: true, name: 'Source' });
  await page.getByRole('tab', { exact: true, name: 'Source' }).click();
  await expect(source).toContainText('endstream');
  await source.evaluate((el) => {
    el.scrollTop = 1200;
  });
  await hex.evaluate((el) => {
    el.scrollTop = 2600;
  });
  await expect.poll(() => source.evaluate((el) => el.scrollTop)).toBe(1200);
  await page.getByRole('tab', { exact: true, name: 'Raw stream' }).click();
  const raw = page.getByRole('tabpanel', { exact: true, name: 'Raw stream' });
  await expect(raw).toContainText('q Q');
  await expect.poll(() => raw.evaluate((el) => el.scrollTop)).toBe(0);
  await raw.evaluate((el) => {
    el.scrollTop = 1800;
  });
  await hex.evaluate((el) => {
    el.scrollTop = 5200;
  });
  await back.click();
  await expect(source).toBeVisible();
  await expect.poll(() => source.evaluate((el) => el.scrollTop)).toBe(1200);
  await expect.poll(() => hex.evaluate((el) => el.scrollTop)).toBe(2600);
  await forward.click();
  await expect(raw).toContainText('q Q');
  await expect.poll(() => raw.evaluate((el) => el.scrollTop)).toBe(1800);
  await expect.poll(() => hex.evaluate((el) => el.scrollTop)).toBe(5200);
  // Decoded content arrives asynchronously too; switching away unmounts it.
  await page.getByRole('tab', { exact: true, name: 'Decoded' }).click();
  const decoded = page.getByRole('tabpanel', { exact: true, name: 'Decoded' });
  await expect(decoded).toContainText('Decoded stream bytes');
  await expect(decoded.getByRole('button', { exact: true, name: 'Decoded byte text' })).toBeVisible();
  await decoded.getByRole('button', { exact: true, name: 'Decoded byte text' }).click();
  await decoded.evaluate((el) => {
    el.scrollTop = 1100;
  });
  await back.click();
  await expect.poll(() => raw.evaluate((el) => el.scrollTop)).toBe(1800);
  await forward.click();
  await expect.poll(() => decoded.evaluate((el) => el.scrollTop)).toBe(1100);
  await back.click();
  // A second visit to the same tab starts at the top and replaces Forward.
  await back.click();
  await page.getByRole('tab', { exact: true, name: 'Raw stream' }).click();
  await expect(raw).toContainText('q Q');
  await expect.poll(() => raw.evaluate((el) => el.scrollTop)).toBe(0);
  await expect(forward).toBeDisabled();
  // Mobile pane unmounts retain the current visit, including async streams.
  await raw.evaluate((el) => {
    el.scrollTop = 900;
  });
  await page.setViewportSize({ height: 844, width: 390 });
  await expect(raw).toContainText('q Q');
  await expect.poll(() => raw.evaluate((el) => el.scrollTop)).toBe(900);
  const panes = page.getByRole('navigation', { name: 'Workspace pane' });
  await panes.getByRole('button', { exact: true, name: 'Original bytes' }).click();
  await hex.evaluate((el) => {
    el.scrollTop = 3900;
  });
  await panes.getByRole('button', { exact: true, name: 'Inspector' }).click();
  await expect(raw).toContainText('q Q');
  await expect.poll(() => raw.evaluate((el) => el.scrollTop)).toBe(900);
  await panes.getByRole('button', { exact: true, name: 'Original bytes' }).click();
  await expect.poll(() => hex.evaluate((el) => el.scrollTop)).toBe(3900);
  await page.setViewportSize({ height: 1000, width: 1440 });
  await page.getByRole('button', { exact: true, name: 'Close PDF' }).click();
  await openMinimal(page);
  await expect.poll(() => hex.evaluate((el) => el.scrollTop)).toBe(0);
  await expect(back).toBeDisabled();
});
test('restores the resource browser scroll and expanded list after inspecting an object', async ({ page }) => {
  const fonts = Array.from({ length: 70 }, (_, index) => [index + 4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']);
  const fixture = classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [3, '<< /Type /Page /Parent 2 0 R >>'],
    ...fonts,
  ]);
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(fixture.bytes),
    mimeType: 'application/pdf',
    name: 'fonts.pdf',
  });
  await expect(page.getByRole('contentinfo')).toContainText('73 objects indexed');
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { exact: true, name: 'Resources' }).click();
  const browser = page.getByRole('region', { name: 'Visual resource browser' });
  await browser.getByRole('button', { name: /Show.*more/i }).click();
  const target = browser.getByRole('button', { exact: true, name: '73 0 obj' });
  await target.scrollIntoViewIfNeeded();
  const top = await browser.evaluate((el) => el.scrollTop);
  expect(top).toBeGreaterThan(1200);
  await target.click();
  await expect(page.getByRole('heading', { name: /73 0\s+obj/ })).toBeVisible();
  await page.getByRole('button', { exact: true, name: 'Back' }).click();
  await expect(target).toBeVisible();
  await expect.poll(() => browser.evaluate((el) => el.scrollTop)).toBe(top);
});
test('keeps smaller object lists visible when history changes sections', async ({ page }) => {
  const fixture = classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>'],
    ...Array.from({ length: 200 }, (_, index) => [index + 4, 'null']),
  ]);
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(fixture.bytes),
    mimeType: 'application/pdf',
    name: 'many-objects.pdf',
  });
  await expect(page.getByRole('contentinfo')).toContainText('203 objects indexed');
  const sections = page.getByRole('navigation', { name: 'Document sections' });
  await sections.getByRole('button', { name: /^Pages/ }).click();
  await expect(
    page.getByRole('navigation', { name: 'Page relationships' }).getByRole('button', { exact: true, name: 'Page 1 3 0 obj' })
  ).toBeVisible();
  await sections.getByRole('button', { exact: true, name: 'All objects' }).click();
  await page.locator('[data-object-list]').evaluate((element) => {
    element.scrollTop = 3000;
  });
  await expect(page.locator('[data-object-list] button').first()).not.toContainText('1 0');
  await page.getByRole('button', { exact: true, name: 'Back' }).click();
  await expect(
    page.getByRole('navigation', { name: 'Page relationships' }).getByRole('button', { exact: true, name: 'Page 1 3 0 obj' })
  ).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Page relationships' })).toContainText('3 0 obj');
  await page.getByRole('button', { exact: true, name: 'Forward' }).click();
  await expect(page.locator('[data-object-list] button').first()).toContainText('1 0');
});
test('renders a local EmbedPDF preview without external requests or runtime errors', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  const externalRequests: string[] = [];
  const writes: string[] = [];
  const appOrigin = new URL(page.url()).origin;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith(`${appOrigin}/`) && !/^(?:blob:|data:)/.test(request.url())) externalRequests.push(request.url());
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(`${request.method()} ${request.url()}`);
  });
  await upload(page, 'minimal.pdf');
  await page.getByRole('button', { exact: true, name: 'Page preview' }).click();
  const image = page.getByRole('img', {
    exact: true,
    name: 'minimal.pdf, page 1',
  });
  await expect(image).toBeVisible({ timeout: 60000 });
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  await expect(page.getByRole('button', { exact: true, name: 'Previous preview page' })).toBeDisabled();
  await expect(page.getByRole('button', { exact: true, name: 'Next preview page' })).toBeDisabled();
  await page.getByRole('button', { exact: true, name: 'Zoom in preview' }).click();
  await expect(page.getByText('125%', { exact: true })).toBeVisible();
  await expect(image).toBeVisible();
  await page.getByRole('button', { exact: true, name: 'Inspect' }).click();
  await expect(page.getByRole('heading', { name: 'Document overview' })).toBeVisible();
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
  expect(writes).toEqual([]);
});
test('uses pane navigation at mobile widths without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await openMinimal(page);
  const panes = page.getByRole('navigation', {
    exact: true,
    name: 'Workspace pane',
  });
  await expect(panes).toBeVisible();
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible();
  await panes.getByRole('button', { exact: true, name: 'Original bytes' }).click();
  await expect(page.getByRole('region', { name: /^Hexadecimal bytes/ })).toBeVisible();
  await expect(page.locator('[data-hex-byte][data-selected]').first()).toBeVisible();
  await panes.getByRole('button', { exact: true, name: 'Explorer' }).click();
  await expect(page.getByRole('complementary', { exact: true, name: 'Structure explorer' })).toBeVisible();
  await panes.getByRole('button', { exact: true, name: 'Inspector' }).click();
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: screenshotPath('mobile.png'),
  });
});
test('links to the static limitations page without a modal and retains the document', async ({ page }) => {
  await expect(page.getByText('Early preview', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /View limitations/ })).toHaveCount(0);
  await openMinimal(page);
  const footerLink = page.getByRole('contentinfo').getByRole('link', { exact: true, name: 'Limitations' });
  await expect(footerLink).toHaveAttribute('href', '/limitations');
  await footerLink.click();
  await expect(page).toHaveURL(/\/limitations$/);
  await expect(
    page.getByRole('heading', {
      exact: true,
      name: 'Supported features and limitations',
    })
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('contentinfo')).toContainText('5 objects indexed');
  await expect(page.locator('[data-filename]')).toContainText('minimal.pdf');
});
test('explores a page tree with inherited resources, explanations and labelled connections', async ({ page }) => {
  await openMinimal(page);
  const sections = page.getByRole('navigation', { name: 'Document sections' });
  await sections.getByRole('button', { name: /^Pages/ }).click();
  const tree = page.getByRole('navigation', { name: 'Page relationships' });
  const expand = tree.getByRole('button', {
    exact: true,
    name: 'Expand Page 1 3 0',
  });
  await expand.focus();
  await page.keyboard.press('Enter');
  await expect(tree).toContainText('/Resources (inherited)');
  await tree
    .getByRole('button', {
      exact: true,
      name: 'Content streams · /Contents 4 0 obj',
    })
    .click();
  await expect(page.locator('[data-object-explanation]')).toContainText('content stream referenced by Page 1');
  await expect(page.locator('[data-relationship-links]').last()).toContainText('via /Contents');
  await expect(page.getByRole('navigation', { name: 'Exploration trail' })).toContainText('/Contents');
  await page.getByRole('button', { exact: true, name: 'Back' }).click();
  await expect(tree.getByRole('button', { exact: true, name: 'Collapse Page 1 3 0' })).toBeVisible();
  await tree
    .getByRole('button', {
      exact: true,
      name: 'Expand Resources · /Resources (inherited)',
    })
    .click();
  await tree.getByRole('button', { exact: true, name: 'Expand Fonts · /Font' }).click();
  await tree.getByRole('button', { exact: true, name: '/F1 5 0 obj' }).click();
  await expect(page.locator('[data-object-explanation]')).toContainText('font dictionary for Helvetica');
  await expect(page.locator('[data-relationship-links]').last()).toContainText('via /Resources → /Font → /F1');
  await expect(page.getByRole('navigation', { name: 'Exploration trail' })).toContainText('Inherited from 2 0 obj');
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: screenshotPath('page-tree-desktop.png'),
  });
  // Reverse links select the actual owning object, without inventing a forward path.
  await page.locator('[data-relationship-links] button').filter({ hasText: 'via /Resources' }).click();
  await expect(page.getByRole('heading', { name: /2 0\s+obj/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Exploration trail' })).not.toContainText('/F1');
  await sections.getByRole('button', { exact: true, name: 'All objects' }).click();
  await sections.getByRole('button', { name: /^Pages/ }).click();
  await expect(tree.getByRole('button', { exact: true, name: '/F1 5 0 obj' })).toBeVisible();
  // Lifted expansion state survives mobile pane unmounts.
  await page.setViewportSize({ height: 844, width: 390 });
  const panes = page.getByRole('navigation', { name: 'Workspace pane' });
  await panes.getByRole('button', { exact: true, name: 'Explorer' }).click();
  await tree.getByRole('button', { exact: true, name: '/F1 5 0 obj' }).click();
  await expect(page.locator('[data-object-explanation]')).toContainText('font dictionary');
  await panes.getByRole('button', { exact: true, name: 'Explorer' }).click();
  await expect(tree.getByRole('button', { exact: true, name: '/F1 5 0 obj' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: screenshotPath('page-tree-mobile.png'),
  });
  await panes.getByRole('button', { exact: true, name: 'Inspector' }).click();
  await upload(page, 'resources.pdf');
  await panes.getByRole('button', { exact: true, name: 'Explorer' }).click();
  await sections.getByRole('button', { name: /^Pages/ }).click();
  await expect(tree.getByRole('button', { exact: true, name: 'Expand Page 1 3 0' })).toBeVisible();
});
test('labels cyclic, shared and unavailable page connections', async ({ page }) => {
  const fixture = classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>'],
    [3, '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /Annots [99 0 R] >>'],
    [4, '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> >>'],
    [5, '<< /Type /Font /BaseFont /Example /Self 5 0 R >>'],
  ]);
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(fixture.bytes),
    mimeType: 'application/pdf',
    name: 'graph.pdf',
  });
  await expect(page.getByRole('contentinfo')).toContainText('5 objects indexed');
  await page
    .getByRole('navigation', { name: 'Document sections' })
    .getByRole('button', { name: /^Pages/ })
    .click();
  const tree = page.getByRole('navigation', { name: 'Page relationships' });
  await tree.getByRole('button', { exact: true, name: 'Expand Page 1 3 0' }).click();
  await tree.getByRole('button', { exact: true, name: 'Expand Resources · /Resources' }).click();
  await tree.getByRole('button', { exact: true, name: 'Expand Fonts · /Font' }).click();
  await expect(tree).toContainText('Shared reference');
  await tree.getByRole('button', { exact: true, name: 'Expand /F1 5 0' }).click();
  await expect(tree).toContainText('Already in this path');
  await expect(tree.getByRole('button', { exact: true, name: 'Expand /Self 5 0' })).toHaveCount(0);
  await tree.getByRole('button', { exact: true, name: 'Expand Annotations · /Annots' }).click();
  await expect(tree).toContainText('99 0 R');
  await expect(tree).toContainText('Unavailable reference');
});
test('pages large trees and preserves later-page expansion through navigation', async ({ page }) => {
  const ids = Array.from({ length: 52 }, (_, index) => index + 3);
  const fixture = classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, `<< /Type /Pages /Kids [${ids.map((id) => `${id} 0 R`).join(' ')}] /Count 52 >>`],
    ...ids.map((id) => [id, '<< /Type /Page /Parent 2 0 R /Annots [55 0 R] >>']),
    [55, '<< /Subtype /Text /Contents (A note) >>'],
  ]);
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(fixture.bytes),
    mimeType: 'application/pdf',
    name: 'pages.pdf',
  });
  await expect(page.getByRole('contentinfo')).toContainText('55 objects indexed');
  const sections = page.getByRole('navigation', { name: 'Document sections' });
  await sections.getByRole('button', { name: /^Pages/ }).click();
  const tree = page.getByRole('navigation', { name: 'Page relationships' });
  await expect(tree.getByRole('button', { exact: true, name: 'Page 52 54 0 obj' })).toHaveCount(0);
  await tree.getByRole('button', { exact: true, name: 'Show 2 more pages' }).click();
  await tree.getByRole('button', { exact: true, name: 'Expand Page 52 54 0' }).click();
  await tree.getByRole('button', { exact: true, name: 'Page 52 54 0 obj' }).click();
  await expect(page.locator('[data-object-explanation]')).toContainText('Page 52 of 52');
  await sections.getByRole('button', { exact: true, name: 'All objects' }).click();
  await page.getByRole('button', { exact: true, name: 'Back' }).click();
  await expect(tree.getByRole('button', { exact: true, name: 'Collapse Page 52 54 0' })).toBeVisible();
});
test('unlocks a password PDF after an incorrect attempt, previews it, and clears the password on replacement', async ({ page }) => {
  await page.getByLabel('Open local PDF').setInputFiles(resolve('tests/fixtures/encryption/AES-256-password.pdf'));
  const password = page.getByLabel('PDF password', { exact: true });
  await password.fill('wrong');
  await password.press('Enter');
  await expect(page.getByRole('alert')).toContainText('That password did not unlock');
  await password.fill('secret');
  await page.screenshot({
    fullPage: true,
    path: screenshotPath('encrypted-password.png'),
  });
  await password.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Encrypted PDF unlocked locally' })).toBeVisible();
  await expect(password).toHaveCount(0);
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  await page.getByRole('button', { exact: true, name: 'Preview' }).click();
  await expect(page.getByRole('img', { name: /AES-256-password.pdf, page 1/ })).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: screenshotPath('encrypted-unlocked-preview.png'),
  });
  await page.getByLabel('Open local PDF').setInputFiles(resolve('tests/fixtures/encryption/AES-256-password.pdf'));
  await expect(password).toHaveValue('');
  await expect(page.getByRole('button', { exact: true, name: 'First page' })).toBeDisabled();
  await page.setViewportSize({ height: 844, width: 390 });
  await page.screenshot({
    fullPage: true,
    path: screenshotPath('encrypted-password-mobile.png'),
  });
});
test('automatically inspects encrypted PDFs with an empty opening password', async ({ page }) => {
  await page.getByLabel('Open local PDF').setInputFiles(resolve('tests/fixtures/encryption/AES-128-empty.pdf'));
  await expect(page.getByRole('status').filter({ hasText: 'Encrypted PDF unlocked locally' })).toBeVisible();
  await expect(page.getByLabel('PDF password', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { exact: true, name: 'First page' })).toBeEnabled();
});
test('navigates About with browser history and retains the local document', async ({ page }) => {
  const projectLinks = page.getByRole('navigation', {
    exact: true,
    name: 'Project',
  });
  await expect(projectLinks.getByRole('link', { exact: true, name: 'Feedback' })).toHaveCount(0);
  await expect(projectLinks.getByRole('link', { exact: true, name: 'Limitations' })).toHaveCount(0);
  await expect(projectLinks.getByRole('link', { exact: true, name: 'Examples' })).toHaveAttribute('href', '/examples');
  await expect(projectLinks.getByRole('link', { exact: true, name: 'GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/antonsamper/pdf-internals-viewer'
  );
  await projectLinks.getByRole('link', { exact: true, name: 'About' }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page).toHaveTitle('About · PDF Internals');
  await expect(page.getByRole('heading', { name: 'A closer look at PDF.' })).toBeVisible();
  await expect(page.getByRole('main')).toBeFocused();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your files stay with you' })).toBeVisible();
  const contact = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Feedback and contact' }) });
  for (const [name, href] of [
    ['GitHub issues', 'https://github.com/antonsamper/pdf-internals-viewer/issues'],
    ['GitHub Discussions', 'https://github.com/antonsamper/pdf-internals-viewer/discussions'],
    ['security policy', 'https://github.com/antonsamper/pdf-internals-viewer/security/policy'],
  ]) {
    await expect(contact.getByRole('link', { exact: true, name })).toHaveAttribute('href', href!);
  }
  await page.getByRole('link', { exact: true, name: 'Read the limitations' }).click();
  await expect(page).toHaveURL(/\/limitations$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goBack();
  await page.getByRole('link', { name: 'Back to the workspace' }).click();
  await openMinimal(page);
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'A closer look at PDF.' })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible();
  await expect(page.locator('[data-filename]')).toContainText('minimal.pdf');
  await expect(page.getByRole('contentinfo')).toContainText('5 objects indexed');
  await page.goBack();
  await page.getByLabel('Open local PDF').setInputFiles(samplePath('resources.pdf'));
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Document overview' })).toBeVisible();
  await expect(page.locator('[data-filename]')).toContainText('resources.pdf');
});
test('opens task guides and returns to the selected PDF object', async ({ page }) => {
  await openMinimal(page);
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  await page.getByRole('link', { exact: true, name: 'User guide' }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { exact: true, name: 'Investigate suspicious features' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Investigate suspicious PDF features');
  await expect(page.getByRole('main')).toContainText('An empty search does not establish safety');
  await page.goBack();
  await expect(page).toHaveURL(/\/guide$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/guides\/investigate-suspicious-features$/);
  await page.getByRole('link', { exact: true, name: 'Back to the workspace' }).click();
  await expect(page.locator('[data-filename]')).toContainText('minimal.pdf');
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible();
});
test('keeps bookmarks usable when browser storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Storage blocked');
      },
    });
  });
  await page.reload();
  await openMinimal(page);
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  await page.getByRole('button', { exact: true, name: 'Bookmark' }).click();
  const bookmarks = page.getByRole('region', { name: 'Bookmarks' });
  await expect(bookmarks).toContainText('Browser storage unavailable');
  await bookmarks.getByRole('textbox').fill('Temporary note');
  await expect(bookmarks.getByRole('textbox')).toHaveValue('Temporary note');
});
test('synchronizes bookmarks and notes across tabs without overwriting additions', async ({ browserName, page, context }) => {
  await openMinimal(page);
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  const other = await context.newPage();
  await other.goto('/');
  await openMinimal(other);
  await other.getByRole('button', { exact: true, name: 'First page' }).click();
  const first = page.getByRole('region', { name: 'Bookmarks' });
  const second = other.getByRole('region', { name: 'Bookmarks' });
  const addFirst = () => page.getByRole('button', { exact: true, name: 'Bookmark' }).click();
  const addSecond = () => other.getByRole('button', { exact: true, name: 'Bookmark' }).click();
  if (browserName === 'webkit') {
    // WebKit propagates localStorage writes to other tab processes asynchronously, so a Web Lock
    // alone cannot guarantee a fresh snapshot for near-simultaneous additions. Wait until the
    // other tab has received the first addition before adding the second.
    await addFirst();
    await expect(second.getByRole('textbox')).toHaveCount(1);
    await addSecond();
  } else {
    await Promise.all([addFirst(), addSecond()]);
  }
  await expect(first.getByRole('textbox')).toHaveCount(2);
  await expect(second.getByRole('textbox')).toHaveCount(2);
  await first.getByRole('textbox').first().fill('Shared finding');
  await expect(second.getByRole('textbox').first()).toHaveValue('Shared finding');
  await second.getByRole('textbox').last().fill('Second finding');
  await expect(first.getByRole('textbox').last()).toHaveValue('Second finding');
  await other.reload();
  await upload(other, 'minimal.pdf');
  await expect(second.getByRole('textbox').first()).toHaveValue('Shared finding');
  await expect(second.getByRole('textbox').last()).toHaveValue('Second finding');
  await second
    .getByRole('button', { name: /^Remove bookmark/ })
    .first()
    .click();
  await expect(first.getByRole('textbox')).toHaveCount(1);
  await other.close();
});
test('downloads complete attachments and embedded subset fonts', async ({ page }) => {
  const fixture = embeddedFilesPdf();
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(fixture.bytes),
    mimeType: 'application/pdf',
    name: 'embedded.pdf',
  });
  await expect(page.getByRole('heading', { exact: true, name: 'Document overview' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Document sections' })
    .getByRole('button', { exact: true, name: 'Document catalogue' })
    .click();
  await page.getByRole('button', { exact: true, name: '5 0 R' }).first().click();
  await page.getByRole('button', { exact: true, name: '6 0 R' }).first().click();
  const [attachment] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { exact: true, name: 'Download attachment' }).click(),
  ]);
  expect(attachment.suggestedFilename()).toBe('report.txt');
  await expect(page.getByRole('region', { name: 'Embedded file downloads' })).toContainText('Download: 293.0 KiB');
  const attachmentStream = await attachment.createReadStream();
  const attachmentChunks: Buffer[] = [];
  for await (const chunk of attachmentStream!) attachmentChunks.push(Buffer.from(chunk));
  expect(Buffer.concat(attachmentChunks)).toEqual(fixture.attachment);
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { exact: true, name: 'Resources' }).click();
  await page.getByRole('button', { exact: true, name: '8 0 obj' }).click();
  await expect(page.getByRole('region', { name: 'Embedded file downloads' })).toContainText('Fonts may be partial');
  await expect(page.getByRole('region', { name: 'Embedded file downloads' })).toContainText('subset indicated');
  const [font] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { exact: true, name: 'Download font' }).click(),
  ]);
  expect(font.suggestedFilename()).toBe('ABCDEF+Example.ttf');
  await expect(page.getByRole('region', { name: 'Embedded file downloads' })).toContainText('Download: 8 B');
  const fontStream = await font.createReadStream();
  const fontChunks: Buffer[] = [];
  for await (const chunk of fontStream!) fontChunks.push(Buffer.from(chunk));
  expect(Buffer.concat(fontChunks)).toEqual(fixture.font);
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: screenshotPath('font-download.png'),
  });
});
test('finds attachments and fonts through resource categories with direct downloads', async ({ page }) => {
  const fixture = embeddedFilesPdf();
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(fixture.bytes),
    mimeType: 'application/pdf',
    name: 'embedded.pdf',
  });
  await expect(page.getByRole('heading', { exact: true, name: 'Document overview' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { exact: true, name: 'Resources' }).click();
  const resources = page.getByRole('region', {
    name: 'Visual resource browser',
  });
  await resources.getByRole('button', { name: /^Attachments 1$/ }).click();
  await expect(resources.getByRole('article')).toHaveCount(1);
  await expect(resources.getByRole('article')).toContainText('report.txt');
  await resources.getByLabel('Filter resources').fill('report.txt');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    resources.getByRole('button', { exact: true, name: 'Download attachment' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('report.txt');
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: screenshotPath('resource-attachments.png'),
  });
  await resources.getByRole('button', { exact: true, name: '6 0 obj' }).click();
  await page.getByRole('button', { exact: true, name: 'Browse resources' }).click();
  await expect(resources.getByRole('button', { name: /^Attachments 1$/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(resources.getByLabel('Filter resources')).toHaveValue('report.txt');
  await resources.getByRole('button', { exact: true, name: 'Clear search' }).click();
  await resources.getByRole('button', { name: /^Fonts 2$/ }).click();
  await expect(resources.getByRole('article')).toHaveCount(2);
  await expect(resources.getByRole('button', { exact: true, name: 'Download font' })).toHaveCount(2);
  await resources.getByLabel('Filter resources').fill('ABCDEF');
  await expect(resources.getByRole('article')).toHaveCount(2);
  const [font] = await Promise.all([
    page.waitForEvent('download'),
    resources.getByRole('button', { exact: true, name: 'Download font' }).first().click(),
  ]);
  expect(font.suggestedFilename()).toBe('ABCDEF+Example.ttf');
  await resources.getByRole('button', { name: /^Images 0$/ }).click();
  await expect(resources).toContainText('No resources match this filter.');
  await resources.getByRole('button', { exact: true, name: 'Clear filters' }).click();
  await expect(resources.getByRole('article')).toHaveCount(3);
  await page.getByRole('button', { exact: true, name: 'Close PDF' }).click();
  await openMinimal(page);
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { exact: true, name: 'Resources' }).click();
  await expect(resources.getByLabel('Filter resources')).toHaveValue('');
  await expect(resources.getByRole('button', { name: /^All 1$/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(resources).toContainText('No embedded font file available to download.');
});
test('downloads full-size PNG images from Resources and the object inspector', async ({ page }) => {
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(imageExportPdf().bytes),
    mimeType: 'application/pdf',
    name: 'images.pdf',
  });
  await expect(page.getByRole('heading', { exact: true, name: 'Document overview' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { exact: true, name: 'Resources' }).click();
  const resources = page.getByRole('region', {
    name: 'Visual resource browser',
  });
  await resources.getByRole('button', { name: /^Images 1$/ }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    resources.getByRole('button', { exact: true, name: 'Download image' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('image-6-0.png');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const png = Buffer.concat(chunks);
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const exported = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const result = {
      height: image.height,
      pixel: [...context.getImageData(image.width - 1, image.height - 1, 1, 1).data],
      width: image.width,
    };
    image.close();
    return result;
  }, png.toString('base64'));
  expect(exported).toEqual({
    height: 300,
    pixel: [32, 117, 214, 255],
    width: 400,
  });
  await expect(resources.getByRole('img', { exact: true, name: 'Image object 6 0' })).toBeVisible();
  await expect(resources.locator('[data-image-file-size]')).toHaveAttribute('title', `${png.length.toLocaleString()} bytes`);
  await expect(resources.locator('[data-image-file-size]')).toContainText('In PDF:');
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: screenshotPath('image-download.png'),
  });
  await resources.getByRole('button', { exact: true, name: '6 0 obj' }).click();
  const [inspectorDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { exact: true, name: 'Download image' }).click(),
  ]);
  expect(inspectorDownload.suggestedFilename()).toBe('image-6-0.png');
});
test('extracts embedded JPEG bytes unchanged and explains unsupported image export', async ({ page }) => {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#e97820';
    context.fillRect(0, 0, 2, 2);
    return canvas.toDataURL('image/jpeg').split(',')[1];
  });
  const jpeg = Buffer.from(base64, 'base64');
  const fixture = imageExportPdf({
    data: jpeg,
    filter: 'DCTDecode',
    height: 2,
    width: 2,
  });
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(fixture.bytes),
    mimeType: 'application/pdf',
    name: 'jpeg.pdf',
  });
  await expect(page.getByRole('heading', { exact: true, name: 'Document overview' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { exact: true, name: 'Resources' }).click();
  const resources = page.getByRole('region', {
    name: 'Visual resource browser',
  });
  await resources.getByRole('button', { name: /^Images 1$/ }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    resources.getByRole('button', { exact: true, name: 'Download image' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('image-6-0.jpg');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks)).toEqual(jpeg);
  await expect(resources.getByRole('img', { exact: true, name: 'Image object 6 0' })).toBeVisible();
  await expect(resources.locator('[data-image-file-size]')).toHaveAttribute('title', `${jpeg.length.toLocaleString()} bytes`);
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(imageExportPdf({ extra: '/SMask 5 0 R' }).bytes),
    mimeType: 'application/pdf',
    name: 'masked.pdf',
  });
  await expect(page.getByRole('heading', { exact: true, name: 'Document overview' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { exact: true, name: 'Resources' }).click();
  await expect(resources.getByRole('button', { exact: true, name: 'Download image' })).toBeDisabled();
  await expect(resources).toContainText('Image export unavailable: custom decoding or image masks');
  await expect(resources).toContainText('Preview unavailable: custom decoding or image masks');
  await expect(resources.getByRole('img', { exact: true, name: 'Image object 6 0' })).toHaveCount(0);
});
test('reports an attachment that cannot be decoded without saving a file', async ({ page }) => {
  const data = Buffer.from('not LZW data');
  const attachment = Buffer.concat([
    Buffer.from(`<< /Type /EmbeddedFile /Length ${data.length} /Filter /LZWDecode >>\nstream\n`, 'latin1'),
    data,
    Buffer.from('\nendstream', 'latin1'),
  ]);
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(
      classicPdf([
        [1, '<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles 4 0 R >> >>'],
        [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
        [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>'],
        [4, '<< /Names [(broken.txt) 5 0 R] >>'],
        [5, '<< /Type /Filespec /F (broken.txt) /EF << /F 6 0 R >> >>'],
        [6, attachment],
      ]).bytes
    ),
    mimeType: 'application/pdf',
    name: 'broken-attachment.pdf',
  });
  await expect(page.getByRole('heading', { exact: true, name: 'Document overview' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Document sections' })
    .getByRole('button', { exact: true, name: 'Document catalogue' })
    .click();
  await page.getByRole('button', { exact: true, name: '4 0 R' }).first().click();
  await page.getByRole('button', { exact: true, name: '5 0 R' }).first().click();
  const saves = await countSaves(page);
  const downloads = page.getByRole('region', { name: 'Embedded file downloads' });
  const button = downloads.getByRole('button', { exact: true, name: 'Download attachment' });
  await expect(downloads.getByRole('alert')).toHaveCount(0);
  await button.click();
  await expect(downloads.getByRole('alert')).toHaveText(
    'Decoded inspection does not support /LZWDecode. Raw stream bytes remain available.'
  );
  await expect(button).toBeEnabled();
  expect(await saves()).toBe(0);
});
test('reports an image that cannot be decoded and allows another attempt', async ({ page }) => {
  const bytes = Buffer.from(imageExportPdf().bytes);
  const start = bytes.indexOf('stream\n', bytes.indexOf('/Subtype /Image')) + 'stream\n'.length;
  // Keep the 2-byte zlib header so inflate fails with "invalid block type".
  bytes.fill(0xff, start + 2, start + 200);
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: bytes,
    mimeType: 'application/pdf',
    name: 'broken-image.pdf',
  });
  await expect(page.getByRole('heading', { exact: true, name: 'Document overview' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { exact: true, name: 'Resources' }).click();
  const resources = page.getByRole('region', { name: 'Visual resource browser' });
  await resources.getByRole('button', { name: /^Images 1$/ }).click();
  await expect(resources).toContainText('Preview unavailable: invalid block type');
  await resources.getByRole('button', { exact: true, name: '6 0 obj' }).click();
  // The inspector prepares the export as soon as it opens, so the error shows before any click.
  await expect(page.getByRole('alert').filter({ hasText: 'invalid block type' })).toBeVisible();
  const saves = await countSaves(page);
  const button = page.getByRole('button', { exact: true, name: 'Download image' });
  await button.click();
  await expect(button).toBeEnabled();
  await button.click();
  await expect(button).toBeEnabled();
  await expect(page.getByRole('alert').filter({ hasText: 'invalid block type' })).toBeVisible();
  expect(await saves()).toBe(0);
});
test('lists and downloads inline attachment file specifications', async ({ page }) => {
  const fixture = classicPdf([
    [
      1,
      '<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles << /Names [(inline.txt) << /Type /Filespec /F (inline.txt) /EF << /F 4 0 R >> >>] >> >> >>',
    ],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> >>'],
    [4, '<< /Length 3 >>\nstream\nabc\nendstream'],
  ]);
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(fixture.bytes),
    mimeType: 'application/pdf',
    name: 'inline-attachment.pdf',
  });
  await expect(page.getByRole('heading', { exact: true, name: 'Document overview' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Document sections' }).getByRole('button', { exact: true, name: 'Resources' }).click();
  const resources = page.getByRole('region', {
    name: 'Visual resource browser',
  });
  await resources.getByRole('button', { name: /^Attachments 1$/ }).click();
  await expect(resources.getByRole('article')).toHaveCount(1);
  await expect(resources.getByRole('article')).toContainText('inline.txt');
  await expect(resources.getByRole('article')).toContainText('Download: 3 B');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    resources.getByRole('button', { exact: true, name: 'Download attachment' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('inline.txt');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toBe('abc');
});
test('serves public answers without JavaScript and keeps articles free of inspector requests', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
  });
  const reader = await context.newPage();
  for (const [path, heading] of [
    ['/who-its-for', 'Who is PDF Internals for?'],
    ['/pdf-inspector-vs-viewer', 'Why use a PDF inspector instead of a PDF viewer?'],
    ['/guide', 'How to inspect a PDF in your browser'],
    ['/guides/inspect-pdf-objects', 'PDF objects and references: what does 3 0 R mean?'],
    ['/guides/decode-pdf-streams', 'How to inspect and decode PDF streams'],
    ['/guides/find-pdf-fonts-images', 'How to find fonts and images in a PDF'],
    ['/guides/find-pdf-attachments', 'Find and extract PDF attachments'],
    ['/guides/search-bookmark-compare', 'Search, bookmark, and compare PDF objects'],
    ['/guides/investigate-suspicious-features', 'Investigate suspicious PDF features'],
    ['/examples', 'PDF debugging examples'],
    ['/examples/large-pdf', 'Why is this one-page PDF so large?'],
    ['/examples/incorrect-text', 'Why does copied PDF text differ from the page?'],
    ['/examples/find-text-source', 'How to find the source bytes behind text in a PDF'],
    ['/examples/embedded-font', 'Which font is this PDF actually using?'],
    ['/examples/hidden-attachment', 'Where is the attachment?'],
    ['/examples/repeated-logo', 'Why is the same logo stored several times?'],
    ['/examples/page-rotation', 'Why is this page rotated?'],
    ['/examples/inherited-resources', 'Where did this page’s resources come from?'],
    ['/examples/opening-action', 'PDF actions: types and an automatic opening example'],
    ['/examples/broken-xref', 'What does a PDF error look like?'],
    ['/privacy', 'Your PDFs and browser storage'],
    ['/limitations', 'Supported features and limitations'],
  ]) {
    const response = await reader.goto(path);
    expect(response?.status()).toBe(200);
    await expect(reader.getByRole('heading', { level: 1 })).toHaveText(heading!);
    await expect(reader.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://pdf-internals-viewer.pages.dev${path}`);
    await expect(reader.locator('main')).toContainText(
      path === '/privacy'
        ? 'Notes created while inspecting an encrypted PDF remain readable'
        : path === '/limitations'
          ? '64 MiB'
          : path === '/guides/find-pdf-attachments'
            ? 'Download attachment'
            : path === '/guides/search-bookmark-compare'
              ? 'Pin to compare'
              : 'sample'
    );
  }
  await context.close();
  const requests: string[] = [];
  {
    const article = await browser.newPage({ baseURL });
    article.on('request', (request) => requests.push(request.url()));
    await article.goto('/guides/decode-pdf-streams');
    await expect(article.getByRole('heading', { level: 1 })).toBeVisible();
    expect(requests.filter((url) => /\.wasm|pdf\.worker|assets\/main-.*\.js/.test(url))).toEqual([]);
    await article.close();
  }
});
test('opens each public page at the top when following links from the bottom', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ height: 844, width });
    await page.goto('/');
    await page.getByRole('link', { exact: true, name: 'User guide' }).click();
    const main = page.getByRole('main');
    await main.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    expect(await main.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await page
      .getByRole('link', {
        exact: true,
        name: 'Investigate suspicious features',
      })
      .click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Investigate suspicious PDF features');
    await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBe(0);
    await expect(main).toBeFocused();
    await main.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await main
      .getByRole('complementary', { name: 'Related reading' })
      .getByRole('link', {
        exact: true,
        name: 'Supported features and limitations',
      })
      .click();
    await expect(page).toHaveURL(/\/limitations$/);
    await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBe(0);
    await expect(main).toBeFocused();
  }
});
test('keeps document state and route metadata across public content navigation', async ({ page }) => {
  await openMinimal(page);
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  await page.getByRole('link', { exact: true, name: 'User guide' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How to inspect a PDF in your browser');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Start with a sample/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://pdf-internals-viewer.pages.dev/guide');
  await page
    .getByRole('link', {
      name: 'Understand objects and references such as 3 0 R',
    })
    .click();
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
  await page.getByRole('link', { exact: true, name: 'Back to the workspace' }).click();
  await expect(page.locator('[data-filename]')).toContainText('minimal.pdf');
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible();
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /An open-source, read-only PDF inspector/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://pdf-internals-viewer.pages.dev/');
});
test('opens only bundled samples from tutorial links and reports no hydration errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/guides/decode-pdf-streams');
  await page.getByRole('link', { exact: true, name: 'Explore Fonts & resources' }).click();
  await expect(page.getByRole('heading', { name: 'Document overview' })).toBeVisible();
  await expect(page.locator('[data-filename]')).toContainText('resources.pdf');
  await page.goto('/?sample=compressed');
  await expect(page.getByRole('heading', { name: 'Document overview' })).toBeVisible();
  await expect(page.locator('[data-filename]')).toContainText('compressed.pdf');
  await page.goto('/?sample=https://example.com/private.pdf');
  await expect(page.getByRole('heading', { name: 'Look inside a PDF.' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('prerenders home and About for readers without JavaScript', async ({ browser, baseURL }) => {
  test.skip(
    !process.env.PLAYWRIGHT_CLOUDFLARE && !process.env.PLAYWRIGHT_PREVIEW && !process.env.PLAYWRIGHT_BASE_URL,
    'Build-time HTML is checked against the production build'
  );
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
  });
  const reader = await context.newPage();
  await reader.goto('/');
  await expect(reader.getByRole('heading', { level: 1 })).toHaveText('Look inside a PDF.');
  await expect(reader.getByRole('contentinfo')).toHaveCount(0);
  await reader.getByRole('navigation', { exact: true, name: 'Project' }).getByRole('link', { exact: true, name: 'About' }).click();
  await expect(reader.getByRole('heading', { level: 1 })).toHaveText('A closer look at PDF.');
  await expect(reader.locator('main')).toContainText('Bookmarks and notes are saved in this browser');
  await reader.getByRole('link', { exact: true, name: 'workspace guide' }).click();
  await expect(reader.getByRole('heading', { level: 1 })).toHaveText('How to inspect a PDF in your browser');
  await reader.screenshot({
    fullPage: false,
    path: screenshotPath('public-guide-desktop.png'),
  });
  await reader.setViewportSize({ height: 844, width: 390 });
  await reader.goto('/guides/decode-pdf-streams');
  await expect(reader.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await reader.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await reader.screenshot({
    fullPage: true,
    path: screenshotPath('public-stream-guide-mobile.png'),
  });
  await context.close();
});
test('replaces a document during an acknowledged object transfer without exposing its partial graph', async ({ page }) => {
  await page.evaluate(() => {
    const NativeWorker = window.Worker;
    let first = true;
    window.Worker = class extends NativeWorker {
      constructor(...args: ConstructorParameters<typeof Worker>) {
        super(...args);
        if (!first) return;
        first = false;
        const send = this.postMessage.bind(this);
        this.postMessage = (...messageArgs: Parameters<Worker['postMessage']>) => {
          if (
            (
              messageArgs[0] as {
                type?: string;
              }
            ).type === 'open-next'
          ) {
            // Hold the acknowledgement deterministically, rather than racing parsing.
            document.documentElement.dataset.batchPaused = 'true';
            return;
          }
          send(...messageArgs);
        };
      }
    };
  });
  const objects: [number, string][] = [
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [] /Count 0 >>'],
    ...Array.from({ length: 300 }, (_, i): [number, string] => [i + 3, '<< /Marker (old document) >>']),
  ];
  const fixture = classicPdf(objects);
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(fixture.bytes),
    mimeType: 'application/pdf',
    name: 'batched.pdf',
  });
  await expect(page.locator('html')).toHaveAttribute('data-batch-paused', 'true');
  await expect(page.getByRole('heading', { name: 'Opening PDF…' })).toBeVisible();
  await expect(page.getByRole('contentinfo')).not.toContainText('objects indexed');
  await upload(page, 'minimal.pdf');
  await expect(page.getByRole('contentinfo')).toContainText('5 objects indexed');
  await page.getByRole('button', { exact: true, name: 'Document catalogue' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: /1 0\s+obj/ })).toBeVisible();
  await expect(page.locator('[data-filename]')).toContainText('minimal.pdf');
});
for (const [route, sample, instruction] of [
  ['/examples/large-pdf', 'oversized-image', '/Im1 Do'],
  ['/examples/incorrect-text', 'incorrect-unicode', 'Invoice total:'],
]) {
  test(`opens example ${sample} and follows its content evidence`, async ({ page }) => {
    await page.goto(route!);
    await expect(page.getByRole('link', { exact: true, name: 'Download sample PDF' })).toHaveAttribute('href', `/samples/${sample}.pdf`);
    await expect(page.getByRole('figure').getByRole('img')).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: screenshotPath(`${sample}-article.png`),
    });
    await page.setViewportSize({ height: 844, width: 390 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({
      fullPage: true,
      path: screenshotPath(`${sample}-article-mobile.png`),
    });
    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.getByRole('link', { exact: true, name: 'Open this example' }).click();
    await expect(page.locator('[data-filename]')).toContainText(`${sample}.pdf`);
    await expect(page.getByRole('contentinfo')).toContainText('6 objects indexed');
    await page.getByRole('button', { exact: true, name: 'First page' }).click();
    await page.getByRole('button', { exact: true, name: '4 0 R' }).first().click();
    await page.getByRole('tab', { exact: true, name: 'Decoded' }).click();
    const decoded = page.getByRole('tabpanel', { exact: true, name: 'Decoded' });
    await decoded.getByRole('button', { exact: true, name: 'Decoded byte text' }).click();
    await expect(decoded.locator('pre')).toContainText(instruction!);
    if (sample === 'incorrect-unicode') {
      await decoded.getByRole('button', { exact: true, name: 'Readable instructions' }).click();
      await decoded.getByRole('button', { exact: true, name: 'Inspect /F1 resource' }).first().click();
      await page.getByRole('button', { exact: true, name: '6 0 R' }).first().click();
      await page.getByRole('tab', { exact: true, name: 'Decoded' }).click();
      await expect(page.getByRole('tabpanel', { exact: true, name: 'Decoded' })).toContainText('<31> <0039>');
    }
  });
}
for (const sample of ['embedded-font', 'hidden-attachment', 'repeated-logo', 'page-rotation', 'inherited-resources', 'opening-action']) {
  test(`opens example ${sample} and verifies its finding`, async ({ page }) => {
    await page.goto(`/examples/${sample}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const image = page.getByRole('figure').getByRole('img');
    await image.scrollIntoViewIfNeeded();
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await page.screenshot({
      fullPage: false,
      path: screenshotPath(`${sample}-article.png`),
    });
    await page.setViewportSize({ height: 844, width: 390 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({
      fullPage: true,
      path: screenshotPath(`${sample}-article-mobile.png`),
    });
    await expect(page.getByRole('complementary', { name: 'Related reading' }).getByRole('link')).toHaveCount(3);
    const footer = page.getByRole('navigation', {
      exact: true,
      name: 'Project',
    });
    await expect(footer.getByRole('link', { exact: true, name: 'Limitations' })).toHaveCount(0);
    await expect(footer.getByRole('link', { exact: true, name: 'Feedback' })).toHaveCount(0);
    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.getByRole('link', { exact: true, name: 'Open this example' }).click();
    await expect(page.locator('[data-filename]')).toContainText(`${sample}.pdf`);
    await expect(page.getByRole('heading', { exact: true, name: 'Document overview' })).toBeVisible();
    const ref = async (name: string) => {
      if (/^\d+ \d+ R$/.test(name)) await page.getByRole('tab', { exact: true, name: 'Properties' }).click();
      await page.getByRole('button', { exact: true, name }).first().click();
    };
    const source = async () => {
      await page.getByRole('tab', { exact: true, name: 'Source' }).click();
      return page.getByRole('tabpanel', { exact: true, name: 'Source' });
    };
    const sections = page.getByRole('navigation', { name: 'Document sections' });
    if (sample === 'embedded-font' || sample === 'hidden-attachment') {
      await sections.getByRole('button', { exact: true, name: 'Resources' }).click();
      const resources = page.getByRole('region', {
        name: 'Visual resource browser',
      });
      await resources
        .getByRole('button', {
          name: sample === 'embedded-font' ? /^Fonts 2$/ : /^Attachments 1$/,
        })
        .click();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        resources
          .getByRole('button', {
            exact: true,
            name: sample === 'embedded-font' ? 'Download font' : 'Download attachment',
          })
          .click(),
      ]);
      if (sample === 'embedded-font') {
        expect(await readFile((await download.path())!)).toEqual(await readFile('scripts/fixtures/assets/example-mark.ttf'));
        await resources.getByRole('button', { exact: true, name: '6 0 obj' }).click();
        await ref('7 0 R');
        await ref('8 0 R');
        await expect(page.getByRole('heading', { name: /8 0\s+obj/ })).toBeVisible();
      } else {
        expect(download.suggestedFilename()).toBe('line-items.csv');
        expect(await readFile((await download.path())!, 'utf8')).toBe('description,amount\nService charge,1250.00\n');
        await resources.getByRole('button', { exact: true, name: '6 0 obj' }).click();
        await ref('7 0 R');
        await page.getByRole('tab', { exact: true, name: 'Decoded' }).click();
        await expect(page.getByRole('tabpanel', { exact: true, name: 'Decoded' })).toContainText('Service charge,1250.00');
      }
    } else if (sample === 'repeated-logo') {
      await ref('First page');
      await expect(await source()).toContainText('/Logo 7 0 R');
      await ref('Pin to compare');
      await sections.getByRole('button', { name: /^Pages/ }).click();
      const tree = page.getByRole('navigation', { name: 'Page relationships' });
      await tree.getByRole('button', { exact: true, name: 'Page 3 5 0 obj' }).click();
      await expect(await source()).toContainText('/Logo 8 0 R');
    } else if (sample === 'page-rotation') {
      await expect(page.locator('[data-document-facts]')).toContainText('Mixed (0°, 90°)');
      await ref('First page');
      await ref('2 0 R');
      await expect(await source()).toContainText('/Rotate 90');
      await ref('4 0 R');
      await expect(await source()).toContainText('/Rotate 0');
      await ref('6 0 R');
      await page.getByRole('tab', { exact: true, name: 'Decoded' }).click();
      const decoded = page.getByRole('tabpanel', {
        exact: true,
        name: 'Decoded',
      });
      await decoded.getByRole('button', { exact: true, name: 'Decoded byte text' }).click();
      await expect(decoded).toContainText('0 1 -1 0 450 80 cm');
    } else if (sample === 'inherited-resources') {
      await sections.getByRole('button', { name: /^Pages/ }).click();
      const tree = page.getByRole('navigation', { name: 'Page relationships' });
      await tree.getByRole('button', { exact: true, name: 'Expand Page 1 3 0' }).click();
      await expect(tree).toContainText('/Resources (inherited)');
      await tree
        .getByRole('button', {
          exact: true,
          name: 'Expand Resources · /Resources (inherited)',
        })
        .click();
      await tree.getByRole('button', { exact: true, name: 'Expand Fonts · /Font' }).click();
      await tree.getByRole('button', { exact: true, name: '/F1 5 0 obj' }).click();
      await expect(page.getByRole('navigation', { name: 'Exploration trail' })).toContainText('Inherited from 2 0 obj');
    } else {
      await ref('Document catalogue');
      await ref('6 0 R');
      await expect(await source()).toContainText('/S /GoTo');
      await ref('3 0 R');
      await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible();
    }
  });
}
test('opens example find-text-source and follows a page-text match to its source bytes', async ({ page }) => {
  await cacheEngineAssets(page);
  await page.goto('/examples/find-text-source');
  await expect(page.getByRole('link', { exact: true, name: 'Download sample PDF' })).toHaveAttribute(
    'href',
    '/samples/find-text-source.pdf'
  );
  const image = page.getByRole('figure').getByRole('img');
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.setViewportSize({ height: 844, width: 390 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('complementary', { name: 'Related reading' }).getByRole('link')).toHaveCount(3);
  await page.setViewportSize({ height: 1000, width: 1440 });
  await page.getByRole('link', { exact: true, name: 'Open this example' }).click();
  await expect(page.locator('[data-filename]')).toContainText('find-text-source.pdf');
  await expect(page.getByRole('contentinfo')).toContainText('5 objects indexed');
  await selectSearchScope(page, 'decoded');
  await page.getByRole('textbox', { exact: true, name: 'Search document' }).fill('reference');
  await page.getByRole('button', { exact: true, name: 'Run search' }).click();
  const results = page.getByRole('region', { exact: true, name: 'Search results' });
  await expect(results).toContainText('0 matches');
  await selectSearchScope(page, 'pageText');
  await page.getByRole('button', { exact: true, name: 'Run search' }).click();
  await expect(results).toContainText('1 page');
  await expect(results).toContainText('1 text match');
  await results.getByRole('button', { name: /Show bytes/ }).click();
  const hex = page.getByRole('region', { exact: true, name: 'Decoded stream bytes' });
  await expect(hex.locator('button[data-hex-byte][data-selected]')).toHaveCount(9);
  await expect(hex.locator('[data-hex-status]')).toContainText('9 bytes selected in 2 ranges');
  await expect(page.locator('[data-text-match]')).toContainText('TJ');
});
test('navigates grouped public content without JavaScript on desktop and mobile', async ({ browser, baseURL }) => {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      viewport: { height: 900, width },
    });
    const reader = await context.newPage();
    await reader.goto('/who-its-for');
    const navigation = reader.getByRole('navigation', { exact: true, name: 'Content navigation' });
    if (width !== 1440) {
      await reader.getByText('On this site', { exact: true }).focus();
      await reader.keyboard.press('Enter');
    }
    for (const label of ['Overview', 'Guides', 'Examples', 'Reference']) {
      await expect(navigation.getByRole('heading', { exact: true, name: label })).toBeVisible();
    }
    await expect(navigation.locator('[aria-current="page"]')).toHaveText('Who it’s for');
    await navigation.getByRole('link', { exact: true, name: 'Inspector vs viewer' }).click();
    await expect(reader.getByRole('heading', { level: 1 })).toHaveText('Why use a PDF inspector instead of a PDF viewer?');
    await expect(reader.getByRole('table')).toContainText('Your task');
    expect(await reader.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(reader.getByRole('complementary', { name: 'Related reading' }).getByRole('link')).toHaveCount(3);
    await reader.screenshot({
      fullPage: width !== 1440,
      path: screenshotPath(`inspector-vs-viewer-${width}.png`),
    });
    if (width !== 1440) {
      expect((await reader.getByRole('banner').boundingBox())!.height).toBe(58);
      const menu = reader.getByRole('banner').locator('details');
      await menu.locator('summary').focus();
      await reader.keyboard.press('Enter');
      await expect(menu).toHaveAttribute('open', '');
      const active = menu.getByRole('link', { exact: true, name: 'Overview' });
      await expect(active).toHaveCSS('text-decoration-line', 'underline');
      await expect(menu.getByRole('link', { exact: true, name: 'Guides' })).toHaveCSS('text-decoration-line', 'none');
      await reader.keyboard.press('Enter');
      await expect(menu).not.toHaveAttribute('open', '');
      await reader.keyboard.press('Enter');
    }
    await reader
      .getByRole('navigation', { exact: true, name: 'Main navigation' })
      .getByRole('link', { exact: true, name: 'Examples' })
      .click();
    await expect(reader.getByRole('heading', { level: 1 })).toHaveText('PDF debugging examples');
    await reader.goBack();
    await expect(reader.getByRole('heading', { level: 1 })).toHaveText('Why use a PDF inspector instead of a PDF viewer?');
    await context.close();
  }
});
test('keeps public header controls separate with a PDF open on narrow screens', async ({ page }) => {
  await openMinimal(page);
  await page.getByRole('link', { exact: true, name: 'User guide' }).click();
  for (const fontFamily of ['inherit', 'monospace']) {
    await page.getByRole('banner').evaluate((header, font) => {
      header.style.fontFamily = font;
    }, fontFamily);
    for (const width of [320, 361, 375, 600, 760]) {
      await page.setViewportSize({ height: 812, width });
      const navigation = await page.getByRole('navigation', { exact: true, name: 'Main navigation' }).boundingBox();
      const close = await page.getByRole('button', { exact: true, name: 'Close PDF' }).boundingBox();
      const theme = await page.getByRole('button', { name: /^Switch to (dark|light) mode$/ }).boundingBox();
      expect(navigation!.x + navigation!.width).toBeLessThanOrEqual(close!.x);
      expect(close!.x + close!.width).toBeLessThanOrEqual(theme!.x);
      await expect(page.getByRole('banner')).toHaveJSProperty('offsetHeight', 58);
    }
  }
  await page
    .getByRole('banner')
    .getByRole('link', { name: /inspector →/i })
    .click();
  await expect(page.getByRole('heading', { name: 'Document overview' })).toBeVisible();
});
test('preserves a PDF selection through the new overview pages and history', async ({ page }) => {
  await openMinimal(page);
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  await page.getByRole('link', { exact: true, name: 'User guide' }).click();
  const navigation = page.getByRole('navigation', { exact: true, name: 'Content navigation' });
  await navigation.getByRole('link', { exact: true, name: 'Who it’s for' }).click();
  await expect(page).toHaveURL(/\/who-its-for$/);
  await navigation.getByRole('link', { exact: true, name: 'Inspector vs viewer' }).click();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://pdf-internals-viewer.pages.dev/pdf-inspector-vs-viewer'
  );
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Who is PDF Internals for?');
  await page.goForward();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Why use a PDF inspector instead of a PDF viewer?');
  await page.getByRole('link', { exact: true, name: 'Back to the workspace' }).click();
  await expect(page.locator('[data-filename]')).toContainText('minimal.pdf');
  await expect(page.getByRole('heading', { name: /3 0\s+obj/ })).toBeVisible();
});
test('collects PDF issues with evidence links and resets on document replacement', async ({ page }) => {
  const fixture = classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R /Missing 99 0 R >>'],
    [2, '<< /Type /Pages /Kids [] /Count 0 >>'],
  ]);
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(fixture.bytes),
    mimeType: 'application/pdf',
    name: 'dangling.pdf',
  });
  await page.getByRole('button', { name: 'View issues and coverage' }).click();
  const panel = page.getByRole('region', { name: 'PDF issues' });
  await expect(panel.getByRole('heading', { name: 'Unresolved object reference' })).toBeVisible();
  await expect(panel).toContainText('99 0 R');
  await panel.getByRole('button', { name: 'Inspect 1 0 obj' }).click();
  await expect(page.getByRole('region', { name: 'Object inspector' })).toContainText('/Missing');
  await page.getByRole('button', { name: /^Issues/ }).click();
  await expect(panel).toBeVisible();
  await mkdir(resolve('.context'), { recursive: true });
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: screenshotPath('issues.png'),
  });
  await upload(page, 'minimal.pdf');
  await page.getByRole('button', { name: 'View issues and coverage' }).click();
  await expect(panel).toContainText('No issues detected by these checks.');
  await expect(panel.getByRole('listitem')).toHaveCount(0);
  await page.setViewportSize({ height: 844, width: 390 });
  await expect(panel.getByRole('heading', { name: 'Checks and coverage' })).toBeVisible();
});
test('records unsupported stream inspection as a limitation and deduplicates retries', async ({ page }) => {
  const fixture = classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [] /Count 0 >>'],
    [3, '<< /Length 1 /Filter /RunLengthDecode >>\nstream\nx\nendstream'],
  ]);
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(fixture.bytes),
    mimeType: 'application/pdf',
    name: 'unsupported-stream.pdf',
  });
  await expect(page.getByRole('heading', { name: 'Document overview' })).toBeVisible();
  for (let retry = 0; retry < 2; retry++) {
    await page.locator('[data-object-list]').getByRole('button').filter({ hasText: '3 0' }).click();
    await page.getByRole('tab', { name: 'Decoded' }).click();
    await expect(page.getByRole('region', { name: 'Object inspector' })).toContainText('does not support /RunLengthDecode');
    await page.getByRole('button', { name: /^Issues/ }).click();
    const panel = page.getByRole('region', { name: 'PDF issues' });
    await expect(panel.getByRole('status')).toHaveText('1 inspection limitation');
    await expect(panel.getByRole('listitem')).toHaveCount(1);
    await expect(panel).toContainText('does not establish a defect in the PDF');
  }
});
test('preserves later issues and scroll position when returning from evidence', async ({ page }) => {
  const objects = [
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [] /Count 0 >>'],
    ...Array.from({ length: 55 }, (_, index) => [index + 3, '<< /Missing 999 0 R >>']),
  ];
  const fixture = classicPdf(objects);
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(fixture.bytes),
    mimeType: 'application/pdf',
    name: 'many-issues.pdf',
  });
  await page.getByRole('button', { name: 'View issues and coverage' }).click();
  const panel = page.getByRole('region', { name: 'PDF issues' });
  await expect(panel.getByRole('listitem')).toHaveCount(50);
  await panel.getByRole('button', { name: /Show more/ }).click();
  await expect(panel.getByRole('listitem')).toHaveCount(55);
  const target = panel.getByRole('button', { name: 'Inspect 57 0 obj' });
  await target.scrollIntoViewIfNeeded();
  await expect.poll(() => panel.evaluate((el) => el.scrollTop)).toBeGreaterThan(1200);
  await target.click();
  await page.getByRole('button', { exact: true, name: 'Back' }).click();
  await expect(panel.getByRole('button', { name: 'Inspect 57 0 obj' })).toBeInViewport();
});
test('opens the broken cross-reference example and follows both findings to evidence', async ({ page }) => {
  await page.goto('/examples');
  await page
    .getByRole('link', {
      exact: true,
      name: 'What does a PDF error look like?',
    })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What does a PDF error look like?');
  const download = page.getByRole('link', { name: 'Download sample PDF' });
  const response = await page.request.get((await download.getAttribute('href')) as string);
  expect(response.ok()).toBe(true);
  expect(await response.body()).toEqual(await readFile(samplePath('broken-xref.pdf')));
  await page.getByRole('link', { exact: true, name: 'Open this example' }).click();
  await expect(page.locator('[data-filename]')).toContainText('broken-xref.pdf');
  await page.getByRole('button', { name: 'View issues and coverage' }).click();
  const panel = page.getByRole('region', { name: 'PDF issues' });
  await expect(panel.getByRole('status')).toContainText('1 error');
  await expect(panel.getByRole('status')).toContainText('1 warning');
  await expect(panel.getByRole('listitem')).toHaveCount(2);
  await expect(panel).toContainText('invalid cross-reference offset 999999');
  await mkdir(resolve('.context'), { recursive: true });
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: screenshotPath('broken-xref-example.png'),
  });
  await panel.getByRole('button', { name: 'Inspect file structure' }).click();
  await page.getByRole('button', { name: /startxref →/ }).click();
  await expect(page.locator('[data-hex-byte][data-selected]')).not.toHaveCount(0);
  await page.getByRole('button', { name: /^Issues/ }).click();
  await panel.getByRole('button', { name: 'Inspect 1 0 obj' }).click();
  await expect(page.getByRole('region', { name: 'Object inspector' })).toContainText('/Metadata');
  await page.getByRole('button', { exact: true, name: 'Preview' }).click();
  await expect(page.getByRole('img', { name: 'broken-xref.pdf, page 1' })).toBeVisible();
});
test('appearance button toggles modes and remembers the choice across visits and pages', async ({ page }) => {
  const root = page.locator('html');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
  await expect(root).toHaveClass('dark');
  await page.emulateMedia({ colorScheme: 'light' });
  const darkButton = page.getByRole('button', { name: 'Switch to dark mode' });
  await expect(darkButton).toBeVisible();
  await darkButton.focus();
  await page.keyboard.press('Enter');
  await expect(root).toHaveClass('dark');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pdf-internals-theme'))).toBe('dark');
  await page.reload();
  await expect(root).toHaveClass('dark');
  await page.goto('/guide');
  await expect(root).toHaveClass('dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(root).not.toHaveClass('dark');
  await page.goto('/about');
  await expect(darkButton).toBeVisible();
  await expect(root).not.toHaveClass('dark');
  await darkButton.click();
  await page.goto('/');
  await openMinimal(page);
  await expect(root).toHaveClass('dark');
  await page.setViewportSize({ height: 844, width: 390 });
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeInViewport();
  await expect(page.getByRole('button', { exact: true, name: 'Close PDF' })).toBeInViewport();
  await page.screenshot({
    animations: 'disabled',
    path: screenshotPath('dark-workspace-mobile.png'),
  });
  await page.setViewportSize({ height: 1000, width: 1440 });
  await page.screenshot({
    animations: 'disabled',
    path: screenshotPath('dark-workspace.png'),
  });
});
test('appearance remains usable when browser storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Blocked', 'SecurityError');
      },
    });
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveClass('dark');
  await page.getByRole('link', { exact: true, name: 'User guide' }).click();
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).not.toHaveClass('dark');
});
test('appearance synchronises across tabs and falls back to system for invalid saved choices', async ({ page, context }) => {
  await page.evaluate(() => localStorage.setItem('pdf-internals-theme', 'invalid'));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();
  const other = await context.newPage();
  await other.emulateMedia({ colorScheme: 'light' });
  await other.goto('/guide');
  await other.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
  await expect(page.locator('html')).toHaveClass('dark');
  await other.evaluate(() => localStorage.removeItem('pdf-internals-theme'));
  await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass('dark');
  await other.close();
});
test('theme button keeps its position across workspace and public headers', async ({ page }) => {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ height: 844, width });
    await page.goto('/');
    const button = page.getByRole('button', { name: /^Switch to (dark|light) mode$/ });
    const workspace = await button.boundingBox();
    expect(workspace).not.toBeNull();
    await openMinimal(page);
    const checkPosition = async () => {
      await expect(button).toBeInViewport();
      const actual = await button.boundingBox();
      expect(actual).not.toBeNull();
      for (const dimension of ['x', 'y', 'width', 'height'] as const) {
        expect(actual![dimension]).toBeCloseTo(workspace![dimension], 0);
      }
    };
    await checkPosition();
    // In-app navigation uses the public header while retaining the open PDF.
    await page.getByRole('link', { exact: true, name: 'User guide' }).click();
    await checkPosition();
    // Direct visits render static articles and the prerendered About page.
    for (const route of ['/guide', '/about']) {
      await page.goto(route);
      await checkPosition();
    }
  }
});
test('public headers match the workspace height and align the mobile identity row', async ({ page }) => {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ height: 844, width });
    await page.goto('/');
    const header = page.getByRole('banner');
    const identity = header.getByRole('link', { exact: true, name: 'PDF Internals' });
    const workspace = await header.boundingBox();
    const workspaceIdentity = await identity.boundingBox();
    expect(workspace!.height).toBe(58);
    const checkHeader = async () => {
      const actual = await header.boundingBox();
      expect(actual!.height).toBe(workspace!.height);
      const actualIdentity = await identity.boundingBox();
      expect(actualIdentity!.y + actualIdentity!.height / 2).toBeCloseTo(workspaceIdentity!.y + workspaceIdentity!.height / 2, 0);
      await expect(page.getByRole('banner').getByRole('link', { name: /inspector →/i })).toBeInViewport();
    };
    // Cover public navigation with an active PDF as well as direct static visits.
    await openMinimal(page);
    await page.getByRole('link', { exact: true, name: 'User guide' }).click();
    await checkHeader();
    for (const route of ['/guide', '/about']) {
      await page.goto(route);
      await checkHeader();
    }
  }
});
test('keeps the site header in view while scrolling public pages, direct or followed', async ({ page }) => {
  const checkScrolled = async (width: number) => {
    const header = page.getByRole('banner');
    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toBeInViewport();
    await page.mouse.move(width / 2, 600);
    // Scroll past the title but not to the end, where the sidebar leaves with its column.
    await page.mouse.wheel(0, 800);
    await expect(title).not.toBeInViewport();
    await expect(header.getByRole('navigation', { name: 'Main navigation' })).toBeInViewport();
    const banner = (await header.boundingBox())!;
    expect(banner.y).toBe(0);
    // The section sidebar sticks below the header instead of sliding under it.
    if (width > 900) {
      const sidebar = page.getByRole('navigation', { name: 'Content navigation' });
      await expect(sidebar).toBeInViewport();
      expect((await sidebar.boundingBox())!.y).toBeGreaterThanOrEqual(banner.height);
    }
  };
  for (const width of [1440, 390]) {
    await page.setViewportSize({ height: 844, width });
    // Static articles scroll the document under a sticky header; About scrolls inside the app shell.
    for (const route of ['/who-its-for', '/examples/large-pdf', '/about']) {
      await page.goto(route);
      await checkScrolled(width);
    }
    // Pages reached from About render inside the app shell.
    await page.getByRole('navigation', { name: 'Project' }).getByRole('link', { exact: true, name: 'Guide' }).click();
    await expect(page).toHaveURL(/\/guide$/);
    await checkScrolled(width);
  }
});
test('lands anchors on static pages below the sticky header', async ({ page }) => {
  await page.goto('/guide#keyboard-shortcuts');
  const heading = page.getByRole('heading', { name: 'Keyboard shortcuts' });
  await expect(heading).toBeInViewport();
  const banner = (await page.getByRole('banner').boundingBox())!;
  expect(banner.y).toBe(0);
  expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual(banner.height);
});
for (const compressed of [false, true]) {
  test(`page text search maps split words to ${compressed ? 'decoded' : 'original'} bytes`, async ({ page }) => {
    await cacheEngineAssets(page);
    const fixture = pageTextSearchPdf(compressed);
    await page.getByLabel('Open local PDF').setInputFiles({
      buffer: Buffer.from(fixture.bytes),
      mimeType: 'application/pdf',
      name: 'split-text.pdf',
    });
    await expect(page.getByRole('contentinfo')).toContainText('5 objects indexed');
    await selectSearchScope(page, 'pageText');
    await page.getByRole('textbox', { exact: true, name: 'Search document' }).fill('Hello');
    await page.getByRole('button', { exact: true, name: 'Run search' }).click();
    const results = page.getByRole('region', {
      exact: true,
      name: 'Search results',
    });
    await expect(results).toContainText('1 page');
    await expect(results).toContainText('1 text match');
    await expect(results.getByRole('button', { name: /Show bytes/ })).toHaveCount(1);
    const hex = page.getByRole('region', {
      exact: true,
      name: compressed ? 'Decoded stream bytes' : 'Original file bytes',
    });
    await expect(hex.locator('button[data-hex-byte][data-selected]')).toHaveCount(5);
    await expect(hex.locator('[data-hex-status]')).toContainText('5 bytes selected in 2 ranges');
    await expect(page.locator('[data-text-match]')).toContainText('TJ');
    if (compressed) {
      await page.keyboard.press('Escape');
      await page.getByRole('button', { exact: true, name: 'Original bytes' }).click();
      await expect(page.locator('[data-text-source-note]')).toContainText('Containing stream only');
      const original = page.getByRole('region', {
        exact: true,
        name: 'Original file bytes',
      });
      await expect(original.locator('button[data-hex-byte][data-selected]')).not.toHaveCount(5);
      await page.getByRole('button', { exact: true, name: 'Decoded bytes' }).click();
      await expect(hex.locator('button[data-hex-byte][data-selected]')).toHaveCount(5);
    }
    await mkdir(resolve('.context'), { recursive: true });
    await page.screenshot({
      animations: 'disabled',
      fullPage: true,
      path: screenshotPath(`page-text-${compressed ? 'decoded' : 'original'}.png`),
    });
    if (compressed) await page.getByRole('button', { exact: true, name: 'Show search results' }).click();
    await results.getByRole('button', { exact: true, name: 'Open page preview' }).click();
    await expect(page.getByRole('img', { exact: true, name: 'split-text.pdf, page 1' })).toBeVisible();
    const preview = page.getByRole('region', {
      exact: true,
      name: 'Rendered page preview',
    });
    await expect(preview.locator('[data-pdf-search-highlights] polygon')).toHaveCount(1);
    await expect(preview.getByRole('status')).toHaveText('1 text match on this page for “Hello”');
    await page.getByRole('textbox', { exact: true, name: 'Search document' }).fill('not-present');
    await page.getByRole('button', { exact: true, name: 'Run search' }).click();
    await expect(results).toContainText('0 pages');
    await expect(page.locator('[data-text-source-bytes]')).toHaveCount(0);
    await expect(preview.locator('[data-pdf-search-highlights]')).toHaveCount(0);
  });
}
test('preview search highlights follow page rotation, zoom and page navigation', async ({ page }) => {
  await cacheEngineAssets(page);
  const content = 'BT /F1 12 Tf 72 700 Td (Hello Hello) Tj ET';
  const other = 'BT /F1 12 Tf 72 700 Td (Other page) Tj ET';
  const fixture = classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 /Resources << /Font << /F1 5 0 R >> >> >>'],
    [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Rotate 90 /Contents 4 0 R >>'],
    [4, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`],
    [5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'],
    [6, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R >>'],
    [7, `<< /Length ${other.length} >>\nstream\n${other}\nendstream`],
  ]);
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(fixture.bytes),
    mimeType: 'application/pdf',
    name: 'rotated-search.pdf',
  });
  await expect(page.getByRole('contentinfo')).toContainText('7 objects indexed');
  await selectSearchScope(page, 'pageText');
  await page.getByRole('textbox', { exact: true, name: 'Search document' }).fill('hello');
  await page.getByRole('button', { exact: true, name: 'Run search' }).click();
  await page.getByRole('button', { exact: true, name: 'Open page preview' }).click();
  const preview = page.getByRole('region', {
    exact: true,
    name: 'Rendered page preview',
  });
  const polygons = preview.locator('[data-pdf-search-highlights] polygon');
  const image = preview.getByRole('img');
  await expect(polygons).toHaveCount(2);
  await expect(polygons.first()).toBeInViewport();
  await expect(preview.getByRole('status')).toHaveText('2 text matches on this page for “hello”');
  const relativeHighlight = async () => {
    const mark = (await polygons.first().boundingBox())!;
    const bounds = (await image.boundingBox())!;
    return {
      height: mark.height / bounds.height,
      width: mark.width / bounds.width,
      x: (mark.x - bounds.x) / bounds.width,
      y: (mark.y - bounds.y) / bounds.height,
    };
  };
  const before = await relativeHighlight();
  // Rotated text is vertical near the right side of this landscape page.
  expect(before.x).toBeGreaterThan(0.8);
  expect(before.y).toBeLessThan(0.2);
  expect((await polygons.first().boundingBox())!.height).toBeGreaterThan((await polygons.first().boundingBox())!.width);
  await preview.getByRole('button', { exact: true, name: 'Zoom in preview' }).click();
  await expect(preview.getByText('125%', { exact: true })).toBeVisible();
  await expect(polygons).toHaveCount(2);
  const after = await relativeHighlight();
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(after[key]).toBeCloseTo(before[key], 3);
  await preview.getByRole('button', { exact: true, name: 'Next preview page' }).click();
  await expect(image).toHaveAttribute('alt', 'rotated-search.pdf, page 2');
  await expect(polygons).toHaveCount(0);
  await expect(preview.getByRole('status')).toHaveText('0 text matches on this page for “hello”');
  await preview.getByRole('button', { exact: true, name: 'Previous preview page' }).click();
  await expect(polygons).toHaveCount(2);
  await page.getByRole('button', { exact: true, name: 'Clear search' }).click();
  await expect(polygons).toHaveCount(0);
  await expect(image).toBeVisible();
  await upload(page, 'minimal.pdf');
  await page.getByRole('button', { exact: true, name: 'Page preview' }).click();
  await expect(preview.getByRole('img', { exact: true, name: 'minimal.pdf, page 1' })).toBeVisible();
  await expect(polygons).toHaveCount(0);
});
test('page text search labels unsupported font mappings as candidate streams on mobile', async ({ page }) => {
  await cacheEngineAssets(page);
  await page.setViewportSize({ height: 844, width: 390 });
  const fixture = pageTextSearchPdf(false, true);
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(fixture.bytes),
    mimeType: 'application/pdf',
    name: 'custom-font.pdf',
  });
  await expect(page.getByRole('contentinfo')).toContainText('5 objects indexed');
  await selectSearchScope(page, 'pageText');
  await page.getByRole('textbox', { exact: true, name: 'Search document' }).fill('Hello');
  await page.getByRole('button', { exact: true, name: 'Run search' }).click();
  const results = page.getByRole('region', {
    exact: true,
    name: 'Search results',
  });
  await expect(results).toContainText('1 page');
  await expect(results.getByRole('button', { name: /Inspect content stream/i })).toHaveCount(1);
  await expect(page.locator('[data-text-source-note]')).toContainText('Exact text bytes could not be mapped');
  await expect(results).toContainText('Exact word bytes could not be mapped');
  const original = page.getByRole('region', {
    exact: true,
    name: 'Original file bytes',
  });
  await expect(original.locator('button[data-hex-byte][data-selected]').first()).toBeVisible();
  await expect(page.locator('[data-text-source-note]')).toContainText('not an exact word match');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { exact: true, name: 'Decoded bytes' }).click();
  await expect(
    page.getByRole('region', { exact: true, name: 'Decoded stream bytes' }).locator('button[data-hex-byte][data-selected]')
  ).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole('button', { exact: true, name: 'Show search results' }).click();
  await results.getByRole('button', { exact: true, name: 'Open page preview' }).click();
  const preview = page.getByRole('region', {
    exact: true,
    name: 'Rendered page preview',
  });
  await expect(preview.locator('[data-pdf-search-highlights] polygon')).toHaveCount(1);
  await expect(preview.getByRole('status')).toHaveText('1 text match on this page for “Hello”');
  await page.getByRole('button', { exact: true, name: 'Clear search' }).click();
  await expect(page.locator('[data-text-source-bytes]')).toHaveCount(0);
  await expect(preview.locator('[data-pdf-search-highlights]')).toHaveCount(0);
});
test('page text search uses the unlock password and keeps encrypted source bytes distinct', async ({ page }) => {
  await cacheEngineAssets(page);
  await page.getByLabel('Open local PDF').setInputFiles(resolve('tests/fixtures/encryption/AES-256-password.pdf'));
  const password = page.getByLabel('PDF password', { exact: true });
  await password.fill('secret');
  await password.press('Enter');
  await expect(password).toHaveCount(0);
  await selectSearchScope(page, 'pageText');
  await page.getByRole('textbox', { exact: true, name: 'Search document' }).fill('Hello');
  await page.getByRole('button', { exact: true, name: 'Run search' }).click();
  await expect(page.getByRole('region', { exact: true, name: 'Search results' })).toContainText('1 page');
  await expect(
    page.getByRole('region', { exact: true, name: 'Decoded stream bytes' }).locator('button[data-hex-byte][data-selected]')
  ).toHaveCount(5);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { exact: true, name: 'Original bytes' }).click();
  await expect(page.locator('[data-text-source-note]')).toContainText('Containing stream only');
});
test('cancels a pending page text search when the document is replaced', async ({ page }) => {
  await cacheEngineAssets(page);
  await openMinimal(page);
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  await page.route('**/*.wasm*', async (route) => {
    await gate;
    await route.continue().catch(() => undefined);
  });
  await selectSearchScope(page, 'pageText');
  await page.getByRole('textbox', { exact: true, name: 'Search document' }).fill('Hello');
  const loading = page.waitForRequest((request) => request.url().includes('.wasm'));
  await page.getByRole('button', { exact: true, name: 'Run search' }).click();
  await loading;
  await page.getByLabel('Open local PDF').setInputFiles(samplePath('minimal.pdf'));
  await expect(page.getByRole('contentinfo')).toContainText('5 objects indexed');
  release();
  await page.unrouteAll({ behavior: 'wait' });
  await expect(page.getByRole('region', { exact: true, name: 'Search results' })).toHaveCount(0);
  await expect(page.locator('[data-text-source-bytes]')).toHaveCount(0);
  await selectSearchScope(page, 'pageText');
  await page.getByRole('textbox', { exact: true, name: 'Search document' }).fill('internals');
  await page.getByRole('button', { exact: true, name: 'Run search' }).click();
  await expect(page.getByRole('region', { exact: true, name: 'Search results' })).toContainText('1 page');
  await expect(
    page.getByRole('region', { exact: true, name: 'Original file bytes' }).locator('button[data-hex-byte][data-selected]')
  ).toHaveCount(9);
});
test('page text search waits for a slow engine download before its time limit starts', async ({ page }) => {
  await cacheEngineAssets(page);
  await page.clock.install();
  await openMinimal(page);
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  await page.route('**/*.wasm*', async (route) => {
    await gate;
    // Fall back to the cached engine asset route rather than the network.
    await route.fallback().catch(() => undefined);
  });
  await selectSearchScope(page, 'pageText');
  await page.getByRole('textbox', { exact: true, name: 'Search document' }).fill('internals');
  const loading = page.waitForRequest((request) => request.url().includes('.wasm'));
  await page.getByRole('button', { exact: true, name: 'Run search' }).click();
  await loading;
  await page.clock.fastForward(30_000);
  const results = page.getByRole('region', { exact: true, name: 'Search results' });
  await expect(results).toContainText('Searching for “internals”…');
  release();
  await expect(results).toContainText('1 page');
  await expect(results).not.toContainText('exceeded 15 seconds');
});
test('page text search blames the engine, not the file, when the engine fails to load', async ({ page }) => {
  await cacheEngineAssets(page);
  await page.clock.install();
  await openMinimal(page);
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  await page.route('**/*.wasm*', async (route) => {
    await gate;
    await route.abort().catch(() => undefined);
  });
  await selectSearchScope(page, 'pageText');
  const search = page.getByRole('textbox', { exact: true, name: 'Search document' });
  await search.fill('internals');
  const loading = page.waitForRequest((request) => request.url().includes('.wasm'));
  await page.getByRole('button', { exact: true, name: 'Run search' }).click();
  await loading;
  await page.clock.fastForward(121_000);
  const results = page.getByRole('region', { exact: true, name: 'Search results' });
  await expect(results).toContainText('The page text engine did not load within 2 minutes. Check your connection and search again.');
  await page.getByRole('button', { exact: true, name: 'Run search' }).click();
  release();
  await expect(results).toContainText('The page text engine could not load. Check your connection and search again.');
  await expect(results).not.toContainText('smaller PDF');
});
for (const width of [1440, 390]) {
  test(`keeps popover results stable while searching and preserves them when hidden at ${width}px`, async ({ page }) => {
    await page.addInitScript(() => {
      const postMessage = Worker.prototype.postMessage;
      const pending: {
        worker: Worker;
        message: unknown;
      }[] = [];
      let released = false;
      Worker.prototype.postMessage = function (message) {
        if (!released && message?.type === 'stream') pending.push({ message, worker: this });
        else postMessage.call(this, message, []);
      };
      window.addEventListener('release-search', () => {
        released = true;
        for (const { worker, message } of pending) postMessage.call(worker, message, []);
      });
    });
    await page.reload();
    await page.setViewportSize({ height: 1000, width });
    await openMinimal(page);
    const search = page.getByRole('textbox', {
      exact: true,
      name: 'Search document',
    });
    const results = page.getByRole('region', {
      exact: true,
      name: 'Search results',
    });
    await search.fill('0');
    await search.press('Enter');
    const matches = results.locator('[data-search-matches] button');
    await expect(matches).toHaveCount(5);
    const height = (await results.boundingBox())!.height;
    expect(height).toBeGreaterThan(200);
    expect(height).toBeLessThanOrEqual(600);
    const panel = await results.elementHandle();
    await search.fill('Hello');
    await selectSearchScope(page, 'decoded');
    await expect(results).toContainText('Searching for “Hello”…');
    await expect(matches).toHaveCount(5);
    await expect(results.locator('[data-search-previous]')).toHaveText('Previous results for “0”');
    await expect(results.locator('[data-search-matches]')).toHaveCSS('opacity', '0.55');
    expect((await results.boundingBox())!.height).toBe(height);
    await expect(matches.first()).toBeDisabled();
    await page.evaluate(() => window.dispatchEvent(new Event('release-search')));
    await expect(matches).toHaveCount(1);
    await expect(results).toContainText('1 match');
    expect((await results.boundingBox())!.height).toBeLessThan(height);
    expect(await panel!.evaluate((element) => element === document.querySelector('[data-search-results]'))).toBe(true);
    await search.fill('no-such-text');
    await search.press('Enter');
    await expect(results).toContainText('0 matches');
    expect((await results.boundingBox())!.height).toBeLessThan(height);
    // Inspecting outside the popover hides it without discarding the query or results.
    if (width < 900) {
      await page.keyboard.press('Escape');
      await page.getByRole('button', { exact: true, name: 'Explorer' }).click();
    }
    await page.getByRole('button', { exact: true, name: 'Overview' }).click();
    await expect(results).toHaveCount(0);
    await expect(search).toHaveValue('no-such-text');
    await page.getByRole('button', { exact: true, name: 'Back' }).click();
    await page.getByRole('button', { exact: true, name: 'Show search results' }).click();
    await expect(results).toContainText('0 matches');
    await search.fill('');
    await expect(results).toHaveCount(0);
  });
}
test('clearing a query cancels the pending results and the close button clears the query too', async ({ page }) => {
  await page.addInitScript(() => {
    const postMessage = Worker.prototype.postMessage;
    const pending: {
      worker: Worker;
      message: unknown;
    }[] = [];
    let released = false;
    Worker.prototype.postMessage = function (message) {
      if (!released && message?.type === 'stream') pending.push({ message, worker: this });
      else postMessage.call(this, message, []);
    };
    window.addEventListener('release-search', () => {
      released = true;
      for (const { worker, message } of pending) postMessage.call(worker, message, []);
    });
  });
  await page.reload();
  await openMinimal(page);
  const search = page.getByRole('textbox', {
    exact: true,
    name: 'Search document',
  });
  const results = page.getByRole('region', {
    exact: true,
    name: 'Search results',
  });
  await selectSearchScope(page, 'decoded');
  await search.fill('Hello');
  await search.press('Enter');
  await expect(results).toContainText('Searching for “Hello”…');
  await search.fill('');
  await expect(results).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('release-search')));
  // A subsequent search must work and must not inherit results from the cancelled query.
  await selectSearchScope(page, 'text');
  await search.fill('not-present');
  await search.press('Enter');
  await expect(results).toContainText('0 matches');
  await page.getByRole('button', { exact: true, name: 'Clear search' }).click();
  await expect(search).toHaveValue('');
  await expect(results).toHaveCount(0);
});
for (const width of [1440, 390]) {
  test(`labels retained results during loading, cancellation and failure at ${width}px`, async ({ page }) => {
    await page.addInitScript(() => {
      const postMessage = Worker.prototype.postMessage;
      const pending: {
        worker: Worker;
        message: unknown;
      }[] = [];
      let released = false;
      Worker.prototype.postMessage = function (message) {
        if (!released && message?.type === 'stream') pending.push({ message, worker: this });
        else postMessage.call(this, message, []);
      };
      window.addEventListener('release-search', () => {
        released = true;
        for (const { worker, message } of pending) postMessage.call(worker, message, []);
      });
    });
    await page.reload();
    await page.setViewportSize({ height: 1000, width });
    await openMinimal(page);
    const search = page.getByRole('textbox', {
      exact: true,
      name: 'Search document',
    });
    const results = page.getByRole('region', {
      exact: true,
      name: 'Search results',
    });
    const matches = results.locator('[data-search-matches] button');
    await search.fill('0');
    await search.press('Enter');
    await expect(matches).toHaveCount(5);
    await page.clock.install();
    await search.fill('Hello');
    await page.getByRole('combobox', { exact: true, name: 'Search scope' }).click();
    const decoded = page.getByRole('option', {
      exact: true,
      name: 'Decoded streams',
    });
    await expect(decoded).toBeVisible();
    // Freeze before the search starts, using the browser clock rather than host
    // time. Force the click because actionability's animation frames are paused.
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await decoded.click({ force: true });
    await expect(results).toContainText('Searching for “Hello”…');
    await page.clock.runFor(599);
    await expect(results.getByRole('button', { exact: true, name: 'Cancel search' })).toHaveCount(0);
    await page.clock.runFor(1);
    await expect(results.getByRole('button', { exact: true, name: 'Cancel search' })).toHaveText('Cancel');
    await page.clock.resume();
    await search.fill('edited while searching');
    await expect(results).toContainText('Searching for “Hello”…');
    await expect(results.locator('[data-search-previous]')).toHaveText('Previous results for “0”');
    await expect(matches.first()).toBeDisabled();
    await mkdir(resolve('.context'), { recursive: true });
    await results.screenshot({
      animations: 'disabled',
      path: screenshotPath(`search-refined-loading-${width}.png`),
    });
    await expect(results.getByRole('button', { exact: true, name: 'Cancel search' })).toHaveText('Cancel');
    await results.getByRole('button', { exact: true, name: 'Cancel search' }).click();
    await expect(results).toContainText('Search cancelled for “Hello”');
    await expect(search).toBeFocused();
    await expect(results.locator('[data-search-previous]')).toHaveText('Previous results for “0”');
    await expect(matches).toHaveCount(5);
    await expect(matches.first()).toBeEnabled();
    await expect(results.locator('[data-search-matches]')).toHaveCSS('opacity', '1');
    await page.evaluate(() => window.dispatchEvent(new Event('release-search')));
    await selectSearchScope(page, 'hex');
    await search.fill('ZZ');
    await search.press('Enter');
    await expect(results).toContainText('Search failed for “ZZ”');
    await expect(results).toContainText('Enter complete hex bytes');
    await expect(results.locator('[data-search-previous]')).toHaveText('Previous results for “0”');
    await expect(matches).toHaveCount(5);
    await selectSearchScope(page, 'objects');
    await search.fill('not-present');
    await search.press('Enter');
    await expect(results).toContainText('0 matches');
    await expect(results.locator('[data-search-previous]')).toHaveCount(0);
    expect((await results.boundingBox())!.height).toBeLessThan(400);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}
for (const width of [1440, 390]) {
  test(`shows a vertical search popover without shifting the workspace at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ height: 1000, width });
    await openMinimal(page);
    const workspace = page.locator(width < 900 ? '[data-workspace="mobile"]' : '[data-workspace="desktop"]');
    const before = await workspace.boundingBox();
    const search = page.getByRole('textbox', {
      exact: true,
      name: 'Search document',
    });
    await selectSearchScope(page, 'text');
    await search.fill('0');
    await search.press('Enter');
    const results = page.getByRole('region', {
      exact: true,
      name: 'Search results',
    });
    const rows = results.locator('[data-search-result]');
    await expect(results).toBeVisible();
    await expect.poll(() => rows.count()).toBeGreaterThan(10);
    const after = await workspace.boundingBox();
    expect(after!.y).toBe(before!.y);
    expect(after!.height).toBe(before!.height);
    const first = (await rows.nth(0).boundingBox())!;
    const second = (await rows.nth(1).boundingBox())!;
    expect(second.x).toBe(first.x);
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
    expect(first.height).toBeGreaterThan(40);
    const body = results.locator('[data-search-results-body]');
    expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    const bounds = (await results.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await mkdir(resolve('.context'), { recursive: true });
    await page.screenshot({
      animations: 'disabled',
      fullPage: true,
      path: screenshotPath(`search-popover-${width}.png`),
    });
    await search.press('ArrowDown');
    await expect(rows.nth(0)).toBeFocused();
    await rows.nth(0).press('ArrowDown');
    await expect(rows.nth(1)).toBeFocused();
    await expect(rows.nth(1)).toHaveAttribute('aria-current', 'true');
    await rows.nth(1).press('Enter');
    await expect(results).toHaveCount(0);
    await expect(search).toHaveValue('0');
    await page.getByRole('button', { exact: true, name: 'Show search results' }).click();
    await expect(rows.nth(1)).toHaveAttribute('aria-current', 'true');
    await rows.nth(1).press('Escape');
    await expect(results).toHaveCount(0);
    await expect(search).toBeFocused();
    await search.press('ControlOrMeta+k');
    await expect(results).toBeVisible();
    await rows.last().click();
    await expect(results).toHaveCount(0);
    await page.getByRole('button', { exact: true, name: 'Show search results' }).click();
    await expect(rows.last()).toBeInViewport();
    await page.getByRole('button', { exact: true, name: 'Hide search results' }).click();
    await expect(results).toHaveCount(0);
    await search.click();
    await expect(results).toBeVisible();
    await page.getByRole('button', { exact: true, name: 'Clear search' }).click();
    await expect(search).toHaveValue('');
    await expect(results).toHaveCount(0);
  });
}
for (const width of [1440, 390, 320]) {
  test(`keeps match navigation in the popover and offers contextual results at ${width}px`, async ({ page }) => {
    await cacheEngineAssets(page);
    await page.setViewportSize({ height: 900, width });
    await openMinimal(page);
    const search = page.getByRole('textbox', {
      exact: true,
      name: 'Search document',
    });
    const results = page.getByRole('region', {
      exact: true,
      name: 'Search results',
    });
    const current = results.getByRole('group', {
      exact: true,
      name: 'Search result navigation',
    });
    await selectSearchScope(page, 'text');
    await search.fill('Hello');
    await search.press('Enter');
    await expect(results).toContainText('1 match');
    await expect(results.locator('[data-search-result] mark')).toHaveText('Hello');
    await expect(results.locator('[data-search-result-context]')).toContainText('PDF internals.');
    await expect(results.locator('[data-search-result-meta]')).toContainText('5 original file bytes');
    expect((await results.boundingBox())!.height).toBeLessThan(width < 900 ? 280 : 240);
    await results.locator('[data-search-result]').click();
    await expect(results).toHaveCount(0);
    await expect(page.getByRole('group', { exact: true, name: 'Current search match' })).toHaveCount(0);
    await search.fill('0');
    await search.press('Enter');
    await expect(results).toContainText('89 matches');
    await results.locator('[data-search-result]').first().click();
    await page.getByRole('button', { exact: true, name: 'Show search results' }).click();
    const previousSelection = await page.locator('[data-hex-status]').textContent();
    await current.getByRole('button', { exact: true, name: 'Next search result' }).click();
    await expect(current).toContainText('2 of 89');
    await expect(results).toBeVisible();
    await expect(page.locator('[data-hex-status]')).not.toHaveText(previousSelection!);
    await current.getByRole('button', { exact: true, name: 'Previous search result' }).click();
    await expect(current).toContainText('1 of 89');
    await current.getByRole('button', { exact: true, name: 'Previous search result' }).click();
    await expect(current).toContainText('89 of 89');
    await expect(results.locator('[data-search-result]').last()).toBeInViewport();
    await selectSearchScope(page, 'objects');
    await search.fill('Hello');
    await search.press('Enter');
    await expect(results).toContainText('0 matches');
    await results.getByRole('button', { exact: true, name: 'Search page text instead' }).click();
    await expect(results).toContainText('1 page');
    await expect(page.getByRole('combobox', { exact: true, name: 'Search scope' })).toContainText('Page text');
    await expect(search).toHaveValue('Hello');
    await expect(results.locator('[data-search-result] mark')).toHaveText('Hello');
    await expect(results.getByRole('button', { exact: true, name: 'Open page preview' })).toBeVisible();
    if (width < 900) {
      expect((await search.boundingBox())!.width).toBeGreaterThan(180);
      expect((await current.getByRole('button', { exact: true, name: 'Next search result' }).boundingBox())!.height).toBeGreaterThanOrEqual(
        44
      );
      expect(
        (await results.getByRole('button', { exact: true, name: 'Hide search results' }).boundingBox())!.height
      ).toBeGreaterThanOrEqual(44);
    }
    await mkdir(resolve('.context'), { recursive: true });
    await page.screenshot({
      animations: 'disabled',
      fullPage: true,
      path: screenshotPath(`search-reviewed-${width}.png`),
    });
    await results.getByRole('button', { name: /Show bytes/ }).click();
    await expect(results).toHaveCount(0);
    await expect(page.getByRole('group', { exact: true, name: 'Current search match' })).toHaveCount(0);
    await expect(page.locator('[data-hex-status]')).toContainText('5 bytes selected');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}
for (const scope of ['text', 'pageText', 'pageTextDecoded']) {
  test(`reselecting the same ${scope} result reveals its highlighted bytes after scrolling away`, async ({ page }) => {
    await cacheEngineAssets(page);
    const content = 'BT /F1 12 Tf 72 700 Td (Hello) Tj ET\n%' + 'padding '.repeat(4000);
    const compressed = scope === 'pageTextDecoded';
    const contentBytes = compressed ? (await import('node:zlib')).deflateSync(Buffer.from(content)) : Buffer.from(content);
    const fixture = classicPdf([
      [1, '<< /Type /Catalog /Pages 2 0 R >>'],
      [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /Font << /F1 5 0 R >> >> >>'],
      [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>'],
      [
        4,
        Buffer.concat([
          Buffer.from(`<< /Length ${contentBytes.length}${compressed ? ' /Filter /FlateDecode' : ''} >>\nstream\n`),
          contentBytes,
          Buffer.from('\nendstream'),
        ]),
      ],
      [5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'],
    ]);
    await page.getByLabel('Open local PDF').setInputFiles({
      buffer: Buffer.from(fixture.bytes),
      mimeType: 'application/pdf',
      name: 'long-text-stream.pdf',
    });
    await expect(page.getByRole('contentinfo')).toContainText('5 objects indexed');
    await selectSearchScope(page, compressed ? 'pageText' : scope);
    await page.getByRole('textbox', { exact: true, name: 'Search document' }).fill('Hello');
    await page.getByRole('button', { exact: true, name: 'Run search' }).click();
    const results = page.getByRole('region', {
      exact: true,
      name: 'Search results',
    });
    await expect(results.locator('[data-search-result]')).toHaveCount(1);
    await results.locator('[data-search-result]').click();
    const bytes = page.getByRole('region', {
      exact: true,
      name: compressed ? 'Decoded stream bytes' : 'Original file bytes',
    });
    await expect(bytes.locator('button[data-hex-byte][data-selected]')).toHaveCount(5);
    await bytes.locator('[data-hex-viewport]').evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(bytes.locator('button[data-hex-byte][data-selected]')).toHaveCount(0);
    await page.getByRole('button', { exact: true, name: 'Show search results' }).click();
    await results.locator('[data-search-result]').click();
    await expect(bytes.locator('button[data-hex-byte][data-selected]')).toHaveCount(5);
    await expect(bytes.locator('button[data-hex-byte][data-selected]').first()).toBeInViewport();
    await bytes.locator('[data-hex-viewport]').evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(bytes.locator('button[data-hex-byte][data-selected]')).toHaveCount(0);
    await page.getByRole('button', { exact: true, name: 'Back' }).click();
    await page.getByRole('button', { exact: true, name: 'Forward' }).click();
    await page.getByRole('button', { exact: true, name: 'Show search results' }).click();
    await results.locator('[data-search-result]').click();
    await expect(bytes.locator('button[data-hex-byte][data-selected]')).toHaveCount(5);
    await expect(bytes.locator('button[data-hex-byte][data-selected]').first()).toBeInViewport();
    if (compressed) {
      for (const width of [2400, 1440]) {
        await page.setViewportSize({ height: 1000, width });
        await expect(bytes.locator('[data-hex-spacer]')).toHaveCSS('--hex-columns', width === 2400 ? '16' : '8');
        await expect(bytes.locator('button[data-hex-byte][data-selected]')).toHaveCount(5);
        await expect(bytes.locator('button[data-hex-byte][data-selected]').first()).toBeInViewport();
      }
      // Selecting a text result again must reveal the word even after inspecting
      // the compressed original container with the representation switch.
      await page.getByRole('button', { exact: true, name: 'Original bytes' }).click();
      await expect(page.locator('[data-text-source-note]')).toContainText('Containing stream only');
      await page.getByRole('button', { exact: true, name: 'Show search results' }).click();
      await results.locator('[data-search-result]').click();
      await expect(bytes).toBeVisible();
      await expect(bytes.locator('button[data-hex-byte][data-selected]')).toHaveCount(5);
      await expect(bytes.locator('button[data-hex-byte][data-selected]').first()).toBeInViewport();
    }
  });
}
for (const width of [1440, 390]) {
  test(`result arrows reveal the whole page result card at ${width}px`, async ({ page }) => {
    await cacheEngineAssets(page);
    await page.setViewportSize({ height: 900, width });
    const content = 'BT /F1 12 Tf 72 700 Td (Hello model) Tj ET';
    const objects: [number, string][] = [
      [1, '<< /Type /Catalog /Pages 2 0 R >>'],
      [2, '<< /Type /Pages /Kids [6 0 R 8 0 R 10 0 R 12 0 R 14 0 R 16 0 R] /Count 6 /Resources << /Font << /F1 5 0 R >> >> >>'],
      [5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding << /BaseEncoding /WinAnsiEncoding /Differences [32 /space] >> >>'],
    ];
    for (let id = 6; id <= 16; id += 2) {
      objects.push(
        [id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${id + 1} 0 R >>`],
        [id + 1, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`]
      );
    }
    const fixture = classicPdf(objects);
    await page.getByLabel('Open local PDF').setInputFiles({
      buffer: Buffer.from(fixture.bytes),
      mimeType: 'application/pdf',
      name: 'six-pages.pdf',
    });
    await expect(page.getByRole('contentinfo')).toContainText('15 objects indexed');
    await selectSearchScope(page, 'pageText');
    const search = page.getByRole('textbox', {
      exact: true,
      name: 'Search document',
    });
    await search.fill('model');
    await search.press('Enter');
    const results = page.getByRole('region', {
      exact: true,
      name: 'Search results',
    });
    const cards = results.locator('[data-search-result-item]');
    await expect(cards).toHaveCount(6);
    const expectWholeCard = async (index: number) => {
      await expect(cards.nth(index).locator('[data-search-result]')).toHaveAttribute('aria-current', 'true');
      await expect
        .poll(async () => {
          const card = (await cards.nth(index).boundingBox())!;
          const body = (await results.locator('[data-search-results-body]').boundingBox())!;
          return card.y >= body.y && card.y + card.height <= body.y + body.height + 1;
        })
        .toBe(true);
    };
    const next = results.getByRole('button', {
      exact: true,
      name: 'Next search result',
    });
    const previous = results.getByRole('button', {
      exact: true,
      name: 'Previous search result',
    });
    const move = async (direction: 'next' | 'previous') => {
      if (width < 900) {
        await results.locator('[data-search-result][aria-current="true"]').press(direction === 'next' ? 'ArrowDown' : 'ArrowUp');
      } else {
        await (direction === 'next' ? next : previous).click();
      }
    };
    for (let index = 1; index <= 3; index++) {
      await move('next');
      await expectWholeCard(index);
    }
    await move('previous');
    await expectWholeCard(2);
    // Keyboard focus must not override the card's scroll position with the snippet's.
    await search.press('ArrowDown');
    await expect(cards.nth(2).locator('[data-search-result]')).toBeFocused();
    await cards.nth(2).locator('[data-search-result]').press('ArrowDown');
    await expectWholeCard(3);
    await cards.nth(3).locator('[data-search-result]').press('ArrowUp');
    await expectWholeCard(2);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await move('previous');
    await expectWholeCard(1);
    await move('previous');
    await expectWholeCard(0);
    await move('previous');
    await expectWholeCard(5);
  });
}
test('page result actions are visible before choosing an unselected page', async ({ page }) => {
  await cacheEngineAssets(page);
  const content = 'BT /F1 12 Tf 72 700 Td (Hello) Tj ET';
  const fixture = classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 /Resources << /Font << /F1 5 0 R >> >> >>'],
    [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>'],
    [4, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`],
    [5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'],
    [6, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R >>'],
    [7, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`],
  ]);
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(fixture.bytes),
    mimeType: 'application/pdf',
    name: 'two-pages.pdf',
  });
  await expect(page.getByRole('contentinfo')).toContainText('7 objects indexed');
  await selectSearchScope(page, 'pageText');
  await page.getByRole('textbox', { exact: true, name: 'Search document' }).fill('Hello');
  await page.getByRole('button', { exact: true, name: 'Run search' }).click();
  const results = page.getByRole('region', {
    exact: true,
    name: 'Search results',
  });
  await expect(results.locator('[data-search-result]')).toHaveCount(2);
  const second = results.locator('[data-search-result-item]').nth(1);
  await expect(second.getByRole('button', { name: /Show bytes/ })).toBeVisible();
  await expect(second.getByRole('button', { exact: true, name: 'Open page preview' })).toBeVisible();
  await second.getByRole('button', { name: /Show bytes/ }).click();
  await expect(results).toHaveCount(0);
  await expect(page.getByRole('group', { exact: true, name: 'Current search match' })).toHaveCount(0);
  await expect(
    page.getByRole('region', { exact: true, name: 'Original file bytes' }).locator('button[data-hex-byte][data-selected]')
  ).toHaveCount(5);
});
test('page text search highlights bytes encoded through a Unicode range font map', async ({ page }) => {
  await cacheEngineAssets(page);
  const content = 'BT /F1 12 Tf 72 700 Td (Hello) Tj ET';
  const cmap = 'begincmap\n1 begincodespacerange <00> <FF> endcodespacerange\n1 beginbfrange <00> <FF> <0000> endbfrange\nendcmap';
  const fixture = classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /Font << /F1 5 0 R >> >> >>'],
    [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>'],
    [4, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`],
    [5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /ToUnicode 6 0 R >>'],
    [6, `<< /Length ${cmap.length} >>\nstream\n${cmap}\nendstream`],
  ]);
  await page.getByLabel('Open local PDF').setInputFiles({
    buffer: Buffer.from(fixture.bytes),
    mimeType: 'application/pdf',
    name: 'range-font.pdf',
  });
  await expect(page.getByRole('contentinfo')).toContainText('6 objects indexed');
  await selectSearchScope(page, 'pageText');
  await page.getByRole('textbox', { exact: true, name: 'Search document' }).fill('Hello');
  await page.getByRole('button', { exact: true, name: 'Run search' }).click();
  const results = page.getByRole('region', {
    exact: true,
    name: 'Search results',
  });
  await expect(results).toContainText('1 page');
  await expect(results.getByRole('button', { name: /Show bytes/ })).toBeVisible();
  await expect(results).not.toContainText('Exact word bytes could not be mapped');
  await results.getByRole('button', { name: /Show bytes/ }).click();
  const selected = page.getByRole('region', { exact: true, name: 'Original file bytes' }).locator('button[data-hex-byte][data-selected]');
  await expect(selected).toHaveCount(5);
  await expect(selected.first()).toBeInViewport();
});
