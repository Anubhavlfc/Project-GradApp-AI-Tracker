import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { FundingRow } from '@/features/funding/types';
import type { RecommenderRow, RequestRow } from '@/features/recommendations/types';
import type { RequirementRow } from '@/features/requirements/types';
import type { TaskRow } from '@/features/tasks/types';
import { DataError } from '@/lib/dataError';
import { createFakeApplicationsApi, daysFromNow, fakeRecord } from '@/test/fakeApplicationsApi';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import { createFakeFundingApi, fakeFunding } from '@/test/fakeFundingApi';
import { createFakeRecommendationsApi } from '@/test/fakeRecommendationsApi';
import { createFakeRequirementsApi } from '@/test/fakeRequirementsApi';
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
    program_name: 'Applied Computing',
    university: { name: 'University of Toronto' },
    status: 'application_started',
    ...overrides,
  });

type Data = {
  programs?: ReturnType<typeof stanford>[];
  requirements?: RequirementRow[];
  recommenders?: RecommenderRow[];
  requests?: RequestRow[];
  funding?: FundingRow[];
  tasks?: TaskRow[];
  path?: string;
};

function open({
  programs = [stanford(), toronto()],
  requirements = [],
  recommenders = [],
  requests = [],
  funding = [],
  tasks = [],
  path = '/app/deadlines',
}: Data = {}) {
  const applications = createFakeApplicationsApi(programs);
  const requirementsFake = createFakeRequirementsApi(requirements);
  const recommendations = createFakeRecommendationsApi({ recommenders, requests });
  const fundingFake = createFakeFundingApi(funding);
  const tasksFake = createFakeTasksApi(tasks);
  const view = renderApp(path, createFakeAuth(fakeSession()).client, {
    api: applications.api,
    requirementsApi: requirementsFake.api,
    recommendationsApi: recommendations.api,
    fundingApi: fundingFake.api,
    tasksApi: tasksFake.api,
  });
  return {
    ...view,
    applications,
    requirementsFake,
    recommendations,
    fundingFake,
    tasksFake,
  };
}

const heading = (name: string) => screen.findByRole('heading', { level: 2, name });
const group = (name: string) => screen.getByRole('list', { name });
const titlesIn = (name: string) =>
  within(group(name))
    .getAllByRole('listitem')
    .map((row) => within(row).getAllByRole('link')[0]!.textContent);
/** The message box with this title (a warning is a status, an error an alert). */
const messageTitled = async (title: string) =>
  (await screen.findByText(title)).closest('[role]') as HTMLElement;
const rowFor = (title: string) =>
  screen.getByRole('link', { name: title }).closest('li') as HTMLElement;

