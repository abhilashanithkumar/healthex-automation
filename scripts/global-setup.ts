import { ensureConfiguredChrome } from './browser-lifecycle';
import { loadEnvironment } from '../tests/support/test-data';

export default async function globalSetup(): Promise<void> {
  loadEnvironment();
  if (process.env.HEALTHEX_AUTH_MODE === 'cdp') await ensureConfiguredChrome();
}
