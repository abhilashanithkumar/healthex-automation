// spec: specs/healthex-test-plan.md
// seed: tests/seed.spec.ts
import { test, expect } from '../fixtures/healthex';
import { HealthExPage } from '../../pages/HealthExPage';
import { exportMarkers } from './scenario-support';

test.describe('Detailed scenarios', () => {
  test('PRINT-01 — Print the entire record using the direct Records action', async ({ page, context, data, artifacts }) => {
    test.skip(process.env.HEALTHEX_HEADLESS === 'true', 'Native Chrome print-preview validation requires headed Chrome.');
    const markers = exportMarkers(data); const wallet = new HealthExPage(page, data);
    await wallet.records(); await wallet.assertIdentity();
    let scopeFailure: unknown;
    // 1. Open Records → Timeline → More options → Print Records.
    await wallet.printRecords();
    try {
      // 2. Verify Chrome print preview opens and inspect its generated pages/content.
      const preview = await artifacts.inspectPrintPreview(context);
      expect(preview.pages, 'Native print preview has generated pages').toBeGreaterThan(0);
      // 3. Compare complete expected clinical document content and scope with the full-record fixture/export; do not infer completeness from opening a print dialog.
      try { await artifacts.validatePdf(preview.artifact, markers); }
      catch (error) {
        // Preserve PDF parse/render and infrastructure errors as unexpected failures.
        if (!data.capabilities.knownPrintScopeBug || !(error instanceof Error) || !error.message.includes('PDF must include every expected private content marker')) throw error;
        scopeFailure = error;
      }
    } finally {
      // 4. Inspect layout/readability/page breaks and cancel preview. Confirm the wallet remains usable.
      await artifacts.cancelPrintPreview(); await wallet.records(); await wallet.assertRecordRows();
    }
    // Apply the expected-failure status only after preview capture and safe-return checks succeed.
    if (data.capabilities.knownPrintScopeBug) test.fail(true, 'P-01: direct Print Records omitted complete clinical document bodies. A fixed implementation must produce an unexpected pass until this flag is removed.');
    if (scopeFailure) throw scopeFailure;
  });
});
