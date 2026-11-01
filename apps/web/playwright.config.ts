import { defineConfig, devices } from '@playwright/test'

/**
 * Two modes:
 * - mock (default): the web app runs locally against a fake API served by `page.route` (deterministic).
 * - real: set E2E_API_URL to a running API (and optionally E2E_BASE_URL to an already running web app).
 *   Only the vision endpoint stays mocked, since it needs SAM credentials.
 */
const PORT = 5361
export const MOCK_API = 'http://api.mock'
const apiUrl = process.env.E2E_API_URL ?? MOCK_API
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    locale: 'es-PY',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm exec vite --port ${PORT} --strictPort --host 127.0.0.1`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        env: { VITE_API_URL: apiUrl },
      },
})
