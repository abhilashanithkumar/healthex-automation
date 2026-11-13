import fs from 'node:fs/promises';
import { test as base, expect } from './healthex';
import { SharingPage } from '../../pages/SharingPage';
import { ShareLinkSession } from '../support/share-link-session';

export const test = base.extend<{
  sharing: SharingPage;
  shareSession: ShareLinkSession;
  sharingFailureScreenshot: void;
}>({
  sharing: async ({ page, data }, use) => { await use(new SharingPage(page, data)); },
  shareSession: async ({ sharing }, use, info) => {
    const session = new ShareLinkSession(sharing, info);
    try { await use(session); } finally { await session.dispose(); }
  },
  sharingFailureScreenshot: [async ({ page, shareSession }, use, info) => {
    await use();
    if (info.status === 'skipped' || info.status === info.expectedStatus || page.isClosed()) return;
    // Sharing specs disable the built-in full-context recorder. Capture only this
    // test page, masking QR codes and fields that could display bearer values.
    const filename = info.outputPath('test-failed-sharing.png');
    try {
      await page.screenshot({ path: filename, timeout: 5000, mask: [page.locator('canvas, svg, input, textarea'), page.getByText(/^shlink:/)] });
      await fs.chmod(filename, 0o600);
      await info.attach('screenshot', { path: filename, contentType: 'image/png' });
    } catch { info.annotations.push({ type: 'screenshot', description: 'Masked Sharing screenshot unavailable' }); }
    void shareSession;
  }, { auto: true }],
});

export { expect };
