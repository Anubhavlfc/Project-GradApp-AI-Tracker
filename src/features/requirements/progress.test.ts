import { daysFromNow } from '@/test/fakeApplicationsApi';
import { fakeRequirement } from '@/test/fakeRequirementsApi';
import { COMMON_REQUIREMENTS } from './kinds';
import {
  completionsByApplication,
  hasRequirement,
  nextLetterLabel,
  requirementDue,
  requirementSubtitle,
  requirementTitle,
  sortRequirements,
  summarize,
} from './progress';

const required = (status: Parameters<typeof fakeRequirement>[0] & object) =>
  fakeRequirement({ is_required: true, ...status });

describe('summarize', () => {
  it('counts complete and submitted required items as done', () => {
    const result = summarize([
      required({ status: 'complete' }),
      required({ status: 'submitted' }),
      required({ status: 'in_progress' }),
      required({ status: 'not_started' }),
    ]);
    expect(result).toMatchObject({ done: 2, total: 4, percent: 50, inProgress: 1, notStarted: 1 });
  });

  it('leaves optional items out of the percentage and counts them separately', () => {
    const result = summarize([
      required({ status: 'complete' }),
      fakeRequirement({ is_required: false, status: 'not_started' }),
      fakeRequirement({ is_required: false, status: 'complete' }),
    ]);
    expect(result).toMatchObject({ done: 1, total: 1, percent: 100, optional: 2 });
  });

  it('rounds to a whole percent: 8 of 11 is 73%', () => {
    const rows = [
      ...Array.from({ length: 8 }, () => required({ status: 'complete' })),
      ...Array.from({ length: 3 }, () => required({ status: 'not_started' })),
    ];
    expect(summarize(rows)).toMatchObject({ done: 8, total: 11, percent: 73 });
  });

  it('has no percentage when nothing is required yet', () => {
    expect(summarize([])).toEqual({
      done: 0,
      total: 0,
      percent: null,
      inProgress: 0,
      notStarted: 0,
      optional: 0,
    });
    expect(summarize([fakeRequirement({ is_required: false })])).toMatchObject({
      total: 0,
      percent: null,
      optional: 1,
    });
  });

  it('never rounds up to 100% while something is left, or down to 0% once something is done', () => {
    const almost = [
      ...Array.from({ length: 199 }, () => required({ status: 'complete' })),
      required({ status: 'not_started' }),
    ];
    expect(summarize(almost).percent).toBe(99);
    const barely = [
      required({ status: 'complete' }),
      ...Array.from({ length: 299 }, () => required({ status: 'not_started' })),
    ];
    expect(summarize(barely).percent).toBe(1);
    expect(summarize([required({ status: 'not_started' })]).percent).toBe(0);
  });
});

describe('completionsByApplication', () => {
  it('summarises each program separately and leaves out programs with no items', () => {
    const map = completionsByApplication([
      required({ application_id: 'a', status: 'complete' }),
      required({ application_id: 'a', status: 'not_started' }),
      required({ application_id: 'b', status: 'complete' }),
    ]);
    expect(map.get('a')).toMatchObject({ done: 1, total: 2, percent: 50 });
    expect(map.get('b')).toMatchObject({ done: 1, total: 1, percent: 100 });
    expect(map.has('c')).toBe(false);
  });
});

describe('names', () => {
  it('uses the kind as the name unless the item has its own', () => {
    expect(requirementTitle(fakeRequirement({ kind: 'transcript', label: null }))).toBe(
      'Transcript',
    );
    expect(requirementTitle(fakeRequirement({ kind: 'transcript', label: '   ' }))).toBe(
      'Transcript',
    );
    expect(
      requirementTitle(fakeRequirement({ kind: 'supplemental_essay', label: 'Why Stanford' })),
    ).toBe('Why Stanford');
  });

  it('shows the kind under a custom name, unless the name already says it', () => {
    expect(
      requirementSubtitle(fakeRequirement({ kind: 'supplemental_essay', label: 'Why Stanford' })),
    ).toBe('Supplemental Essay');
    expect(requirementSubtitle(fakeRequirement({ kind: 'transcript', label: null }))).toBeNull();
    expect(
      requirementSubtitle(
        fakeRequirement({ kind: 'recommendation_letter', label: 'Recommendation Letter 2' }),
      ),
    ).toBeNull();
    expect(
      requirementSubtitle(fakeRequirement({ kind: 'transcript', label: 'transcript: State U' })),
    ).toBeNull();
  });

  it('suggests the next free letter number', () => {
    const letter = (label: string) => fakeRequirement({ kind: 'recommendation_letter', label });
    expect(nextLetterLabel([])).toBe('Recommendation Letter 1');
    expect(nextLetterLabel([letter('Recommendation Letter 1')])).toBe('Recommendation Letter 2');
    // A gap left by a deleted letter is filled before a new number is used.
    expect(
      nextLetterLabel([letter('Recommendation Letter 1'), letter('Recommendation Letter 3')]),
    ).toBe('Recommendation Letter 2');
    expect(nextLetterLabel([letter('Letter from Prof. Chen')])).toBe('Recommendation Letter 1');
  });
});