describe('the deadlines page', () => {
  describe('getting there', () => {
    it('is in the sidebar', async () => {
      open();
      await screen.findByRole('heading', { level: 1, name: 'Deadlines' });
      const nav = screen.getAllByRole('navigation', { name: 'Primary' })[0]!;
      expect(within(nav).getByRole('link', { name: 'Deadlines' })).toHaveAttribute(
        'href',
        '/app/deadlines',
      );
      expect(within(nav).getByRole('link', { name: 'Deadlines' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('shows that it is loading, then the deadlines', async () => {
      const { applications } = open({ programs: [stanford({ deadline: daysFromNow(3) })] });
      let release = () => {};
      applications.api.list.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve(applications.records);
          }),
      );
      expect(await screen.findByText('Loading deadlines')).toBeInTheDocument();
      release();
      expect(await heading('Next 7 days')).toBeVisible();
      expect(screen.queryByText('Loading deadlines')).not.toBeInTheDocument();
    });
  });

  describe('with nothing dated', () => {
    it('says so, and points to the applications', async () => {
      open({ programs: [stanford(), toronto()] });
      expect(await screen.findByRole('heading', { name: 'No upcoming deadlines.' })).toBeVisible();
      expect(screen.getByRole('link', { name: 'Go to applications' })).toHaveAttribute(
        'href',
        '/app/applications',
      );
      expect(screen.queryByRole('heading', { level: 2, name: 'Today' })).not.toBeInTheDocument();
    });

    it('says the same when there are no programs at all', async () => {
      open({ programs: [] });
      expect(await screen.findByRole('heading', { name: 'No upcoming deadlines.' })).toBeVisible();
    });

    it('does not list history: sent letters, finished work, and programs already submitted', async () => {
      open({
        programs: [
          stanford({ status: 'submitted', deadline: daysFromNow(2) }),
          toronto({ status: 'application_started' }),
        ],
        requirements: [
          {
            ...requirement('toronto', 'gre', daysFromNow(2)),
            status: 'complete',
          },
        ],
        recommenders: [recommender('lee', 'Dr. Lee')],
        requests: [
          {
            ...request('lee', 'toronto', daysFromNow(2)),
            status: 'submitted',
          },
        ],
        funding: [fakeFunding({ deadline: daysFromNow(2), status: 'applied' })],
        tasks: [fakeTask({ due_date: daysFromNow(2), status: 'complete' })],
      });
      expect(await screen.findByRole('heading', { name: 'No upcoming deadlines.' })).toBeVisible();
    });
  });

  describe('the list', () => {
    const fixture = (): Data => ({
      programs: [stanford({ deadline: daysFromNow(0) }), toronto({ deadline: daysFromNow(90) })],
      requirements: [requirement('stanford', 'gre', daysFromNow(3))],
      recommenders: [recommender('lee', 'Dr. Lee')],
      requests: [request('lee', 'stanford', daysFromNow(9))],
      funding: [fakeFunding({ name: 'Outside grant', deadline: daysFromNow(20) })],
      tasks: [
        fakeTask({ title: 'Order transcripts', application_id: null, due_date: daysFromNow(-3) }),
        fakeTask({
          title: 'Email Prof. Lee',
          application_id: 'stanford',
          due_date: daysFromNow(1),
        }),
      ],
    });

    it('groups everything by how soon it is, soonest first', async () => {
      open(fixture());
      await heading('Overdue');
      expect(screen.getAllByRole('heading', { level: 2 }).map((item) => item.textContent)).toEqual([
        'Overdue1',
        'Today1',
        'Next 7 days2',
        'Next 30 days2',
        'Later1',
      ]);

      expect(titlesIn('Overdue')).toEqual(['Order transcripts']);
      expect(titlesIn('Today')).toEqual(['Application deadline']);
      expect(titlesIn('Next 7 days')).toEqual(['Email Prof. Lee', 'GRE']);
      expect(titlesIn('Next 30 days')).toEqual(['Letter from Dr. Lee', 'Outside grant']);
      expect(titlesIn('Later')).toEqual(['Application deadline']);
    });

    it('summarises what needs attention', async () => {
      open(fixture());
      expect(
        await screen.findByText('1 overdue · 1 due today · 2 in the next 7 days'),
      ).toBeVisible();
    });

    it('says when nothing is close', async () => {
      open({ programs: [stanford({ deadline: daysFromNow(45) })] });
      expect(await screen.findByText('Nothing is due in the next 7 days.')).toBeVisible();
    });

    it('shows the date, how far away it is, and the program, on each row', async () => {
      open(fixture());
      await heading('Overdue');
      const overdue = rowFor('Order transcripts');
      expect(overdue).toHaveTextContent('3 days overdue');
      expect(overdue).toHaveTextContent('Task');
      const letter = rowFor('Letter from Dr. Lee');
      expect(letter).toHaveTextContent('In 9 days');
      expect(letter).toHaveTextContent('Stanford University, Computer Science');
      expect(rowFor('Email Prof. Lee')).toHaveTextContent('Due tomorrow');
      expect(within(group('Today')).getByText('Due today')).toBeVisible();
      // Far away enough that the date alone says enough.
      expect(
        within(group('Later')).getByText('University of Toronto, Applied Computing'),
      ).toBeVisible();
      expect(within(group('Later')).queryByText(/^In \d+ days$/)).not.toBeInTheDocument();
    });

    it('links each row to the place where it can be dealt with', async () => {
      open(fixture());
      await heading('Overdue');
      const hrefOf = (title: string) =>
        screen.getByRole('link', { name: title }).getAttribute('href');
      expect(hrefOf('Order transcripts')).toBe('/app/tasks');
      expect(hrefOf('Email Prof. Lee')).toBe('/app/applications/stanford/tasks');
      expect(hrefOf('GRE')).toBe('/app/applications/stanford/requirements');
      expect(hrefOf('Letter from Dr. Lee')).toBe('/app/applications/stanford/recommendations');
      expect(hrefOf('Outside grant')).toBe('/app/funding');
      expect(
        within(group('Today')).getByRole('link', { name: 'Application deadline' }),
      ).toHaveAttribute('href', '/app/applications/stanford');
      expect(
        within(group('Later')).getByRole('link', { name: 'Application deadline' }),
      ).toHaveAttribute('href', '/app/applications/toronto');
    });

    it('lists a program’s interview and reply-by date too', async () => {
      const soon = new Date();
      soon.setDate(soon.getDate() + 2);
      soon.setHours(14, 30, 0, 0);
      open({
        programs: [
          stanford({
            status: 'accepted',
            interview_at: soon.toISOString(),
            decision_deadline: daysFromNow(12),
          }),
        ],
      });
      await heading('Next 7 days');
      expect(titlesIn('Next 7 days')).toEqual(['Interview']);
      expect(rowFor('Interview')).toHaveTextContent('2:30 PM');
      expect(titlesIn('Next 30 days')).toEqual(['Reply to offer']);
    });

    it('keeps a row a link, in reading order, for a keyboard or a screen reader', async () => {
      open(fixture());
      await heading('Overdue');
      const links = within(screen.getByRole('main')).getAllByRole('link');
      expect(links.map((link) => link.textContent)).toEqual([
        'Order transcripts',
        'Application deadline',
        'Email Prof. Lee',
        'GRE',
        'Letter from Dr. Lee',
        'Outside grant',
        'Application deadline',
      ]);
    });
  });

  describe('when something cannot be loaded', () => {
    it('says it cannot list anything when the programs are not there, and can try again', async () => {
      const { applications } = open({ programs: [stanford({ deadline: daysFromNow(3) })] });
      applications.api.list.mockRejectedValueOnce(new DataError('network'));
      const alert = await messageTitled('Unable to load deadlines');
      expect(alert).toHaveAttribute('role', 'alert');
      expect(alert).toHaveTextContent(/Can't reach the server/);
      expect(
        screen.queryByRole('heading', { name: 'No upcoming deadlines.' }),
      ).not.toBeInTheDocument();

      fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
      expect(await heading('Next 7 days')).toBeVisible();
      expect(screen.queryByText('Unable to load deadlines')).not.toBeInTheDocument();
    });

    it('still lists the rest when one list fails, says which is missing, and can try again', async () => {
      const { tasksFake } = open({
        programs: [stanford({ deadline: daysFromNow(3) })],
        tasks: [fakeTask({ title: 'Email Prof. Lee', due_date: daysFromNow(2) })],
      });
      tasksFake.api.list.mockRejectedValueOnce(new DataError('network'));
      const alert = await messageTitled('Some deadlines are missing');
      expect(alert).toHaveTextContent(
        'Couldn’t load your tasks, so their deadlines are not listed.',
      );
      expect(titlesIn('Next 7 days')).toEqual(['Application deadline']);

      fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
      await waitFor(() =>
        expect(titlesIn('Next 7 days')).toEqual(['Email Prof. Lee', 'Application deadline']),
      );
      expect(screen.queryByText('Some deadlines are missing')).not.toBeInTheDocument();
    });

    it('names every list that is missing', async () => {
      const { requirementsFake, fundingFake, tasksFake } = open({
        programs: [stanford({ deadline: daysFromNow(3) })],
      });
      requirementsFake.api.list.mockRejectedValueOnce(new DataError('network'));
      fundingFake.api.list.mockRejectedValueOnce(new DataError('network'));
      tasksFake.api.list.mockRejectedValueOnce(new DataError('network'));
      expect(await messageTitled('Some deadlines are missing')).toHaveTextContent(
        'Couldn’t load your checklist items, funding, and tasks',
      );
    });

    it('counts a failed list of people or letters as missing letters', async () => {
      const { recommendations } = open({ programs: [stanford({ deadline: daysFromNow(3) })] });
      recommendations.api.listRecommenders.mockRejectedValueOnce(new DataError('network'));
      expect(await messageTitled('Some deadlines are missing')).toHaveTextContent(
        'Couldn’t load your recommendation letters',
      );
    });

    it('asks again only for the lists that failed', async () => {
      const { applications, requirementsFake, recommendations, fundingFake, tasksFake } = open({
        programs: [stanford({ deadline: daysFromNow(3) })],
      });
      tasksFake.api.list.mockRejectedValueOnce(new DataError('network'));
      const alert = await messageTitled('Some deadlines are missing');
      const asked = () =>
        [
          applications.api.list,
          requirementsFake.api.list,
          recommendations.api.listRecommenders,
          recommendations.api.listRequests,
          fundingFake.api.list,
          tasksFake.api.list,
        ].map((mock) => mock.mock.calls.length);
      expect(asked()).toEqual([1, 1, 1, 1, 1, 1]);

      fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
      await waitFor(() => expect(tasksFake.api.list).toHaveBeenCalledTimes(2));
      await waitFor(() =>
        expect(screen.queryByText('Some deadlines are missing')).not.toBeInTheDocument(),
      );
      expect(asked()).toEqual([1, 1, 1, 1, 1, 2]);
    });

    it('puts a list that is missing before one that is only old, and blames the right failure', async () => {
      const { tasksFake, fundingFake, queryClient } = open({
        programs: [stanford({ deadline: daysFromNow(3) })],
        funding: [fakeFunding({ name: 'Knight Fellowship', deadline: daysFromNow(4) })],
      });
      tasksFake.api.list.mockRejectedValueOnce(new DataError('network'));
      await messageTitled('Some deadlines are missing');

      // Funding loaded, and then could not be refreshed: old, but not missing.
      fundingFake.api.list.mockRejectedValueOnce(new DataError('session'));
      await act(() => queryClient.invalidateQueries({ queryKey: ['funding', 'user-1'] }));
      const alert = await messageTitled('Some deadlines are missing');
      expect(alert).toHaveTextContent('Couldn’t load your tasks');
      expect(alert).toHaveTextContent("Can't reach the server");
      expect(alert).not.toHaveTextContent('session');
      expect(screen.queryByText('Unable to refresh deadlines')).not.toBeInTheDocument();
    });

    it('keeps the last list, and says it could not refresh, when a list fails after loading', async () => {
      const { tasksFake, queryClient } = open({
        programs: [stanford({ deadline: daysFromNow(3) })],
        tasks: [fakeTask({ title: 'Email Prof. Lee', due_date: daysFromNow(2) })],
      });
      await heading('Next 7 days');
      expect(titlesIn('Next 7 days')).toEqual(['Email Prof. Lee', 'Application deadline']);

      tasksFake.api.list.mockRejectedValueOnce(new DataError('network'));
      await act(() => queryClient.invalidateQueries({ queryKey: ['tasks', 'user-1'] }));
      const alert = await messageTitled('Unable to refresh deadlines');
      expect(alert).toHaveTextContent('Showing the last list that loaded.');
      expect(titlesIn('Next 7 days')).toEqual(['Email Prof. Lee', 'Application deadline']);

      fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
      await waitFor(() =>
        expect(screen.queryByText('Unable to refresh deadlines')).not.toBeInTheDocument(),
      );
    });
  });

  describe('when the day changes', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('counts from the new day when the page is looked at again, without a reload', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-15T20:30:00') });
      open({ programs: [stanford({ deadline: '2026-10-18' })] });
      await heading('Next 7 days');
      expect(rowFor('Application deadline')).toHaveTextContent('In 3 days');

      // The computer slept through midnight; nothing is read from the server again.
      vi.setSystemTime(new Date('2026-10-16T09:00:00'));
      act(() => {
        window.dispatchEvent(new Event('focus'));
      });
      await waitFor(() => expect(rowFor('Application deadline')).toHaveTextContent('In 2 days'));
    });
  });

  describe('staying in step with the rest of the app', () => {
    it('drops a task when it is finished on the Tasks page', async () => {
      const { tasksFake } = open({
        path: '/app/tasks',
        programs: [stanford()],
        tasks: [fakeTask({ id: 'call', title: 'Call the office', due_date: daysFromNow(2) })],
      });
      const row = (await screen.findByText('Call the office')).closest('li') as HTMLElement;
      fireEvent.click(
        within(row).getByRole('button', {
          name: (label) => label.endsWith('. Change status of Call the office'),
        }),
      );
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Complete' }));
      await waitFor(() => expect(tasksFake.api.setStatus).toHaveBeenCalledWith('call', 'complete'));

      const nav = screen.getAllByRole('navigation', { name: 'Primary' })[0]!;
      fireEvent.click(within(nav).getByRole('link', { name: 'Deadlines' }));
      expect(await screen.findByRole('heading', { name: 'No upcoming deadlines.' })).toBeVisible();
    });

    it('lists a task added on the Tasks page', async () => {
      const { tasksFake } = open({ path: '/app/tasks', programs: [stanford()] });
      fireEvent.click(await screen.findByRole('button', { name: 'Add task' }));
      const dialog = await screen.findByRole('dialog', { name: 'Add task' });
      fireEvent.change(within(dialog).getByLabelText(/^Title/), {
        target: { value: 'Book the GRE' },
      });
      fireEvent.change(within(dialog).getByLabelText('Due date'), {
        target: { value: daysFromNow(4) },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add task' }));
      await waitFor(() => expect(tasksFake.api.create).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: 'Add task' })).not.toBeInTheDocument(),
      );

      const nav = screen.getAllByRole('navigation', { name: 'Primary' })[0]!;
      fireEvent.click(within(nav).getByRole('link', { name: 'Deadlines' }));
      await heading('Next 7 days');
      expect(titlesIn('Next 7 days')).toEqual(['Book the GRE']);
    });
  });
});

// ---------------------------------------------------------------------------------------------
// Rows

function requirement(applicationId: string, kind: RequirementRow['kind'], dueDate: string) {
  return {
    id: `requirement-${applicationId}-${kind}`,
    application_id: applicationId,
    kind,
    label: null,
    is_required: true,
    status: 'not_started',
    due_date: dueDate,
    document_id: null,
    notes: null,
    created_at: '2026-09-01T00:00:00+00:00',
    updated_at: '2026-09-01T00:00:00+00:00',
  } satisfies RequirementRow;
}

function recommender(id: string, name: string): RecommenderRow {
  return {
    id,
    name,
    title: null,
    institution: null,
    email: null,
    notes: null,
    created_at: '2026-09-01T00:00:00+00:00',
    updated_at: '2026-09-01T00:00:00+00:00',
  };
}

function request(recommenderId: string, applicationId: string, deadline: string): RequestRow {
  return {
    id: `request-${recommenderId}-${applicationId}`,
    recommender_id: recommenderId,
    application_id: applicationId,
    status: 'requested',
    requested_on: null,
    deadline,
    notes: null,
    created_at: '2026-09-01T00:00:00+00:00',
    updated_at: '2026-09-01T00:00:00+00:00',
  };
}
