import type { FundingApi } from '@/features/funding/api';
import type { FundingRow } from '@/features/funding/types';
import { DataError } from '@/lib/dataError';

let counter = 0;

/** A complete funding item with unremarkable defaults; pass only what the test cares about. */
export function fakeFunding(overrides: Partial<FundingRow> = {}): FundingRow {
  counter += 1;
  return {
    id: `funding-${counter}`,
    application_id: null,
    name: `Scholarship ${counter}`,
    kind: 'university_scholarship',
    amount: null,
    currency: 'USD',
    deadline: null,
    application_required: false,
    status: 'researching',
    url: null,
    notes: null,
    created_at: '2026-09-01T00:00:00+00:00',
    updated_at: '2026-09-01T00:00:00+00:00',
    ...overrides,
  };
}

/**
 * An in-memory FundingApi. Each method is a mock with realistic behaviour, so a test only
 * overrides what it cares about.
 */
export function createFakeFundingApi(initial: readonly FundingRow[] = []) {
  let rows = initial.map((row) => structuredClone(row));
  const now = () => new Date().toISOString();

  function find(id: string): FundingRow {
    const row = rows.find((item) => item.id === id);
    if (!row) throw new DataError('not_found');
    return row;
  }

  const api = {
    list: vi.fn<FundingApi['list']>(async () => structuredClone(rows)),

    create: vi.fn<FundingApi['create']>(async (fields) => {
      const created = { ...fakeFunding(), ...fields, created_at: now(), updated_at: now() };
      rows.push(created);
      return structuredClone(created);
    }),

    update: vi.fn<FundingApi['update']>(async (id, fields) => {
      const next = { ...find(id), ...fields, updated_at: now() };
      rows = rows.map((row) => (row.id === id ? next : row));
      return structuredClone(next);
    }),

    setStatus: vi.fn<FundingApi['setStatus']>(async (id, status) => {
      const row = find(id);
      row.status = status;
      row.updated_at = now();
    }),

    remove: vi.fn<FundingApi['remove']>(async (id) => {
      rows = rows.filter((row) => row.id !== id);
    }),
  } satisfies FundingApi;

  return {
    api,
    /** The data as the "database" currently holds it. */
    get rows() {
      return rows;
    },
  };
}
