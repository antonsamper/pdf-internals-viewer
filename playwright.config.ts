import { defineConfig, devices } from '@playwright/test';

import { port } from './vite/port.ts';

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const cloudflarePreview = Boolean(process.env.PLAYWRIGHT_CLOUDFLARE);
const localBaseURL = cloudflarePreview ? 'http://127.0.0.1:8787' : `http://127.0.0.1:${port}`;

export default defineConfig({
  expect: { timeout: 12000 },
  // Tests use isolated browser contexts, so cases in the same file can run together.
  fullyParallel: true,
  reporter: 'list',
  testDir: './tests',
  testMatch: 'e2e.spec.ts',
  timeout: 45000,
  use: {
    baseURL: externalBaseURL ?? localBaseURL,
    ...devices['Desktop Chrome'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { height: 1000, width: 1440 },
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: cloudflarePreview
          ? 'pnpm exec wrangler pages dev dist --ip 127.0.0.1 --port 8787'
          : process.env.PLAYWRIGHT_PREVIEW
            ? `pnpm run preview --host 127.0.0.1 --port ${port} --strictPort`
            : `pnpm run dev --host 127.0.0.1 --port ${port} --strictPort`,
        reuseExistingServer: cloudflarePreview ? false : !process.env.CI,
        timeout: 30000,
        url: localBaseURL,
      },
  workers: 4,
});
