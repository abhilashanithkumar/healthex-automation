// spec: specs/healthex-test-plan.md
// seed: tests/seed.spec.ts
import { test, expect } from '../fixtures/healthex';
import { HealthExPage } from '../../pages/HealthExPage';
import { exportMarkers } from './scenario-support';

test.describe('Detailed scenarios', () => {
  test('PRINT-02 — Verify complete printing from the exported PDF', async ({ page, context, data, artifacts }) => {
    test.skip(process.env.HEALTHEX_HEADLESS === 'true', 'Native Chrome print-preview validation requires headed Chrome.');
    const markers = exportMarkers(data); const wallet = new HealthExPage(page, data);
    await wallet.records(); await wallet.assertIdentity(); await wallet.closeDetails();
    const existingPages = new Set(context.pages());
    const downloaded = await artifacts.downloadFullPdf(page); const exported = await artifacts.validatePdf(downloaded, markers);
    const pdf = context.pages().find(tab => !existingPages.has(tab) && tab.frames().some(frame => frame.url().startsWith('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/')));
    expect(Boolean(pdf), 'The full-record Chrome PDF tab remains open').toBe(true);
    // 1. In the full PDF tab, click Chrome PDF toolbar Print.
    const viewer = pdf!.frames().find(frame => frame.url().startsWith('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/'))!;
    await viewer.getByRole('button', { name: 'Print', exact: true }).evaluate((element: HTMLElement) => { setTimeout(() => element.click(), 0); });
    try {
      // 2. Wait for preview readiness, select/check Save as PDF as the inspection destination, and verify all pages are included.
      const preview = await artifacts.inspectPrintPreview(context); expect(preview.pages).toBe(exported.pages);
      // 3. Inspect the generated preview PDF with a format-aware reader and compare full document text/representative scope with the downloaded full PDF.
      const printed = await artifacts.validatePdf(preview.artifact, markers);
      expect(printed.pages).toBe(exported.pages); expect(printed.renderedPages).toBe(printed.pages); expect(printed.matchedMarkers).toBe(printed.expectedMarkers);
    } finally {
      // 4. Cancel without submitting to a physical printer; return to the wallet.
      await artifacts.cancelPrintPreview(); await page.bringToFront(); await wallet.assertWallet(); await wallet.assertRecordRows();
    }
  });
});
