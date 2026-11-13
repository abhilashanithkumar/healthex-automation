// spec: specs/healthex-test-plan.md
// seed: tests/seed.spec.ts
import { test, expect } from '../fixtures/healthex';
import { HealthExPage, normalized } from '../../pages/HealthExPage';
import { documentRecords } from './scenario-support';

test.describe('Detailed scenarios', () => {
  test('RECORDS-05 — Open distinct records and verify document rendering', async ({ page, data }) => {
    const records = documentRecords(data);
    const visit = records.find(record => record.kind === 'visit')!; const imaging = records.find(record => record.kind === 'imaging')!;
    const wallet = new HealthExPage(page, data);
    await wallet.records(); await wallet.assertIdentity();
    // 1. Open a representative visit; compare metadata with its selected entry, then open its clinical-note document.
    await wallet.openRecord(visit); const first = await wallet.openDocument(visit);
    // 2. Scroll through the readable viewer and compare its content with the private fixture.
    expect(normalized(first) === normalized(visit.documentText), 'Full visit document matches its fixture').toBe(true);
    // 3. Close document and record overlays; open a distinct imaging record and its document.
    await wallet.closeDetails(); await wallet.openRecord(imaging); const second = await wallet.openDocument(imaging);
    // 4. Verify different content, correct metadata/source, readable full content, and usable viewer/back controls. Exercise multipage/zoom controls when available.
    expect(normalized(first) !== normalized(second), 'Visit and imaging documents contain distinct readable content').toBe(true);
    expect(normalized(second) === normalized(imaging.documentText), 'Full imaging document matches its fixture').toBe(true);
    test.info().annotations.push({ type: 'not applicable', description: 'Observed individual documents are HTML fragments; PDF multipage and zoom variants require separate format fixtures.' });
    await wallet.closeDetails(); await wallet.assertRecordRows();
  });
});
