import type { RecommendationsApi } from '@/features/recommendations/api';
import type { RecommenderRow, RequestRow } from '@/features/recommendations/types';
import { DataError } from '@/lib/dataError';

let counter = 0;

/** A complete recommender with unremarkable defaults; pass only what the test cares about. */
export function fakeRecommender(overrides: Partial<RecommenderRow> = {}): RecommenderRow {
  counter += 1;
  return {
    id: `recommender-${counter}`,
    name: `Prof. Example ${counter}`,
    title: null,
    institution: null,
    email: null,
    notes: null,
    created_at: '2026-09-01T00:00:00+00:00',
    updated_at: '2026-09-01T00:00:00+00:00',
    ...overrides,
  };
}

/** A complete letter request with unremarkable defaults. */
export function fakeRequest(overrides: Partial<RequestRow> = {}): RequestRow {
  counter += 1;
  return {
    id: `request-${counter}`,
    recommender_id: 'recommender-1',
    application_id: 'application-1',
    status: 'not_requested',
    requested_on: null,
    deadline: null,
    notes: null,
    created_at: '2026-09-01T00:00:00+00:00',
    updated_at: '2026-09-01T00:00:00+00:00',
    ...overrides,
  };
}

/**
 * An in-memory RecommendationsApi. Each method is a mock with realistic behaviour (including the
 * database's one-request-per-person-and-program rule and deleting a person's requests with them),
 * so a test only overrides what it cares about.
 */
export function createFakeRecommendationsApi(
  initial: { recommenders?: readonly RecommenderRow[]; requests?: readonly RequestRow[] } = {},
) {
  let recommenders = (initial.recommenders ?? []).map((row) => structuredClone(row));
  let requests = (initial.requests ?? []).map((row) => structuredClone(row));
  const now = () => new Date().toISOString();

  function findRecommender(id: string): RecommenderRow {
    const row = recommenders.find((item) => item.id === id);
    if (!row) throw new DataError('not_found');
    return row;
  }

  function findRequest(id: string): RequestRow {
    const row = requests.find((item) => item.id === id);
    if (!row) throw new DataError('not_found');
    return row;
  }

  const api = {
    listRecommenders: vi.fn<RecommendationsApi['listRecommenders']>(async () =>
      structuredClone(recommenders),
    ),

    createRecommender: vi.fn<RecommendationsApi['createRecommender']>(async (fields) => {
      const created = { ...fakeRecommender(), ...fields, created_at: now(), updated_at: now() };
      recommenders.push(created);
      return structuredClone(created);
    }),

    updateRecommender: vi.fn<RecommendationsApi['updateRecommender']>(async (id, fields) => {
      const next = { ...findRecommender(id), ...fields, updated_at: now() };
      recommenders = recommenders.map((row) => (row.id === id ? next : row));
      return structuredClone(next);
    }),

    deleteRecommender: vi.fn<RecommendationsApi['deleteRecommender']>(async (id) => {
      recommenders = recommenders.filter((row) => row.id !== id);
      requests = requests.filter((row) => row.recommender_id !== id);
    }),

    listRequests: vi.fn<RecommendationsApi['listRequests']>(async () => structuredClone(requests)),

    createRequest: vi.fn<RecommendationsApi['createRequest']>(async (request) => {
      if (
        requests.some(
          (row) =>
            row.recommender_id === request.recommender_id &&
            row.application_id === request.application_id,
        )
      ) {
        throw new DataError('unknown', { cause: { code: '23505' } });
      }
      const created = { ...fakeRequest(), ...request, created_at: now(), updated_at: now() };
      requests.push(created);
      return structuredClone(created);
    }),

    updateRequest: vi.fn<RecommendationsApi['updateRequest']>(async (id, fields) => {
      const next = { ...findRequest(id), ...fields, updated_at: now() };
      requests = requests.map((row) => (row.id === id ? next : row));
      return structuredClone(next);
    }),

    setRequestStatus: vi.fn<RecommendationsApi['setRequestStatus']>(
      async (id, status, requestedOn) => {
        const row = findRequest(id);
        row.status = status;
        if (requestedOn) row.requested_on = requestedOn;
        row.updated_at = now();
      },
    ),

    deleteRequest: vi.fn<RecommendationsApi['deleteRequest']>(async (id) => {
      requests = requests.filter((row) => row.id !== id);
    }),
  } satisfies RecommendationsApi;

  return {
    api,
    /** The data as the "database" currently holds it. */
    get recommenders() {
      return recommenders;
    },
    get requests() {
      return requests;
    },
  };
}
