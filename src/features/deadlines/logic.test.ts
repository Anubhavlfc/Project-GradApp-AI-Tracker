import { APPLICATION_STATUSES, type ApplicationStatus } from '@/features/applications/status';
import type { ApplicationRecord } from '@/features/applications/types';
import { fakeRecord } from '@/test/fakeApplicationsApi';
import { fakeFunding } from '@/test/fakeFundingApi';
import { fakeRecommender, fakeRequest } from '@/test/fakeRecommendationsApi';
import { fakeRequirement } from '@/test/fakeRequirementsApi';
import { fakeTask } from '@/test/fakeTasksApi';
import { permutations } from '@/test/permutations';
import {
  collectDeadlines,
  compareDeadlines,
  countDeadlines,
  DEADLINE_GROUPS,
  describeDeadlineCounts,
  groupDeadlines,
  groupKeyOf,
  isOpenDeadline,
  MONTH_DAYS,
  WEEK_DAYS,
  type DeadlineInputs,
  type DeadlineItem,
} from './logic';

const today = '2026-12-01';

const program = (overrides: Parameters<typeof fakeRecord>[0] = {}) =>
  fakeRecord({
    university: { name: 'Stanford University' },
    program_name: 'MS Computer Science',
    status: 'application_started',
    ...overrides,
  });

const NAME = 'Stanford University, MS Computer Science';

const collect = (
  applications: ApplicationRecord[],
  rest: Omit<Partial<DeadlineInputs>, 'applications' | 'today'> = {},
) => collectDeadlines({ applications, today, ...rest });

const CLOSED: ApplicationStatus[] = [
  'submitted',
  'interview',
  'waitlisted',
  'accepted',
  'rejected',
  'withdrawn',
];
const OPEN = APPLICATION_STATUSES.map((status) => status.value).filter(
  (status) => !CLOSED.includes(status),
);

/** A moment on the given local calendar day, as the database stores it. */
const at = (year: number, month: number, day: number, hour = 14, minute = 30) =>
  new Date(year, month - 1, day, hour, minute).toISOString();

