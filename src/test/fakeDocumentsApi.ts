import type { DocumentsApi } from '@/features/documents/api';
import type { DocumentRow } from '@/features/documents/types';
import { DataError } from '@/lib/dataError';

let counter = 0;

/** A complete document with unremarkable defaults; pass only what the test cares about. */
export function fakeDocument(overrides: Partial<DocumentRow> = {}): DocumentRow {
  counter += 1;
  return {
    id: `document-${counter}`,
    name: `Document ${counter}`,
    kind: 'resume',
    status: 'not_started',
    url: null,
    notes: null,
    created_at: '2026-09-01T00:00:00+00:00',
    updated_at: '2026-09-01T00:00:00+00:00',
    ...overrides,
  };
}

/**
 * An in-memory DocumentsApi. Each method is a mock with realistic behaviour, so a test only
 * overrides what it cares about.
 */
export function createFakeDocumentsApi(initial: readonly DocumentRow[] = []) {
  let rows = initial.map((row) => structuredClone(row));
  const now = () => new Date().toISOString();

  function find(id: string): DocumentRow {
    const row = rows.find((item) => item.id === id);
    if (!row) throw new DataError('not_found');
    return row;
  }

  const api = {
    list: vi.fn<DocumentsApi['list']>(async () => structuredClone(rows)),

    create: vi.fn<DocumentsApi['create']>(async (fields) => {
      const created = { ...fakeDocument(), ...fields, created_at: now(), updated_at: now() };
      rows.push(created);
      return structuredClone(created);
    }),

    createMany: vi.fn<DocumentsApi['createMany']>(async (items) => {
      const created = items.map((fields) => ({
        ...fakeDocument(),
        ...fields,
        created_at: now(),
        updated_at: now(),
      }));
      rows.push(...created);
      return structuredClone(created);
    }),

    update: vi.fn<DocumentsApi['update']>(async (id, fields) => {
      const next = { ...find(id), ...fields, updated_at: now() };
      rows = rows.map((row) => (row.id === id ? next : row));
      return structuredClone(next);
    }),

    setStatus: vi.fn<DocumentsApi['setStatus']>(async (id, status) => {
      const row = find(id);
      row.status = status;
      row.updated_at = now();
    }),

    remove: vi.fn<DocumentsApi['remove']>(async (id) => {
      rows = rows.filter((row) => row.id !== id);
    }),
  } satisfies DocumentsApi;

  return {
    api,
    /** The data as the "database" currently holds it. */
    get rows() {
      return rows;
    },
  };
}
