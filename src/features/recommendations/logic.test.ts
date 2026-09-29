import { fakeRecommender, fakeRequest } from '@/test/fakeRecommendationsApi';
import {
  describeLetters,
  groupByRecommender,
  recommenderSubtitle,
  requestDue,
  sortRecommenders,
  sortRequests,
  summarizeRequests,
} from './logic';

const TODAY = '2026-10-01';

describe('recommenderSubtitle', () => {
  it('joins what they do and where', () => {
    expect(recommenderSubtitle({ title: 'Associate Professor', institution: 'MIT' })).toBe(
      'Associate Professor · MIT',
    );
  });

  it('shows whichever of the two is known', () => {
    expect(recommenderSubtitle({ title: 'Manager', institution: null })).toBe('Manager');
    expect(recommenderSubtitle({ title: null, institution: 'Acme Corp' })).toBe('Acme Corp');
  });

  it('is null when neither is known, blanks included', () => {
    expect(recommenderSubtitle({ title: null, institution: null })).toBeNull();
    expect(recommenderSubtitle({ title: '  ', institution: '' })).toBeNull();
  });
});

describe('summarizeRequests', () => {
  it('counts the letters, the ones sent, and the ones to chase', () => {
    const summary = summarizeRequests([
      { status: 'not_requested' },
      { status: 'requested' },
      { status: 'confirmed' },
      { status: 'submitted' },
      { status: 'submitted' },
      { status: 'needs_follow_up' },
    ]);
    expect(summary).toEqual({ total: 6, submitted: 2, needsFollowUp: 1 });
  });

  it('is all zeros for no letters', () => {
    expect(summarizeRequests([])).toEqual({ total: 0, submitted: 0, needsFollowUp: 0 });
  });
});

describe('describeLetters', () => {
  it('says so when nothing has been requested', () => {
    expect(describeLetters({ total: 0, submitted: 0, needsFollowUp: 0 })).toBe(
      'No letters requested',
    );
  });

  it('uses the singular for one letter', () => {
    expect(describeLetters({ total: 1, submitted: 0, needsFollowUp: 0 })).toBe('1 letter');
  });

  it('adds what has been sent and what needs chasing, only when there is any', () => {
    expect(describeLetters({ total: 3, submitted: 1, needsFollowUp: 1 })).toBe(
      '3 letters · 1 submitted · 1 to follow up',
    );
    expect(describeLetters({ total: 2, submitted: 2, needsFollowUp: 0 })).toBe(
      '2 letters · 2 submitted',
    );
  });
});

describe('requestDue', () => {
  it('has nothing to say without a deadline', () => {
    expect(requestDue({ deadline: null, status: 'requested' }, 'researching', TODAY)).toMatchObject(
      { state: 'none', text: null },
    );
  });

  it('warns as the deadline nears, and when it has passed', () => {
    const soon = requestDue({ deadline: '2026-10-04', status: 'requested' }, 'researching', TODAY);
    expect(soon).toMatchObject({ state: 'soon', text: 'In 3 days', tone: 'amber' });
    const late = requestDue({ deadline: '2026-09-28', status: 'requested' }, 'researching', TODAY);
    expect(late).toMatchObject({ state: 'overdue', text: '3 days overdue', tone: 'red' });
  });

  it('never calls a submitted letter overdue', () => {
    const due = requestDue({ deadline: '2026-09-01', status: 'submitted' }, 'researching', TODAY);
    expect(due).toMatchObject({ state: 'closed', text: null, tone: 'neutral' });
  });

  it('never calls a letter overdue once the program is sent, decided or withdrawn', () => {
    for (const programStatus of ['submitted', 'interview', 'accepted', 'rejected', 'withdrawn']) {
      const due = requestDue(
        { deadline: '2026-09-01', status: 'requested' },
        programStatus as 'submitted',
        TODAY,
      );
      expect(due.state).toBe('closed');
    }
  });

  it('still warns about a letter that needs following up', () => {
    const due = requestDue(
      { deadline: '2026-09-30', status: 'needs_follow_up' },
      'documents_in_progress',
      TODAY,
    );
    expect(due).toMatchObject({ state: 'overdue', tone: 'red' });
  });
});

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [
      item,
      ...rest,
    ]),
  );
}

