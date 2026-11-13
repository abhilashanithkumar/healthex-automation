import { test as base, expect, type Browser } from '@playwright/test';
import { loadTestData, type TestData } from '../support/test-data';
import { createArtifactTools } from '../support/artifact-tools';
import type { ArtifactTools } from '../support/artifacts';
import fs from 'node:fs/promises';
import path from 'node:path';

export const test = base.extend<{ data: TestData; artifacts: ArtifactTools; authenticated: boolean }, { attachedBrowser: Browser | undefined }>({
  attachedBrowser: [async ({ playwright }, use) => {
    if (process.env.HEALTHEX_AUTH_MODE !== 'cdp') { await use(undefined); return; }
    const endpoint = process.env.HEALTHEX_CDP_ENDPOINT ?? 'http://127.0.0.1:19333';
    if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(endpoint).hostname)) throw new Error('Existing Chrome mode requires a local endpoint');
    const attached = await playwright.chromium.connectOverCDP(endpoint, {
      slowMo: Number(process.env.HEALTHEX_SLOW_MO ?? 0),
    });
    try { await use(attached); }
    finally {
      // Disconnect this worker. Global teardown closes task Chrome once the run ends.
      await attached.close();
    }
  }, { scope: 'worker' }],
  authenticated: [true, { option: true }],
  data: async ({}, use) => { await use(loadTestData()); },
  context: async ({ context: isolated, attachedBrowser, baseURL, authenticated, data }, use, info) => {
    const context = authenticated && attachedBrowser ? attachedBrowser.contexts()[0] : isolated;
    const originalPages = new Set(context.pages());
    await fs.mkdir(info.outputDir, { recursive: true, mode: 0o700 });
    await fs.chmod(info.outputDir, 0o700);
    if (authenticated && !attachedBrowser) {
      const authFile = path.resolve(process.env.HEALTHEX_AUTH_STATE ?? 'playwright/.auth/healthex.json');
      const sessionFile = process.env.HEALTHEX_SESSION_STORAGE ?? authFile.replace(/\.json$/, '.session.json');
      const saved = await fs.readFile(sessionFile, 'utf8').then(text => JSON.parse(text) as { origin: string; entries: Record<string, string> }).catch(() => undefined);
      if (saved && saved.origin === new URL(baseURL ?? 'https://app.healthex.io').origin) {
        await context.addInitScript(({ origin, entries }) => {
          if (location.origin === origin) for (const [key, value] of Object.entries(entries)) sessionStorage.setItem(key, value);
        }, saved);
      }
    }
    const allowed = (process.env.HEALTHEX_ALLOWED_POPUP_HOSTS ?? [
      new URL(baseURL ?? 'https://app.healthex.io').hostname,
      new URL(data.publicURL).hostname,
      'www.' + new URL(data.publicURL).hostname.replace(/^www\./, ''),
      ...Object.values(data.fixture.controlled).filter(Boolean).map(item => new URL(item!.startURL, data.baseURL).hostname),
      'accounts.google.com', 'myaccount.google.com', '.kaiserpermanente.org',
      '.fastenhealth.com', '.fastenhealth.io',
      'prod-us-west-2-backend-health-records.s3.us-west-2.amazonaws.com',
    ].join(',')).split(',').map(host => host.trim()).filter(Boolean);
    const watch = (page: import('@playwright/test').Page) => {
      page.on('dialog', async dialog => {
        info.annotations.push({ type: 'popup', description: `Dismissed unexpected ${dialog.type()} dialog` });
        await dialog.dismiss().catch(() => {});
      });
    };
    const onPage = (page: import('@playwright/test').Page) => {
      watch(page);
      void (async () => {
        // Main test pages are not unsolicited popup windows.
        if (!(await page.opener())) return;
        await page.waitForURL(url => url.href !== 'about:blank', { timeout: 30000 });
        const url = new URL(page.url());
        const native = ['blob:', 'data:', 'chrome-extension:'].includes(url.protocol) || (url.protocol === 'chrome:' && url.hostname === 'print');
        if (!native && !allowed.some(host => host.startsWith('.') ? url.hostname.endsWith(host) : url.hostname === host)) {
          info.annotations.push({ type: 'popup', description: 'Closed popup outside the configured origin allowlist' });
          await page.close({ runBeforeUnload: false });
        }
      })().catch(() => {});
    };
    context.on('page', onPage);
    try { await use(context); }
    finally {
      context.off('page', onPage);
      for (const page of context.pages()) if (!originalPages.has(page)) await page.close({ runBeforeUnload: false }).catch(() => {});
    }
  },
  page: async ({ context }, use) => {
    const page = await context.newPage();
    await page.waitForLoadState('domcontentloaded');
    try { await use(page); }
    finally { await page.close({ runBeforeUnload: false }).catch(() => {}); }
  },
  artifacts: async ({ context, data }, use, info) => {
    const tools = createArtifactTools(context, info, data.exportTimeout);
    try { await use(tools); }
    finally { await tools.cancelPrintPreview(); }
  },
});

export { expect };
