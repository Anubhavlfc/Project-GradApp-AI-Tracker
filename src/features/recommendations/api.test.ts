import { DataError } from '@/lib/dataError';
import { createFakeSupabase } from '@/test/fakeSupabaseData';
import { createRecommendationsApi } from './api';
import type { RecommenderFields, RequestFields } from './types';

const application = (id = 'app-1') => ({
  id,
  university_id: 'uni-1',
  program_name: 'Computer Science',
});

const recommenderRow = (overrides = {}) => ({
  id: 'rec-1',
  name: 'Dr. Lee',
  title: null,
  institution: null,
  email: null,
  notes: null,
  created_at: '2026-09-01T00:00:00+00:00',
  updated_at: '2026-09-01T00:00:00+00:00',
  ...overrides,
});

const requestRow = (overrides = {}) => ({
  id: 'req-1',
  recommender_id: 'rec-1',
  application_id: 'app-1',
  status: 'not_requested',
  requested_on: null,
  deadline: null,
  notes: null,
  created_at: '2026-09-01T00:00:00+00:00',
  updated_at: '2026-09-01T00:00:00+00:00',
  ...overrides,
});

const person = (overrides: Partial<RecommenderFields> = {}): RecommenderFields => ({
  name: 'Dr. Lee',
  title: null,
  institution: null,
  email: null,
  notes: null,
  ...overrides,
});

const fields = (overrides: Partial<RequestFields> = {}): RequestFields => ({
  status: 'not_requested',
  requested_on: null,
  deadline: null,
  notes: null,
  ...overrides,
});

function setup(seed: Parameters<typeof createFakeSupabase>[0] = {}) {
  const fake = createFakeSupabase({
    applications: [application(), application('app-2')],
    recommenders: [recommenderRow()],
    ...seed,
  });
  return { fake, api: createRecommendationsApi(fake.client) };
}

describe('listRecommenders', () => {
  it('returns every person in one request', async () => {
    const { api, fake } = setup({
      recommenders: [recommenderRow(), recommenderRow({ id: 'rec-2', name: 'Prof. Ortiz' })],
    });
    const rows = await api.listRecommenders();
    expect(rows.map((row) => row.id)).toEqual(['rec-1', 'rec-2']);
    expect(fake.requests).toEqual(['select recommenders']);
  });

  it('refuses data that does not look like a recommender, rather than showing nonsense', async () => {
    const { api } = setup({ recommenders: [recommenderRow({ name: 42 })] });
    await expect(api.listRecommenders()).rejects.toMatchObject({
      name: 'DataError',
      kind: 'unknown',
    });
  });

  it('turns a database failure into a message fit for the screen', async () => {
    const { api, fake } = setup();
    fake.failNext('recommenders', 'select', { code: 'PGRST301', message: 'JWT expired' });
    const error = await api.listRecommenders().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DataError);
    expect(error).toMatchObject({ kind: 'session' });
  });
});

describe('createRecommender', () => {
  it('saves the person and returns them as stored', async () => {
    const { api, fake } = setup({ recommenders: [] });
    const row = await api.createRecommender(
      person({ name: 'Prof. Ortiz', title: 'Professor', email: 'o@uw.edu' }),
    );
    expect(row).toMatchObject({ name: 'Prof. Ortiz', title: 'Professor', email: 'o@uw.edu' });
    expect(fake.tables.recommenders).toHaveLength(1);
  });

  it('never sends who owns the row: the database decides that', async () => {
    const { api, fake } = setup({ recommenders: [] });
    await api.createRecommender(person());
    expect(fake.tables.recommenders[0]).not.toHaveProperty('user_id');
  });

  it('turns a rejected value into a message about the values', async () => {
    const { api, fake } = setup();
    fake.failNext('recommenders', 'insert', { code: '23514', message: 'check constraint' });
    await expect(api.createRecommender(person())).rejects.toMatchObject({ kind: 'invalid' });
  });
});

