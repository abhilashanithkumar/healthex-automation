// spec: specs/healthex-test-plan.md
// seed: tests/seed.spec.ts
import { test, expect } from '../fixtures/sharing';
import { OPTIONAL_SHARE_TYPES } from '../../pages/SharingPage';

test.use({ screenshot: 'off' });
test.describe('Detailed scenarios', () => {
  test('SHARING-01 — Inspect defaults, select preferences, and cancel without creating a link', async ({ sharing, shareSession }) => {
    // 1. Verify the configured Google identity. Open Sharing → Shared Links and wait for settled content.
    await shareSession.start();
    // 2. Record the initial link identifiers/counts privately. Open Create share link.
    const baseline = await sharing.list(); const name = shareSession.name('SHARING-01');
    await sharing.openForm();
    // 3. Verify the dated private name and default one-time/all-records preferences.
    await sharing.assertDefaults();
    // 4. Select Selected data types; verify nine optional choices and mandatory demographics/contact information.
    await sharing.selectedTypes.click();
    await expect(sharing.page.getByRole('checkbox')).toHaveCount(OPTIONAL_SHARE_TYPES.length);
    for (const type of OPTIONAL_SHARE_TYPES) await expect(sharing.page.getByRole('checkbox', { name: new RegExp(`^${type} `) })).toBeVisible();
    await expect(sharing.page.getByText('Demographics and contact information', { exact: true })).toBeVisible();
    // 5. Clear all types, select Vitals alone, and set a unique QA name for one-time use.
    await sharing.page.getByRole('button', { name: 'Clear', exact: true }).click();
    expect(await sharing.checkedTypeCount()).toBe(0);
    await expect(sharing.page.getByRole('button', { name: 'Select all', exact: true })).toBeVisible();
    await sharing.page.getByRole('checkbox', { name: 'Vitals Blood pressure, heart rate, and more', exact: true }).check();
    await sharing.name.fill(name);
    expect(await sharing.checkedTypeCount()).toBe(1); await expect(sharing.oneTime.getByRole('radio')).toBeChecked();
    // 6. Cancel without creating a resource; reopen and verify all defaults were restored, then cancel again.
    await sharing.cancel.click();
    let current = await sharing.list();
    expect(current.length === baseline.length && current.every(link => baseline.some(old => old.id === link.id && old.status === link.status)), 'Cancellation preserves the exact link baseline').toBe(true);
    expect(current.some(link => link.label === name), 'Canceled name creates no resource').toBe(false);
    await sharing.openForm(); await sharing.assertDefaults(); await sharing.cancel.click();
    current = await sharing.list();
    expect(current.length === baseline.length, 'Reopening and canceling still creates no resource').toBe(true);
    await shareSession.assertBaselinePreserved();
  });
});
