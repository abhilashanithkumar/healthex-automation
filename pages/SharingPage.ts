import { expect, type Frame, type Page, type Request, type Response } from '@playwright/test';
import { HealthExPage } from './HealthExPage';
import type { TestData } from '../tests/support/test-data';

export const OPTIONAL_SHARE_TYPES = ['Conditions', 'Medications', 'Labs', 'Vitals', 'Clinical visits', 'Allergies', 'Procedures', 'Immunizations', 'Clinical notes'] as const;
export const VITALS_SCOPES = ['DEMOGRAPHICS', 'CONTACT_INFO', 'CLINICAL_VITALS'];
export const collectionPath = /\/patients\/[^/]+\/shl\/?$/;

export interface ShareLink {
  id: string;
  label: string;
  patientId: string;
  status: string;
  isOneTimeUse: boolean;
  consentDataResourceScopes: string[];
  fullRecordWithoutRestrictedData: boolean;
  createdAt: string;
  expiresAt: string;
  link: string;
}

export function shareLinkFrom(value: unknown): ShareLink {
  const link = value as ShareLink;
  if (!link || typeof link.id !== 'string' || typeof link.label !== 'string'
    || typeof link.status !== 'string' || !Array.isArray(link.consentDataResourceScopes)) {
    throw new Error('Share-link response has an invalid shape; private contents suppressed');
  }
  return link;
}

export class SharingPage {
  readonly wallet: HealthExPage;
  constructor(readonly page: Page, readonly data: TestData) { this.wallet = new HealthExPage(page, data); }
  get name() { return this.page.getByRole('textbox', { name: 'Enter a name for this link', exact: true }); }
  get create() { return this.page.getByRole('button', { name: 'Create share link', exact: true }); }
  get cancel() { return this.page.getByRole('button', { name: 'Cancel', exact: true }); }
  get deactivate() { return this.page.getByRole('button', { name: 'Deactivate link', exact: true }); }
  get oneTime() { return this.page.getByRole('button', { name: 'One-time use Best for sharing at a single appointment', exact: true }); }
  get allRecords() { return this.page.getByRole('button', { name: 'All health records Includes everything available on file', exact: true }); }
  get selectedTypes() { return this.page.getByRole('button', { name: 'Selected data types Choose what to include', exact: true }); }

  async open(): Promise<void> {
    await this.wallet.records();
    await this.wallet.assertIdentity();
    await this.wallet.sharing();
    await this.page.getByRole('button', { name: 'Shared Links', exact: true }).click();
    await this.wallet.settle();
    await expect(this.create).toBeVisible();
  }

  async list(): Promise<ShareLink[]> {
    if (!await this.page.getByRole('tab', { name: 'Sharing', exact: true }).isVisible()) await this.open();
    if (await this.name.isVisible()) await this.cancel.click();
    if (await this.page.getByRole('button', { name: 'Back to sharing', exact: true }).isVisible()) {
      await this.page.getByRole('button', { name: 'Back to sharing', exact: true }).click();
    }
    await expect(this.page).toHaveTitle('HealthEx | Patient Sharing');
    await expect(this.name).toBeHidden();
    const values = await this.reloadJSON(item => item.method() === 'GET' && collectionPath.test(new URL(item.url()).pathname));
    if (!Array.isArray(values)) throw new Error('Owner share-link list must be an array; contents suppressed');
    return values.map(shareLinkFrom);
  }

  async openForm(): Promise<void> { await this.create.click(); await expect(this.name).toBeVisible(); }

  async assertDefaults(): Promise<void> {
    expect((await this.name.inputValue()).startsWith('Created on '), 'Default link name is dated').toBe(true);
    await expect(this.page.getByText('This name is only visible to you', { exact: true })).toBeVisible();
    await expect(this.oneTime.getByRole('radio')).toBeChecked();
    await expect(this.allRecords.getByRole('radio')).toBeChecked();
    await expect(this.page.getByText(/This link provides access to your raw health records/)).toBeVisible();
  }

  async chooseVitals(name: string): Promise<void> {
    await this.name.fill(name);
    await this.oneTime.click();
    await this.selectedTypes.click();
    await this.page.getByRole('button', { name: 'Clear', exact: true }).click();
    await this.page.getByRole('checkbox', { name: 'Vitals Blood pressure, heart rate, and more', exact: true }).check();
    expect(await this.checkedTypeCount(), 'Only the requested optional type is selected').toBe(1);
    await expect(this.page.getByText('Demographics and contact information', { exact: true })).toBeVisible();
  }

