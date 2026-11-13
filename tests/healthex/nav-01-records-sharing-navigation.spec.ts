// spec: specs/healthex-test-plan.md
// seed: tests/seed.spec.ts
import { test, expect } from '../fixtures/healthex';
import { HealthExPage } from '../../pages/HealthExPage';
import { representativeRecords } from './scenario-support';

test.describe('Detailed scenarios', () => {
  test('NAV-01 — Check Records and Sharing content across navigation', async ({ page, data }) => {
    representativeRecords(data); const wallet = new HealthExPage(page, data);
    // 1. Note the wallet identity in Records; open Sharing and verify its correct title/heading.
    await wallet.records(); await wallet.assertIdentity(); await wallet.assertRecordRows(); await wallet.sharing();
    // 2. Open Connections and wait for settled content; inspect existing authorized entries or No Connections.
    await page.getByRole('button', { name: 'Connections', exact: true }).click(); await wallet.settle();
    await expect(page.getByText('No Connections', { exact: true })).toBeVisible();
    // 3. Open Shared Links and wait for Loading... to resolve; inspect entries or No links yet and Create share link.
    await page.getByRole('button', { name: 'Shared Links', exact: true }).click(); await wallet.settle();
    const emptyLinks = page.getByText('No links yet', { exact: true });
    if (await emptyLinks.isVisible()) {
      await expect(emptyLinks).toBeVisible();
    } else {
      // Deactivated links remain as history; a prepared wallet need not be empty.
      await expect(page.getByText(/^(?:Active|Inactive) links\s*\(\s*[1-9]\d*\s*\)$/).first()).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Create share link', exact: true })).toBeVisible();
    // 4. Return to Records and confirm title, records, and active identity. Exercise Back/Forward/reload with an approved fixture.
    await page.getByRole('tab', { name: 'Records', exact: true }).click(); await wallet.switchView('Timeline'); await wallet.assertRecordRows();
    const recordsURL = page.url(); await wallet.sharing(); const sharingURL = page.url();
    await page.goBack(); await expect(page).toHaveURL(recordsURL); await expect(page).toHaveTitle('HealthEx | Patient Records');
    await page.goForward(); await expect(page).toHaveURL(sharingURL); await expect(page).toHaveTitle('HealthEx | Patient Sharing');
    await wallet.records(); await page.reload(); await wallet.assertRecordRows(); await wallet.assertIdentity();
  });
});
