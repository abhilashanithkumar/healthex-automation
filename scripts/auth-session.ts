import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';
import { loadEnvironment, loadTestData } from '../tests/support/test-data';
import { ensureConfiguredChrome } from './browser-lifecycle';

async function main(): Promise<void> {
  loadEnvironment();
  const data = loadTestData();
  const endpoint = new URL(process.env.HEALTHEX_CDP_ENDPOINT ?? 'http://127.0.0.1:19333');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)) throw new Error('Authentication capture requires a local Chrome endpoint');
  await ensureConfiguredChrome();
  if (process.argv.includes('--open')) {
    console.log('Regular Chrome is ready. Complete Google sign-in with the configured account if needed, then run npm run auth:save.');
    return;
  }
  if (!data.googleEmail || !data.accountInitials) throw new Error('Configure the Google email and account initials in .env.local');
  const browser = await chromium.connectOverCDP(endpoint.toString(), { timeout: 15000 });
  const context = browser.contexts()[0];
  const page = context.pages().find(tab => tab.url().startsWith(data.baseURL)) ?? await context.newPage();
  await page.goto(`${data.baseURL}/#/patient-records`);
  await expect(page.getByRole('heading', { name: 'Your HealthEx', exact: true })).toBeVisible({ timeout: 30000 });
  await page.getByText(data.accountInitials, { exact: true }).first().click();
  await page.getByRole('button', { name: 'Login Methods', exact: true }).click();
  await expect.poll(async () => {
    const text = await page.getByRole('dialog').last().innerText();
    return text.includes('Google') && text.split(/\s+/).includes(data.googleEmail);
  }, { message: 'Saved authentication must belong to the configured Google wallet' }).toBe(true);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  const session = await page.evaluate(() => Object.fromEntries(Object.entries(window.sessionStorage)));
  const state = await context.storageState({ indexedDB: true });
  const appHost = new URL(data.baseURL).hostname;
  const rootHost = appHost.split('.').slice(-2).join('.');
  state.cookies = state.cookies.filter(cookie => { const domain = cookie.domain.replace(/^\./, ''); return domain === rootHost || domain.endsWith('.' + rootHost); });
  state.origins = state.origins.filter(origin => { const host = new URL(origin.origin).hostname; return host === rootHost || host.endsWith('.' + rootHost); });
  const filename = path.resolve(process.env.HEALTHEX_AUTH_STATE ?? 'playwright/.auth/healthex.json');
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  await fs.writeFile(filename, JSON.stringify(state), { mode: 0o600 });
  await fs.chmod(filename, 0o600);
  const sessionFile = process.env.HEALTHEX_SESSION_STORAGE ?? filename.replace(/\.json$/, '.session.json');
  await fs.writeFile(sessionFile, JSON.stringify({ origin: new URL(data.baseURL).origin, entries: session }), { mode: 0o600 });
  await fs.chmod(sessionFile, 0o600);
  console.log('Verified HealthEx authentication and session storage saved privately. Google and Kaiser cookies were excluded.');
  // Exit disconnects the attached client and preserves the owner's regular Chrome.
}

main().then(() => process.exit(0)).catch(() => { console.error('Authentication setup failed. Confirm local Chrome is open, signed in to the configured wallet, and retry.'); process.exit(1); });