describe('collectDeadlines', () => {
  it('has nothing to list when there are no programs, or no dates', () => {
    expect(collect([])).toEqual([]);
    expect(collect([program()])).toEqual([]);
  });

  describe('a program’s own dates', () => {
    it('lists the application deadline, with the program and where to go', () => {
      const record = program({ deadline: '2026-12-15' });
      expect(collect([record])).toEqual([
        {
          id: `application:${record.id}`,
          source: 'application',
          date: '2026-12-15',
          title: 'Application deadline',
          detail: null,
          applicationId: record.id,
          program: NAME,
          href: `/app/applications/${record.id}`,
          info: expect.objectContaining({ state: 'soon', days: 14, text: 'In 14 days' }),
        },
      ]);
    });

    it('lists a missed deadline as overdue while the application is still open', () => {
      const [item] = collect([program({ deadline: '2026-11-28' })]);
      expect(item?.info).toMatchObject({ state: 'overdue', days: -3, text: '3 days overdue' });
    });

    it.each(OPEN)('still lists the deadline of a program that is %s', (status) => {
      expect(collect([program({ status, deadline: '2026-12-15' })])).toHaveLength(1);
    });

    it.each(CLOSED)('drops the deadline of a program that is %s', (status) => {
      expect(collect([program({ status, deadline: '2026-12-15' })])).toEqual([]);
      expect(collect([program({ status, deadline: '2026-11-15' })])).toEqual([]);
    });

    it('lists the priority deadline as its own date', () => {
      const record = program({ deadline: '2027-01-15', priority_deadline: '2026-12-10' });
      expect(collect([record]).map((item) => [item.source, item.title, item.date])).toEqual([
        ['priority', 'Priority deadline', '2026-12-10'],
        ['application', 'Application deadline', '2027-01-15'],
      ]);
    });

    it.each(CLOSED)('drops the priority deadline of a program that is %s', (status) => {
      expect(collect([program({ status, priority_deadline: '2026-12-10' })])).toEqual([]);
    });

    it('gives each of a program’s dates its own id', () => {
      const record = program({
        deadline: '2026-12-10',
        priority_deadline: '2026-12-10',
        interview_at: at(2026, 12, 10),
        decision_deadline: '2026-12-10',
      });
      const ids = collect([record]).map((item) => item.id);
      expect(ids).toHaveLength(4);
      expect(new Set(ids).size).toBe(4);
    });
  });

  describe('an interview', () => {
    it('is listed on the day it happens, with the time of day', () => {
      const record = program({ status: 'interview', interview_at: at(2026, 12, 3, 14, 30) });
      expect(collect([record])).toEqual([
        expect.objectContaining({
          source: 'interview',
          date: '2026-12-03',
          title: 'Interview',
          detail: '2:30 PM',
          program: NAME,
          href: `/app/applications/${record.id}`,
          info: expect.objectContaining({ state: 'soon', days: 2, text: 'In 2 days' }),
        }),
      ]);
    });

    it('says "Today" and "Tomorrow", not "Due today", since an interview happens', () => {
      const same = collect([program({ interview_at: at(2026, 12, 1, 18, 0) })])[0];
      expect(same?.info).toMatchObject({ state: 'today', text: 'Today' });
      const next = collect([program({ interview_at: at(2026, 12, 2, 9, 0) })])[0];
      expect(next?.info).toMatchObject({ state: 'soon', days: 1, text: 'Tomorrow' });
    });

    it('goes by the viewer’s own day, so a late evening interview is not moved to the next day', () => {
      const [item] = collect([program({ interview_at: at(2026, 12, 4, 23, 30) })]);
      expect(item?.date).toBe('2026-12-04');
    });

    it('goes by the viewer’s own day at the start of the day too', () => {
      const [item] = collect([program({ interview_at: at(2026, 12, 4, 0, 30) })]);
      expect(item?.date).toBe('2026-12-04');
    });

    it('is history once the day has passed, not something you are late for', () => {
      expect(collect([program({ interview_at: at(2026, 11, 30) })])).toEqual([]);
    });

    it('is dropped when the program was rejected or withdrawn', () => {
      for (const status of ['rejected', 'withdrawn'] as const) {
        expect(collect([program({ status, interview_at: at(2026, 12, 3) })])).toEqual([]);
      }
    });

    it('is kept for a program that is waitlisted or accepted, whose interview may still be ahead', () => {
      for (const status of ['waitlisted', 'accepted', 'submitted'] as const) {
        expect(collect([program({ status, interview_at: at(2026, 12, 3) })])).toHaveLength(1);
      }
    });

    it('ignores a value that is not a moment in time', () => {
      expect(collect([program({ interview_at: 'sometime' })])).toEqual([]);
    });
  });

  describe('the date to reply to an offer', () => {
    it('is listed until you make your final choice', () => {
      const record = program({ status: 'accepted', decision_deadline: '2027-04-15' });
      expect(collect([record])).toEqual([
        expect.objectContaining({
          source: 'decision',
          title: 'Reply to offer',
          date: '2027-04-15',
          program: NAME,
          href: `/app/applications/${record.id}`,
        }),
      ]);
      expect(
        collect([
          program({ status: 'accepted', decision_deadline: '2027-04-15', is_final_choice: true }),
        ]),
      ).toEqual([]);
    });

    it('is overdue when it has passed and you have not chosen', () => {
      const [item] = collect([program({ status: 'accepted', decision_deadline: '2026-11-30' })]);
      expect(item?.info).toMatchObject({ state: 'overdue', text: '1 day overdue' });
    });

    it('is dropped when the program was rejected or withdrawn', () => {
      for (const status of ['rejected', 'withdrawn'] as const) {
        expect(collect([program({ status, decision_deadline: '2027-04-15' })])).toEqual([]);
      }
    });
  });

  describe('checklist items', () => {
    it('are listed with their name, the program, and the checklist to go to', () => {
      const record = program();
      const gre = fakeRequirement({
        application_id: record.id,
        kind: 'gre',
        due_date: '2026-12-20',
      });
      const essay = fakeRequirement({
        application_id: record.id,
        kind: 'supplemental_essay',
        label: 'Why Stanford',
        due_date: '2026-12-05',
      });
      expect(collect([record], { requirements: [gre, essay] })).toEqual([
        expect.objectContaining({
          id: `requirement:${essay.id}`,
          source: 'requirement',
          title: 'Why Stanford',
          detail: 'Requirement',
          date: '2026-12-05',
          program: NAME,
          applicationId: record.id,
          href: `/app/applications/${record.id}/requirements`,
        }),
        expect.objectContaining({ title: 'GRE', date: '2026-12-20' }),
      ]);
    });

    it('drop out once they are done', () => {
      const record = program();
      const rows = (['complete', 'submitted'] as const).map((status) =>
        fakeRequirement({ application_id: record.id, status, due_date: '2026-12-05' }),
      );
      expect(collect([record], { requirements: rows })).toEqual([]);
      const open = (['not_started', 'in_progress'] as const).map((status) =>
        fakeRequirement({ application_id: record.id, status, due_date: '2026-12-05' }),
      );
      expect(collect([record], { requirements: open })).toHaveLength(2);
    });

    it.each(CLOSED)('drop out once the program is %s', (status) => {
      const record = program({ status });
      const row = fakeRequirement({ application_id: record.id, due_date: '2026-12-05' });
      expect(collect([record], { requirements: [row] })).toEqual([]);
    });

    it('need a date, and a program that exists', () => {
      const record = program();
      const undated = fakeRequirement({ application_id: record.id, due_date: null });
      const orphan = fakeRequirement({ application_id: 'gone', due_date: '2026-12-05' });
      expect(collect([record], { requirements: [undated, orphan] })).toEqual([]);
    });
  });

  describe('recommendation letters', () => {
    it('are listed under the name of the person writing them', () => {
      const record = program();
      const person = fakeRecommender({ name: 'Dr. Lee' });
      const request = fakeRequest({
        application_id: record.id,
        recommender_id: person.id,
        deadline: '2026-12-08',
        status: 'requested',
      });
      expect(collect([record], { recommenders: [person], requests: [request] })).toEqual([
        {
          id: `letter:${request.id}`,
          source: 'letter',
          date: '2026-12-08',
          title: 'Letter from Dr. Lee',
          detail: null,
          applicationId: record.id,
          program: NAME,
          href: `/app/applications/${record.id}/recommendations`,
          info: expect.objectContaining({ state: 'soon', days: 7 }),
        },
      ]);
    });

    it('are still listed, unnamed, when the person’s list is not there', () => {
      const record = program();
      const request = fakeRequest({ application_id: record.id, deadline: '2026-12-08' });
      expect(collect([record], { requests: [request] })[0]?.title).toBe('Recommendation letter');
      expect(collect([record], { recommenders: [], requests: [request] })[0]?.title).toBe(
        'Recommendation letter',
      );
    });

    it('drop out once the letter has been sent', () => {
      const record = program();
      const person = fakeRecommender();
      const make = (status: 'submitted' | 'confirmed') =>
        fakeRequest({
          application_id: record.id,
          recommender_id: person.id,
          deadline: '2026-12-08',
          status,
        });
      expect(collect([record], { recommenders: [person], requests: [make('submitted')] })).toEqual(
        [],
      );
      expect(
        collect([record], { recommenders: [person], requests: [make('confirmed')] }),
      ).toHaveLength(1);
    });

    it.each(CLOSED)('drop out once the program is %s', (status) => {
      const record = program({ status });
      const person = fakeRecommender();
      const request = fakeRequest({
        application_id: record.id,
        recommender_id: person.id,
        deadline: '2026-12-08',
      });
      expect(collect([record], { recommenders: [person], requests: [request] })).toEqual([]);
    });

    it('need a date, and a program that exists', () => {
      const record = program();
      const person = fakeRecommender();
      const undated = fakeRequest({ application_id: record.id, recommender_id: person.id });
      const orphan = fakeRequest({
        application_id: 'gone',
        recommender_id: person.id,
        deadline: '2026-12-08',
      });
      expect(collect([record], { recommenders: [person], requests: [undated, orphan] })).toEqual(
        [],
      );
    });
  });

  describe('funding', () => {
    it('is listed with its kind, and the program it is for', () => {
      const record = program();
      const row = fakeFunding({
        application_id: record.id,
        name: 'Dean’s Fellowship',
        kind: 'fellowship',
        deadline: '2026-12-12',
        status: 'applying',
      });
      expect(collect([record], { funding: [row] })).toEqual([
        {
          id: `funding:${row.id}`,
          source: 'funding',
          date: '2026-12-12',
          title: 'Dean’s Fellowship',
          detail: 'Fellowship',
          applicationId: record.id,
          program: NAME,
          href: `/app/applications/${record.id}/funding`,
          info: expect.objectContaining({ state: 'soon', days: 11 }),
        },
      ]);
    });

    it('can belong to no program, and then is found on the Funding page', () => {
      const row = fakeFunding({
        application_id: null,
        deadline: '2026-12-12',
        status: 'researching',
      });
      expect(collect([program()], { funding: [row] })).toEqual([
        expect.objectContaining({ applicationId: null, program: null, href: '/app/funding' }),
      ]);
    });

    it('is treated as belonging to no program when the program is not in the list', () => {
      const row = fakeFunding({ application_id: 'gone', deadline: '2026-12-12' });
      expect(collect([program()], { funding: [row] })).toEqual([
        expect.objectContaining({ applicationId: null, program: null, href: '/app/funding' }),
      ]);
    });

    it('drops out once you have applied or been answered', () => {
      const rows = (['applied', 'offered', 'accepted', 'declined', 'rejected'] as const).map(
        (status) => fakeFunding({ deadline: '2026-12-12', status }),
      );
      expect(collect([program()], { funding: rows })).toEqual([]);
      const open = (['researching', 'applying'] as const).map((status) =>
        fakeFunding({ deadline: '2026-12-12', status }),
      );
      expect(collect([program()], { funding: open })).toHaveLength(2);
    });

    it('drops out when the program is rejected or withdrawn, but not when it is only submitted', () => {
      for (const status of ['rejected', 'withdrawn'] as const) {
        const record = program({ status });
        const row = fakeFunding({ application_id: record.id, deadline: '2026-12-12' });
        expect(collect([record], { funding: [row] })).toEqual([]);
      }
      // A scholarship can be due after the application itself is in.
      const sent = program({ status: 'submitted' });
      const row = fakeFunding({
        application_id: sent.id,
        deadline: '2026-12-12',
        status: 'applying',
      });
      expect(collect([sent], { funding: [row] })).toHaveLength(1);
    });

    it('needs a date', () => {
      expect(collect([program()], { funding: [fakeFunding({ deadline: null })] })).toEqual([]);
    });
  });

  describe('tasks', () => {
    it('are listed with the program they are for', () => {
      const record = program();
      const task = fakeTask({
        application_id: record.id,
        title: 'Email Prof. Lee',
        due_date: '2026-12-03',
      });
      expect(collect([record], { tasks: [task] })).toEqual([
        {
          id: `task:${task.id}`,
          source: 'task',
          date: '2026-12-03',
          title: 'Email Prof. Lee',
          detail: 'Task',
          applicationId: record.id,
          program: NAME,
          href: `/app/applications/${record.id}/tasks`,
          info: expect.objectContaining({ state: 'soon', days: 2 }),
        },
      ]);
    });

    it('can belong to no program, and then are found on the Tasks page', () => {
      const task = fakeTask({ application_id: null, due_date: '2026-12-03' });
      expect(collect([program()], { tasks: [task] })).toEqual([
        expect.objectContaining({ applicationId: null, program: null, href: '/app/tasks' }),
      ]);
    });

    it('are listed while open, and overdue when late', () => {
      const rows = (['todo', 'in_progress'] as const).map((status) =>
        fakeTask({ status, due_date: '2026-11-25' }),
      );
      const items = collect([], { tasks: rows });
      expect(items).toHaveLength(2);
      expect(items.every((item) => item.info.state === 'overdue')).toBe(true);
    });

    it('drop out once complete', () => {
      const task = fakeTask({ status: 'complete', due_date: '2026-12-03' });
      expect(collect([], { tasks: [task] })).toEqual([]);
    });

    it('stay listed when the program has been submitted, unlike the program’s own dates', () => {
      const record = program({ status: 'submitted' });
      const task = fakeTask({ application_id: record.id, due_date: '2026-12-03' });
      expect(collect([record], { tasks: [task] })).toHaveLength(1);
    });

    it('need a date', () => {
      expect(collect([], { tasks: [fakeTask({ due_date: null })] })).toEqual([]);
    });
  });

  it('leaves out a list that is not there without losing the others', () => {
    const record = program({ deadline: '2026-12-15' });
    const task = fakeTask({ due_date: '2026-12-03' });
    const row = fakeRequirement({ application_id: record.id, due_date: '2026-12-05' });
    expect(collect([record], { tasks: [task] }).map((item) => item.source)).toEqual([
      'task',
      'application',
    ]);
    expect(collect([record], { requirements: [row] }).map((item) => item.source)).toEqual([
      'requirement',
      'application',
    ]);
  });

  describe('order', () => {
    it('is soonest first, from every source together', () => {
      const record = program({ deadline: '2026-12-20' });
      const person = fakeRecommender({ name: 'Dr. Lee' });
      const items = collect([record], {
        recommenders: [person],
        requests: [
          fakeRequest({
            application_id: record.id,
            recommender_id: person.id,
            deadline: '2026-12-10',
          }),
        ],
        requirements: [fakeRequirement({ application_id: record.id, due_date: '2026-12-05' })],
        funding: [fakeFunding({ deadline: '2026-12-15' })],
        tasks: [fakeTask({ due_date: '2026-12-02' })],
      });
      expect(items.map((item) => item.date)).toEqual([
        '2026-12-02',
        '2026-12-05',
        '2026-12-10',
        '2026-12-15',
        '2026-12-20',
      ]);
      expect(items.map((item) => item.source)).toEqual([
        'task',
        'requirement',
        'letter',
        'funding',
        'application',
      ]);
    });

    it('puts the most overdue first', () => {
      const items = collect([], {
        tasks: [
          fakeTask({ title: 'A day late', due_date: '2026-11-30' }),
          fakeTask({ title: 'A month late', due_date: '2026-11-01' }),
          fakeTask({ title: 'On time', due_date: '2026-12-01' }),
        ],
      });
      expect(items.map((item) => item.title)).toEqual(['A month late', 'A day late', 'On time']);
    });

    it('lists a day’s dates by where they come from, then by name', () => {
      const record = program({ deadline: '2026-12-10' });
      const items = collect([record], {
        tasks: [
          fakeTask({ title: 'Zebra', due_date: '2026-12-10' }),
          fakeTask({ title: 'apple', due_date: '2026-12-10' }),
          fakeTask({ title: 'Item 10', due_date: '2026-12-10' }),
          fakeTask({ title: 'Item 9', due_date: '2026-12-10' }),
        ],
        funding: [fakeFunding({ name: 'Grant', deadline: '2026-12-10' })],
      });
      expect(items.map((item) => item.title)).toEqual([
        'Application deadline',
        'Grant',
        'apple',
        'Item 9',
        'Item 10',
        'Zebra',
      ]);
    });

    it('is the same whatever order the rows arrive in', () => {
      const record = program({ deadline: '2026-12-10' });
      const tasks = [
        fakeTask({ title: 'Same', due_date: '2026-12-10', application_id: record.id }),
        fakeTask({ title: 'Same', due_date: '2026-12-10', application_id: null }),
        fakeTask({ title: 'Other', due_date: '2026-12-09' }),
      ];
      const titles = permutations(tasks).map((order) =>
        collect([record], { tasks: order }).map((item) => item.id),
      );
      for (const result of titles) expect(result).toEqual(titles[0]);
    });
  });
});

