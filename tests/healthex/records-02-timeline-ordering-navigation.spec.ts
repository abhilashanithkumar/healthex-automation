// spec: specs/healthex-test-plan.md
// seed: tests/seed.spec.ts
import { test, expect } from '../fixtures/healthex';
import { HealthExPage, normalized } from '../../pages/HealthExPage';
import { representativeRecords } from './scenario-support';

test.describe('Detailed scenarios', () => {
  test('RECORDS-02 — Check Timeline content, ordering, loading, and navigation', async ({ page, data }) => {
    const records = representativeRecords(data);
    const wallet = new HealthExPage(page, data);
    await wallet.records(); await wallet.assertIdentity();
    // 1. Select Timeline and establish its actual sort direction and filters.
    await wallet.switchView('Timeline'); await wallet.assertRecordRows();
    for (const [filter, allowed] of [
      ['Visits', ['Specialist', 'Primary Care', 'Rehabilitation']],
      ['Diagnostic', ['Imaging', 'Lab Draw']],
      ['Immunization', ['Immunization']],
    ] as const) {
      await page.getByRole('button', { name: 'All', exact: true }).click();
      await page.getByRole('button', { name: filter, exact: true }).click();
      await expect(page.getByRole('button', { name: filter, exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(async () => {
        const types = (await wallet.rows.allTextContents()).map(value => value.split('·')[0]);
        return types.length > 0 && types.every(type => (allowed as readonly string[]).includes(type));
      }, { timeout: data.syncTimeout, message: 'Selected category contains only its own record types' }).toBe(true);
    }
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await wallet.assertRecordRows();
    // 2. Compare representative dates/types/source labels with expected records and ordering rules.
    const labels = await wallet.rowLabels();
    const dated = records.filter(record => record.dateISO).sort((left, right) => labels.indexOf(normalized(left.rowText)) - labels.indexOf(normalized(right.rowText)));
    expect(dated.length, 'Fixture supplies at least two dates to verify the displayed newest-first order').toBeGreaterThanOrEqual(2);
    for (let index = 1; index < dated.length; index++) expect(Date.parse(dated[index - 1].dateISO!) >= Date.parse(dated[index].dateISO!), 'Timeline representative dates follow newest-first order').toBe(true);
    // 3. Exercise available incremental loading/pagination with a known manifest.
    const before = await wallet.rows.count();
    await wallet.rows.last().scrollIntoViewIfNeeded(); await wallet.settle();
    expect(await wallet.rows.count(), 'Scrolling preserves the loaded record subset').toBeGreaterThanOrEqual(before);
    await wallet.assertRecordRows();
    test.info().annotations.push({ type: 'scope', description: 'Loaded rows are a subset; the test does not equate them with the total record count. Fixtures must include any additional pagination boundary for exhaustive loading coverage.' });
    // 4. Open one entry, close its overlay, then open a different entry.
    const first = await wallet.openRecord(records[0]); await wallet.closeDetails();
    const second = await wallet.openRecord(records[1]);
    expect(normalized(first) !== normalized(second), 'Different entries render distinct record details').toBe(true);
    await wallet.closeDetails();
  });
});
