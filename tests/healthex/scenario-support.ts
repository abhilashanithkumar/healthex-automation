import { expect } from '@playwright/test';
import { normalized } from '../../pages/HealthExPage';
import type { RecordFixture, TestData } from '../support/test-data';

export function representativeRecords(data: TestData): RecordFixture[] {
  expect(data.fixture.records.length, 'Private fixture includes at least two representative records').toBeGreaterThanOrEqual(2);
  expect(data.fixture.records.some(record => record.kind === 'visit'), 'Private fixture includes a visit').toBe(true);
  expect(data.fixture.records.some(record => record.kind === 'imaging'), 'Private fixture includes an imaging record').toBe(true);
  for (const record of data.fixture.records) {
    expect(Boolean(record.rowText && record.detailMarkers.length), 'Record fixture has an identity and metadata baseline').toBe(true);
  }
  return data.fixture.records;
}

export function documentRecords(data: TestData): RecordFixture[] {
  const records = representativeRecords(data).filter(record => record.documentButtonText && record.documentText);
  expect(records.length, 'Private fixture includes two complete document baselines').toBeGreaterThanOrEqual(2);
  expect(records.some(record => record.kind === 'visit') && records.some(record => record.kind === 'imaging'), 'Both the visit and imaging fixture have complete documents').toBe(true);
  expect(new Set(records.map(record => normalized(record.documentText))).size, 'Document fixtures contain distinct content').toBe(records.length);
  return records;
}

export function exportMarkers(data: TestData): string[] {
  expect(data.fixture.exportMarkers.length, 'Full export has a private scope manifest').toBeGreaterThan(0);
  return [...data.fixture.exportMarkers, ...documentRecords(data).map(record => record.documentText)];
}

