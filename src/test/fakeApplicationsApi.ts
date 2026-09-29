import type { ApplicationsApi } from '@/features/applications/api';
import { toISODate } from '@/features/applications/dates';
import { DataError } from '@/features/applications/errors';
import type {
  ApplicationInput,
  ApplicationRecord,
  UniversityRow,
} from '@/features/applications/types';

let counter = 0;

type RecordOverrides = Partial<Omit<ApplicationRecord, 'university'>> & {
  university?: Partial<UniversityRow>;
};

/** A complete record with unremarkable defaults; pass only what the test cares about. */
export function fakeRecord(overrides: RecordOverrides = {}): ApplicationRecord {
  counter += 1;
  const { university, ...rest } = overrides;
  const universityRow: UniversityRow = {
    id: `university-${counter}`,
    name: 'Example University',
    city: null,
    region: null,
    country: null,
    website_url: null,
    created_at: '2026-09-01T00:00:00+00:00',
    updated_at: '2026-09-01T00:00:00+00:00',
    ...university,
  };
  return {
    id: `application-${counter}`,
    university_id: universityRow.id,
    school_college: null,
    department: null,
    program_name: 'Computer Science',
    degree_level: 'masters',
    degree_type: null,
    program_url: null,
    program_length_months: null,
    is_stem: false,
    status: 'researching',
    priority: null,
    is_favorite: false,
    deadline: null,
    priority_deadline: null,
    portal_url: null,
    interview_at: null,
    submitted_on: null,
    application_fee: null,
    fee_currency: 'USD',
    fee_waiver_available: false,
    fee_waiver_status: 'not_requested',
    fee_paid_on: null,
    decision_received_on: null,
    decision_deadline: null,
    enrollment_deposit: null,
    is_final_choice: false,
    notes: null,
    created_at: '2026-09-01T00:00:00+00:00',
    updated_at: '2026-09-01T00:00:00+00:00',
    ...rest,
    university: universityRow,
  };
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * An in-memory ApplicationsApi. Each method is a mock with realistic behaviour, so a test only
 * overrides what it cares about (e.g. `api.list.mockRejectedValueOnce(new DataError('network'))`).
 */
export function createFakeApplicationsApi(initial: readonly ApplicationRecord[] = []) {
  let records = initial.map((record) => structuredClone(record));
  const now = () => new Date().toISOString();

  function resolveUniversity(input: ApplicationInput['university']): UniversityRow {
    const existing = records.find((r) => sameName(r.university.name, input.name))?.university;
    counter += 1;
    return existing
      ? {
          ...existing,
          ...Object.fromEntries(
            Object.entries(input).filter(([k, v]) => v !== null && k !== 'name'),
          ),
        }
      : { id: `university-${counter}`, ...input, created_at: now(), updated_at: now() };
  }

  function find(id: string): ApplicationRecord {
    const record = records.find((r) => r.id === id);
    if (!record) throw new DataError('not_found');
    return record;
  }

  const api = {
    list: vi.fn<ApplicationsApi['list']>(async () => structuredClone(records)),

    create: vi.fn<ApplicationsApi['create']>(async (input) => {
      const university = resolveUniversity(input.university);
      counter += 1;
      const record: ApplicationRecord = {
        ...fakeRecord(),
        ...input.application,
        id: `application-${counter}`,
        university_id: university.id,
        is_favorite: false,
        created_at: now(),
        updated_at: now(),
        university,
      };
      records.push(record);
      return structuredClone(record);
    }),

    update: vi.fn<ApplicationsApi['update']>(async (id, input) => {
      const current = find(id);
      const university = resolveUniversity(input.university);
      const next: ApplicationRecord = {
        ...current,
        ...input.application,
        university_id: university.id,
        university,
        updated_at: now(),
      };
      records = records.map((r) => (r.id === id ? next : r));
      return structuredClone(next);
    }),

    setStatus: vi.fn<ApplicationsApi['setStatus']>(async (id, status, submittedOn) => {
      const current = find(id);
      current.status = status;
      if (submittedOn) current.submitted_on = submittedOn;
      current.updated_at = now();
    }),

    setFavorite: vi.fn<ApplicationsApi['setFavorite']>(async (id, isFavorite) => {
      find(id).is_favorite = isFavorite;
    }),

    remove: vi.fn<ApplicationsApi['remove']>(async (id) => {
      records = records.filter((r) => r.id !== id);
    }),
  } satisfies ApplicationsApi;

  return {
    api,
    /** The data as the "database" currently holds it. */
    get records() {
      return records;
    },
  };
}

/** A calendar date this many days from today ('YYYY-MM-DD', local), for deadline tests. */
export function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toISODate(date);
}
