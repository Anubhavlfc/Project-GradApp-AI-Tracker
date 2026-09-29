import { fakeRecommender, fakeRequest } from '@/test/fakeRecommendationsApi';
import {
  emptyRecommenderValues,
  emptyRequestValues,
  NEW_RECOMMENDER,
  recommenderFormSchema,
  recommenderValuesFromRow,
  requestFormSchema,
  requestValuesFromRow,
} from './form';

function errorsOf(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  if (result.success || !result.error) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
  );
}

describe('recommenderFormSchema', () => {
  it('needs a name and nothing else', () => {
    expect(recommenderFormSchema.parse({ ...emptyRecommenderValues(), name: 'Dr. Lee' })).toEqual({
      name: 'Dr. Lee',
      title: null,
      institution: null,
      email: null,
      notes: null,
    });
    expect(errorsOf(recommenderFormSchema.safeParse(emptyRecommenderValues()))).toEqual({
      name: "Enter the recommender's name.",
    });
  });

  it('tidies what was typed', () => {
    const result = recommenderFormSchema.parse({
      name: '  Dr.   Jane   Lee ',
      title: ' Professor ',
      institution: 'MIT',
      email: ' jane@mit.edu ',
      notes: 'Knows me from CS 101\r\nTeaches on Tuesdays',
    });
    expect(result).toEqual({
      name: 'Dr. Jane Lee',
      title: 'Professor',
      institution: 'MIT',
      email: 'jane@mit.edu',
      notes: 'Knows me from CS 101\nTeaches on Tuesdays',
    });
  });

  it.each(['jane', 'jane@', '@mit.edu', 'jane@mit', 'jane lee@mit.edu', 'a@b@c.edu'])(
    'refuses %j as an email address',
    (email) => {
      const errors = errorsOf(recommenderFormSchema.safeParse({ name: 'Jane', email }));
      expect(errors.email).toBe('Enter an email address, like name@university.edu.');
    },
  );

  it('refuses an over-long email and over-long text', () => {
    const long = `${'a'.repeat(250)}@mit.edu`;
    expect(
      errorsOf(recommenderFormSchema.safeParse({ name: 'Jane', email: long })).email,
    ).toBeDefined();
    expect(errorsOf(recommenderFormSchema.safeParse({ name: 'x'.repeat(201) })).name).toBe(
      'Name must be 200 characters or fewer.',
    );
  });

  it('round-trips a saved row', () => {
    const row = fakeRecommender({ name: 'Dr. Lee', title: 'Professor', email: 'lee@mit.edu' });
    const values = recommenderValuesFromRow(row);
    expect(values).toEqual({
      name: 'Dr. Lee',
      title: 'Professor',
      institution: '',
      email: 'lee@mit.edu',
      notes: '',
    });
    expect(recommenderFormSchema.parse(values)).toMatchObject({
      name: 'Dr. Lee',
      institution: null,
    });
  });
});

describe('requestFormSchema', () => {
  const submitted = (overrides: Record<string, string> = {}) => ({
    recommender_id: 'recommender-1',
    application_id: 'application-1',
    ...emptyRequestValues(),
    ...overrides,
  });

  it('accepts a request from someone on the list', () => {
    expect(requestFormSchema.parse(submitted())).toEqual({
      writer: { kind: 'existing', recommenderId: 'recommender-1' },
      applicationId: 'application-1',
      fields: { status: 'not_requested', requested_on: null, deadline: null, notes: null },
    });
  });

  it('keeps the dates and notes', () => {
    const result = requestFormSchema.parse(
      submitted({
        status: 'requested',
        requested_on: '2026-10-03',
        deadline: '2026-12-01',
        notes: 'Asked in person',
      }),
    );
    expect(result.fields).toEqual({
      status: 'requested',
      requested_on: '2026-10-03',
      deadline: '2026-12-01',
      notes: 'Asked in person',
    });
  });

  it('asks who is writing and for which program', () => {
    const errors = errorsOf(
      requestFormSchema.safeParse(submitted({ recommender_id: '', application_id: '' })),
    );
    expect(errors).toEqual({
      recommender_id: 'Choose who is writing the letter.',
      application_id: 'Choose a program.',
    });
  });

  it('takes a new recommender from the extra fields', () => {
    const result = requestFormSchema.parse(
      submitted({
        recommender_id: NEW_RECOMMENDER,
        new_name: '  Dr. Sam   Ortiz ',
        new_title: 'Lecturer',
        new_email: 'sam@uw.edu',
      }),
    );
    expect(result.writer).toEqual({
      kind: 'new',
      fields: {
        name: 'Dr. Sam Ortiz',
        title: 'Lecturer',
        institution: null,
        email: 'sam@uw.edu',
        notes: null,
      },
    });
  });

  it('reports a problem with the new person on their own fields', () => {
    const errors = errorsOf(
      requestFormSchema.safeParse(
        submitted({ recommender_id: NEW_RECOMMENDER, new_name: '', new_email: 'nope' }),
      ),
    );
    expect(errors).toEqual({
      new_name: "Enter the recommender's name.",
      new_email: 'Enter an email address, like name@university.edu.',
    });
  });

  it('ignores the new-person fields when someone from the list is chosen', () => {
    const result = requestFormSchema.parse(submitted({ new_name: 'Leftover', new_email: 'bad' }));
    expect(result.writer).toEqual({ kind: 'existing', recommenderId: 'recommender-1' });
  });

  it('refuses an impossible date and an unknown status', () => {
    const errors = errorsOf(
      requestFormSchema.safeParse(
        submitted({ status: 'on_fire', requested_on: '2026-02-30', deadline: '0026-12-01' }),
      ),
    );
    expect(errors.status).toBe('Choose a status.');
    expect(errors.requested_on).toBe('Enter a valid date.');
    expect(errors.deadline).toBeDefined();
  });

  it('round-trips a saved request', () => {
    const row = fakeRequest({
      status: 'confirmed',
      requested_on: '2026-10-03',
      deadline: '2026-12-01',
    });
    expect(requestValuesFromRow(row)).toEqual({
      status: 'confirmed',
      requested_on: '2026-10-03',
      deadline: '2026-12-01',
      notes: '',
    });
  });
});
