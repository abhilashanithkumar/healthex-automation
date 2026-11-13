import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { expect, type TestInfo } from '@playwright/test';
import { SharingPage, shareLinkFrom, type ShareLink } from '../../pages/SharingPage';
import { createShareLinkName } from './share-link-data';

interface OwnedLink { name: string; state: 'pending' | 'created' | 'inactive' | 'absent'; links: ShareLink[]; unmatchedResponse?: { id: string; label: string } }

/** Per-test ownership and recovery. The private ledger is never attached to reports. */
export class ShareLinkSession {
  private owned: OwnedLink[] = [];
  private baseline?: ShareLink[];
  private ledgerPath: string;
  constructor(readonly sharing: SharingPage, info: TestInfo) {
    this.ledgerPath = path.resolve('playwright/.auth/sharing-ledgers', `${info.workerIndex}-${randomUUID()}.json`);
  }

  async start(): Promise<void> { await this.sharing.open(); this.baseline = await this.sharing.list(); }
  name(scenario: string): string { return createShareLinkName(scenario); }
  private async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.ledgerPath), { recursive: true, mode: 0o700 });
    const temporary = `${this.ledgerPath}.tmp`;
    await fs.writeFile(temporary, JSON.stringify({ baseline: this.baseline, owned: this.owned }), { mode: 0o600 });
    await fs.rename(temporary, this.ledgerPath);
  }

  async register(name: string): Promise<OwnedLink> {
    if (!this.baseline) throw new Error('Capture the Sharing baseline before creating any test link');
    expect(!this.baseline.some(link => link.label === name), 'Test name is absent from the baseline').toBe(true);
    const owned: OwnedLink = { name, state: 'pending', links: [] };
    this.owned.push(owned); await this.save(); return owned;
  }

  async remember(name: string, raw: unknown): Promise<ShareLink> {
    const owned = this.owned.find(item => item.name === name);
    if (!owned) throw new Error('Register ownership before submission');
    const link = shareLinkFrom(raw);
    if (this.baseline?.some(item => item.id === link.id)) throw new Error('Creation returned a baseline identifier; refusing to mutate it');
    if (link.label !== owned.name) {
      owned.unmatchedResponse = { id: link.id, label: link.label }; await this.save();
      throw new Error('Creation returned an unexpected name; ownership requires manual ledger review');
    }
    if (!owned.links.some(item => item.id === link.id)) owned.links.push(link);
    owned.state = 'created'; await this.save(); return link;
  }

  async create(scenario: string): Promise<ShareLink> {
    const name = this.name(scenario);
    await this.register(name);
    await this.sharing.openForm(); await this.sharing.chooseVitals(name);
    const response = await this.sharing.submit();
    if (!response.ok()) throw new Error('Share-link creation was rejected');
    const link = await this.remember(name, await response.json());
    await expect(this.sharing.deactivate).toBeVisible();
    return link;
  }

  async recover(name: string): Promise<ShareLink[]> {
    const owned = this.owned.find(item => item.name === name);
    if (!owned) throw new Error('Cannot recover an unregistered share-link name');
    await this.sharing.open();
    const links = (await this.sharing.list()).filter(link => link.label === owned.name && !this.baseline?.some(item => item.id === link.id));
    for (const link of links) await this.remember(name, link);
    return links;
  }

  async assertBaselinePreserved(): Promise<void> {
    const links = await this.sharing.list();
    expect(Boolean(this.baseline), 'Baseline was established independently').toBe(true);
    for (const original of this.baseline ?? []) {
      const current = links.find(item => item.id === original.id);
      expect(Boolean(current && current.label === original.label && current.status === original.status), 'Every pre-existing share link is preserved').toBe(true);
    }
  }

  async dispose(): Promise<void> {
    const errors: Error[] = [];
    for (const owned of this.owned) {
      try {
        if (owned.unmatchedResponse) throw new Error('Unexpected creation response requires manual ownership review');
        const recovered = await this.recover(owned.name);
        if (!recovered.length && !owned.links.length) { owned.state = 'absent'; await this.save(); continue; }
        for (const link of owned.links) {
          if (this.baseline?.some(item => item.id === link.id)) throw new Error('Ownership conflict with a pre-existing link');
          let inactive: ShareLink;
          try { inactive = await this.sharing.deactivateOwned(link); }
          catch { await this.sharing.page.reload(); inactive = await this.sharing.deactivateOwned(link); }
          expect(await this.sharing.isInactive(inactive), 'Every test-created link is inactive').toBe(true);
        }
        owned.state = 'inactive'; await this.save();
      } catch { errors.push(new Error('Test-owned link deactivation is unresolved; inspect the private sharing ledger')); }
    }
    if (this.baseline && this.owned.length) try { await this.assertBaselinePreserved(); } catch { errors.push(new Error('Pre-existing Sharing baseline changed')); }
    if (errors.length) throw new AggregateError(errors, 'Sharing cleanup failed; private ledgers are under playwright/.auth/sharing-ledgers');
  }
}
