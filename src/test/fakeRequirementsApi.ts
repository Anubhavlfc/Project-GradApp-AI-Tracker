import { DataError } from '@/lib/dataError';
import type { RequirementsApi } from '@/features/requirements/api';
import type { RequirementRow } from '@/features/requirements/types';

let counter = 0;

/** A complete checklist item with unremarkable defaults; pass only what the test cares about. */
export function fakeRequirement(overrides: Partial<RequirementRow> = {}): RequirementRow {
  counter += 1;
  return {
    id: `requirement-${counter}`,
    application_id: 'application-1',
    kind: 'resume_cv',
    label: null,
    is_required: true,
    status: 'not_started',
    due_date: null,
    document_id: null,
    notes: null,
    created_at: '2026-09-01T00:00:00+00:00',
    updated_at: '2026-09-01T00:00:00+00:00',
    ...overrides,
  };
}

/**
 * An in-memory RequirementsApi. Each method is a mock with realistic behaviour, so a test only
 * overrides what it cares about (e.g. `api.setStatus.mockRejectedValueOnce(new DataError('network'))`).
 */
export function createFakeRequirementsApi(initial: readonly RequirementRow[] = []) {
  let rows = initial.map((row) => structuredClone(row));
  const now = () => new Date().toISOString();

  function find(id: string): RequirementRow {
    const row = rows.find((item) => item.id === id);
    if (!row) throw new DataError('not_found');
    return row;
  }

  const api = {
    list: vi.fn<RequirementsApi['list']>(async () => structuredClone(rows)),

    add: vi.fn<RequirementsApi['add']>(async (applicationId, items) => {
      const created = items.map((item) => ({
        ...fakeRequirement(),
        ...item,
        application_id: applicationId,
        created_at: now(),
        updated_at: now(),
      }));
      rows.push(...created);
      return structuredClone(created);
    }),

    update: vi.fn<RequirementsApi['update']>(async (id, fields) => {
      const next = { ...find(id), ...fields, updated_at: now() };
      rows = rows.map((row) => (row.id === id ? next : row));
      return structuredClone(next);
    }),

    setStatus: vi.fn<RequirementsApi['setStatus']>(async (id, status) => {
      const row = find(id);
      row.status = status;
      row.updated_at = now();
    }),

    remove: vi.fn<RequirementsApi['remove']>(async (id) => {
      rows = rows.filter((row) => row.id !== id);
    }),
  } satisfies RequirementsApi;

  return {
    api,
    /** The data as the "database" currently holds it. */
    get rows() {
      return rows;
    },
  };
}
