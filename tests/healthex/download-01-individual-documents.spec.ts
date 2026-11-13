// spec: specs/healthex-test-plan.md
// seed: tests/seed.spec.ts
import { test, expect } from '../fixtures/healthex';
import { HealthExPage } from '../../pages/HealthExPage';
import { documentRecords } from './scenario-support';

test.describe('Detailed scenarios', () => {
  test('DOWNLOAD-01 — Download and open individual documents', async ({ page, data, artifacts }) => {
    const records = documentRecords(data); const wallet = new HealthExPage(page, data);
    await wallet.records(); await wallet.assertIdentity();
    for (const [index, record] of records.entries()) {
      // 1. Open a selected record/document and begin listening for download before clicking its Download action.
      await wallet.openRecord(record); const rendered = await wallet.openDocument(record);
      const pending = page.waitForEvent('download', { timeout: data.exportTimeout });
      await page.getByRole('button', { name: 'Download', exact: true }).click();
      // 2. Save privately, check completion and nonzero bytes, and identify the real format.
      const artifact = await artifacts.saveDownload(await pending, `individual-document-${index + 1}`);
      expect(artifact.bytes, 'The genuine document download is nonempty').toBeGreaterThan(0);
      // 3. Parse/open in an appropriate reader and compare full readable content with the selected viewer.
      if (artifact.format === 'html') await artifacts.validateHtml(artifact, rendered);
      else { expect(artifact.format, 'A supported real reader format is detected').toBe('pdf'); await artifacts.validatePdf(artifact, [record.documentText]); }
      // 4. Repeat for a distinct document and each available fixture format.
      await wallet.closeDetails();
    }
    await wallet.assertRecordRows();
  });
});
