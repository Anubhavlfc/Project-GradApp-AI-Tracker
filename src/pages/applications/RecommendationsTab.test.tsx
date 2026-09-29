import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { toISODate } from '@/features/applications/dates';
import type { RecommenderRow, RequestRow } from '@/features/recommendations/types';
import { DataError } from '@/lib/dataError';
import { createFakeApplicationsApi, daysFromNow, fakeRecord } from '@/test/fakeApplicationsApi';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import {
  createFakeRecommendationsApi,
  fakeRecommender,
  fakeRequest,
} from '@/test/fakeRecommendationsApi';
import { renderApp } from '@/test/renderApp';

const stanford = (overrides: Parameters<typeof fakeRecord>[0] = {}) =>
  fakeRecord({
    program_name: 'Computer Science',
    degree_type: 'MS',
    status: 'documents_in_progress',
    university: { name: 'Stanford University' },
    ...overrides,
  });

const person = (name: string, extra: Partial<RecommenderRow> = {}) =>
  fakeRecommender({ id: name, name, ...extra });
const lee = () =>
  person('Dr. Ada Lee', { title: 'Professor', institution: 'MIT', email: 'ada@mit.edu' });
const ortiz = () => person('Prof. Sam Ortiz');
const chen = () => person('Dr. Wei Chen');

type Letter = Partial<RequestRow> & { recommender_id: string };

/** Opens the Recommendations tab of one program, with these people and letters on file. */
function open({
  people = [lee(), ortiz(), chen()],
  letters = [],
  record = stanford(),
  path = 'recommendations',
}: {
  people?: RecommenderRow[];
  letters?: Letter[];
  record?: ReturnType<typeof stanford>;
  path?: string;
} = {}) {
  const applications = createFakeApplicationsApi([record]);
  const recommendations = createFakeRecommendationsApi({
    recommenders: people,
    requests: letters.map((letter) => fakeRequest({ application_id: record.id, ...letter })),
  });
  const view = renderApp(
    `/app/applications/${record.id}/${path}`,
    createFakeAuth(fakeSession()).client,
    { api: applications.api, recommendationsApi: recommendations.api },
  );
  return { ...view, record, applications, recommendations };
}

const list = () => screen.getByRole('list', { name: 'Recommendation letters' });
const ready = () => screen.findByRole('list', { name: 'Recommendation letters' });
const subjectOf = (name: string) => `${name}'s letter`;
/** The people on the list, top to bottom. */
const names = () =>
  within(list())
    .getAllByRole('button', { name: /^Actions for / })
    .map((button) =>
      button.getAttribute('aria-label')!.slice('Actions for '.length, -"'s letter".length),
    );
const rowFor = (name: string) =>
  within(list())
    .getByRole('button', { name: `Actions for ${subjectOf(name)}` })
    .closest('li') as HTMLElement;
const statusButton = (name: string) =>
  within(rowFor(name)).getByRole('button', {
    name: (label) => label.endsWith(`. Change status of ${subjectOf(name)}`),
  });
const statusOf = (name: string) => statusButton(name).getAttribute('aria-label')!.split('.')[0];

function changeStatus(name: string, status: string) {
  fireEvent.click(statusButton(name));
  fireEvent.click(screen.getByRole('menuitemradio', { name: status }));
}
function chooseAction(name: string, action: 'Edit request' | 'Remove request…') {
  fireEvent.click(
    within(rowFor(name)).getByRole('button', { name: `Actions for ${subjectOf(name)}` }),
  );
  fireEvent.click(screen.getByRole('menuitem', { name: action }));
}

const field = (dialog: HTMLElement, label: RegExp | string) =>
  within(dialog).getByLabelText(label) as HTMLInputElement;
const setField = (dialog: HTMLElement, label: RegExp | string, value: string) =>
  fireEvent.change(field(dialog, label), { target: { value } });
const gone = (name: string) =>
  waitFor(() => expect(screen.queryByRole('dialog', { name })).not.toBeInTheDocument());

async function openRequestForm() {
  fireEvent.click((await screen.findAllByRole('button', { name: 'Request a letter' }))[0]!);
  return screen.findByRole('dialog', { name: 'Request a letter' });
}
const submitRequest = (dialog: HTMLElement) =>
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add request' }));

