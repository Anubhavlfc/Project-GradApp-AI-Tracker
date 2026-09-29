import type { ActivityApi } from '@/features/activity/api';
import type { ActivityRow } from '@/features/activity/types';

let counter = 0;

/** A complete activity entry with unremarkable defaults; pass only what the test cares about. */
export function fakeActivity(overrides: Partial<ActivityRow> = {}): ActivityRow {
  counter += 1;
  return {
    id: `activity-${counter}`,
    application_id: null,
    kind: 'task_completed',
    subject: `Task ${counter}`,
    detail: null,
    meta: {},
    created_at: '2026-09-01T12:00:00+00:00',
    ...overrides,
  };
}

/** An in-memory ActivityApi. The mock returns what it was given, newest first, up to the limit. */
export function createFakeActivityApi(initial: readonly ActivityRow[] = []) {
  const rows = initial.map((row) => structuredClone(row));
  const api = {
    recent: vi.fn<ActivityApi['recent']>(async (limit) =>
      structuredClone(
        [...rows]
          .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
          .slice(0, limit),
      ),
    ),
  };
  return { api, rows };
}
