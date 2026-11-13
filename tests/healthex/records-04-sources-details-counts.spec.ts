// spec: specs/healthex-test-plan.md
// seed: tests/seed.spec.ts
import { test, expect } from '../fixtures/healthex';
import { HealthExPage } from '../../pages/HealthExPage';
import { representativeRecords } from './scenario-support';

test.describe('Detailed scenarios', () => {
  test('RECORDS-04 — Check Sources, details, counts, and status', async ({ page, data }) => {
    representativeRecords(data);
    const wallet = new HealthExPage(page, data);
    await wallet.records(); await wallet.assertIdentity();
    // 1. Select Sources and verify the Northern California Kaiser card appears once.
    await wallet.switchView('Sources'); await wallet.assertConnectedSource();
    const sourceText = await page.locator('body').innerText();
    // 2. Check Connected status, last-refresh display, and source details.
    expect(/refresh/i.test(sourceText), 'Source displays refresh information').toBe(true);
    await wallet.openSource();
    const details = await page.getByRole('dialog').innerText();
    expect(details.includes(data.kaiserProvider), 'Source details preserve the requested region').toBe(true);
    expect(/refresh/i.test(details), 'Source details expose refresh metadata or controls').toBe(true);
    // 3. Compare counts only when their scopes are equivalent; routine + specialist visits equal total visits.
    const count = (text: string, label: string) => {
      const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
      const index = lines.findIndex(line => line.toLowerCase() === label.toLowerCase());
      // Detail cards render value → VISITS → Routine/Specialist Visits; source cards render value → Visits.
      const previous = lines[index - 1];
      const candidate = previous?.toLowerCase() === 'visits' ? lines[index - 2] : previous;
      return index >= 0 && /^\d[\d,]*$/.test(candidate ?? '') ? Number(candidate.replace(/,/g, '')) : NaN;
    };
    const routine = count(details, 'Routine Visits'); const specialist = count(details, 'Specialist Visits'); const total = count(sourceText, 'Visits');
    expect([routine, specialist, total].every(Number.isFinite), 'Equivalent visit breakdown and aggregate counts are readable').toBe(true);
    expect(routine + specialist, 'Equivalent visit scopes have coherent totals').toBe(total);
    // 4. Navigate back to Timeline/Summary and verify usable corresponding records.
    await wallet.closeDetails(); await wallet.assertRecordRows();
    await wallet.switchView('Summary'); await wallet.assertPrivateMarkers(data.fixture.summaryMarkers);
  });
});
