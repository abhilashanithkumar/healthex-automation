// spec: specs/healthex-test-plan.md
// seed: tests/seed.spec.ts
import { test, expect } from '../fixtures/healthex';

test.use({ authenticated: false, storageState: { cookies: [], origins: [] } });

test.describe('Detailed scenarios', () => {
  test('AUTH-01 — Reach the genuine HealthEx login', async ({ context, data }) => {
    const browser = context.browser();
    expect(browser, 'Installed Chrome is available').not.toBeNull();
    const signedOut = await browser!.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await signedOut.newPage();
    try {
      // 1. Open https://healthex.io and follow Sign in.
      await page.goto(data.publicURL);
      await expect(page).toHaveTitle('HealthEx | Get All Your Medical Records in One Place');
      // 2. Confirm the public redirect to www.healthex.io, then the application login at app.healthex.io/#/login-patients.
      await expect(page).toHaveURL(url => url.hostname === 'www.healthex.io');
      await page.getByRole('link', { name: 'Sign in', exact: true }).first().click();
      await expect(page).toHaveURL(url => url.hostname === new URL(data.baseURL).hostname && url.hash === '#/login-patients');
      await expect(page).toHaveTitle('HealthEx');
      // 3. Check Welcome to HealthEx and Continue with Google.
      await expect(page.getByText('Welcome to HealthEx', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Continue with Google', exact: true })).toBeEnabled();
    } finally { await signedOut.close(); }
  });
});
