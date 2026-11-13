import { expect, type BrowserContext, type Frame, type Locator, type Page } from '@playwright/test';
import type { TestData, RecordFixture } from '../tests/support/test-data';

export const normalized = (value: string) => value.replace(/\s+/g, ' ').trim();

/** Locators are based on the regular-Chrome exploration recorded in the plan. */
export class HealthExPage {
  constructor(readonly page: Page, readonly data: TestData) {}

  get context(): BrowserContext { return this.page.context(); }
  get rows(): Locator { return this.page.getByRole('button').filter({ hasText: /·/ }); }
  get sourceCards(): Locator { return this.page.getByRole('button', { name: 'View source details', exact: true }); }
  get providerSearch(): Locator { return this.page.getByRole('textbox', { name: 'Clinic, hospital or health plan', exact: true }); }
  get consentCheckbox(): Locator { return this.page.getByRole('checkbox', { name: 'I allow HealthEx ongoing access to my records', exact: true }); }
  get consentName(): Locator { return this.page.getByRole('textbox', { name: 'Enter your name', exact: true }); }
  get consentSubmit(): Locator { return this.page.getByRole('button', { name: 'Consent & confirm access', exact: true }); }

  async rowLabels(): Promise<string[]> { return Promise.all((await this.rows.all()).map(async row => normalized(await row.innerText()))); }

  async settle(timeout = this.data.syncTimeout): Promise<void> {
    await expect.poll(async () => this.page.getByRole('progressbar').evaluateAll(elements => elements.filter(element => element.getClientRects().length > 0).length), { timeout, message: 'Loading indicators resolve' }).toBe(0);
    await this.page.getByText('Loading...', { exact: true }).first().waitFor({ state: 'hidden', timeout });
  }

  async records(view: 'Timeline' | 'Summary' | 'Sources' = 'Timeline'): Promise<void> {
    await this.page.goto(`${this.data.baseURL}/#/patient-records/${view.toLowerCase()}`);
    await expect(this.page.getByRole('tab', { name: 'Records', exact: true })).toBeVisible();
    await expect(this.page).toHaveTitle('HealthEx | Patient Records');
    await this.page.getByRole('button', { name: view, exact: true }).click();
    await this.settle();
  }

  async switchView(view: 'Timeline' | 'Summary' | 'Sources'): Promise<void> {
    await this.page.getByRole('button', { name: view, exact: true }).click();
    await this.settle();
  }

  async sharing(): Promise<void> {
    await this.page.getByRole('tab', { name: 'Sharing', exact: true }).click();
    await expect(this.page).toHaveTitle('HealthEx | Patient Sharing');
    await expect(this.page.getByRole('heading', { name: 'Share your Records', exact: true })).toBeVisible();
    await this.settle();
  }

  async assertIdentity(): Promise<void> {
    // Initials are a visible account trigger in the observed UI; no identity is hardcoded.
    const trigger = this.data.accountInitials
      ? this.page.getByText(this.data.accountInitials, { exact: true })
      : this.page.getByText(/^[A-Z]{2}$/, { exact: true });
    await trigger.first().click();
    await this.page.getByRole('button', { name: 'Login Methods', exact: true }).click();
    await this.settle();
    const dialog = this.page.getByRole('dialog').last();
    const text = await dialog.innerText();
    expect(text.includes('Google'), 'Google is a listed login method').toBe(true);
    expect(text.split(/\s+/).includes(this.data.googleEmail), 'Google method matches the configured wallet identity').toBe(true);
    await this.page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(this.page.getByRole('button', { name: 'Login Methods', exact: true })).toBeVisible();
    await this.page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(this.page.getByRole('dialog')).toHaveCount(0);
    await expect(this.page.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);
    await expect(this.page.getByRole('tab', { name: 'Records', exact: true })).toBeVisible();
  }

  async assertWallet(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Your HealthEx', exact: true })).toBeVisible();
    await expect(this.page.getByRole('tab', { name: 'Records', exact: true })).toBeVisible();
    const heading = await this.page.getByRole('heading').allTextContents();
    expect(heading.some(value => /\b(?:undefined|null)\b/.test(value)), 'Wallet headings contain valid values').toBe(false);
  }

  async assertEmpty(): Promise<void> {
    await expect(this.page.getByText("Looks like you haven't synced any records yet.", { exact: true })).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Find my Records', exact: true })).toBeVisible();
    await expect(this.rows).toHaveCount(0);
  }

