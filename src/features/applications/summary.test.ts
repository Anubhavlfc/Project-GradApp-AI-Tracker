import { APPLICATION_STATUSES } from './status';
import { summarizeStatuses } from './summary';

const counts = (statuses: (typeof APPLICATION_STATUSES)[number]['value'][]) =>
  Object.fromEntries(
    summarizeStatuses(statuses.map((status) => ({ status }))).groups.map((g) => [g.label, g.count]),
  );

describe('summarizeStatuses', () => {
  it('counts nothing for an empty list', () => {
    const summary = summarizeStatuses([]);
    expect(summary.total).toBe(0);
    expect(summary.withdrawn).toBe(0);
    expect(summary.groups.every((group) => group.count === 0)).toBe(true);
  });

  it('groups statuses the way the dashboard shows them', () => {
    expect(
      counts([
        'researching',
        'shortlisted',
        'planning_to_apply',
        'application_started',
        'documents_in_progress',
        'ready_to_submit',
        'submitted',
        'submitted',
        'interview',
        'accepted',
        'waitlisted',
        'rejected',
        'rejected',
        'rejected',
      ]),
    ).toEqual({
      'Not started': 3,
      'In progress': 3,
      Submitted: 2,
      Interviews: 1,
      Accepted: 1,
      Waitlisted: 1,
      Rejected: 3,
    });
  });

  it('counts withdrawn programs in the total, and says how many there are, but in no group', () => {
    const summary = summarizeStatuses([
      { status: 'withdrawn' },
      { status: 'withdrawn' },
      { status: 'researching' },
    ]);
    expect(summary.total).toBe(3);
    expect(summary.withdrawn).toBe(2);
    expect(summary.groups.reduce((sum, group) => sum + group.count, 0)).toBe(1);
  });

  it('has no withdrawn programs unless one was withdrawn', () => {
    expect(summarizeStatuses([{ status: 'submitted' }, { status: 'rejected' }]).withdrawn).toBe(0);
  });

  it('places every status in at most one group', () => {
    for (const { value } of APPLICATION_STATUSES) {
      const total = summarizeStatuses([{ status: value }]).groups.reduce((s, g) => s + g.count, 0);
      expect(total).toBe(value === 'withdrawn' ? 0 : 1);
    }
  });
});