describe('updateRecommender', () => {
  it('saves the changes and returns the person as stored', async () => {
    const { api, fake } = setup();
    const row = await api.updateRecommender('rec-1', person({ name: 'Dr. Lee-Park', notes: 'hi' }));
    expect(row).toMatchObject({ id: 'rec-1', name: 'Dr. Lee-Park', notes: 'hi' });
    expect(fake.tables.recommenders[0]).toMatchObject({ name: 'Dr. Lee-Park' });
  });

  it('says so when the person is gone, for example deleted in another tab', async () => {
    const { api } = setup();
    await expect(api.updateRecommender('rec-9', person())).rejects.toMatchObject({
      kind: 'not_found',
    });
  });
});

describe('deleteRecommender', () => {
  it('deletes the person and their letter requests, and nobody else’s', async () => {
    const { api, fake } = setup({
      recommenders: [recommenderRow(), recommenderRow({ id: 'rec-2', name: 'Prof. Ortiz' })],
      recommendation_requests: [
        requestRow(),
        requestRow({ id: 'req-2', application_id: 'app-2' }),
        requestRow({ id: 'req-3', recommender_id: 'rec-2' }),
      ],
    });
    await api.deleteRecommender('rec-1');
    expect(fake.tables.recommenders.map((row) => row.id)).toEqual(['rec-2']);
    expect(fake.tables.recommendation_requests.map((row) => row.id)).toEqual(['req-3']);
  });

  it('counts a person who is already gone as deleted', async () => {
    const { api } = setup();
    await expect(api.deleteRecommender('rec-9')).resolves.toBeUndefined();
  });

  it('reports a failure', async () => {
    const { api, fake } = setup();
    fake.failNext('recommenders', 'delete', { code: '42501', message: 'permission denied' });
    await expect(api.deleteRecommender('rec-1')).rejects.toMatchObject({ kind: 'permission' });
  });
});

describe('listRequests', () => {
  it('returns every request in one request', async () => {
    const { api, fake } = setup({
      recommendation_requests: [requestRow(), requestRow({ id: 'req-2', application_id: 'app-2' })],
    });
    const rows = await api.listRequests();
    expect(rows.map((row) => row.id)).toEqual(['req-1', 'req-2']);
    expect(fake.requests).toEqual(['select recommendation_requests']);
  });

  it('refuses a status it does not know', async () => {
    const { api } = setup({ recommendation_requests: [requestRow({ status: 'on_fire' })] });
    await expect(api.listRequests()).rejects.toMatchObject({ name: 'DataError', kind: 'unknown' });
  });
});

describe('createRequest', () => {
  const request = (overrides = {}) => ({
    recommender_id: 'rec-1',
    application_id: 'app-1',
    ...fields(),
    ...overrides,
  });

  it('keeps what was typed, exactly', async () => {
    const { api } = setup();
    const row = await api.createRequest(
      request({
        status: 'requested',
        requested_on: '2026-10-03',
        deadline: '2026-12-01',
        notes: 'In person',
      }),
    );
    expect(row).toMatchObject({
      recommender_id: 'rec-1',
      application_id: 'app-1',
      status: 'requested',
      requested_on: '2026-10-03',
      deadline: '2026-12-01',
      notes: 'In person',
    });
  });

  it('never sends who owns the row', async () => {
    const { api, fake } = setup();
    await api.createRequest(request());
    expect(fake.tables.recommendation_requests[0]).not.toHaveProperty('user_id');
  });

  it('allows a second letter from the same person for a different program', async () => {
    const { api, fake } = setup({ recommendation_requests: [requestRow()] });
    await api.createRequest(request({ application_id: 'app-2' }));
    expect(fake.tables.recommendation_requests).toHaveLength(2);
  });

  it('refuses a second request from the same person for the same program', async () => {
    const { api, fake } = setup({ recommendation_requests: [requestRow()] });
    const error = await api.createRequest(request()).catch((e: unknown) => e);
    expect(error).toMatchObject({ name: 'DataError', kind: 'conflict' });
    expect(fake.tables.recommendation_requests).toHaveLength(1);
  });

  it('refuses a person or a program that is not there', async () => {
    const { api } = setup();
    await expect(api.createRequest(request({ recommender_id: 'rec-9' }))).rejects.toMatchObject({
      kind: 'conflict',
    });
    await expect(api.createRequest(request({ application_id: 'app-9' }))).rejects.toMatchObject({
      kind: 'conflict',
    });
  });
});

