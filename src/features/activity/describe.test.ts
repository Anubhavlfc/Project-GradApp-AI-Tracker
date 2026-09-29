import { fakeActivity } from '@/test/fakeActivityApi';
import { APPLICATION_STATUSES } from '@/features/applications/status';
import { FUNDING_STATUSES } from '@/features/funding/kinds';
import { RECOMMENDATION_STATUSES } from '@/features/recommendations/statuses';
import { REQUIREMENT_KINDS, REQUIREMENT_STATUSES } from '@/features/requirements/kinds';
import { describeActivity } from './describe';
import { ACTIVITY_KINDS, isActivityKind } from './kinds';

const PROGRAM = 'Stanford University - MS Computer Science';

describe('describeActivity', () => {
  describe('a program', () => {
    it('is added: the program is the context, and it can be opened', () => {
      expect(
        describeActivity(
          fakeActivity({ kind: 'application_added', subject: PROGRAM, application_id: 'p1' }),
        ),
      ).toEqual({ headline: 'Added a program', context: PROGRAM, href: '/app/applications/p1' });
    });

    it('changes status: the new status is named', () => {
      expect(
        describeActivity(
          fakeActivity({
            kind: 'status_changed',
            subject: PROGRAM,
            detail: 'documents_in_progress',
            application_id: 'p1',
          }),
        ),
      ).toEqual({
        headline: 'Status changed to Documents In Progress',
        context: PROGRAM,
        href: '/app/applications/p1',
      });
    });

    it('has a word for every status it can have', () => {
      for (const { value, label } of APPLICATION_STATUSES) {
        expect(
          describeActivity(fakeActivity({ kind: 'status_changed', detail: value })).headline,
        ).toBe(`Status changed to ${label}`);
      }
    });

    it('still reads when the status is one we do not know, or missing', () => {
      for (const detail of ['not_a_status', null]) {
        expect(
          describeActivity(fakeActivity({ kind: 'status_changed', subject: PROGRAM, detail })),
        ).toMatchObject({ headline: 'Status changed', context: PROGRAM });
      }
    });

    it('is removed: there is nowhere to go, since it is gone', () => {
      expect(
        describeActivity(
          fakeActivity({ kind: 'application_removed', subject: PROGRAM, application_id: null }),
        ),
      ).toEqual({ headline: 'Removed a program', context: PROGRAM, href: null });
      // Even if a row somehow kept its link.
      expect(
        describeActivity(
          fakeActivity({ kind: 'application_removed', subject: PROGRAM, application_id: 'p1' }),
        ).href,
      ).toBeNull();
    });

    it('cannot be opened when the entry no longer points at a program', () => {
      expect(
        describeActivity(fakeActivity({ kind: 'status_changed', application_id: null })).href,
      ).toBeNull();
      expect(
        describeActivity(fakeActivity({ kind: 'application_added', application_id: null })).href,
      ).toBeNull();
    });
  });

  describe('a checklist item', () => {
    const entry = (overrides: Parameters<typeof fakeActivity>[0]) =>
      fakeActivity({
        kind: 'requirement_updated',
        subject: PROGRAM,
        application_id: 'p1',
        ...overrides,
      });

    it('is named by its type, and goes to the checklist', () => {
      expect(
        describeActivity(
          entry({ detail: 'complete', meta: { requirement: 'transcript', label: null } }),
        ),
      ).toEqual({
        headline: 'Transcript marked Complete',
        context: PROGRAM,
        href: '/app/applications/p1/requirements',
      });
    });

    it('is named by its own name when it has one', () => {
      expect(
        describeActivity(
          entry({
            detail: 'in_progress',
            meta: { requirement: 'supplemental_essay', label: 'Why Stanford' },
          }),
        ).headline,
      ).toBe('Why Stanford marked In Progress');
    });

    it('has a word for every type and every status', () => {
      for (const kind of REQUIREMENT_KINDS) {
        for (const status of REQUIREMENT_STATUSES) {
          expect(
            describeActivity(
              entry({ detail: status.value, meta: { requirement: kind.value, label: null } }),
            ).headline,
          ).toBe(`${kind.label} marked ${status.label}`);
        }
      }
    });

    it('still reads when the extra words are missing or wrong', () => {
      expect(describeActivity(entry({ detail: 'complete', meta: {} })).headline).toBe(
        'A checklist item marked Complete',
      );
      expect(
        describeActivity(entry({ detail: 'complete', meta: { requirement: 'not_a_kind' } }))
          .headline,
      ).toBe('A checklist item marked Complete');
      expect(
        describeActivity(entry({ detail: 'complete', meta: { requirement: 42, label: 7 } }))
          .headline,
      ).toBe('A checklist item marked Complete');
      expect(
        describeActivity(entry({ detail: 'mystery', meta: { requirement: 'gre', label: null } }))
          .headline,
      ).toBe('GRE updated');
      expect(
        describeActivity(entry({ detail: null, meta: { requirement: 'gre', label: '   ' } }))
          .headline,
      ).toBe('GRE updated');
    });
  });

  describe('a recommendation letter', () => {
    const entry = (overrides: Parameters<typeof fakeActivity>[0]) =>
      fakeActivity({
        kind: 'letter_updated',
        subject: PROGRAM,
        application_id: 'p1',
        ...overrides,
      });

    it('is named after the person, and goes to the letters', () => {
      expect(
        describeActivity(entry({ detail: 'requested', meta: { recommender: 'Dr. Lee' } })),
      ).toEqual({
        headline: 'Letter from Dr. Lee marked Requested',
        context: PROGRAM,
        href: '/app/applications/p1/recommendations',
      });
    });

    it('has a word for every status', () => {
      for (const { value, label } of RECOMMENDATION_STATUSES) {
        expect(
          describeActivity(entry({ detail: value, meta: { recommender: 'Dr. Lee' } })).headline,
        ).toBe(`Letter from Dr. Lee marked ${label}`);
      }
    });

    it('still reads without a name or with a status we do not know', () => {
      expect(describeActivity(entry({ detail: 'submitted', meta: {} })).headline).toBe(
        'A letter marked Submitted',
      );
      expect(
        describeActivity(entry({ detail: 'lost', meta: { recommender: 'Dr. Lee' } })).headline,
      ).toBe('Letter from Dr. Lee updated');
    });
  });

  describe('funding', () => {
    it('is named by the funding, with the program when it has one', () => {
      expect(
        describeActivity(
          fakeActivity({
            kind: 'funding_updated',
            subject: 'Knight-Hennessy',
            detail: 'applied',
            application_id: 'p1',
            meta: { program: PROGRAM },
          }),
        ),
      ).toEqual({
        headline: 'Knight-Hennessy marked Applied',
        context: PROGRAM,
        href: '/app/applications/p1/funding',
      });
    });

    it('goes to the Funding page when it belongs to no program', () => {
      expect(
        describeActivity(
          fakeActivity({
            kind: 'funding_updated',
            subject: 'Fulbright',
            detail: 'offered',
            application_id: null,
            meta: { program: null },
          }),
        ),
      ).toEqual({ headline: 'Fulbright marked Offered', context: null, href: '/app/funding' });
    });

    it('has a word for every status', () => {
      for (const { value, label } of FUNDING_STATUSES) {
        expect(
          describeActivity(fakeActivity({ kind: 'funding_updated', subject: 'X', detail: value }))
            .headline,
        ).toBe(`X marked ${label}`);
      }
    });

    it('still reads with a status we do not know', () => {
      expect(
        describeActivity(fakeActivity({ kind: 'funding_updated', subject: 'X', detail: 'lost' }))
          .headline,
      ).toBe('X updated');
    });
  });

  describe('a task', () => {
    it('is completed: named by its title, and goes to the program’s tasks', () => {
      expect(
        describeActivity(
          fakeActivity({
            kind: 'task_completed',
            subject: 'Email Prof. Lee',
            application_id: 'p1',
            meta: { program: PROGRAM },
          }),
        ),
      ).toEqual({
        headline: 'Completed “Email Prof. Lee”',
        context: PROGRAM,
        href: '/app/applications/p1/tasks',
      });
    });

    it('goes to the Tasks page when it belongs to no program', () => {
      expect(
        describeActivity(
          fakeActivity({
            kind: 'task_completed',
            subject: 'Renew passport',
            application_id: null,
            meta: { program: null },
          }),
        ),
      ).toEqual({
        headline: 'Completed “Renew passport”',
        context: null,
        href: '/app/tasks',
      });
    });
  });

  describe('a document', () => {
    it('is finished: named by its name, and goes to the library', () => {
      expect(
        describeActivity(
          fakeActivity({ kind: 'document_completed', subject: 'Resume, 2026', meta: {} }),
        ),
      ).toEqual({ headline: 'Finished “Resume, 2026”', context: null, href: '/app/documents' });
    });
  });

  describe('a kind from a later version of the app', () => {
    it('is worded by its subject, with nowhere to go', () => {
      expect(
        describeActivity(fakeActivity({ kind: 'something_new', subject: 'A new thing' })),
      ).toEqual({ headline: 'A new thing', context: null, href: null });
      expect(describeActivity(fakeActivity({ kind: 'something_new', subject: '' })).headline).toBe(
        'Something changed',
      );
    });
  });

  it('can word every kind the database can write', () => {
    for (const kind of ACTIVITY_KINDS) {
      const words = describeActivity(fakeActivity({ kind, subject: 'Subject', detail: null }));
      expect(words.headline.length).toBeGreaterThan(0);
    }
  });
});

describe('isActivityKind', () => {
  it('knows the kinds the database can write, and nothing else', () => {
    for (const kind of ACTIVITY_KINDS) expect(isActivityKind(kind)).toBe(true);
    expect(isActivityKind('something_new')).toBe(false);
    expect(isActivityKind('')).toBe(false);
  });
});
