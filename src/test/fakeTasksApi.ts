import type { TasksApi } from '@/features/tasks/api';
import type { TaskRow } from '@/features/tasks/types';
import { DataError } from '@/lib/dataError';

let counter = 0;

/** A complete task with unremarkable defaults; pass only what the test cares about. */
export function fakeTask(overrides: Partial<TaskRow> = {}): TaskRow {
  counter += 1;
  return {
    id: `task-${counter}`,
    application_id: null,
    title: `Task ${counter}`,
    due_date: null,
    priority: 'medium',
    status: 'todo',
    completed_at: null,
    notes: null,
    created_at: '2026-09-01T00:00:00+00:00',
    updated_at: '2026-09-01T00:00:00+00:00',
    ...overrides,
  };
}

/**
 * An in-memory TasksApi. Each method is a mock with realistic behaviour, so a test only overrides
 * what it cares about. Like the database, it stamps `completed_at` when a task becomes complete
 * and clears it when it stops being complete.
 */
export function createFakeTasksApi(initial: readonly TaskRow[] = []) {
  let rows = initial.map((row) => structuredClone(row));
  const now = () => new Date().toISOString();

  function find(id: string): TaskRow {
    const row = rows.find((item) => item.id === id);
    if (!row) throw new DataError('not_found');
    return row;
  }

  const completedAt = (before: TaskRow | null, status: TaskRow['status']) => {
    if (status !== 'complete') return null;
    return before?.status === 'complete' ? before.completed_at : now();
  };

  const api = {
    list: vi.fn<TasksApi['list']>(async () => structuredClone(rows)),

    create: vi.fn<TasksApi['create']>(async (fields) => {
      const created = {
        ...fakeTask(),
        ...fields,
        completed_at: completedAt(null, fields.status),
        created_at: now(),
        updated_at: now(),
      };
      rows.push(created);
      return structuredClone(created);
    }),

    update: vi.fn<TasksApi['update']>(async (id, fields) => {
      const before = find(id);
      const next = {
        ...before,
        ...fields,
        completed_at: completedAt(before, fields.status),
        updated_at: now(),
      };
      rows = rows.map((row) => (row.id === id ? next : row));
      return structuredClone(next);
    }),

    setStatus: vi.fn<TasksApi['setStatus']>(async (id, status) => {
      const row = find(id);
      row.completed_at = completedAt(row, status);
      row.status = status;
      row.updated_at = now();
    }),

    remove: vi.fn<TasksApi['remove']>(async (id) => {
      rows = rows.filter((row) => row.id !== id);
    }),
  } satisfies TasksApi;

  return {
    api,
    /** The data as the "database" currently holds it. */
    get rows() {
      return rows;
    },
  };
}
