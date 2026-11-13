import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@playwright/test';
import { loadEnvironment } from './tests/support/test-data';

loadEnvironment();
// Installed Playwright uses this switch to omit automatic page snapshots in errors.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
for (const directory of ['test-results', 'playwright-report']) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
}
const authFile = path.resolve(process.env.HEALTHEX_AUTH_STATE ?? 'playwright/.auth/healthex.json');

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/healthex/*.spec.ts', '**/sharing/*.spec.ts'],
  outputDir: './test-results/chrome',
  globalSetup: './scripts/global-setup.ts',
  globalTeardown: './scripts/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: Number(process.env.HEALTHEX_TEST_TIMEOUT ?? 300000),
  expect: { timeout: 15000 },
  reporter: [['list'], ['html', { open: process.env.CI ? 'never' : 'always', host: '127.0.0.1' }]],
  use: {
    baseURL: process.env.HEALTHEX_BASE_URL ?? 'https://app.healthex.io',
    headless: process.env.HEALTHEX_HEADLESS === 'true',
    launchOptions: { slowMo: Number(process.env.HEALTHEX_SLOW_MO ?? 0) },
    storageState: fs.existsSync(authFile) ? authFile : undefined,
    acceptDownloads: true,
    actionTimeout: 15000,
    navigationTimeout: 45000,
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  // Keep installed Chrome's real user agent; the bundled Desktop Chrome preset
  // emulates another OS/version and invalidates this application's device session.
  projects: [{ name: 'chrome', use: { channel: 'chrome', viewport: { width: 1280, height: 900 } } }],
});