describe('compareDeadlines', () => {
  const item = (overrides: Partial<DeadlineItem> & { days?: number } = {}): DeadlineItem => {
    const { days = 3, ...rest } = overrides;
    return {
      id: 'task:1',
      source: 'task',
      date: '2026-12-04',
      title: 'Same',
      detail: null,
      applicationId: null,
      program: null,
      href: '/app/tasks',
      info: { state: 'soon', days, text: null, tone: 'neutral' },
      ...rest,
    };
  };

  it('is negative when the first is sooner, positive when later, zero only for the same item', () => {
    expect(compareDeadlines(item({ days: 1 }), item({ days: 2 }))).toBeLessThan(0);
    expect(compareDeadlines(item({ days: 2 }), item({ days: 1 }))).toBeGreaterThan(0);
    expect(compareDeadlines(item(), item())).toBe(0);
  });

  it('breaks a tie by source, then title, then program, then id', () => {
    expect(
      compareDeadlines(item({ source: 'application' }), item({ source: 'task' })),
    ).toBeLessThan(0);
    expect(compareDeadlines(item({ title: 'A' }), item({ title: 'B' }))).toBeLessThan(0);
    expect(compareDeadlines(item({ program: 'A' }), item({ program: 'B' }))).toBeLessThan(0);
    expect(compareDeadlines(item({ program: null }), item({ program: 'A' }))).toBeLessThan(0);
    expect(compareDeadlines(item({ id: 'task:1' }), item({ id: 'task:2' }))).toBeLessThan(0);
  });
});