describe('sortRecommenders', () => {
  it('puts people in alphabetical order, ignoring capitals', () => {
    const people = [
      fakeRecommender({ name: 'zhang Wei' }),
      fakeRecommender({ name: 'Alvarez, Ana' }),
      fakeRecommender({ name: 'brown, Ben' }),
    ];
    expect(sortRecommenders(people).map((person) => person.name)).toEqual([
      'Alvarez, Ana',
      'brown, Ben',
      'zhang Wei',
    ]);
  });

  it('gives the same order whatever order the people arrive in', () => {
    const expected = ['Abe', 'bea', 'Cy', 'Di'].map((name) => fakeRecommender({ name }));
    for (const arrival of permutations(expected)) {
      expect(sortRecommenders(arrival)).toEqual(expected);
    }
  });

  it('counts numbers as numbers', () => {
    const people = [fakeRecommender({ name: 'Mentor 10' }), fakeRecommender({ name: 'Mentor 2' })];
    expect(sortRecommenders(people).map((person) => person.name)).toEqual([
      'Mentor 2',
      'Mentor 10',
    ]);
  });

  it('keeps the older entry first among people with the same name, and does not touch its input', () => {
    const newer = fakeRecommender({ name: 'Pat', created_at: '2026-09-02T00:00:00+00:00' });
    const older = fakeRecommender({ name: 'Pat', created_at: '2026-09-01T00:00:00+00:00' });
    const input = [newer, older];
    expect(sortRecommenders(input)).toEqual([older, newer]);
    expect(input).toEqual([newer, older]);
  });
});

describe('sortRequests', () => {
  const nameOf = (names: Record<string, string>) => (row: { recommender_id: string }) =>
    names[row.recommender_id] ?? '';

  it('puts the soonest deadline first, and letters without a deadline last', () => {
    const none = fakeRequest({ deadline: null });
    const december = fakeRequest({ deadline: '2026-12-01' });
    const november = fakeRequest({ deadline: '2026-11-15' });
    expect(sortRequests([none, december, november], () => '')).toEqual([november, december, none]);
  });

  it('gives the same order whatever order the letters arrive in', () => {
    const expected = [
      fakeRequest({ recommender_id: 'a', deadline: '2026-11-15' }),
      fakeRequest({ recommender_id: 'b', deadline: '2026-12-01' }),
      fakeRequest({ recommender_id: 'c', deadline: null }),
      fakeRequest({ recommender_id: 'd', deadline: null }),
    ];
    const names = { a: 'Abe', b: 'Bea', c: 'Cy', d: 'Di' } as Record<string, string>;
    for (const arrival of permutations(expected)) {
      expect(sortRequests(arrival, (row) => names[row.recommender_id]!)).toEqual(expected);
    }
  });

  it('breaks ties by the writer’s name, then by when the request was added', () => {
    const bea = fakeRequest({ recommender_id: 'b', deadline: '2026-12-01' });
    const abe = fakeRequest({ recommender_id: 'a', deadline: '2026-12-01' });
    const abeTwin = fakeRequest({
      recommender_id: 'a',
      deadline: '2026-12-01',
      created_at: '2026-09-05T00:00:00+00:00',
    });
    const sorted = sortRequests([bea, abeTwin, abe], nameOf({ a: 'Abe', b: 'Bea' }));
    expect(sorted).toEqual([abe, abeTwin, bea]);
  });
});

describe('groupByRecommender', () => {
  it('groups letters by writer, each group in deadline order', () => {
    const late = fakeRequest({ recommender_id: 'a', deadline: '2026-12-15' });
    const early = fakeRequest({ recommender_id: 'a', deadline: '2026-11-01' });
    const other = fakeRequest({ recommender_id: 'b', deadline: null });
    const groups = groupByRecommender([late, other, early], () => '');
    expect(groups.get('a')).toEqual([early, late]);
    expect(groups.get('b')).toEqual([other]);
    expect(groups.get('c')).toBeUndefined();
  });
});
