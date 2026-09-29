import { fakeRecord } from '@/test/fakeApplicationsApi';
import { fakeRecommender, fakeRequest } from '@/test/fakeRecommendationsApi';
import { permutations } from '@/test/permutations';
import type { ApplicationStatus } from '@/features/applications/status';
import type { Completion } from '@/features/requirements/progress';
import {
  LETTER_WARNING_DAYS,
  letterProgress,
  lettersNeedingAttention,
  overallProgress,
  programsToPrepare,
} from './logic';

const TODAY = '2026-10-15';

const program = (
  id: string,
  overrides: Parameters<typeof fakeRecord>[0] = {},
): ReturnType<typeof fakeRecord> =>
  fakeRecord({
    id,
    university: { name: `University ${id}` },
    program_name: 'Computer Science',
    status: 'application_started',
    ...overrides,
  });

const completion = (done: number, total: number): Completion => ({
  done,
  total,
  percent: total === 0 ? null : Math.round((done / total) * 100),
  inProgress: 0,
  notStarted: total - done,
  optional: 0,
});

describe('programsToPrepare', () => {
  it('leaves out programs that are sent, decided or withdrawn', () => {
    const closed: ApplicationStatus[] = [
      'submitted',
      'interview',
      'waitlisted',
      'accepted',
      'rejected',
      'withdrawn',
    ];
    const open: ApplicationStatus[] = [
      'researching',
      'shortlisted',
      'planning_to_apply',
      'application_started',
      'documents_in_progress',
      'ready_to_submit',
    ];
    const records = [...closed, ...open].map((status) => program(status, { status }));
    expect(
      programsToPrepare(records)
        .map((record) => record.id)
        .sort(),
    ).toEqual([...open].sort());
  });

  it('lists the soonest deadline first, a missed one leading, and programs with none last', () => {
    const records = [
      program('none'),
      program('later', { deadline: '2026-12-01' }),
      program('missed', { deadline: '2026-09-01' }),
      program('soon', { deadline: '2026-10-20' }),
    ];
    expect(programsToPrepare(records).map((record) => record.id)).toEqual([
      'missed',
      'soon',
      'later',
      'none',
    ]);
  });

  it('goes by name, then by id, when deadlines are the same', () => {
    const records = [
      program('b', { deadline: '2026-11-01', university: { name: 'Zeta' } }),
      program('a2', { deadline: '2026-11-01', university: { name: 'Alpha' } }),
      program('a10', { deadline: '2026-11-01', university: { name: 'Alpha' } }),
    ];
    const ids = (list: typeof records) => list.map((record) => record.id);
    // 'a2' before 'a10': ids are compared as numbers-in-text, like names.
    expect(ids(programsToPrepare(records))).toEqual(['a2', 'a10', 'b']);
    for (const order of permutations(records)) {
      expect(ids(programsToPrepare(order))).toEqual(['a2', 'a10', 'b']);
    }
  });

  it('does not change the list it was given', () => {
    const records = [
      program('b', { deadline: '2026-12-01' }),
      program('a', { deadline: '2026-11-01' }),
    ];
    programsToPrepare(records);
    expect(records.map((record) => record.id)).toEqual(['b', 'a']);
  });

  it('has nothing to list for no programs', () => {
    expect(programsToPrepare([])).toEqual([]);
  });
});

describe('overallProgress', () => {
  it('adds up the required items of the programs still to prepare', () => {
    const records = [program('a'), program('b')];
    const completions = new Map([
      ['a', completion(3, 8)],
      ['b', completion(5, 12)],
    ]);
    expect(overallProgress(records, completions)).toEqual({
      done: 8,
      total: 20,
      percent: 40,
      programs: 2,
    });
  });

  it('leaves out programs that have been sent: their lists say nothing about the work ahead', () => {
    const records = [program('open'), program('sent', { status: 'submitted' })];
    const completions = new Map([
      ['open', completion(1, 4)],
      ['sent', completion(9, 9)],
    ]);
    expect(overallProgress(records, completions)).toMatchObject({ done: 1, total: 4, programs: 1 });
  });

  it('leaves out programs with no checklist, or nothing required on it', () => {
    const records = [program('none'), program('optional'), program('real')];
    const completions = new Map([
      ['optional', completion(0, 0)],
      ['real', completion(2, 5)],
    ]);
    expect(overallProgress(records, completions)).toMatchObject({ done: 2, total: 5, programs: 1 });
  });

  it('has no percentage until some program has a required item', () => {
    expect(overallProgress([program('a')], new Map())).toEqual({
      done: 0,
      total: 0,
      percent: null,
      programs: 0,
    });
    expect(overallProgress([], new Map())).toMatchObject({ percent: null, programs: 0 });
  });

  it('never claims more than is true', () => {
    const records = [program('a')];
    expect(overallProgress(records, new Map([['a', completion(199, 200)]])).percent).toBe(99);
    expect(overallProgress(records, new Map([['a', completion(1, 300)]])).percent).toBe(1);
    expect(overallProgress(records, new Map([['a', completion(5, 5)]])).percent).toBe(100);
  });
});