describe('updateRequest', () => {
  it('saves the changes and leaves who and which program alone', async () => {
    const { api, fake } = setup({ recommendation_requests: [requestRow()] });
    const row = await api.updateRequest('req-1', fields({ status: 'confirmed', notes: 'Yes!' }));
    expect(row).toMatchObject({
      id: 'req-1',
      recommender_id: 'rec-1',
      application_id: 'app-1',
      status: 'confirmed',
      notes: 'Yes!',
    });
    expect(fake.tables.recommendation_requests[0]).toMatchObject({ status: 'confirmed' });
  });

  it('says so when the request is gone', async () => {
    const { api } = setup();
    await expect(api.updateRequest('req-9', fields())).rejects.toMatchObject({ kind: 'not_found' });
  });
});

describe('setRequestStatus', () => {
  it('changes only the status', async () => {
    const { api, fake } = setup({
      recommendation_requests: [requestRow({ notes: 'keep me', requested_on: '2026-10-01' })],
    });
    await api.setRequestStatus('req-1', 'submitted');
    expect(fake.tables.recommendation_requests[0]).toMatchObject({
      status: 'submitted',
      notes: 'keep me',
      requested_on: '2026-10-01',
    });
  });

  it('records the date asked in the same change when given one', async () => {
    const { api, fake } = setup({ recommendation_requests: [requestRow()] });
    await api.setRequestStatus('req-1', 'requested', '2026-10-05');
    expect(fake.tables.recommendation_requests[0]).toMatchObject({
      status: 'requested',
      requested_on: '2026-10-05',
    });
    expect(fake.requests.filter((r) => r === 'update recommendation_requests')).toHaveLength(1);
  });

  it('says so when the request is gone', async () => {
    const { api } = setup();
    await expect(api.setRequestStatus('req-9', 'submitted')).rejects.toMatchObject({
      kind: 'not_found',
    });
  });

  it('reports a lost connection as such', async () => {
    const { api, fake } = setup({ recommendation_requests: [requestRow()] });
    fake.failNext('recommendation_requests', 'update', {
      code: '',
      message: 'TypeError: Failed to fetch',
    });
    await expect(api.setRequestStatus('req-1', 'submitted')).rejects.toMatchObject({
      kind: 'network',
    });
  });
});

describe('deleteRequest', () => {
  it('deletes the request and keeps the person', async () => {
    const { api, fake } = setup({ recommendation_requests: [requestRow()] });
    await api.deleteRequest('req-1');
    expect(fake.tables.recommendation_requests).toHaveLength(0);
    expect(fake.tables.recommenders).toHaveLength(1);
  });

  it('counts a request that is already gone as deleted', async () => {
    const { api } = setup();
    await expect(api.deleteRequest('req-9')).resolves.toBeUndefined();
  });
});

describe('when a program is deleted', () => {
  it('its letter requests go with it, and the people stay', async () => {
    const { fake } = setup({
      recommendation_requests: [requestRow(), requestRow({ id: 'req-2', application_id: 'app-2' })],
    });
    await fake.client.from('applications').delete().eq('id', 'app-1');
    expect(fake.tables.recommendation_requests.map((row) => row.id)).toEqual(['req-2']);
    expect(fake.tables.recommenders).toHaveLength(1);
  });
});
