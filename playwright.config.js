import { defineConfig } from '@playwright/test';

const port = 8788;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Fade-in animations otherwise let axe sample semi-transparent text.
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'mobile-320', use: { browserName: 'chromium', viewport: { width: 320, height: 568 } } },
    { name: 'mobile-390', use: { browserName: 'chromium', viewport: { width: 390, height: 844 } } },
    { name: 'tablet', use: { browserName: 'chromium', viewport: { width: 768, height: 1024 } } },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } }
  ],
  webServer: {
    command: `E2E_PORT=${port} node scripts/e2e-web-server.mjs`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
