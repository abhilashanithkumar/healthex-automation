import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

export interface RecordFixture {
  rowText: string;
  kind: 'visit' | 'imaging' | 'other';
  detailMarkers: string[];
  documentButtonText: string;
  documentText: string;
  dateISO?: string;
  source?: string;
}

export interface ControlledScenario {
  startURL: string;
  expectedMessage: string;
  retryButtonName?: string;
  retrySuccessText?: string;
  recordRowText?: string;
  documentButtonText?: string;
  protectedURL?: string;
  baselineMarkers?: string[];
  actionButtonName?: string;
  query?: string;
  expectedResults?: string[];
}

export interface TestData {
  baseURL: string;
  publicURL: string;
  googleEmail: string;
  googlePassword: string;
  recoveryPhone: string;
  kaiserProvider: string;
  kaiserUsername: string;
  kaiserPassword: string;
  consentName: string;
  accountInitials: string;
  syncTimeout: number;
  exportTimeout: number;
  fasten: { duration: string; categoryCount: number };
  capabilities: {
    googleLogin: boolean;
    recoveryPhoneChallenge: boolean;
    emptyWallet: boolean;
    liveMutations: boolean;
    healthExConsent: boolean;
    fastenConsent: boolean;
    controlledFailures: boolean;
    knownPrintScopeBug: boolean;
  };
  fixture: {
    records: RecordFixture[];
    summaryMarkers: string[];
    exportMarkers: string[];
    controlled: Partial<Record<string, ControlledScenario>>;
  };
}

let loaded = false;
export function loadEnvironment(): void {
  if (loaded) return;
  const supplied = new Set(Object.keys(process.env));
  for (const name of ['.env', '.env.local']) {
    const filename = path.resolve(name);
    if (!fs.existsSync(filename)) continue;
    for (const [key, value] of Object.entries(parseEnv(fs.readFileSync(filename, 'utf8')))) {
      if (!supplied.has(key)) process.env[key] = value;
    }
  }
  loaded = true;
}

function flag(name: string): boolean { return process.env[name] === 'true'; }
function timeout(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
  return value;
}

export function loadTestData(): TestData {
  loadEnvironment();
  const filename = path.resolve(process.env.HEALTHEX_FIXTURE_FILE ?? 'playwright/.auth/fixtures.json');
  let fixture: Record<string, any> = {};
  if (fs.existsSync(filename)) {
    try { fixture = JSON.parse(fs.readFileSync(filename, 'utf8')); }
    catch { throw new Error('Private fixture JSON is invalid; its contents are suppressed'); }
  }
  for (const name of ['records', 'summaryMarkers', 'exportMarkers']) {
    if (fixture[name] !== undefined && !Array.isArray(fixture[name])) throw new Error(`Private fixture ${name} must be an array`);
  }
  for (const [index, record] of (fixture.records ?? []).entries()) {
    if (!record || typeof record.rowText !== 'string' || !['visit', 'imaging', 'other'].includes(record.kind) || !Array.isArray(record.detailMarkers)) {
      throw new Error(`Private record fixture ${index} needs rowText, kind and detailMarkers`);
    }
  }
  const baseURL = process.env.HEALTHEX_BASE_URL ?? 'https://app.healthex.io';
  const controlled = fixture.controlled ?? {};
  for (const [name, item] of Object.entries(controlled) as [string, ControlledScenario][]) {
    if (!item.startURL || !item.expectedMessage) throw new Error(`Controlled fixture ${name} needs startURL and expectedMessage`);
    const target = new URL(item.startURL, baseURL);
    if (target.hostname === 'app.healthex.io') throw new Error(`Controlled fixture ${name} must use an approved nonproduction environment`);
    if (item.protectedURL && new URL(item.protectedURL, target).origin !== target.origin) throw new Error(`Controlled fixture ${name} protectedURL must stay in its approved environment`);
  }
  return {
    baseURL, publicURL: process.env.HEALTHEX_PUBLIC_URL ?? 'https://healthex.io',
    googleEmail: process.env.HEALTHEX_GOOGLE_EMAIL ?? '',
    googlePassword: process.env.HEALTHEX_GOOGLE_PASSWORD ?? '',
    recoveryPhone: process.env.HEALTHEX_RECOVERY_PHONE ?? '',
    kaiserProvider: process.env.HEALTHEX_PROVIDER ?? '',
    kaiserUsername: process.env.HEALTHEX_KAISER_USERNAME ?? '',
    kaiserPassword: process.env.HEALTHEX_KAISER_PASSWORD ?? '',
    consentName: process.env.HEALTHEX_CONSENT_NAME ?? '',
    accountInitials: process.env.HEALTHEX_ACCOUNT_INITIALS ?? '',
    syncTimeout: timeout('HEALTHEX_SYNC_TIMEOUT', 120000),
    exportTimeout: timeout('HEALTHEX_EXPORT_TIMEOUT', 120000),
    fasten: { duration: process.env.HEALTHEX_FASTEN_DURATION ?? '1 hour', categoryCount: timeout('HEALTHEX_FASTEN_CATEGORY_COUNT', 19) },
    capabilities: {
      googleLogin: flag('HEALTHEX_GOOGLE_LOGIN'), recoveryPhoneChallenge: flag('HEALTHEX_RECOVERY_PHONE_CHALLENGE'),
      emptyWallet: flag('HEALTHEX_EMPTY_WALLET'), liveMutations: flag('HEALTHEX_ALLOW_MUTATIONS'),
      healthExConsent: flag('HEALTHEX_ALLOW_CONSENT'), fastenConsent: flag('HEALTHEX_ALLOW_PROVIDER_GRANT'),
      controlledFailures: flag('HEALTHEX_CONTROLLED_FIXTURES'), knownPrintScopeBug: flag('HEALTHEX_KNOWN_PRINT_SCOPE_BUG'),
    },
    fixture: { records: fixture.records ?? [], summaryMarkers: fixture.summaryMarkers ?? [], exportMarkers: fixture.exportMarkers ?? [], controlled },
  };
}
