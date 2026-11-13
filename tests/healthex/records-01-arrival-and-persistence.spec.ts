// spec: specs/healthex-test-plan.md
// seed: tests/seed.spec.ts
import { test } from '../fixtures/healthex';
import { HealthExPage } from '../../pages/HealthExPage';
import { representativeRecords } from './scenario-support';

test.describe('Detailed scenarios', () => {
  test('RECORDS-01 — Verify records arrive and persist', async ({ page, data }) => {
    const records = representativeRecords(data);
    const wallet = new HealthExPage(page, data);
    await wallet.records(); await wallet.assertIdentity();
    // 1. Observe import/sync status within SYNC_TIMEOUT.
    await wallet.settle(data.syncTimeout);
    // 2. Open Timeline and verify actual entries associated with the selected Kaiser source.
    await wallet.switchView('Timeline'); await wallet.assertRecordRows();
    // 3. Compare representative expected identifiers/dates/types with the private fixture and open their details.
    for (const record of records) { await wallet.openRecord(record); await wallet.closeDetails(); }
    // 4. Revisit Sources, then reload Records and verify persistence.
    await wallet.switchView('Sources'); await wallet.assertConnectedSource();
    await wallet.switchView('Timeline'); await page.reload(); await wallet.assertRecordRows(); await wallet.assertIdentity();
  });
});
