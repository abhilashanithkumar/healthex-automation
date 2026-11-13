// spec: specs/healthex-test-plan.md
// seed: tests/seed.spec.ts
import { test, expect } from '../fixtures/sharing';

test.use({ screenshot: 'off' });
test.describe('Detailed scenarios', () => {
  test('SHARING-02 — Create a one-time scoped link, verify persistence, and deactivate it', async ({ sharing, shareSession }) => {
    // 1. Confirm Google wallet identity and open Sharing → Shared Links.
    await shareSession.start();
    // 2–4. Generate a unique name, select one-time Vitals scope, record ownership before submission, and capture the returned identifier privately.
    const link = await shareSession.create('SHARING-02');
    // 5. Verify active owner details and exact submitted preferences, then reload to verify persistence.
    await sharing.assertActive(link, link.label);
    const persisted = await sharing.reloadDetails(link.id); await sharing.assertActive(persisted, link.label);
    // 6. Explicitly deactivate without consuming the active URL; verify inactive details/history and preserve baseline links.
    const inactive = await sharing.deactivateOwned(persisted);
    await expect(sharing.page.getByText('Deactivated by you', { exact: true })).toBeVisible();
    await sharing.assertInactiveInList(inactive); await shareSession.assertBaselinePreserved();
    // The shareSession fixture repeats owned-resource recovery/deactivation in finally even if an assertion above fails.
  });
});
