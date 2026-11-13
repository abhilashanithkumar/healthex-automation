import { randomUUID } from 'node:crypto';

/** Generate once per test attempt; reuse for submission recovery and deactivation. */
export function createShareLinkName(scenarioId: string): string {
  if (!/^SHARING-\d{2}$/.test(scenarioId)) {
    throw new Error('Share-link scenario ID must match SHARING-NN');
  }
  return `QA-${scenarioId}-${randomUUID()}`;
}
