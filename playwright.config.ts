import { defineConfig, devices } from '@playwright/test';

/**
 * CI installs the browsers Playwright expects, including WebKit for the phone
 * and tablet projects. A restricted machine that cannot download them can set
 * `PLAYWRIGHT_CHROMIUM_PATH` to a Chromium it already has: every project then
 * runs its viewport and input profile on Chromium instead. That is a weaker
 * check than real WebKit and is a fallback, never what CI does — unset, this
 * changes nothing.
 */
const localChromium = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const engineOverride = localChromium
  ? {
      browserName: 'chromium' as const,
      launchOptions: { executablePath: localChromium, args: ['--no-sandbox'] },
    }
  : {};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm build && pnpm preview --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...engineOverride } },
    { name: 'iphone', use: { ...devices['iPhone 15'], ...engineOverride } },
    { name: 'ipad', use: { ...devices['iPad Pro 11'], ...engineOverride } },
  ],
});
