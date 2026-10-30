import { defineConfig, devices } from '@playwright/test';

const externalURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: {
    baseURL: externalURL ?? 'http://127.0.0.1:18080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // Standalone local runs build and start the same Go/static-file setup.
  // CI points these tests at the image it just built instead.
  webServer: externalURL ? undefined : {
    command: 'npm run build && cd ../backend && PORT=18080 STATIC_DIR=../frontend/dist go run ./cmd/server',
    url: 'http://127.0.0.1:18080/healthz',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
