import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { DEADLINES_SHOWN } from '@/features/dashboard/DeadlinesCard';
import { LETTERS_SHOWN } from '@/features/dashboard/LettersCard';
import { PROGRAMS_SHOWN } from '@/features/dashboard/ProgressCard';
import { TASKS_SHOWN } from '@/features/dashboard/TasksCard';
import type { RecommenderRow, RequestRow } from '@/features/recommendations/types';
import type { RequirementRow } from '@/features/requirements/types';
import type { ActivityRow } from '@/features/activity/types';
import type { TaskRow } from '@/features/tasks/types';
import { DataError } from '@/lib/dataError';
import { createFakeActivityApi, fakeActivity } from '@/test/fakeActivityApi';
import { createFakeApplicationsApi, daysFromNow, fakeRecord } from '@/test/fakeApplicationsApi';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import {
  createFakeRecommendationsApi,
  fakeRecommender,
  fakeRequest,
} from '@/test/fakeRecommendationsApi';
import { createFakeRequirementsApi, fakeRequirement } from '@/test/fakeRequirementsApi';
import { createFakeTasksApi, fakeTask } from '@/test/fakeTasksApi';
import { renderApp } from '@/test/renderApp';

const stanford = (overrides: Parameters<typeof fakeRecord>[0] = {}) =>
  fakeRecord({
    id: 'stanford',
    program_name: 'Computer Science',
    university: { name: 'Stanford University' },
    status: 'application_started',
    ...overrides,
  });
const toronto = (overrides: Parameters<typeof fakeRecord>[0] = {}) =>
  fakeRecord({
    id: 'toronto',
    program_name: 'Data Science',
    university: { name: 'University of Toronto' },
    status: 'application_started',
    ...overrides,
  });

type Data = {
  programs?: ReturnType<typeof fakeRecord>[];
  requirements?: RequirementRow[];
  recommenders?: RecommenderRow[];
  requests?: RequestRow[];
  tasks?: TaskRow[];
  activity?: ActivityRow[];
};

function open({
  programs = [stanford()],
  requirements = [],
  recommenders = [],
  requests = [],
  tasks = [],
  activity = [],
}: Data = {}) {
  const applications = createFakeApplicationsApi(programs);
  const requirementsFake = createFakeRequirementsApi(requirements);
  const recommendations = createFakeRecommendationsApi({ recommenders, requests });
  const tasksFake = createFakeTasksApi(tasks);
  const activityFake = createFakeActivityApi(activity);
  const view = renderApp('/app', createFakeAuth(fakeSession()).client, {
    api: applications.api,
    requirementsApi: requirementsFake.api,
    recommendationsApi: recommendations.api,
    tasksApi: tasksFake.api,
    activityApi: activityFake.api,
  });
  return { ...view, applications, requirementsFake, recommendations, tasksFake, activityFake };
}

const stat = (label: string) =>
  within(screen.getByText(label, { selector: 'dt' }).closest('dl')!).getByText(/^\d+$/).textContent;

/** A card by its title. Waits until the page itself has loaded. */
const cardTitled = async (title: string) =>
  (await screen.findByRole('heading', { level: 2, name: title })).closest(
    '.rounded-lg',
  ) as HTMLElement;
const linksIn = (card: HTMLElement) =>
  within(card)
    .queryAllByRole('link')
    .map((link) => link.textContent);

const CARDS = [
  'Upcoming deadlines',
  'Application progress',
  'Tasks',
  'Recommendation letters',
  'Recent activity',
];