describe('lettersNeedingAttention', () => {
  const ada = fakeRecommender({ id: 'ada', name: 'Dr. Ada' });
  const bob = fakeRecommender({ id: 'bob', name: 'Prof. Bob' });
  const run = (
    requests: ReturnType<typeof fakeRequest>[],
    records = [program('p1')],
    recommenders = [ada, bob],
  ) => lettersNeedingAttention({ records, recommenders, requests, today: TODAY });
  const request = (overrides: Parameters<typeof fakeRequest>[0]) =>
    fakeRequest({ recommender_id: 'ada', application_id: 'p1', ...overrides });

  it('lists a letter that is late, due today, or due within two weeks', () => {
    const found = run([
      request({ id: 'late', deadline: '2026-10-10' }),
      request({ id: 'today', deadline: '2026-10-15', recommender_id: 'bob' }),
      request({ id: 'soon', deadline: '2026-10-29' }),
    ]);
    expect(LETTER_WARNING_DAYS).toBe(14);
    expect(found.map((warning) => warning.request.id)).toEqual(['late', 'today', 'soon']);
  });

  it('does not list a letter that is not close', () => {
    expect(run([request({ deadline: '2026-10-30' })])).toEqual([]); // 15 days away
  });

  it('does not list a letter that has been sent, however late its date', () => {
    expect(run([request({ status: 'submitted', deadline: '2026-10-01' })])).toEqual([]);
  });

  it('does not list letters of a program that has been sent, decided or withdrawn', () => {
    for (const status of ['submitted', 'accepted', 'rejected', 'withdrawn'] as const) {
      const records = [program('p1', { status })];
      expect(
        run([request({ deadline: '2026-10-10', status: 'needs_follow_up' })], records),
      ).toEqual([]);
    }
  });

  it('does not list a letter for a program that is not there', () => {
    expect(run([request({ application_id: 'gone', deadline: '2026-10-10' })])).toEqual([]);
  });

  it('lists a letter marked Needs Follow-Up whatever its date, even with none', () => {
    const found = run([
      request({ id: 'far', status: 'needs_follow_up', deadline: '2026-12-25' }),
      request({ id: 'undated', status: 'needs_follow_up', deadline: null, recommender_id: 'bob' }),
    ]);
    expect(found.map((warning) => warning.request.id)).toEqual(['far', 'undated']);
  });

  it('does not list a letter with no date that nobody has flagged', () => {
    expect(run([request({ deadline: null, status: 'requested' })])).toEqual([]);
  });

  it('most urgent first, and a letter with no date after those that have one', () => {
    const found = run([
      request({ id: 'undated', status: 'needs_follow_up', deadline: null }),
      request({ id: 'soon', deadline: '2026-10-20', recommender_id: 'bob' }),
      request({ id: 'late', deadline: '2026-10-05', recommender_id: 'bob' }),
    ]);
    expect(found.map((warning) => warning.request.id)).toEqual(['late', 'soon', 'undated']);
  });

  it('goes by the person’s name, then by id, on the same day, whatever order they arrive in', () => {
    const requests = [
      request({ id: 'r2', deadline: '2026-10-20', recommender_id: 'bob' }),
      request({ id: 'r1', deadline: '2026-10-20', recommender_id: 'ada' }),
      request({ id: 'r3', deadline: '2026-10-20', recommender_id: 'ada' }),
    ];
    for (const order of permutations(requests)) {
      expect(run(order).map((warning) => warning.request.id)).toEqual(['r1', 'r3', 'r2']);
    }
  });

  it('says who and which program, and how the date stands', () => {
    const [warning] = run([request({ id: 'late', deadline: '2026-10-10' })]);
    expect(warning?.recommender?.name).toBe('Dr. Ada');
    expect(warning?.record.id).toBe('p1');
    expect(warning?.info).toMatchObject({ state: 'overdue', days: -5, text: '5 days overdue' });
  });

  it('still lists a letter whose person is not in the list, unnamed', () => {
    const [warning] = run([request({ recommender_id: 'unknown', deadline: '2026-10-20' })]);
    expect(warning?.recommender).toBeNull();
  });
});

describe('letterProgress', () => {
  it('counts the letters of the programs still to prepare', () => {
    const records = [program('open'), program('sent', { status: 'submitted' })];
    const requests = [
      fakeRequest({ application_id: 'open', status: 'submitted' }),
      fakeRequest({ application_id: 'open', status: 'requested' }),
      fakeRequest({ application_id: 'open', status: 'needs_follow_up' }),
      fakeRequest({ application_id: 'sent', status: 'submitted' }),
      fakeRequest({ application_id: 'gone', status: 'submitted' }),
    ];
    expect(letterProgress(records, requests)).toEqual({
      total: 3,
      submitted: 1,
      needsFollowUp: 1,
    });
  });

  it('is empty without letters', () => {
    expect(letterProgress([program('open')], [])).toEqual({
      total: 0,
      submitted: 0,
      needsFollowUp: 0,
    });
  });
});
