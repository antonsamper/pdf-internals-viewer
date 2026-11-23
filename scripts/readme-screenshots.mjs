// Captures the README screenshots from a running site.
// Usage: node scripts/readme-screenshots.mjs [base URL, default http://127.0.0.1:5173]
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const baseURL = process.argv[2] ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const page = await browser.newPage({ colorScheme: theme, deviceScaleFactor: 1, viewport: { height: 860, width: 1440 } });
  await page.goto(`${baseURL}/?sample=incorrect-unicode`);
  await page.getByRole('button', { exact: true, name: 'First page' }).click();
  await page.getByRole('button', { exact: true, name: '4 0 R' }).first().click();
  await page.getByRole('tab', { exact: true, name: 'Decoded' }).click();
  const instructions = page.getByRole('tabpanel', { exact: true, name: 'Decoded' });
  await instructions.getByRole('button', { exact: true, name: 'Readable instructions' }).click();
  await instructions.getByRole('button', { exact: true, name: 'Inspect /F1 resource' }).first().click();
  await page.getByRole('button', { exact: true, name: '6 0 R' }).first().click();
  await page.getByRole('tab', { exact: true, name: 'Decoded' }).click();
  const decoded = page.getByRole('tabpanel', { exact: true, name: 'Decoded' }).locator('pre');
  await decoded.getByText('<31> <0039>').waitFor();
  // Select and centre the incorrect entry, which maps the digit 1 (code 31) to U+0039, the digit 9.
  await decoded.evaluate((pre) => {
    const text = [...pre.childNodes].flatMap((node) => (node.nodeType === Node.TEXT_NODE ? [node] : [...node.childNodes]));
    const node = text.find((child) => child.textContent?.includes('<31> <0039>'));
    if (!node) throw new Error('Mapping not found');
    const start = node.textContent.indexOf('<31> <0039>');
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + '<31> <0039>'.length);
    let scroller = pre.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight) scroller = scroller.parentElement;
    if (scroller) {
      const box = scroller.getBoundingClientRect();
      scroller.scrollTop += range.getBoundingClientRect().top - box.top - box.height / 2;
    }
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ animations: 'disabled', path: fileURLToPath(new URL(`../docs/images/inspector-${theme}.png`, import.meta.url)) });
  await page.close();
}
await browser.close();