describe('a program’s recommendations tab', () => {
  describe('getting there', () => {
    it('is a tab on the program page', async () => {
      const { record } = open({ path: '' });
      const tabs = await screen.findByRole('navigation', { name: 'Sections of this program' });
      fireEvent.click(within(tabs).getByRole('link', { name: 'Recommendations' }));
      expect(
        await screen.findByRole('heading', { name: 'No letters requested yet.' }),
      ).toBeVisible();
      expect(within(tabs).getByRole('link', { name: 'Recommendations' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(within(tabs).getByRole('link', { name: 'Recommendations' })).toHaveAttribute(
        'href',
        `/app/applications/${record.id}/recommendations`,
      );
    });

    it('shows that it is loading, then the letters', async () => {
      const { recommendations } = open({ letters: [{ recommender_id: 'Dr. Ada Lee' }] });
      let release = () => {};
      recommendations.api.listRequests.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve(recommendations.requests);
          }),
      );
      expect(await screen.findByText('Loading recommendation letters')).toBeInTheDocument();
      expect(
        screen.queryByRole('list', { name: 'Recommendation letters' }),
      ).not.toBeInTheDocument();
      release();
      await ready();
      expect(names()).toEqual(['Dr. Ada Lee']);
    });
  });

  describe('with no letters', () => {
    it('invites you to request the first one', async () => {
      open();
      expect(
        await screen.findByRole('heading', { name: 'No letters requested yet.' }),
      ).toBeVisible();
      expect(screen.getByRole('button', { name: 'Request a letter' })).toBeEnabled();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  describe('the letters', () => {
    it('lists the soonest deadline first, and letters without one last', async () => {
      open({
        letters: [
          { recommender_id: 'Dr. Wei Chen', deadline: null },
          { recommender_id: 'Prof. Sam Ortiz', deadline: '2026-12-15' },
          { recommender_id: 'Dr. Ada Lee', deadline: '2026-11-20' },
        ],
      });
      await ready();
      expect(names()).toEqual(['Dr. Ada Lee', 'Prof. Sam Ortiz', 'Dr. Wei Chen']);
    });

    it('shows who is writing, where they work, how to reach them, and the dates', async () => {
      open({
        letters: [
          {
            recommender_id: 'Dr. Ada Lee',
            status: 'requested',
            requested_on: '2026-10-03',
            deadline: '2027-01-05',
            notes: 'Asked after class.',
          },
        ],
      });
      await ready();
      const row = rowFor('Dr. Ada Lee');
      expect(within(row).getByText('Professor · MIT')).toBeInTheDocument();
      expect(within(row).getByRole('link', { name: 'ada@mit.edu' })).toHaveAttribute(
        'href',
        'mailto:ada@mit.edu',
      );
      expect(row).toHaveTextContent('Asked Oct 3, 2026');
      expect(row).toHaveTextContent('Due Jan 5, 2027');
      expect(within(row).getByText('Asked after class.')).toBeInTheDocument();
      expect(statusOf('Dr. Ada Lee')).toBe('Requested');
    });

    it('says a letter has not been asked for yet', async () => {
      open({ letters: [{ recommender_id: 'Dr. Ada Lee' }] });
      await ready();
      expect(rowFor('Dr. Ada Lee')).toHaveTextContent('Not asked yet');
    });

    it('counts the letters that have been submitted', async () => {
      open({
        letters: [
          { recommender_id: 'Dr. Ada Lee', status: 'submitted' },
          { recommender_id: 'Prof. Sam Ortiz', status: 'requested' },
          { recommender_id: 'Dr. Wei Chen', status: 'needs_follow_up' },
        ],
      });
      await ready();
      expect(screen.getByText('1 of 3')).toBeInTheDocument();
      expect(screen.getByText('letters submitted')).toBeInTheDocument();
      expect(screen.getByText('1 to follow up')).toBeInTheDocument();
      expect(
        screen.getByRole('progressbar', {
          name: 'Recommendation letters submitted for Stanford University, Computer Science',
        }),
      ).toHaveAttribute('aria-valuenow', '1');
    });

    it('celebrates when every letter is in', async () => {
      open({
        letters: [
          { recommender_id: 'Dr. Ada Lee', status: 'submitted' },
          { recommender_id: 'Prof. Sam Ortiz', status: 'submitted' },
        ],
      });
      await ready();
      expect(screen.getByText('2 of 2')).toBeInTheDocument();
      expect(screen.getByText('Every letter is submitted.')).toBeInTheDocument();
    });

    it('only shows this program’s letters', async () => {
      open({
        letters: [
          { recommender_id: 'Dr. Ada Lee' },
          { recommender_id: 'Prof. Sam Ortiz', application_id: 'some-other-program' },
        ],
      });
      await ready();
      expect(names()).toEqual(['Dr. Ada Lee']);
    });
  });

  describe('deadlines', () => {
    it('warns as a deadline nears and when it has passed', async () => {
      open({
        letters: [
          { recommender_id: 'Dr. Ada Lee', status: 'requested', deadline: daysFromNow(3) },
          { recommender_id: 'Prof. Sam Ortiz', status: 'requested', deadline: daysFromNow(-2) },
          { recommender_id: 'Dr. Wei Chen', status: 'requested', deadline: daysFromNow(200) },
        ],
      });
      await ready();
      expect(within(rowFor('Dr. Ada Lee')).getByText('In 3 days')).toBeInTheDocument();
      expect(within(rowFor('Prof. Sam Ortiz')).getByText('2 days overdue')).toBeInTheDocument();
      expect(rowFor('Dr. Wei Chen')).not.toHaveTextContent(/overdue|In \d+ days/);
    });

    it('does not call a submitted letter overdue', async () => {
      open({
        letters: [
          { recommender_id: 'Dr. Ada Lee', status: 'submitted', deadline: daysFromNow(-5) },
        ],
      });
      await ready();
      expect(rowFor('Dr. Ada Lee')).not.toHaveTextContent('overdue');
      expect(rowFor('Dr. Ada Lee')).toHaveTextContent('Due');
    });

    it('does not call a letter overdue once the program has been sent', async () => {
      open({
        record: stanford({ status: 'submitted' }),
        letters: [
          { recommender_id: 'Dr. Ada Lee', status: 'requested', deadline: daysFromNow(-5) },
        ],
      });
      await ready();
      expect(rowFor('Dr. Ada Lee')).not.toHaveTextContent('overdue');
    });
  });

  describe('requesting a letter', () => {
    it('starts with the program decided and its deadline filled in', async () => {
      open({ record: stanford({ deadline: '2026-12-15' }), letters: [] });
      const dialog = await openRequestForm();
      expect(dialog).toHaveTextContent('Stanford University, Computer Science');
      expect(field(dialog, /^Recommender/)).toHaveFocus();
      expect(field(dialog, /^Recommender/)).toHaveValue('');
      expect(field(dialog, 'Status')).toHaveValue('not_requested');
      expect(field(dialog, 'Deadline')).toHaveValue('2026-12-15');
    });

    it('saves a request to someone on the list', async () => {
      const { recommendations, record } = open({ record: stanford({ deadline: '2026-12-15' }) });
      const dialog = await openRequestForm();
      setField(dialog, /^Recommender/, 'Prof. Sam Ortiz');
      setField(dialog, 'Status', 'requested');
      setField(dialog, 'Date requested', '2026-10-03');
      setField(dialog, 'Notes', 'Emailed a draft.');
      submitRequest(dialog);

      expect(
        await screen.findByText(
          'Requested a letter from Prof. Sam Ortiz for Stanford University, Computer Science.',
        ),
      ).toBeInTheDocument();
      await gone('Request a letter');
      expect(recommendations.api.createRequest).toHaveBeenCalledWith({
        recommender_id: 'Prof. Sam Ortiz',
        application_id: record.id,
        status: 'requested',
        requested_on: '2026-10-03',
        deadline: '2026-12-15',
        notes: 'Emailed a draft.',
      });
      expect(recommendations.api.createRecommender).not.toHaveBeenCalled();
      expect(names()).toEqual(['Prof. Sam Ortiz']);
      expect(statusOf('Prof. Sam Ortiz')).toBe('Requested');
    });

    it('lets you set your own deadline, and keeps it', async () => {
      const { recommendations } = open({ record: stanford({ deadline: '2026-12-15' }) });
      const dialog = await openRequestForm();
      setField(dialog, /^Recommender/, 'Dr. Ada Lee');
      setField(dialog, 'Deadline', '2026-11-01');
      submitRequest(dialog);
      await screen.findByText(/Requested a letter from Dr. Ada Lee/);
      expect(recommendations.api.createRequest.mock.calls[0]![0]).toMatchObject({
        deadline: '2026-11-01',
      });
    });

    it('can save a letter with no deadline at all', async () => {
      const { recommendations } = open();
      const dialog = await openRequestForm();
      expect(field(dialog, 'Deadline')).toHaveValue('');
      setField(dialog, /^Recommender/, 'Dr. Ada Lee');
      submitRequest(dialog);
      await screen.findByText(/Requested a letter from Dr. Ada Lee/);
      expect(recommendations.api.createRequest.mock.calls[0]![0]).toMatchObject({ deadline: null });
    });

    it('greys out people who are already asked for this program', async () => {
      open({ letters: [{ recommender_id: 'Dr. Ada Lee' }] });
      await ready();
      const dialog = await openRequestForm();
      const options = within(field(dialog, /^Recommender/)).getAllByRole('option');
      const asked = options.find((option) => option.textContent?.includes('Dr. Ada Lee'))!;
      expect(asked).toBeDisabled();
      expect(asked).toHaveTextContent('(already asked)');
      expect(options.find((option) => option.textContent === 'Prof. Sam Ortiz')).toBeEnabled();
    });

    it('adds a new recommender and the request in one step', async () => {
      const { recommendations, record } = open({ people: [] });
      const dialog = await openRequestForm();
      // With nobody on file, the new-recommender fields are ready and waiting.
      expect(field(dialog, /^Recommender/)).toHaveValue('new');
      setField(dialog, /^Name/, 'Dr. Priya Rao');
      setField(dialog, 'Title', 'Lecturer');
      setField(dialog, 'Institution', 'UW');
      setField(dialog, 'Email', 'priya@uw.edu');
      submitRequest(dialog);

      expect(
        await screen.findByText(/Requested a letter from Dr. Priya Rao for Stanford University/),
      ).toBeInTheDocument();
      expect(recommendations.api.createRecommender).toHaveBeenCalledWith({
        name: 'Dr. Priya Rao',
        title: 'Lecturer',
        institution: 'UW',
        email: 'priya@uw.edu',
        notes: null,
      });
      expect(recommendations.recommenders).toHaveLength(1);
      expect(recommendations.api.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          recommender_id: recommendations.recommenders[0]!.id,
          application_id: record.id,
        }),
      );
      expect(names()).toEqual(['Dr. Priya Rao']);
    });

    it('offers to add a new recommender even when others are on file', async () => {
      open();
      const dialog = await openRequestForm();
      expect(within(dialog).queryByLabelText(/^Name/)).not.toBeInTheDocument();
      setField(dialog, /^Recommender/, 'new');
      expect(field(dialog, /^Name/)).toBeVisible();
    });

    it('explains what is missing without saving anything', async () => {
      const { recommendations } = open({ people: [] });
      const dialog = await openRequestForm();
      setField(dialog, 'Email', 'not-an-email');
      submitRequest(dialog);
      expect(await within(dialog).findByText("Enter the recommender's name.")).toBeInTheDocument();
      expect(
        within(dialog).getByText('Enter an email address, like name@university.edu.'),
      ).toBeInTheDocument();
      expect(field(dialog, /^Name/)).toHaveAttribute('aria-invalid', 'true');
      expect(field(dialog, /^Name/)).toHaveFocus();
      expect(recommendations.api.createRecommender).not.toHaveBeenCalled();
      expect(recommendations.api.createRequest).not.toHaveBeenCalled();
    });

    it('asks who is writing when nobody is chosen', async () => {
      const { recommendations } = open();
      const dialog = await openRequestForm();
      submitRequest(dialog);
      expect(
        await within(dialog).findByText('Choose who is writing the letter.'),
      ).toBeInTheDocument();
      expect(recommendations.api.createRequest).not.toHaveBeenCalled();
    });

    it('stays open and explains when saving fails, and works on the next try', async () => {
      const { recommendations } = open();
      recommendations.api.createRequest.mockRejectedValueOnce(new DataError('network'));
      const dialog = await openRequestForm();
      setField(dialog, /^Recommender/, 'Dr. Ada Lee');
      submitRequest(dialog);
      expect(await within(dialog).findByText('Failed to save request')).toBeVisible();
      expect(dialog).toHaveTextContent("Can't reach the server");
      submitRequest(dialog);
      expect(await screen.findByText(/Requested a letter from Dr. Ada Lee/)).toBeInTheDocument();
    });

    it('says so when the database already has a request from that person for this program', async () => {
      const { recommendations } = open();
      recommendations.api.createRequest.mockRejectedValueOnce(
        new DataError('unknown', { cause: { code: '23505' } }),
      );
      const dialog = await openRequestForm();
      setField(dialog, /^Recommender/, 'Dr. Ada Lee');
      submitRequest(dialog);
      expect(
        await within(dialog).findByText('That recommender already has a request for this program.'),
      ).toBeVisible();
    });

    it('does not add the new recommender twice when only the request failed', async () => {
      const { recommendations } = open({ people: [] });
      recommendations.api.createRequest.mockRejectedValueOnce(new DataError('network'));
      const dialog = await openRequestForm();
      setField(dialog, /^Name/, 'Dr. Priya Rao');
      submitRequest(dialog);
      expect(
        await within(dialog).findByText(/Saved Dr. Priya Rao, but couldn't add the request\./),
      ).toBeVisible();
      // The person is now chosen from the list, so trying again uses them.
      await waitFor(() =>
        expect(field(dialog, /^Recommender/)).toHaveValue(recommendations.recommenders[0]!.id),
      );
      submitRequest(dialog);
      expect(await screen.findByText(/Requested a letter from Dr. Priya Rao/)).toBeInTheDocument();
      expect(recommendations.api.createRecommender).toHaveBeenCalledTimes(1);
      expect(recommendations.api.createRequest).toHaveBeenCalledTimes(2);
      expect(recommendations.recommenders).toHaveLength(1);
    });

    it('starts clean each time it opens', async () => {
      open();
      let dialog = await openRequestForm();
      setField(dialog, /^Recommender/, 'Dr. Ada Lee');
      setField(dialog, 'Notes', 'half written');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await gone('Request a letter');
      dialog = await openRequestForm();
      expect(field(dialog, /^Recommender/)).toHaveValue('');
      expect(field(dialog, 'Notes')).toHaveValue('');
    });
  });

  describe('editing a request', () => {
    it('shows who and which program, and saves the changes', async () => {
      const { recommendations } = open({
        letters: [
          { recommender_id: 'Dr. Ada Lee', status: 'requested', requested_on: '2026-10-03' },
        ],
      });
      await ready();
      chooseAction('Dr. Ada Lee', 'Edit request');
      const dialog = await screen.findByRole('dialog', { name: 'Edit letter request' });
      expect(dialog).toHaveTextContent('Dr. Ada Lee');
      expect(dialog).toHaveTextContent('Stanford University, Computer Science');
      expect(within(dialog).queryByRole('combobox', { name: /^Recommender/ })).toBeNull();
      expect(field(dialog, 'Status')).toHaveValue('requested');
      expect(field(dialog, 'Date requested')).toHaveValue('2026-10-03');

      setField(dialog, 'Status', 'confirmed');
      setField(dialog, 'Deadline', '2026-12-20');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

      expect(await screen.findByText('Saved the request to Dr. Ada Lee.')).toBeInTheDocument();
      await gone('Edit letter request');
      expect(recommendations.api.updateRequest).toHaveBeenCalledWith(
        recommendations.requests[0]!.id,
        {
          status: 'confirmed',
          requested_on: '2026-10-03',
          deadline: '2026-12-20',
          notes: null,
        },
      );
      expect(statusOf('Dr. Ada Lee')).toBe('Confirmed');
      expect(rowFor('Dr. Ada Lee')).toHaveTextContent('Due Dec 20, 2026');
    });

    it('says so when the request was deleted in another tab', async () => {
      const { recommendations } = open({ letters: [{ recommender_id: 'Dr. Ada Lee' }] });
      await ready();
      recommendations.api.updateRequest.mockRejectedValueOnce(new DataError('not_found'));
      chooseAction('Dr. Ada Lee', 'Edit request');
      const dialog = await screen.findByRole('dialog', { name: 'Edit letter request' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
      expect(await within(dialog).findByText(/That request no longer exists/)).toBeVisible();
    });
  });

  describe('changing a status', () => {
    it('moves the letter at once and saves it', async () => {
      const { recommendations } = open({
        letters: [
          { recommender_id: 'Dr. Ada Lee', status: 'requested', requested_on: '2026-10-03' },
        ],
      });
      await ready();
      changeStatus('Dr. Ada Lee', 'Submitted');
      expect(
        await screen.findByRole('button', { name: /^Submitted\. Change status/ }),
      ).toBeVisible();
      await waitFor(() =>
        expect(recommendations.api.setRequestStatus).toHaveBeenCalledWith(
          recommendations.requests[0]!.id,
          'submitted',
          undefined,
        ),
      );
      expect(screen.getByText('1 of 1')).toBeInTheDocument();
    });

    it('offers all five statuses and marks the current one', async () => {
      open({ letters: [{ recommender_id: 'Dr. Ada Lee', status: 'confirmed' }] });
      await ready();
      fireEvent.click(statusButton('Dr. Ada Lee'));
      expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
        'Not Requested',
        'Requested',
        'Confirmed',
        'Submitted',
        'Needs Follow-Up',
      ]);
      expect(screen.getByRole('menuitemradio', { name: 'Confirmed' })).toBeChecked();
    });

    it('notes today as the date asked when you mark a letter Requested', async () => {
      const { recommendations } = open({ letters: [{ recommender_id: 'Dr. Ada Lee' }] });
      await ready();
      changeStatus('Dr. Ada Lee', 'Requested');
      await waitFor(() =>
        expect(recommendations.api.setRequestStatus).toHaveBeenCalledWith(
          recommendations.requests[0]!.id,
          'requested',
          toISODate(),
        ),
      );
      await waitFor(() => expect(rowFor('Dr. Ada Lee')).toHaveTextContent('Asked'));
      expect(rowFor('Dr. Ada Lee')).not.toHaveTextContent('Not asked yet');
    });

    it('keeps a date asked that you already gave', async () => {
      const { recommendations } = open({
        letters: [{ recommender_id: 'Dr. Ada Lee', requested_on: '2026-09-15' }],
      });
      await ready();
      changeStatus('Dr. Ada Lee', 'Requested');
      await waitFor(() => expect(recommendations.api.setRequestStatus).toHaveBeenCalled());
      expect(recommendations.api.setRequestStatus.mock.calls[0]![2]).toBeUndefined();
      expect(rowFor('Dr. Ada Lee')).toHaveTextContent('Asked Sep 15, 2026');
    });

    it('does not invent a date asked when you jump to a later status', async () => {
      const { recommendations } = open({ letters: [{ recommender_id: 'Dr. Ada Lee' }] });
      await ready();
      changeStatus('Dr. Ada Lee', 'Confirmed');
      await waitFor(() => expect(recommendations.api.setRequestStatus).toHaveBeenCalled());
      expect(recommendations.api.setRequestStatus.mock.calls[0]![2]).toBeUndefined();
    });

    it('does nothing when you pick the status it already has', async () => {
      const { recommendations } = open({
        letters: [{ recommender_id: 'Dr. Ada Lee', status: 'submitted' }],
      });
      await ready();
      changeStatus('Dr. Ada Lee', 'Submitted');
      expect(recommendations.api.setRequestStatus).not.toHaveBeenCalled();
    });

    it('puts the old status back and explains when saving fails', async () => {
      const { recommendations } = open({
        letters: [
          { recommender_id: 'Dr. Ada Lee', status: 'requested' },
          { recommender_id: 'Prof. Sam Ortiz', status: 'submitted' },
        ],
      });
      recommendations.api.setRequestStatus.mockRejectedValueOnce(new DataError('network'));
      await ready();
      changeStatus('Dr. Ada Lee', 'Submitted');
      expect(await screen.findByText("Couldn't update that letter")).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the server");
      await waitFor(() => expect(statusOf('Dr. Ada Lee')).toBe('Requested'));
      expect(screen.getByText('1 of 2')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(screen.queryByText("Couldn't update that letter")).not.toBeInTheDocument();
    });

    it('applies two quick changes to the same letter in the order they were made', async () => {
      const { recommendations } = open({ letters: [{ recommender_id: 'Dr. Ada Lee' }] });
      await ready();
      changeStatus('Dr. Ada Lee', 'Confirmed');
      changeStatus('Dr. Ada Lee', 'Submitted');
      await waitFor(() => expect(recommendations.api.setRequestStatus).toHaveBeenCalledTimes(2));
      expect(recommendations.api.setRequestStatus.mock.calls.map(([, status]) => status)).toEqual([
        'confirmed',
        'submitted',
      ]);
      await waitFor(() => expect(recommendations.requests[0]!.status).toBe('submitted'));
      expect(statusOf('Dr. Ada Lee')).toBe('Submitted');
    });
  });

  describe('removing a request', () => {
    async function askToRemove(name = 'Dr. Ada Lee') {
      chooseAction(name, 'Remove request…');
      return screen.findByRole('dialog', { name: 'Remove this letter request?' });
    }

    it('asks first, and names the person and the program', async () => {
      const { recommendations } = open({ letters: [{ recommender_id: 'Dr. Ada Lee' }] });
      await ready();
      const dialog = await askToRemove();
      expect(dialog).toHaveTextContent(
        'The request to Dr. Ada Lee for Stanford University, Computer Science will be removed.',
      );
      expect(dialog).toHaveTextContent('Dr. Ada Lee stays on your list of recommenders.');
      expect(recommendations.api.deleteRequest).not.toHaveBeenCalled();
    });

    it('keeps the letter when you cancel', async () => {
      const { recommendations } = open({ letters: [{ recommender_id: 'Dr. Ada Lee' }] });
      await ready();
      const dialog = await askToRemove();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await gone('Remove this letter request?');
      expect(names()).toEqual(['Dr. Ada Lee']);
      expect(recommendations.api.deleteRequest).not.toHaveBeenCalled();
    });

    it('removes the request and keeps the person', async () => {
      const { recommendations } = open({
        letters: [
          { recommender_id: 'Dr. Ada Lee', status: 'submitted' },
          { recommender_id: 'Prof. Sam Ortiz' },
        ],
      });
      await ready();
      expect(screen.getByText('1 of 2')).toBeInTheDocument();
      const dialog = await askToRemove('Prof. Sam Ortiz');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Remove request' }));
      expect(
        await screen.findByText('Removed the request to Prof. Sam Ortiz.'),
      ).toBeInTheDocument();
      await gone('Remove this letter request?');
      expect(names()).toEqual(['Dr. Ada Lee']);
      expect(recommendations.requests).toHaveLength(1);
      expect(recommendations.recommenders).toHaveLength(3);
      expect(screen.getByText('1 of 1')).toBeInTheDocument();
    });

    it('goes back to the invitation after the last letter is removed', async () => {
      open({ letters: [{ recommender_id: 'Dr. Ada Lee' }] });
      await ready();
      const dialog = await askToRemove();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Remove request' }));
      expect(
        await screen.findByRole('heading', { name: 'No letters requested yet.' }),
      ).toBeVisible();
    });

    it('stays open and explains when removing fails', async () => {
      const { recommendations } = open({ letters: [{ recommender_id: 'Dr. Ada Lee' }] });
      recommendations.api.deleteRequest.mockRejectedValueOnce(new DataError('network'));
      await ready();
      const dialog = await askToRemove();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Remove request' }));
      expect(await within(dialog).findByText("Couldn't remove this request")).toBeVisible();
      expect(dialog).toHaveTextContent("Can't reach the server");
      expect(names()).toEqual(['Dr. Ada Lee']);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Remove request' }));
      expect(await screen.findByText('Removed the request to Dr. Ada Lee.')).toBeInTheDocument();
    });
  });

  describe('when the server is not reachable', () => {
    it('says the letters could not be loaded, and tries again on request', async () => {
      const { recommendations } = open({ letters: [{ recommender_id: 'Dr. Ada Lee' }] });
      recommendations.api.listRequests.mockRejectedValueOnce(new DataError('network'));
      expect(await screen.findByText('Unable to load recommendation letters')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the server");
      expect(screen.queryByRole('heading', { name: 'No letters requested yet.' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await ready();
      expect(names()).toEqual(['Dr. Ada Lee']);
    });

    it('says so when the people could not be loaded either', async () => {
      const { recommendations } = open({ letters: [{ recommender_id: 'Dr. Ada Lee' }] });
      recommendations.api.listRecommenders.mockRejectedValueOnce(new DataError('network'));
      expect(await screen.findByText('Unable to load recommendation letters')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await ready();
      expect(names()).toEqual(['Dr. Ada Lee']);
    });

    it('keeps showing the last letters when a refresh fails', async () => {
      const { recommendations } = open({ letters: [{ recommender_id: 'Dr. Ada Lee' }] });
      await ready();
      recommendations.api.listRequests.mockRejectedValueOnce(new DataError('network'));
      changeStatus('Dr. Ada Lee', 'Submitted');
      expect(
        await screen.findByText('Unable to refresh recommendation letters'),
      ).toBeInTheDocument();
      expect(names()).toEqual(['Dr. Ada Lee']);
      expect(screen.getByText(/Showing the last list that loaded\./)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await waitFor(() =>
        expect(
          screen.queryByText('Unable to refresh recommendation letters'),
        ).not.toBeInTheDocument(),
      );
    });
  });

  describe('on the overview', () => {
    it('invites you to request a letter when there are none', async () => {
      const { record } = open({ path: '' });
      const card = (await screen.findByRole('heading', { name: 'Recommendations' })).closest(
        'div.rounded-lg',
      ) as HTMLElement;
      expect(await within(card).findByText('No letters requested yet.')).toBeInTheDocument();
      expect(within(card).getByRole('link', { name: 'Request a letter' })).toHaveAttribute(
        'href',
        `/app/applications/${record.id}/recommendations`,
      );
    });

    it('summarises the letters and links to the list', async () => {
      const { record } = open({
        path: '',
        letters: [
          { recommender_id: 'Dr. Ada Lee', status: 'submitted' },
          { recommender_id: 'Prof. Sam Ortiz' },
        ],
      });
      const card = (await screen.findByRole('heading', { name: 'Recommendations' })).closest(
        'div.rounded-lg',
      ) as HTMLElement;
      expect(await within(card).findByText('1 of 2')).toBeInTheDocument();
      expect(within(card).getByRole('link', { name: 'View letters' })).toHaveAttribute(
        'href',
        `/app/applications/${record.id}/recommendations`,
      );
    });

    it('says when the letters could not be loaded, and tries again', async () => {
      const { recommendations } = open({ path: '', letters: [{ recommender_id: 'Dr. Ada Lee' }] });
      recommendations.api.listRequests.mockRejectedValueOnce(new DataError('network'));
      expect(await screen.findByText('Unable to load recommendation letters')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('letter submitted', { exact: false })).toBeInTheDocument();
    });
  });

  describe('when the program is deleted', () => {
    it('takes its letters out of what is remembered', async () => {
      const { recommendations, queryClient } = open({
        path: '',
        letters: [
          { recommender_id: 'Dr. Ada Lee' },
          { recommender_id: 'Prof. Sam Ortiz', application_id: 'some-other-program' },
        ],
      });
      await screen.findByRole('heading', { level: 1, name: 'Stanford University' });
      fireEvent.click(screen.getByRole('link', { name: 'Recommendations' }));
      await ready();
      const remembered = () =>
        queryClient.getQueryData<RequestRow[]>(['recommendation-requests', 'user-1']);
      expect(remembered()).toHaveLength(2);

      // The fake database keeps the rows (the real one deletes them along with the program), so
      // hold back the reload to see what was done to the remembered list itself.
      recommendations.api.listRequests.mockImplementation(() => new Promise(() => {}));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      const dialog = await screen.findByRole('dialog', { name: 'Delete this application?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete application' }));
      await screen.findByRole('heading', { name: 'No applications yet.' });

      expect(remembered()?.map((row) => row.application_id)).toEqual(['some-other-program']);
    });
  });
});