  async checkedTypeCount(): Promise<number> {
    return this.page.getByRole('checkbox').evaluateAll(elements => elements.filter(element => (element as HTMLInputElement).checked || element.getAttribute('aria-checked') === 'true').length);
  }

  async submit(): Promise<Response> {
    const response = this.page.waitForResponse(item => item.request().method() === 'POST' && collectionPath.test(new URL(item.url()).pathname));
    void response.catch(() => {});
    await this.create.click();
    return response;
  }

  detailsURL(id: string): string { return `${this.data.baseURL}/#/${encodeURIComponent(id)}/patient-smart-link-details`; }

  async details(id: string): Promise<void> { await this.page.goto(this.detailsURL(id)); await this.wallet.settle(); }

  async reloadDetails(id: string): Promise<ShareLink> {
    return shareLinkFrom(await this.reloadJSON(item => item.method() === 'GET'
      && new URL(item.url()).pathname.endsWith(`/shl/${encodeURIComponent(id)}`)));
  }

  private async reloadJSON(matches: (request: Request) => boolean): Promise<unknown> {
    // A previous route can still have an in-flight GET. Only accept requests
    // started by the newly committed document, and consume its body immediately.
    let committed = false;
    const fresh = new Set<Request>();
    const navigated = (frame: Frame) => { if (frame === this.page.mainFrame()) committed = true; };
    const requested = (request: Request) => { if (committed && matches(request)) fresh.add(request); };
    this.page.on('framenavigated', navigated); this.page.on('request', requested);
    const result = this.page.waitForResponse(response => fresh.has(response.request())).then(async response => {
      if (!response.ok()) throw new Error('Unable to reload owner share-link metadata');
      return response.json();
    });
    void result.catch(() => {});
    try { await this.page.reload(); const value = await result; await this.wallet.settle(); return value; }
    finally { this.page.off('framenavigated', navigated); this.page.off('request', requested); }
  }

  async assertActive(link: ShareLink, name: string): Promise<void> {
    expect(link.label === name, 'Created link retains its submitted name').toBe(true);
    expect(link.status === 'ACTIVE', 'New owner link is active').toBe(true);
    expect(link.isOneTimeUse, 'Owner link uses the selected one-time lifetime').toBe(true);
    expect(link.fullRecordWithoutRestrictedData === false, 'Selected-type link does not expand to all records').toBe(true);
    expect([...link.consentDataResourceScopes].sort().join() === [...VITALS_SCOPES].sort().join(), 'Owner link has exactly the selected scopes').toBe(true);
    await expect(this.deactivate).toBeVisible();
    await expect(this.page.getByText(name, { exact: true })).toBeVisible();
    for (const label of ['Link type', 'Created on', "What's included"]) await expect(this.page.getByText(label, { exact: true })).toBeVisible();
  }

  async deactivateOwned(link: ShareLink): Promise<ShareLink> {
    await this.details(link.id);
    const current = await this.reloadDetails(link.id);
    expect(current.id === link.id && current.label === link.label, 'Deactivation targets this exact owned link').toBe(true);
    if (!await this.isInactive(current)) {
      const response = this.page.waitForResponse(item => item.request().method() === 'POST'
        && new URL(item.url()).pathname.endsWith(`/shl/${encodeURIComponent(link.id)}/revoke`));
      void response.catch(() => {});
      await this.deactivate.click();
      if (!(await response).ok()) throw new Error('Owned share-link deactivation failed');
    }
    await expect(this.page.getByText('This link is inactive', { exact: true })).toBeVisible();
    const final = await this.reloadDetails(link.id);
    expect(await this.isInactive(final), 'Owned share link remains inactive after reload').toBe(true);
    await expect(this.deactivate).toHaveCount(0);
    return final;
  }

  async assertInactiveInList(link: ShareLink): Promise<void> {
    const links = await this.list();
    const current = links.find(item => item.id === link.id);
    expect(Boolean(current && await this.isInactive(current)), 'Owned link is in inactive history').toBe(true);
    const label = this.page.getByText(link.label, { exact: true });
    if (!await label.isVisible()) await this.page.getByText(/^Inactive links\s*\(\d+\)$/, { exact: true }).click();
    await expect(label).toBeVisible();
  }

  async isInactive(link: ShareLink): Promise<boolean> {
    return link.status !== 'ACTIVE' || await this.page.evaluate(expires => Date.parse(expires) < Date.now(), link.expiresAt);
  }

}