  async openDiscovery(): Promise<void> {
    await this.page.getByRole('button', { name: 'Find my Records', exact: true }).click();
    await expect(this.page.getByText('How would you like to find your records?', { exact: true })).toBeVisible();
    await this.page.getByRole('button', { name: "Search for my providers You'll need your patient portal logins.", exact: true }).click();
    await this.settle();
  }

  async assertConsent(): Promise<void> {
    await expect(this.page.getByText('Confirm access to your records', { exact: true })).toBeVisible();
    await expect(this.consentCheckbox).toBeAttached();
    await expect(this.consentName).toBeVisible();
  }

  async fillApprovedConsent(): Promise<void> {
    expect(this.data.capabilities.healthExConsent, 'Explicit ongoing-access and electronic-name approval is required').toBe(true);
    expect(Boolean(this.data.consentName), 'Approved consent name is configured privately').toBe(true);
    const text = await this.page.locator('body').innerText();
    expect(text.includes(this.data.consentName), 'Approved name is the name displayed on the consent screen').toBe(true);
    if (!(await this.consentCheckbox.isChecked())) await this.page.getByText('I allow HealthEx ongoing access to my records', { exact: true }).click();
    await expect(this.consentCheckbox).toBeChecked();
    await this.consentName.fill(this.data.consentName);
    await expect(this.consentSubmit).toBeEnabled();
  }

  async submitConsent(): Promise<void> {
    await this.fillApprovedConsent();
    await this.consentSubmit.click();
    await expect(this.providerSearch).toBeVisible();
    await this.settle();
  }

  async reachProviderSearch(): Promise<void> {
    await this.openDiscovery();
    if (await this.consentName.isVisible()) await this.submitConsent();
    await expect(this.providerSearch).toBeVisible();
  }

  async searchProvider(query = this.data.kaiserProvider): Promise<void> {
    await this.providerSearch.fill(query);
    await this.settle();
  }

  async exactProvider(): Promise<Locator> {
    const provider = this.page.getByText(this.data.kaiserProvider, { exact: true });
    await expect(provider).toHaveCount(1);
    await expect(provider).toBeVisible();
    return provider;
  }

  /** Handles either the observed same-tab redirect or an actual new authorization tab. */
  async beginProviderAuthorization(): Promise<Page> {
    const provider = await this.exactProvider();
    const authorization = this.waitForAuthorization('kaiser');
    await provider.click();
    const portal = await authorization;
    await expect.poll(() => new URL(portal.url()).hostname, { timeout: this.data.syncTimeout }).toBe('identityauth.kaiserpermanente.org');
    return portal;
  }

  async waitForAuthorization(service: 'google' | 'kaiser'): Promise<Page> {
    const allowed = service === 'google'
      ? (host: string) => host === 'accounts.google.com'
      : (host: string) => host.endsWith('.kaiserpermanente.org');
    let found: Page | undefined;
    await expect.poll(() => {
      found = this.context.pages().find(tab => {
        try { return allowed(new URL(tab.url()).hostname); } catch { return false; }
      });
      return Boolean(found);
    }, { timeout: this.data.syncTimeout, message: `Genuine ${service} authorization surface opens` }).toBe(true);
    return found!;
  }

  async beginGoogleLogin(): Promise<Page> {
    await this.page.goto(`${this.data.baseURL}/#/login-patients`);
    await expect(this.page.getByRole('button', { name: 'Continue with Google', exact: true })).toBeVisible();
    const authorization = this.waitForAuthorization('google');
    await this.page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
    return authorization;
  }

