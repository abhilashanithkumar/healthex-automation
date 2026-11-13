// spec: specs/healthex-test-plan.md
// seed: tests/seed.spec.ts
import { test, expect } from '../fixtures/healthex';
import { HealthExPage } from '../../pages/HealthExPage';

test.describe('Detailed scenarios', () => {
  test('WALLET-01 — Verify titles and active wallet across views', async ({ page, data }) => {
    const wallet = new HealthExPage(page, data);
    // 1. Open Records; check HealthEx | Patient Records and visible Your HealthEx / Wallet heading.
    await wallet.records();
    await wallet.assertWallet();
    await wallet.assertIdentity();
    // 2. Open Sharing; check HealthEx | Patient Sharing and Share your Records.
    await wallet.sharing();
    await expect(page).toHaveTitle('HealthEx | Patient Sharing');
    // 3. Return to Records and reload. Confirm the expected title and the same authorized wallet.
    await page.getByRole('tab', { name: 'Records', exact: true }).click();
    await page.reload();
    await expect(page).toHaveTitle('HealthEx | Patient Records');
    await wallet.assertWallet();
    await wallet.assertIdentity();
  });
});