describe('hasRequirement', () => {
  it('finds an item already on the list by kind and name, ignoring capitals', () => {
    const rows = [
      fakeRequirement({ kind: 'transcript', label: null }),
      fakeRequirement({ kind: 'recommendation_letter', label: 'recommendation letter 2' }),
    ];
    const item = (id: string) => COMMON_REQUIREMENTS.find((common) => common.id === id)!;
    expect(hasRequirement(rows, item('transcript'))).toBe(true);
    expect(hasRequirement(rows, item('recommendation_letter_2'))).toBe(true);
    expect(hasRequirement(rows, item('recommendation_letter_1'))).toBe(false);
    expect(hasRequirement(rows, item('gre'))).toBe(false);
  });
});

describe('sortRequirements', () => {
  it('keeps a checklist in the order of the kinds, then by name, then by when it was added', () => {
    const rows = [
      fakeRequirement({ id: 'fee', kind: 'application_fee' }),
      fakeRequirement({
        id: 'l10',
        kind: 'recommendation_letter',
        label: 'Recommendation Letter 10',
      }),
      fakeRequirement({
        id: 'l2',
        kind: 'recommendation_letter',
        label: 'Recommendation Letter 2',
      }),
      fakeRequirement({ id: 'cv', kind: 'resume_cv' }),
      fakeRequirement({
        id: 'e2',
        kind: 'supplemental_essay',
        label: 'Essay',
        created_at: '2026-09-02T00:00:00+00:00',
      }),
      fakeRequirement({
        id: 'e1',
        kind: 'supplemental_essay',
        label: 'Essay',
        created_at: '2026-09-01T00:00:00+00:00',
      }),
    ];
    expect(sortRequirements(rows).map((row) => row.id)).toEqual([
      'cv',
      'e1',
      'e2',
      'l2',
      'l10',
      'fee',
    ]);
  });

  it('does not change the list it is given', () => {
    const rows = [
      fakeRequirement({ kind: 'application_fee' }),
      fakeRequirement({ kind: 'resume_cv' }),
    ];
    const before = rows.map((row) => row.id);
    sortRequirements(rows);
    expect(rows.map((row) => row.id)).toEqual(before);
  });
});

describe('requirementDue', () => {
  const today = daysFromNow(0);

  it('says nothing when there is no due date', () => {
    expect(
      requirementDue(fakeRequirement({ due_date: null }), 'application_started', today),
    ).toMatchObject({
      state: 'none',
      text: null,
    });
  });

  it('warns about open items that are due soon or overdue', () => {
    const soon = requirementDue(
      fakeRequirement({ due_date: daysFromNow(3), status: 'in_progress' }),
      'application_started',
      today,
    );
    expect(soon).toMatchObject({ state: 'soon', text: 'In 3 days', tone: 'amber' });
    const late = requirementDue(
      fakeRequirement({ due_date: daysFromNow(-2), status: 'not_started' }),
      'application_started',
      today,
    );
    expect(late).toMatchObject({ state: 'overdue', text: '2 days overdue', tone: 'red' });
  });

  it('never calls a finished item overdue', () => {
    for (const status of ['complete', 'submitted'] as const) {
      expect(
        requirementDue(
          fakeRequirement({ due_date: daysFromNow(-9), status }),
          'application_started',
          today,
        ),
      ).toMatchObject({ state: 'closed', text: null });
    }
  });

  it('never calls an item overdue once the application itself has been sent', () => {
    expect(
      requirementDue(
        fakeRequirement({ due_date: daysFromNow(-9), status: 'not_started' }),
        'submitted',
        today,
      ),
    ).toMatchObject({ state: 'closed', text: null });
  });
});