describe('dashboard', () => {
  describe('the headline numbers', () => {
    it('invites you to add a first program when there are none', async () => {
      open({ programs: [] });
      expect(
        await screen.findByRole('heading', { name: 'No applications yet.' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Add program' })).toHaveAttribute(
        'href',
        '/app/applications/new',
      );
      expect(screen.queryByText('Total programs')).not.toBeInTheDocument();
    });

    it('has no cards, and asks nothing else of the database, until there is a program', async () => {
      const { tasksFake, requirementsFake, activityFake } = open({ programs: [] });
      await screen.findByRole('heading', { name: 'No applications yet.' });
      for (const title of CARDS) {
        expect(screen.queryByRole('heading', { level: 2, name: title })).not.toBeInTheDocument();
      }
      expect(tasksFake.api.list).not.toHaveBeenCalled();
      expect(requirementsFake.api.list).not.toHaveBeenCalled();
      expect(activityFake.api.recent).not.toHaveBeenCalled();
    });

    it('counts your own programs by where they stand', async () => {
      open({
        programs: [
          fakeRecord({ status: 'researching' }),
          fakeRecord({ status: 'shortlisted' }),
          fakeRecord({ status: 'documents_in_progress' }),
          fakeRecord({ status: 'submitted' }),
          fakeRecord({ status: 'interview' }),
          fakeRecord({ status: 'accepted' }),
          fakeRecord({ status: 'rejected' }),
          fakeRecord({ status: 'rejected' }),
          fakeRecord({ status: 'withdrawn' }),
        ],
      });
      expect(await screen.findByText('Total programs', { selector: 'dt' })).toBeInTheDocument();
      expect(stat('Total programs')).toBe('9');
      expect(stat('Not started')).toBe('2');
      expect(stat('In progress')).toBe('1');
      expect(stat('Submitted')).toBe('1');
      expect(stat('Interviews')).toBe('1');
      expect(stat('Accepted')).toBe('1');
      expect(stat('Waitlisted')).toBe('0');
      expect(stat('Rejected')).toBe('2');
      expect(
        screen.queryByRole('heading', { name: 'No applications yet.' }),
      ).not.toBeInTheDocument();
    });

    it('says how many of the total are withdrawn, and only when some are', async () => {
      open({
        programs: [
          fakeRecord({ status: 'researching' }),
          fakeRecord({ status: 'withdrawn' }),
          fakeRecord({ status: 'withdrawn' }),
        ],
      });
      expect(await screen.findByText('Includes 2 withdrawn')).toBeVisible();
    });

    it('says nothing about withdrawn programs when there are none', async () => {
      open({ programs: [fakeRecord({ status: 'researching' })] });
      await screen.findByText('Total programs', { selector: 'dt' });
      expect(screen.queryByText(/withdrawn/)).not.toBeInTheDocument();
    });

    it('links to the full list once there is something in it', async () => {
      open({ programs: [fakeRecord()] });
      expect(await screen.findByRole('link', { name: 'View applications' })).toHaveAttribute(
        'href',
        '/app/applications',
      );
    });

    it('follows a change made elsewhere at once', async () => {
      const { queryClient } = open({ programs: [fakeRecord({ status: 'researching' })] });
      await screen.findByText('Total programs', { selector: 'dt' });
      expect(stat('Submitted')).toBe('0');
      await act(async () => {
        queryClient.setQueryData(
          ['applications', 'user-1'],
          (old: ReturnType<typeof fakeRecord>[]) =>
            old.map((record) => ({ ...record, status: 'submitted' })),
        );
      });
      expect(stat('Submitted')).toBe('1');
      expect(stat('Not started')).toBe('0');
    });

    it('says so, and lets you retry, when the programs cannot be loaded', async () => {
      const fake = createFakeApplicationsApi([fakeRecord()]);
      fake.api.list.mockRejectedValueOnce(new DataError('network'));
      renderApp('/app', createFakeAuth(fakeSession()).client, { api: fake.api });
      expect(await screen.findByText('Unable to load programs')).toBeInTheDocument();
      for (const title of CARDS) {
        expect(screen.queryByRole('heading', { level: 2, name: title })).not.toBeInTheDocument();
      }
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('Total programs', { selector: 'dt' })).toBeInTheDocument();
    });
  });

  it('has a card for everything worth keeping an eye on', async () => {
    open();
    for (const title of CARDS) {
      expect(await screen.findByRole('heading', { level: 2, name: title })).toBeVisible();
    }
  });

  describe('upcoming deadlines', () => {
    it('lists the next dates, soonest first, and links to the rest', async () => {
      open({
        programs: [
          stanford({ deadline: daysFromNow(9) }),
          toronto({ deadline: daysFromNow(2), status: 'documents_in_progress' }),
        ],
        tasks: [fakeTask({ title: 'Email Prof. Lee', due_date: daysFromNow(4) })],
      });
      const card = await cardTitled('Upcoming deadlines');
      const list = await within(card).findByRole('list', { name: 'Upcoming deadlines' });
      expect(
        within(list)
          .getAllByRole('listitem')
          .map((row) => within(row).getAllByRole('link')[0]!.textContent),
      ).toEqual(['Application deadline', 'Email Prof. Lee', 'Application deadline']);
      expect(within(list.children[0] as HTMLElement).getByText('In 2 days')).toBeVisible();
      expect(
        within(list.children[0] as HTMLElement).getByText(/University of Toronto/),
      ).toBeVisible();
      expect(within(card).getByRole('link', { name: 'View all' })).toHaveAttribute(
        'href',
        '/app/deadlines',
      );
    });

    it(`shows no more than ${DEADLINES_SHOWN}, the soonest`, async () => {
      const programs = Array.from({ length: DEADLINES_SHOWN + 3 }, (_, index) =>
        fakeRecord({
          id: `p${index}`,
          program_name: `Program ${index}`,
          university: { name: `University ${index}` },
          status: 'application_started',
          deadline: daysFromNow(index + 1),
        }),
      );
      open({ programs });
      const card = await cardTitled('Upcoming deadlines');
      const list = await within(card).findByRole('list', { name: 'Upcoming deadlines' });
      const rows = within(list).getAllByRole('listitem');
      expect(rows).toHaveLength(DEADLINES_SHOWN);
      expect(rows[0]).toHaveTextContent('University 0');
      expect(rows.at(-1)).toHaveTextContent(`University ${DEADLINES_SHOWN - 1}`);
    });

    it('says nothing is due when nothing has a date', async () => {
      open({ programs: [stanford({ deadline: null })] });
      const card = await cardTitled('Upcoming deadlines');
      expect(await within(card).findByText(/Nothing is due/)).toBeVisible();
      expect(within(card).queryByRole('list')).not.toBeInTheDocument();
    });

    it('leaves out dates that are history, like a program already sent', async () => {
      open({ programs: [stanford({ status: 'submitted', deadline: daysFromNow(2) })] });
      const card = await cardTitled('Upcoming deadlines');
      expect(await within(card).findByText(/Nothing is due/)).toBeVisible();
    });

    it('still lists the rest, and says what is missing, when one list cannot be loaded', async () => {
      const { tasksFake } = open({
        programs: [stanford({ deadline: daysFromNow(3) })],
        tasks: [fakeTask({ title: 'Email Prof. Lee', due_date: daysFromNow(2) })],
      });
      tasksFake.api.list.mockRejectedValueOnce(new DataError('network'));
      const card = await cardTitled('Upcoming deadlines');
      expect(await within(card).findByText('Some deadlines are missing')).toBeVisible();
      expect(card).toHaveTextContent('Couldn’t load your tasks');
      expect(linksIn(card)).toContain('Application deadline');
      expect(linksIn(card)).not.toContain('Email Prof. Lee');
    });
  });

  describe('application progress', () => {
    const items = (application: string, statuses: RequirementRow['status'][]) =>
      statuses.map((status) => fakeRequirement({ application_id: application, status }));

    it('adds up the required items done, over the programs still being prepared', async () => {
      open({
        programs: [stanford({ deadline: daysFromNow(10) }), toronto({ deadline: daysFromNow(20) })],
        requirements: [
          ...items('stanford', ['complete', 'complete', 'not_started']),
          ...items('toronto', ['submitted', 'in_progress']),
          fakeRequirement({ application_id: 'toronto', is_required: false, status: 'complete' }),
        ],
      });
      const card = await cardTitled('Application progress');
      expect(await within(card).findByText('3 of 5')).toBeVisible();
      expect(card).toHaveTextContent('3 of 5 required items done');
      expect(within(card).getByText('60%')).toBeVisible();
      expect(
        within(card).getByRole('progressbar', { name: 'Overall checklist completion' }),
      ).toHaveAttribute('aria-valuenow', '60');
      expect(card).toHaveTextContent('2 left across 2 programs');
    });

    it('lists each of those programs with its own progress, soonest deadline first', async () => {
      open({
        programs: [stanford({ deadline: daysFromNow(20) }), toronto({ deadline: daysFromNow(5) })],
        requirements: [
          ...items('stanford', ['complete', 'not_started']),
          ...items('toronto', ['complete', 'complete', 'complete', 'not_started']),
        ],
      });
      const card = await cardTitled('Application progress');
      const list = await within(card).findByRole('list', { name: 'Programs still to prepare' });
      const rows = within(list).getAllByRole('listitem');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent('University of Toronto, Data Science');
      expect(rows[0]).toHaveTextContent('3 of 4 · 75%');
      expect(rows[1]).toHaveTextContent('Stanford University, Computer Science');
      expect(rows[1]).toHaveTextContent('1 of 2 · 50%');
      expect(within(rows[0]!).getByRole('link')).toHaveAttribute(
        'href',
        '/app/applications/toronto/requirements',
      );
    });

    it('leaves out programs that have been sent, decided or withdrawn', async () => {
      open({
        programs: [
          stanford(),
          toronto({ status: 'submitted' }),
          fakeRecord({ id: 'mit', university: { name: 'MIT' }, status: 'accepted' }),
        ],
        requirements: [
          ...items('stanford', ['complete', 'not_started']),
          ...items('toronto', ['complete']),
          ...items('mit', ['complete']),
        ],
      });
      const card = await cardTitled('Application progress');
      const list = await within(card).findByRole('list', { name: 'Programs still to prepare' });
      expect(within(list).getAllByRole('listitem')).toHaveLength(1);
      expect(card).toHaveTextContent('1 of 2 required items done');
    });

    it(`shows no more than ${PROGRAMS_SHOWN} programs`, async () => {
      const programs = Array.from({ length: PROGRAMS_SHOWN + 2 }, (_, index) =>
        fakeRecord({
          id: `p${index}`,
          university: { name: `University ${index}` },
          status: 'application_started',
          deadline: daysFromNow(index + 1),
        }),
      );
      open({ programs });
      const card = await cardTitled('Application progress');
      const list = await within(card).findByRole('list', { name: 'Programs still to prepare' });
      expect(within(list).getAllByRole('listitem')).toHaveLength(PROGRAMS_SHOWN);
    });

    it('asks for required items when no program has any', async () => {
      open({ programs: [stanford()] });
      const card = await cardTitled('Application progress');
      expect(
        await within(card).findByText(/Add required items to a program’s checklist/),
      ).toBeVisible();
      expect(
        within(card).queryByRole('progressbar', { name: 'Overall checklist completion' }),
      ).not.toBeInTheDocument();
    });

    it('says when every required item is done', async () => {
      open({
        programs: [stanford()],
        requirements: items('stanford', ['complete', 'submitted']),
      });
      const card = await cardTitled('Application progress');
      expect(await within(card).findByText('Every required item is done.')).toBeVisible();
      expect(within(card).getByText('100%')).toBeVisible();
    });

    it('says there is nothing left to prepare when every program is sent, decided or withdrawn', async () => {
      open({ programs: [stanford({ status: 'submitted' }), toronto({ status: 'rejected' })] });
      const card = await cardTitled('Application progress');
      expect(await within(card).findByText(/Nothing left to prepare/)).toBeVisible();
    });

    it('says why, and can try again, when the checklists cannot be loaded', async () => {
      const { requirementsFake } = open({ programs: [stanford()] });
      requirementsFake.api.list.mockRejectedValueOnce(new DataError('network'));
      const card = await cardTitled('Application progress');
      expect(await within(card).findByText('Unable to load your progress')).toBeVisible();
      expect(card).toHaveTextContent("Can't reach the server");
      fireEvent.click(within(card).getByRole('button', { name: 'Try again' }));
      await waitFor(() =>
        expect(within(card).queryByText('Unable to load your progress')).not.toBeInTheDocument(),
      );
    });
  });

  describe('tasks', () => {
    it('counts what is open, late and close, and lists what to do next', async () => {
      open({
        programs: [stanford()],
        tasks: [
          fakeTask({
            title: 'Send transcripts',
            due_date: daysFromNow(-2),
            application_id: 'stanford',
          }),
          fakeTask({
            title: 'Email Prof. Lee',
            due_date: daysFromNow(3),
            application_id: 'stanford',
          }),
          fakeTask({ title: 'Renew passport', due_date: daysFromNow(40) }),
          fakeTask({ title: 'Order a gown' }),
          fakeTask({
            title: 'Booked the GRE',
            status: 'complete',
            completed_at: '2026-09-01T00:00:00Z',
          }),
        ],
      });
      const card = await cardTitled('Tasks');
      expect(await within(card).findByRole('list', { name: 'Next tasks' })).toBeVisible();
      expect(card).toHaveTextContent('4 open · 1 overdue · 1 due in the next 7 days');
      expect(linksIn(card)).toEqual([
        'View all',
        'Send transcripts',
        'Email Prof. Lee',
        'Renew passport',
        'Order a gown',
      ]);
      expect(within(card).getByText('2 days overdue')).toBeVisible();
    });

    it('sends you to the program a task belongs to, or to the Tasks page when it has none', async () => {
      open({
        programs: [stanford()],
        tasks: [
          fakeTask({
            title: 'Email Prof. Lee',
            application_id: 'stanford',
            due_date: daysFromNow(1),
          }),
          fakeTask({ title: 'Renew passport', due_date: daysFromNow(2) }),
        ],
      });
      const card = await cardTitled('Tasks');
      expect(await within(card).findByRole('link', { name: 'Email Prof. Lee' })).toHaveAttribute(
        'href',
        '/app/applications/stanford/tasks',
      );
      expect(within(card).getByRole('link', { name: 'Renew passport' })).toHaveAttribute(
        'href',
        '/app/tasks',
      );
      expect(within(card).getByRole('link', { name: 'View all' })).toHaveAttribute(
        'href',
        '/app/tasks',
      );
      const row = within(card).getByRole('link', { name: 'Email Prof. Lee' }).closest('li')!;
      expect(row).toHaveTextContent('Stanford University, Computer Science');
    });

    it(`lists no more than ${TASKS_SHOWN}`, async () => {
      open({
        tasks: Array.from({ length: TASKS_SHOWN + 3 }, (_, index) =>
          fakeTask({ title: `Task ${index}`, due_date: daysFromNow(index + 1) }),
        ),
      });
      const card = await cardTitled('Tasks');
      const list = await within(card).findByRole('list', { name: 'Next tasks' });
      expect(within(list).getAllByRole('listitem')).toHaveLength(TASKS_SHOWN);
      expect(card).toHaveTextContent(`${TASKS_SHOWN + 3} open`);
    });

    it('says when every task is complete, and lists nothing to do', async () => {
      open({
        tasks: [fakeTask({ status: 'complete', completed_at: '2026-09-01T00:00:00Z' })],
      });
      const card = await cardTitled('Tasks');
      expect(await within(card).findByText('Every task is complete.')).toBeVisible();
      expect(within(card).queryByRole('list')).not.toBeInTheDocument();
    });

    it('invites you to add a first one', async () => {
      open({ tasks: [] });
      const card = await cardTitled('Tasks');
      expect(await within(card).findByText(/No tasks yet/)).toBeVisible();
    });

    it('says why, and can try again, when the tasks cannot be loaded', async () => {
      const { tasksFake } = open({ tasks: [fakeTask({ title: 'Email Prof. Lee' })] });
      tasksFake.api.list.mockRejectedValueOnce(new DataError('network'));
      const card = await cardTitled('Tasks');
      expect(await within(card).findByText('Unable to load tasks')).toBeVisible();
      fireEvent.click(within(card).getByRole('button', { name: 'Try again' }));
      expect(await within(card).findByRole('link', { name: 'Email Prof. Lee' })).toBeVisible();
    });
  });

  describe('recommendation letters', () => {
    const dr = fakeRecommender({ id: 'lee', name: 'Dr. Lee' });
    const prof = fakeRecommender({ id: 'kim', name: 'Prof. Kim' });
    const letter = (overrides: Partial<RequestRow>) =>
      fakeRequest({ recommender_id: 'lee', application_id: 'stanford', ...overrides });

    it('counts the letters sent, and lists those that need a nudge, most urgent first', async () => {
      open({
        programs: [stanford(), toronto()],
        recommenders: [dr, prof],
        requests: [
          letter({ status: 'requested', deadline: daysFromNow(9) }),
          letter({ recommender_id: 'kim', status: 'requested', deadline: daysFromNow(-3) }),
          letter({ application_id: 'toronto', status: 'submitted' }),
          letter({
            recommender_id: 'kim',
            application_id: 'toronto',
            status: 'requested',
            deadline: daysFromNow(60),
          }),
        ],
      });
      const card = await cardTitled('Recommendation letters');
      const list = await within(card).findByRole('list', { name: 'Letters that need attention' });
      expect(card).toHaveTextContent('1 of 4 letters submitted');
      const rows = within(list).getAllByRole('listitem');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent('Letter from Prof. Kim');
      expect(rows[0]).toHaveTextContent('3 days overdue');
      expect(rows[1]).toHaveTextContent('Letter from Dr. Lee');
      expect(rows[1]).toHaveTextContent('In 9 days');
      expect(within(rows[0]!).getByRole('link')).toHaveAttribute(
        'href',
        '/app/applications/stanford/recommendations',
      );
    });

    it('also lists a letter you marked as needing a follow-up, however far off it is', async () => {
      open({
        recommenders: [dr],
        requests: [letter({ status: 'needs_follow_up', deadline: daysFromNow(90) })],
      });
      const card = await cardTitled('Recommendation letters');
      const list = await within(card).findByRole('list', { name: 'Letters that need attention' });
      expect(within(list).getAllByRole('listitem')).toHaveLength(1);
      expect(within(list).getByText('Needs Follow-Up')).toBeVisible();
    });

    it('says no letter needs attention when they are all on track or sent', async () => {
      open({
        recommenders: [dr],
        requests: [
          letter({ status: 'requested', deadline: daysFromNow(60) }),
          letter({ recommender_id: 'kim', status: 'submitted', deadline: daysFromNow(-5) }),
        ],
      });
      const card = await cardTitled('Recommendation letters');
      expect(await within(card).findByText('No letters need attention.')).toBeVisible();
      expect(card).toHaveTextContent('1 of 2 letters submitted');
      expect(within(card).queryByRole('list')).not.toBeInTheDocument();
    });

    it(`lists no more than ${LETTERS_SHOWN}`, async () => {
      const people = Array.from({ length: LETTERS_SHOWN + 2 }, (_, index) =>
        fakeRecommender({ id: `r${index}`, name: `Person ${index}` }),
      );
      open({
        recommenders: people,
        requests: people.map((person, index) =>
          fakeRequest({
            recommender_id: person.id,
            application_id: 'stanford',
            status: 'requested',
            deadline: daysFromNow(index + 1),
          }),
        ),
      });
      const card = await cardTitled('Recommendation letters');
      const list = await within(card).findByRole('list', { name: 'Letters that need attention' });
      expect(within(list).getAllByRole('listitem')).toHaveLength(LETTERS_SHOWN);
    });

    it('invites you to add a recommender when there are no letters', async () => {
      open();
      const card = await cardTitled('Recommendation letters');
      expect(await within(card).findByText(/No letters to track yet/)).toBeVisible();
    });

    it('says why, and can try again, when the letters cannot be loaded', async () => {
      const { recommendations } = open({ recommenders: [dr] });
      recommendations.api.listRequests.mockRejectedValueOnce(new DataError('network'));
      const card = await cardTitled('Recommendation letters');
      expect(await within(card).findByText('Unable to load your letters')).toBeVisible();
      fireEvent.click(within(card).getByRole('button', { name: 'Try again' }));
      await waitFor(() =>
        expect(within(card).queryByText('Unable to load your letters')).not.toBeInTheDocument(),
      );
    });
  });

  describe('recent activity', () => {
    it('lists the latest changes, newest first, in words, with how long ago', async () => {
      const now = Date.now();
      const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
      open({
        programs: [stanford()],
        activity: [
          fakeActivity({
            kind: 'status_changed',
            subject: 'Stanford University, Computer Science',
            detail: 'submitted',
            application_id: 'stanford',
            created_at: ago(5),
          }),
          fakeActivity({
            kind: 'task_completed',
            subject: 'Email Prof. Lee',
            application_id: 'stanford',
            created_at: ago(120),
          }),
          fakeActivity({
            kind: 'application_added',
            subject: 'Stanford University, Computer Science',
            application_id: 'stanford',
            created_at: ago(60 * 24 * 3),
          }),
        ],
      });
      const card = await cardTitled('Recent activity');
      const list = await within(card).findByRole('list', { name: 'Recent activity' });
      const rows = within(list).getAllByRole('listitem');
      expect(rows).toHaveLength(3);
      expect(rows[0]).toHaveTextContent('Status changed to Submitted');
      expect(rows[0]).toHaveTextContent('Stanford University, Computer Science');
      expect(rows[0]).toHaveTextContent('5 minutes ago');
      expect(rows[1]).toHaveTextContent('Completed “Email Prof. Lee”');
      expect(rows[1]).toHaveTextContent('2 hours ago');
      expect(rows[2]).toHaveTextContent('Added a program');
      expect(rows[2]).toHaveTextContent('3 days ago');
    });

    it('links a change to the place where it was made', async () => {
      open({
        programs: [stanford()],
        activity: [
          fakeActivity({
            kind: 'status_changed',
            detail: 'submitted',
            subject: 'Stanford University, Computer Science',
            application_id: 'stanford',
          }),
        ],
      });
      const card = await cardTitled('Recent activity');
      expect(
        await within(card).findByRole('link', { name: 'Status changed to Submitted' }),
      ).toHaveAttribute('href', '/app/applications/stanford');
    });

    it('does not link to a program that has since been deleted', async () => {
      open({
        programs: [stanford()],
        activity: [
          fakeActivity({
            kind: 'task_completed',
            subject: 'Email Prof. Lee',
            application_id: 'gone',
          }),
          fakeActivity({
            kind: 'application_removed',
            subject: 'MIT, Robotics',
            application_id: null,
          }),
        ],
      });
      const card = await cardTitled('Recent activity');
      const list = await within(card).findByRole('list', { name: 'Recent activity' });
      expect(within(list).queryAllByRole('link')).toHaveLength(0);
      expect(list).toHaveTextContent('Completed “Email Prof. Lee”');
      expect(list).toHaveTextContent('Removed a program');
    });

    it('shows a kind it does not know as what the database said, rather than failing', async () => {
      open({
        activity: [fakeActivity({ kind: 'something_new', subject: 'A new kind of change' })],
      });
      const card = await cardTitled('Recent activity');
      expect(await within(card).findByText('A new kind of change')).toBeVisible();
    });

    it('says what will appear when there is nothing yet', async () => {
      open({ activity: [] });
      const card = await cardTitled('Recent activity');
      expect(await within(card).findByText(/Nothing yet/)).toBeVisible();
    });

    it('reads the log again when the dashboard is opened again', async () => {
      const { activityFake } = open({ activity: [fakeActivity({ subject: 'First' })] });
      const card = await cardTitled('Recent activity');
      await within(card).findByRole('list', { name: 'Recent activity' });
      expect(activityFake.api.recent).toHaveBeenCalledTimes(1);
    });

    it('says why, and can try again, when the activity cannot be loaded', async () => {
      const { activityFake } = open({
        activity: [fakeActivity({ kind: 'task_completed', subject: 'Email' })],
      });
      activityFake.api.recent.mockRejectedValueOnce(new DataError('network'));
      const card = await cardTitled('Recent activity');
      expect(await within(card).findByText('Unable to load your activity')).toBeVisible();
      fireEvent.click(within(card).getByRole('button', { name: 'Try again' }));
      expect(await within(card).findByRole('list', { name: 'Recent activity' })).toBeVisible();
    });
  });

  describe('when one card cannot load', () => {
    it('leaves every other card as it is', async () => {
      const { tasksFake } = open({
        programs: [stanford({ deadline: daysFromNow(3) })],
        tasks: [fakeTask({ title: 'Email Prof. Lee', due_date: daysFromNow(2) })],
        activity: [fakeActivity({ subject: 'Email Prof. Lee' })],
      });
      tasksFake.api.list.mockRejectedValueOnce(new DataError('network'));
      const tasks = await cardTitled('Tasks');
      expect(await within(tasks).findByText('Unable to load tasks')).toBeVisible();

      // The one alert on the page is the failed card; the others are showing what they have.
      expect(screen.getAllByRole('alert')).toHaveLength(1);
      expect(
        within(await cardTitled('Recent activity')).getByRole('list', { name: 'Recent activity' }),
      ).toBeVisible();
      expect(
        within(await cardTitled('Recommendation letters')).getByText(/No letters to track yet/),
      ).toBeVisible();
      expect(
        within(await cardTitled('Application progress')).getByText(/Add required items/),
      ).toBeVisible();
      expect(stat('Total programs')).toBe('1');
    });

    it('asks again only for what failed', async () => {
      const { applications, requirementsFake, recommendations, tasksFake, activityFake } = open({
        tasks: [fakeTask({ title: 'Email Prof. Lee' })],
      });
      tasksFake.api.list.mockRejectedValueOnce(new DataError('network'));
      const tasks = await cardTitled('Tasks');
      await within(tasks).findByText('Unable to load tasks');
      await within(await cardTitled('Recent activity')).findByText(/Nothing yet/);
      const asked = () =>
        [
          applications.api.list,
          requirementsFake.api.list,
          recommendations.api.listRecommenders,
          recommendations.api.listRequests,
          tasksFake.api.list,
          activityFake.api.recent,
        ].map((mock) => mock.mock.calls.length);
      const before = asked();

      fireEvent.click(within(tasks).getByRole('button', { name: 'Try again' }));
      await within(tasks).findByRole('link', { name: 'Email Prof. Lee' });
      const after = asked();
      expect(after[4]).toBe(before[4]! + 1); // tasks
      expect(after.filter((_, index) => index !== 4)).toEqual(
        before.filter((_, index) => index !== 4),
      );
    });

    it('keeps showing what a card had, and warns, when a refresh fails', async () => {
      const { tasksFake, queryClient } = open({
        tasks: [fakeTask({ title: 'Email Prof. Lee', due_date: daysFromNow(2) })],
      });
      const tasks = await cardTitled('Tasks');
      await within(tasks).findByRole('link', { name: 'Email Prof. Lee' });
      tasksFake.api.list.mockRejectedValueOnce(new DataError('network'));
      await act(() => queryClient.invalidateQueries({ queryKey: ['tasks', 'user-1'] }));
      expect(await within(tasks).findByText('Unable to refresh')).toBeVisible();
      expect(within(tasks).getByRole('link', { name: 'Email Prof. Lee' })).toBeVisible();
      expect(tasks).toHaveTextContent('Showing what loaded last.');
    });
  });

  describe('is made only of your own data', () => {
    it('shows no number, date or name that is not in what was loaded', async () => {
      open({ programs: [fakeRecord({ status: 'researching' })] });
      await screen.findByText('Total programs', { selector: 'dt' });
      expect(stat('Total programs')).toBe('1');
      // Nothing is due, nothing to do, nobody asked: every card says so rather than inventing.
      expect(
        await within(await cardTitled('Upcoming deadlines')).findByText(/Nothing is due/),
      ).toBeVisible();
      expect(within(await cardTitled('Tasks')).getByText(/No tasks yet/)).toBeVisible();
      expect(
        within(await cardTitled('Recommendation letters')).getByText(/No letters to track yet/),
      ).toBeVisible();
      expect(within(await cardTitled('Recent activity')).getByText(/Nothing yet/)).toBeVisible();
    });
  });
});
