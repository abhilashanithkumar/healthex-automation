// spec: specs/healthex-test-plan.md
// seed: tests/seed.spec.ts
import { test, expect } from '../fixtures/healthex';
import { HealthExPage } from '../../pages/HealthExPage';
import { exportMarkers } from './scenario-support';

test.describe('Detailed scenarios', () => {
  test('DOWNLOAD-02 — Download the entire record through the PDF tab', async ({ page, data, artifacts }) => {
    const markers = exportMarkers(data); const wallet = new HealthExPage(page, data);
    await wallet.records(); await wallet.assertIdentity();
    // 1. Close all detail overlays and ensure the global Records heading is visible.
    await wallet.closeDetails();
    // 2. Start listening for a new tab/popup, then More options → Download as PDF.
    // 3. Wait for the new PDF tab and its Chrome PDF viewer to load. Opening this tab is not yet a saved download.
    // 4. In the new tab, click the PDF toolbar's exact Download control. Do not click Save to Google Drive or Summarize.
    // 5. Capture the actual download from the PDF tab/viewer; use Chrome download events. Save privately and verify completion and genuine format.
    const artifact = await artifacts.downloadFullPdf(page);
    expect(artifact.format).toBe('pdf'); expect(artifact.bytes).toBeGreaterThan(0);
    // 6. Compare the exported scope with the fixture manifest and representative records/documents.
    const checked = await artifacts.validatePdf(artifact, markers);
    expect(checked.pages).toBeGreaterThan(0); expect(checked.renderedPages).toBe(checked.pages); expect(checked.textPages).toBe(checked.pages);
    expect(checked.matchedMarkers).toBe(checked.expectedMarkers);
    await wallet.assertWallet();
  });
});