describe('isOpenDeadline', () => {
  const info = (state: string, days: number | null) =>
    ({ state, days, text: null, tone: 'neutral' }) as Parameters<typeof isOpenDeadline>[0];

  it('is true for a date that is late, today, or ahead', () => {
    expect(isOpenDeadline(info('overdue', -2))).toBe(true);
    expect(isOpenDeadline(info('today', 0))).toBe(true);
    expect(isOpenDeadline(info('soon', 5))).toBe(true);
    expect(isOpenDeadline(info('upcoming', 90))).toBe(true);
  });

  it('is false for no date, and for history', () => {
    expect(isOpenDeadline(info('none', null))).toBe(false);
    expect(isOpenDeadline(info('closed', 5))).toBe(false);
    expect(isOpenDeadline(info('closed', -5))).toBe(false);
  });
});

describe('groups', () => {
  it('put each date in the group for how soon it is', () => {
    expect(groupKeyOf(-400)).toBe('overdue');
    expect(groupKeyOf(-1)).toBe('overdue');
    expect(groupKeyOf(0)).toBe('today');
    expect(groupKeyOf(1)).toBe('week');
    expect(groupKeyOf(WEEK_DAYS)).toBe('week');
    expect(groupKeyOf(WEEK_DAYS + 1)).toBe('month');
    expect(groupKeyOf(MONTH_DAYS)).toBe('month');
    expect(groupKeyOf(MONTH_DAYS + 1)).toBe('later');
    expect(groupKeyOf(900)).toBe('later');
  });

  it('are a week and a month, as they are called', () => {
    expect(WEEK_DAYS).toBe(7);
    expect(MONTH_DAYS).toBe(30);
    expect(DEADLINE_GROUPS.map((group) => group.title)).toEqual([
      'Overdue',
      'Today',
      'Next 7 days',
      'Next 30 days',
      'Later',
    ]);
  });

  const tasks = [
    fakeTask({ title: 'Far', due_date: '2027-03-01' }),
    fakeTask({ title: 'Late', due_date: '2026-11-20' }),
    fakeTask({ title: 'Now', due_date: '2026-12-01' }),
    fakeTask({ title: 'Soon B', due_date: '2026-12-08' }),
    fakeTask({ title: 'Soon A', due_date: '2026-12-02' }),
    fakeTask({ title: 'Month', due_date: '2026-12-31' }),
  ];
  const items = collect([], { tasks });

  it('are listed soonest first, with only the ones that have something in them', () => {
    expect(
      groupDeadlines(items).map((group) => [
        group.key,
        group.title,
        group.items.map((i) => i.title),
      ]),
    ).toEqual([
      ['overdue', 'Overdue', ['Late']],
      ['today', 'Today', ['Now']],
      ['week', 'Next 7 days', ['Soon A', 'Soon B']],
      ['month', 'Next 30 days', ['Month']],
      ['later', 'Later', ['Far']],
    ]);
    expect(groupDeadlines(items.filter((i) => i.title === 'Far')).map((g) => g.key)).toEqual([
      'later',
    ]);
    expect(groupDeadlines([])).toEqual([]);
  });

  it('are counted', () => {
    expect(countDeadlines(items)).toEqual({ overdue: 1, today: 1, week: 2, month: 1, later: 1 });
    expect(countDeadlines([])).toEqual({ overdue: 0, today: 0, week: 0, month: 0, later: 0 });
  });
});

describe('describeDeadlineCounts', () => {
  const counts = (overrides: Partial<ReturnType<typeof countDeadlines>>) => ({
    overdue: 0,
    today: 0,
    week: 0,
    month: 0,
    later: 0,
    ...overrides,
  });

  it('says what needs attention, and nothing else', () => {
    expect(
      describeDeadlineCounts(counts({ overdue: 2, today: 1, week: 4, month: 9, later: 9 })),
    ).toBe('2 overdue · 1 due today · 4 in the next 7 days');
    expect(describeDeadlineCounts(counts({ today: 1 }))).toBe('1 due today');
    expect(describeDeadlineCounts(counts({ overdue: 3, week: 1 }))).toBe(
      '3 overdue · 1 in the next 7 days',
    );
  });

  it('says so when nothing is close', () => {
    expect(describeDeadlineCounts(counts({ month: 2, later: 1 }))).toBe(
      'Nothing is due in the next 7 days.',
    );
    expect(describeDeadlineCounts(counts({}))).toBe('Nothing is due in the next 7 days.');
  });
});
