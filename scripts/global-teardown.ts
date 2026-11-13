import { closeConfiguredChrome } from './browser-lifecycle';

export default async function globalTeardown(): Promise<void> {
  // Run once after all workers finish, rather than killing CDP Chrome on a worker restart.
  await closeConfiguredChrome();
}