  async completeGoogleLogin(google: Page, allowPhone = false): Promise<{ phoneSeen: boolean }> {
    expect(new URL(google.url()).hostname, 'Credentials remain on the genuine Google host').toBe('accounts.google.com');
    await expect.poll(async () => (await google.locator('body').innerText()).includes('HealthEx'), { timeout: this.data.syncTimeout, message: 'Google identifies the HealthEx application' }).toBe(true);
    const chooser = google.getByRole('link').filter({ hasText: this.data.googleEmail });
    await expect.poll(async () => await chooser.count() > 0 || await google.locator('input[type="email"]').isVisible(), { timeout: this.data.syncTimeout, message: 'The normal Google chooser or email field is ready' }).toBe(true);
    if (await chooser.count()) {
      await chooser.first().click();
    } else {
      const email = google.locator('input[type="email"]');
      await expect(email).toBeVisible();
      await email.fill(this.data.googleEmail);
      await google.getByRole('button', { name: 'Next', exact: true }).click();
    }
    // Handle only challenges that appear. Each secret is submitted once, without automated retries.
    let passwordSubmitted = false; let phoneSeen = false; let phoneSubmitted = false;
    await expect.poll(async () => {
      const callback = this.context.pages().some(tab => tab.url().startsWith(this.data.baseURL) && /#\/patient-records/.test(tab.url()));
      if (callback) return true;
      if (google.isClosed() || new URL(google.url()).hostname !== 'accounts.google.com') return false;
      const body = await google.locator('body').innerText();
      if (/couldn.t sign you in|browser or app may not be secure/i.test(body)) throw new Error('Blocked: Google rejected this browser; complete verification in the supported regular-Chrome profile.');
      const password = google.locator('input[type="password"]');
      if (!passwordSubmitted && await password.isVisible()) {
        expect(Boolean(this.data.googlePassword), 'Private Google password is configured for the requested challenge').toBe(true);
        passwordSubmitted = true; await password.fill(this.data.googlePassword); await google.getByRole('button', { name: 'Next', exact: true }).click();
      }
      const phone = google.locator('input[type="tel"]');
      if (!phoneSubmitted && await phone.isVisible()) {
        const label = [await phone.getAttribute('aria-label'), await phone.getAttribute('placeholder'), await phone.getAttribute('autocomplete')].filter(Boolean).join(' ');
        expect(/phone|tel/i.test(label) && !/one-time-code|enter.*code/i.test(label), 'The visible challenge requests a phone number, rather than a verification code').toBe(true);
        phoneSeen = true;
        expect(allowPhone, 'A requested phone challenge needs the explicitly provisioned recovery-phone scenario').toBe(true);
        expect(Boolean(this.data.recoveryPhone), 'Private recovery phone is configured').toBe(true);
        phoneSubmitted = true; await phone.fill(this.data.recoveryPhone); await google.getByRole('button', { name: 'Next', exact: true }).click();
      }
      return false;
    }, { timeout: this.data.syncTimeout, message: 'Google authorization returns to the HealthEx wallet; unresolved owner verification or browser rejection blocks login' }).toBe(true);
    await this.records();
    await this.assertIdentity();
    return { phoneSeen };
  }

  async authenticateKaiser(portal: Page): Promise<void> {
    expect(new URL(portal.url()).hostname, 'Kaiser credentials use the verified login host').toBe('identityauth.kaiserpermanente.org');
    const cookieSettings = portal.getByRole('button', { name: 'Settings , Opens the preference center dialog', exact: true });
    if (await cookieSettings.isVisible()) await cookieSettings.click();
    const preferences = portal.getByRole('dialog', { name: 'Preference Center', exact: true });
    if (await preferences.isVisible()) {
      const targeting = portal.getByRole('switch', { name: 'Targeting Technologies (Optional)', exact: true });
      if (await targeting.isChecked()) await portal.locator('label[for="ot-group-id-C0004"]').click();
      await expect(targeting).not.toBeChecked();
      await portal.getByRole('button', { name: 'Confirm My Choices', exact: true }).click();
    }
    await portal.getByRole('textbox', { name: 'User ID learn more about the User Id', exact: true }).fill(this.data.kaiserUsername);
    await portal.getByRole('textbox', { name: 'Password learn more about the Password', exact: true }).fill(this.data.kaiserPassword);
    await portal.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect.poll(() => new URL(portal.url()).hostname, { timeout: this.data.syncTimeout }).toBe('healthy.kaiserpermanente.org');
  }

  async approveFasten(portal: Page): Promise<void> {
    expect(this.data.capabilities.fastenConsent, 'Explicit recipient, categories and duration approval is required').toBe(true);
    expect(new URL(portal.url()).hostname).toBe('healthy.kaiserpermanente.org');
    expect((await portal.locator('body').innerText()).includes('Fasten Connect'), 'Authorization recipient matches the approved connector').toBe(true);
    await portal.getByRole('button', { name: 'Continue', exact: true }).click();
    const categories = portal.getByRole('list', { name: 'List of selectable data types.', exact: true }).getByRole('checkbox');
    await expect(categories).toHaveCount(this.data.fasten.categoryCount);
    for (const category of await categories.all()) await expect(category).toBeChecked();
    await portal.getByText(this.data.fasten.duration, { exact: true }).click();
    await expect(portal.getByRole('radio', { name: this.data.fasten.duration, exact: true })).toBeChecked();
    await portal.getByRole('button', { name: /^Allow access/ }).click();
  }

  async finishProviderImport(): Promise<void> {
    let returned: Page | undefined;
    await expect.poll(() => {
      returned = this.context.pages().find(tab => tab.url().startsWith(this.data.baseURL) && tab.url().includes('#/patient-consent/'));
      return Boolean(returned);
    }, { timeout: this.data.syncTimeout, message: 'Provider authorization returns to HealthEx' }).toBe(true);
    const tab = returned!;
    await expect(tab.getByText('Select the Providers You Want to Include', { exact: true })).toBeVisible();
    const choices = tab.getByRole('checkbox');
    await expect(choices).toHaveCount(1);
    const choice = choices.first();
    expect((await choice.getAttribute('aria-label') || await tab.locator('body').innerText()).includes(this.data.kaiserProvider), 'Only the approved provider is included').toBe(true);
    await expect(choice).toBeChecked();
    await tab.getByRole('button', { name: 'Continue', exact: true }).click();
    await tab.getByRole('button', { name: 'Open Your Wallet', exact: true }).click({ timeout: this.data.syncTimeout });
    await this.records('Sources');
    await this.assertConnectedSource();
  }

  async assertConnectedSource(): Promise<void> {
    await expect(this.sourceCards).toHaveCount(1);
    const text = await this.page.locator('body').innerText();
    expect(text.includes(this.data.kaiserProvider), 'The connected source is the requested Kaiser region').toBe(true);
    expect(/\bConnected\b/i.test(text) && !/\bDisconnected\b/i.test(text), 'Kaiser is connected').toBe(true);
  }

  async openSource(): Promise<void> {
    await this.switchView('Sources');
    await this.assertConnectedSource();
    await this.sourceCards.click();
    await expect(this.page.getByRole('dialog')).toBeVisible();
    await this.settle();
  }

  async prepareRefresh(): Promise<void> {
    await this.page.getByRole('dialog').getByRole('button', { name: 'More options', exact: true }).click();
    await this.page.getByRole('button', { name: /^Refresh Source/ }).click();
    await expect(this.page.getByText('Refresh records', { exact: true })).toBeVisible();
  }

  async refreshOnce(): Promise<void> {
    expect(this.data.capabilities.liveMutations, 'Explicit source refresh authorization is required').toBe(true);
    await this.page.getByRole('button', { name: 'Refresh these records', exact: true }).click();
    await expect(this.page.getByText('Refresh Successful', { exact: true })).toBeVisible({ timeout: this.data.syncTimeout });
    await this.page.getByRole('button', { name: 'Continue', exact: true }).click();
    const openWallet = this.page.getByRole('button', { name: 'Open Your Wallet', exact: true });
    if (await openWallet.isVisible()) await openWallet.click();
    await this.records('Sources');
    await this.assertConnectedSource();
  }

  async assertRecordRows(): Promise<void> {
    await expect(this.rows.first()).toBeVisible({ timeout: this.data.syncTimeout });
    await expect.poll(async () => {
      const loaded = await this.rowLabels();
      return this.data.fixture.records.every(record => loaded.includes(normalized(record.rowText)));
    }, { timeout: this.data.syncTimeout, message: 'Representative records load into Timeline' }).toBe(true);
    const labels = await this.rowLabels();
    expect(labels.length, 'Timeline contains actual records').toBeGreaterThan(0);
    for (const record of this.data.fixture.records) expect(labels.includes(normalized(record.rowText)), 'Expected representative record is present in Timeline').toBe(true);
  }

  async openRecord(record: RecordFixture): Promise<string> {
    await expect.poll(async () => (await this.rowLabels()).includes(normalized(record.rowText)), { timeout: this.data.syncTimeout, message: 'The representative Timeline entry is ready' }).toBe(true);
    const labels = await this.rowLabels();
    const index = labels.indexOf(normalized(record.rowText));
    expect(index >= 0, 'The configured representative record is loaded').toBe(true);
    await this.rows.nth(index).click();
    const dialog = this.page.getByRole('dialog').last();
    await expect(dialog).toBeVisible();
    await this.settle();
    for (const marker of record.detailMarkers) await expect.poll(async () => normalized(await dialog.innerText()).includes(normalized(marker)), { timeout: this.data.syncTimeout, message: 'Selected record metadata matches its fixture' }).toBe(true);
    const text = await dialog.innerText();
    if (record.source) expect(text.includes(record.source), 'Record source matches the selected provider').toBe(true);
    return text;
  }

  async openDocument(record: RecordFixture): Promise<string> {
    expect(Boolean(record.documentButtonText), 'The fixture identifies a real document control').toBe(true);
    const buttons = this.page.getByRole('dialog').last().getByRole('button');
    const labels = await Promise.all((await buttons.all()).map(async button => normalized(await button.innerText())));
    const index = labels.findIndex(value => value.includes(normalized(record.documentButtonText)));
    expect(index >= 0, 'The selected record has its expected document action').toBe(true);
    await buttons.nth(index).click();
    await this.settle();
    await expect(this.page.getByRole('button', { name: 'Download', exact: true })).toBeVisible();
    const frame = await this.documentFrame();
    await expect.poll(async () => normalized(await frame.locator('body').innerText()).length, { timeout: this.data.syncTimeout, message: 'Document frame contains readable content' }).toBeGreaterThan(0);
    const text = await frame.locator('body').innerText();
    expect(normalized(text).length, 'Document viewer contains readable text').toBeGreaterThan(0);
    expect(normalized(text) === normalized(record.documentText), 'Complete rendered document matches the private fixture').toBe(true);
    await frame.locator('body').evaluate(element => element.scrollIntoView({ block: 'end' }));
    return text;
  }

  async documentFrame(): Promise<Frame> {
    let selected: Frame | undefined;
    await expect.poll(async () => {
      for (const frame of this.page.frames()) {
        if (frame === this.page.mainFrame()) continue;
        if (await frame.locator('body').isVisible().catch(() => false)) { selected = frame; return true; }
      }
      return false;
    }, { timeout: this.data.syncTimeout, message: 'Readable embedded document frame loads' }).toBe(true);
    return selected!;
  }

  async closeDetails(): Promise<void> {
    // Changing only an unchanged hash does not clear React's record/document overlay state.
    for (let index = 0; index < 5; index++) {
      const close = this.page.getByRole('button', { name: 'Close', exact: true }).last();
      if (!(await close.isVisible())) break;
      const [control] = await close.elementHandles();
      if (!control) continue;
      const closed = () => control.evaluate(node => {
        const element = node as Element;
        return !element.isConnected || element.getClientRects().length === 0 || Boolean(element.closest('[aria-hidden="true"]'));
      }).catch(() => true);
      try {
        // Keep this exact element: a locator would retry against an already closing overlay.
        if (!(await closed())) {
          try { await control.click(); }
          catch (error) { if (!(await closed())) throw error; }
        }
        await expect.poll(closed, { timeout: this.data.syncTimeout, message: 'The selected overlay finishes closing' }).toBe(true);
      } finally { await control.dispose(); }
    }
    await expect(this.page.getByRole('dialog')).toHaveCount(0);
    await this.records();
    await this.assertWallet();
  }

  async globalOptions(): Promise<void> {
    await this.closeDetails();
    await this.page.getByRole('button', { name: 'More options', exact: true }).click();
  }

  async printRecords(): Promise<void> {
    await this.globalOptions();
    await expect(this.page.getByRole('button', { name: 'Print Records', exact: true })).toBeEnabled();
    // Native preview can suspend the click's renderer acknowledgement. Queue the actual control.
    await this.page.getByRole('button', { name: 'Print Records', exact: true }).evaluate((element: HTMLElement) => { setTimeout(() => element.click(), 0); });
  }

  async assertPrivateMarkers(markers: string[]): Promise<void> {
    expect(markers.length, 'A meaningful expected record baseline is supplied').toBeGreaterThan(0);
    const text = normalized(await this.page.locator('body').innerText());
    for (const marker of markers) expect(text.includes(normalized(marker)), 'Expected baseline content remains available').toBe(true);
  }
}
