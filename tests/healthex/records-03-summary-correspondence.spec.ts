// spec: specs/healthex-test-plan.md
// seed: tests/seed.spec.ts
import { test, expect } from '../fixtures/healthex';
import { HealthExPage } from '../../pages/HealthExPage';

test.describe('Detailed scenarios', () => {
  test('RECORDS-03 — Check populated Summary against underlying data', async ({ page, data, artifacts }) => {
    const wallet = new HealthExPage(page, data);
    await wallet.records(); await wallet.assertIdentity();
    // 1. Select Summary and wait for loading to resolve.
    await wallet.switchView('Summary'); await wallet.settle();
    // 2. Identify actual sections and compare representative facts, dates, and units to source records/export data.
    expect(data.fixture.summaryMarkers.length, 'Private fixture contains representative Summary facts with dates and units').toBeGreaterThan(0);
    await wallet.assertPrivateMarkers(data.fixture.summaryMarkers);
    const text = (await page.locator('body').innerText()).toLowerCase();
    expect(['medications', 'conditions', 'vitals'].every(section => text.includes(section)), 'Observed populated Summary categories are available').toBe(true);
    const exported = await artifacts.downloadFullPdf(page);
    await artifacts.validatePdf(exported, data.fixture.summaryMarkers);
    // 3. Test any available drill-down links and verify they resolve to the corresponding record.
    await wallet.records('Summary');
    const drilldowns = page.locator('a[href*="patient-records"]');
    if (await drilldowns.count()) {
      for (const link of await drilldowns.all()) expect(Boolean(await link.getAttribute('href')), 'Available Summary drill-down has a record destination').toBe(true);
    } else test.info().annotations.push({ type: 'not applicable', description: 'No Summary record drill-down link was exposed in this fixture.' });
    // 4. Check missing-data sections show clear absence rather than stale or invented content.
    expect(/\bundefined\b|\bNaN\b/.test(await page.locator('body').innerText()), 'Summary does not render missing data as invalid values').toBe(false);
    test.info().annotations.push({ type: 'scope', description: 'Absent-category behavior needs a separately provisioned missing-category fixture; populated representative facts are reconciled with the export.' });
  });
});
