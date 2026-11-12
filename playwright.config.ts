import { defineConfig, devices } from '@playwright/test'

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL
const cloudflarePreview = Boolean(process.env.PLAYWRIGHT_CLOUDFLARE)
const localBaseURL = cloudflarePreview ? 'http://127.0.0.1:8787' : 'http://127.0.0.1:5173'

export default defineConfig({
  testDir: './tests',
  testMatch: 'e2e.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: 'list',
  use: {
    baseURL: externalBaseURL ?? localBaseURL,
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: externalBaseURL ? undefined : {
    command: cloudflarePreview
      ? 'pnpm exec wrangler pages dev dist --ip 127.0.0.1 --port 8787'
      : process.env.PLAYWRIGHT_PREVIEW
      ? 'pnpm run preview --host 127.0.0.1 --port 5173 --strictPort'
      : 'pnpm run dev --host 127.0.0.1 --port 5173 --strictPort',
    url: localBaseURL,
    reuseExistingServer: cloudflarePreview ? false : !process.env.CI,
    timeout: 30_000,
  },
})
