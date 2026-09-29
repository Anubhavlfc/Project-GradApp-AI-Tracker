import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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

const STANFORD = 'Stanford University, Computer Science';
const CMU = 'Carnegie Mellon University, Computational Finance';

const stanford = () =>
  fakeRecord({
    id: 'stanford',
    program_name: 'Computer Science',
    university: { name: 'Stanford University' },
  });
const cmu = () =>
  fakeRecord({
    id: 'cmu',
    program_name: 'Computational Finance',
    university: { name: 'Carnegie Mellon University' },
  });

const person = (name: string, extra: Partial<RecommenderRow> = {}) =>
  fakeRecommender({ id: name, name, ...extra });
const lee = () =>
  person('Dr. Ada Lee', { title: 'Professor', institution: 'MIT', email: 'ada@mit.edu' });
const ortiz = () => person('Prof. Sam Ortiz');

type Letter = Partial<RequestRow> & { recommender_id: string; application_id: string };

function open({
  people = [ortiz(), lee()],
  letters = [],
  programs = [stanford(), cmu()],
}: {
  people?: RecommenderRow[];
  letters?: Letter[];
  programs?: ReturnType<typeof stanford>[];
} = {}) {
  const applications = createFakeApplicationsApi(programs);
  const recommendations = createFakeRecommendationsApi({
    recommenders: people,
    requests: letters.map((letter) => fakeRequest(letter)),
  });
  const view = renderApp('/app/recommenders', createFakeAuth(fakeSession()).client, {
    api: applications.api,
    recommendationsApi: recommendations.api,
  });
  return { ...view, applications, recommendations };
}

const ready = () => screen.findByRole('heading', { level: 1, name: 'Recommenders' });
const cardFor = (name: string) =>
  screen.getByRole('heading', { level: 2, name }).closest('div.rounded-lg') as HTMLElement;
const people = () =>
  screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
const lettersOf = (name: string) =>
  within(cardFor(name)).queryByRole('list', { name: `Letters from ${name}` });
const subject = (who: string, program: string) => `${who}'s letter for ${program}`;
const letterRow = (who: string, program: string) =>
  within(cardFor(who))
    .getByRole('button', { name: `Actions for ${subject(who, program)}` })
    .closest('li') as HTMLElement;
const statusButton = (who: string, program: string) =>
  within(letterRow(who, program)).getByRole('button', {
    name: (label) => label.endsWith(`. Change status of ${subject(who, program)}`),
  });
const statusOf = (who: string, program: string) =>
  statusButton(who, program).getAttribute('aria-label')!.split('.')[0];

const field = (dialog: HTMLElement, label: RegExp | string) =>
  within(dialog).getByLabelText(label) as HTMLInputElement;
const setField = (dialog: HTMLElement, label: RegExp | string, value: string) =>
  fireEvent.change(field(dialog, label), { target: { value } });
const gone = (name: string) =>
  waitFor(() => expect(screen.queryByRole('dialog', { name })).not.toBeInTheDocument());

function chooseFromPersonMenu(name: string, action: 'Edit recommender' | 'Delete recommender…') {
  fireEvent.click(within(cardFor(name)).getByRole('button', { name: `Actions for ${name}` }));
  fireEvent.click(screen.getByRole('menuitem', { name: action }));
}
function chooseFromLetterMenu(
  who: string,
  program: string,
  action: 'Edit request' | 'Remove request…',
) {
  fireEvent.click(
    within(letterRow(who, program)).getByRole('button', {
      name: `Actions for ${subject(who, program)}`,
    }),
  );
  fireEvent.click(screen.getByRole('menuitem', { name: action }));
}

describe('the recommenders page', () => {
  describe('getting there', () => {
    it('is in the sidebar', async () => {
      open();
      await ready();
      const nav = screen.getAllByRole('navigation', { name: 'Primary' })[0]!;
      expect(within(nav).getByRole('link', { name: 'Recommenders' })).toHaveAttribute(
        'href',
        '/app/recommenders',
      );
      expect(within(nav).getByRole('link', { name: 'Recommenders' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('shows that it is loading, then the people', async () => {
      const { recommendations } = open();
      let release = () => {};
      recommendations.api.listRecommenders.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve(recommendations.recommenders);
          }),
      );
      expect(await screen.findByText('Loading recommenders')).toBeInTheDocument();
      release();
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
    });
  });

  describe('with nobody on the list', () => {
    it('invites you to add the first recommender', async () => {
      open({ people: [] });
      expect(await screen.findByRole('heading', { name: 'No recommenders yet.' })).toBeVisible();
      expect(screen.getAllByRole('button', { name: 'Add recommender' })).toHaveLength(1);
    });

    it('adds one', async () => {
      const { recommendations } = open({ people: [] });
      fireEvent.click(await screen.findByRole('button', { name: 'Add recommender' }));
      const dialog = await screen.findByRole('dialog', { name: 'Add recommender' });
      expect(field(dialog, /^Name/)).toHaveFocus();
      setField(dialog, /^Name/, 'Dr. Priya Rao');
      setField(dialog, 'Title', 'Lecturer');
      setField(dialog, 'Institution', 'UW');
      setField(dialog, 'Email', 'priya@uw.edu');
      setField(dialog, 'Notes', 'Taught my stats course.');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add recommender' }));

      expect(await screen.findByText('Added Dr. Priya Rao.')).toBeInTheDocument();
      await gone('Add recommender');
      expect(recommendations.api.createRecommender).toHaveBeenCalledWith({
        name: 'Dr. Priya Rao',
        title: 'Lecturer',
        institution: 'UW',
        email: 'priya@uw.edu',
        notes: 'Taught my stats course.',
      });
      const card = cardFor('Dr. Priya Rao');
      expect(card).toHaveTextContent('Lecturer · UW');
      expect(card).toHaveTextContent('No letters requested');
      expect(within(card).getByText('Taught my stats course.')).toBeInTheDocument();
    });
  });

  describe('the people', () => {
    it('lists them alphabetically', async () => {
      open({ people: [ortiz(), person('dr. bea Ang'), lee()] });
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
      expect(people()).toEqual(
        ['dr. bea Ang', 'Dr. Ada Lee', 'Prof. Sam Ortiz'].sort((a, b) =>
          a.localeCompare(b, 'en', { sensitivity: 'base' }),
        ),
      );
    });

    it('shows what they do, how to reach them, and how their letters stand', async () => {
      open({
        letters: [
          { recommender_id: 'Dr. Ada Lee', application_id: 'stanford', status: 'submitted' },
          { recommender_id: 'Dr. Ada Lee', application_id: 'cmu', status: 'needs_follow_up' },
        ],
      });
      await ready();
      const card = await waitFor(() => cardFor('Dr. Ada Lee'));
      expect(card).toHaveTextContent('Professor · MIT');
      expect(within(card).getByRole('link', { name: 'ada@mit.edu' })).toHaveAttribute(
        'href',
        'mailto:ada@mit.edu',
      );
      expect(card).toHaveTextContent('2 letters · 1 submitted · 1 to follow up');
    });

    it('says when someone has no letters yet', async () => {
      open();
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Prof. Sam Ortiz' });
      expect(cardFor('Prof. Sam Ortiz')).toHaveTextContent('No letters requested yet.');
      expect(lettersOf('Prof. Sam Ortiz')).toBeNull();
    });
  });

  describe('their letters', () => {
    it('lists each person’s letters by program, soonest deadline first', async () => {
      open({
        letters: [
          { recommender_id: 'Dr. Ada Lee', application_id: 'stanford', deadline: '2026-12-15' },
          { recommender_id: 'Dr. Ada Lee', application_id: 'cmu', deadline: '2026-12-01' },
          { recommender_id: 'Prof. Sam Ortiz', application_id: 'stanford' },
        ],
      });
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
      const rows = within(lettersOf('Dr. Ada Lee')!).getAllByRole('listitem');
      expect(rows.map((row) => within(row).getByRole('link').textContent)).toEqual([CMU, STANFORD]);
      expect(within(lettersOf('Prof. Sam Ortiz')!).getAllByRole('listitem')).toHaveLength(1);
    });

    it('links each letter to its program’s recommendations', async () => {
      open({ letters: [{ recommender_id: 'Dr. Ada Lee', application_id: 'cmu' }] });
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
      expect(
        within(letterRow('Dr. Ada Lee', CMU)).getByRole('link', { name: CMU }),
      ).toHaveAttribute('href', '/app/applications/cmu/recommendations');
    });

    it('shows the dates and warns about a letter that is late', async () => {
      open({
        letters: [
          {
            recommender_id: 'Dr. Ada Lee',
            application_id: 'stanford',
            status: 'requested',
            requested_on: '2026-10-03',
            deadline: daysFromNow(-2),
          },
        ],
      });
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
      const row = letterRow('Dr. Ada Lee', STANFORD);
      expect(row).toHaveTextContent('Asked Oct 3, 2026');
      expect(within(row).getByText('2 days overdue')).toBeInTheDocument();
    });

    it('does not call a letter overdue once the program was sent', async () => {
      open({
        programs: [{ ...stanford(), status: 'submitted' }, cmu()],
        letters: [
          {
            recommender_id: 'Dr. Ada Lee',
            application_id: 'stanford',
            status: 'requested',
            deadline: daysFromNow(-2),
          },
        ],
      });
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
      expect(letterRow('Dr. Ada Lee', STANFORD)).not.toHaveTextContent('overdue');
    });

    it('changes a status right there', async () => {
      const { recommendations } = open({
        letters: [
          { recommender_id: 'Dr. Ada Lee', application_id: 'stanford', status: 'requested' },
        ],
      });
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
      fireEvent.click(statusButton('Dr. Ada Lee', STANFORD));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Submitted' }));
      await waitFor(() => expect(statusOf('Dr. Ada Lee', STANFORD)).toBe('Submitted'));
      await waitFor(() =>
        expect(recommendations.api.setRequestStatus).toHaveBeenCalledWith(
          recommendations.requests[0]!.id,
          'submitted',
          undefined,
        ),
      );
      expect(cardFor('Dr. Ada Lee')).toHaveTextContent('1 letter · 1 submitted');
    });

    it('puts the old status back and explains when saving fails', async () => {
      const { recommendations } = open({
        letters: [
          { recommender_id: 'Dr. Ada Lee', application_id: 'stanford', status: 'requested' },
        ],
      });
      recommendations.api.setRequestStatus.mockRejectedValueOnce(new DataError('network'));
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
      fireEvent.click(statusButton('Dr. Ada Lee', STANFORD));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Submitted' }));
      expect(await screen.findByText("Couldn't update that letter")).toBeInTheDocument();
      await waitFor(() => expect(statusOf('Dr. Ada Lee', STANFORD)).toBe('Requested'));
    });
  });

  describe('requesting a letter from a person', () => {
    it('has the person decided, and asks only for the program', async () => {
      const { recommendations } = open();
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Prof. Sam Ortiz' });
      fireEvent.click(
        screen.getByRole('button', { name: 'Request a letter from Prof. Sam Ortiz' }),
      );
      const dialog = await screen.findByRole('dialog', { name: 'Request a letter' });
      expect(dialog).toHaveTextContent('Prof. Sam Ortiz');
      expect(within(dialog).queryByRole('combobox', { name: /^Recommender/ })).toBeNull();
      expect(field(dialog, /^Program/)).toHaveFocus();

      setField(dialog, /^Program/, 'cmu');
      setField(dialog, 'Status', 'requested');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add request' }));

      expect(
        await screen.findByText(`Requested a letter from Prof. Sam Ortiz for ${CMU}.`),
      ).toBeInTheDocument();
      expect(recommendations.api.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({ recommender_id: 'Prof. Sam Ortiz', application_id: 'cmu' }),
      );
      expect(statusOf('Prof. Sam Ortiz', CMU)).toBe('Requested');
      expect(cardFor('Prof. Sam Ortiz')).toHaveTextContent('1 letter');
    });

    it('starts the deadline at the chosen program’s, until you change it', async () => {
      open({
        programs: [
          { ...stanford(), deadline: '2026-12-15' },
          { ...cmu(), deadline: '2027-01-02' },
        ],
      });
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Prof. Sam Ortiz' });
      fireEvent.click(
        screen.getByRole('button', { name: 'Request a letter from Prof. Sam Ortiz' }),
      );
      const dialog = await screen.findByRole('dialog', { name: 'Request a letter' });
      expect(field(dialog, 'Deadline')).toHaveValue('');
      setField(dialog, /^Program/, 'stanford');
      expect(field(dialog, 'Deadline')).toHaveValue('2026-12-15');
      setField(dialog, /^Program/, 'cmu');
      expect(field(dialog, 'Deadline')).toHaveValue('2027-01-02');
      setField(dialog, 'Deadline', '2026-11-11');
      setField(dialog, /^Program/, 'stanford');
      expect(field(dialog, 'Deadline')).toHaveValue('2026-11-11');
    });

    it('greys out the programs they are already asked about', async () => {
      open({ letters: [{ recommender_id: 'Prof. Sam Ortiz', application_id: 'stanford' }] });
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Prof. Sam Ortiz' });
      fireEvent.click(
        screen.getByRole('button', { name: 'Request a letter from Prof. Sam Ortiz' }),
      );
      const dialog = await screen.findByRole('dialog', { name: 'Request a letter' });
      const options = within(field(dialog, /^Program/)).getAllByRole('option');
      const asked = options.find((option) => option.textContent?.startsWith(STANFORD))!;
      expect(asked).toBeDisabled();
      expect(asked).toHaveTextContent('(already asked)');
      expect(options.find((option) => option.textContent === CMU)).toBeEnabled();
    });

    it('asks for a program when none is chosen', async () => {
      const { recommendations } = open();
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Prof. Sam Ortiz' });
      fireEvent.click(
        screen.getByRole('button', { name: 'Request a letter from Prof. Sam Ortiz' }),
      );
      const dialog = await screen.findByRole('dialog', { name: 'Request a letter' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add request' }));
      expect(await within(dialog).findByText('Choose a program.')).toBeInTheDocument();
      expect(recommendations.api.createRequest).not.toHaveBeenCalled();
    });

    it('sends you to add a program first when there are none', async () => {
      open({ programs: [] });
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Prof. Sam Ortiz' });
      fireEvent.click(
        screen.getByRole('button', { name: 'Request a letter from Prof. Sam Ortiz' }),
      );
      const dialog = await screen.findByRole('dialog', { name: 'Request a letter' });
      expect(within(dialog).getByText('Add a program first')).toBeVisible();
      expect(within(dialog).getByRole('link', { name: 'Add a program' })).toHaveAttribute(
        'href',
        '/app/applications/new',
      );
      expect(within(dialog).getByRole('button', { name: 'Add request' })).toBeDisabled();
    });
  });

  describe('editing a person', () => {
    it('shows what is on file and saves changes', async () => {
      const { recommendations } = open();
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
      chooseFromPersonMenu('Dr. Ada Lee', 'Edit recommender');
      const dialog = await screen.findByRole('dialog', { name: 'Edit recommender' });
      expect(field(dialog, /^Name/)).toHaveValue('Dr. Ada Lee');
      expect(field(dialog, 'Title')).toHaveValue('Professor');
      expect(field(dialog, 'Email')).toHaveValue('ada@mit.edu');

      setField(dialog, 'Title', 'Emeritus Professor');
      setField(dialog, 'Email', '');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
      expect(await screen.findByText('Saved Dr. Ada Lee.')).toBeInTheDocument();
      expect(recommendations.api.updateRecommender).toHaveBeenCalledWith(
        'Dr. Ada Lee',
        expect.objectContaining({ title: 'Emeritus Professor', email: null }),
      );
      expect(cardFor('Dr. Ada Lee')).toHaveTextContent('Emeritus Professor · MIT');
      expect(
        within(cardFor('Dr. Ada Lee')).queryByRole('link', { name: 'ada@mit.edu' }),
      ).toBeNull();
    });

    it('needs a name, and a real-looking email', async () => {
      const { recommendations } = open();
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
      chooseFromPersonMenu('Dr. Ada Lee', 'Edit recommender');
      const dialog = await screen.findByRole('dialog', { name: 'Edit recommender' });
      setField(dialog, /^Name/, '   ');
      setField(dialog, 'Email', 'nope');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
      expect(await within(dialog).findByText("Enter the recommender's name.")).toBeInTheDocument();
      expect(
        within(dialog).getByText('Enter an email address, like name@university.edu.'),
      ).toBeInTheDocument();
      expect(recommendations.api.updateRecommender).not.toHaveBeenCalled();
    });

    it('stays open and explains when saving fails', async () => {
      const { recommendations } = open();
      recommendations.api.updateRecommender.mockRejectedValueOnce(new DataError('network'));
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
      chooseFromPersonMenu('Dr. Ada Lee', 'Edit recommender');
      const dialog = await screen.findByRole('dialog', { name: 'Edit recommender' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
      expect(await within(dialog).findByText('Failed to save recommender')).toBeVisible();
      expect(dialog).toHaveTextContent("Can't reach the server");
    });

    it('says so when the person was deleted in another tab', async () => {
      const { recommendations } = open();
      recommendations.api.updateRecommender.mockRejectedValueOnce(new DataError('not_found'));
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
      chooseFromPersonMenu('Dr. Ada Lee', 'Edit recommender');
      const dialog = await screen.findByRole('dialog', { name: 'Edit recommender' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
      expect(await within(dialog).findByText(/That recommender no longer exists/)).toBeVisible();
    });
  });

  describe('deleting a person', () => {
    async function askToDelete(name: string) {
      chooseFromPersonMenu(name, 'Delete recommender…');
      return screen.findByRole('dialog', { name: 'Delete this recommender?' });
    }

    it('asks first, and says how many letters go with them', async () => {
      const { recommendations } = open({
        letters: [
          { recommender_id: 'Dr. Ada Lee', application_id: 'stanford' },
          { recommender_id: 'Dr. Ada Lee', application_id: 'cmu' },
        ],
      });
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
      const dialog = await askToDelete('Dr. Ada Lee');
      expect(dialog).toHaveTextContent('“Dr. Ada Lee” will be removed from your recommenders.');
      expect(dialog).toHaveTextContent(
        "Their 2 letter requests will be removed too. This can't be undone.",
      );
      expect(recommendations.api.deleteRecommender).not.toHaveBeenCalled();
    });

    it('uses the singular for one letter, and says nothing about letters for none', async () => {
      open({ letters: [{ recommender_id: 'Dr. Ada Lee', application_id: 'stanford' }] });
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
      let dialog = await askToDelete('Dr. Ada Lee');
      expect(dialog).toHaveTextContent('Their 1 letter request will be removed too.');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await gone('Delete this recommender?');
      dialog = await askToDelete('Prof. Sam Ortiz');
      expect(dialog).toHaveTextContent("This can't be undone.");
      expect(dialog).not.toHaveTextContent('letter request');
    });

    it('keeps the person when you cancel', async () => {
      const { recommendations } = open();
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
      const dialog = await askToDelete('Dr. Ada Lee');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await gone('Delete this recommender?');
      expect(people()).toContain('Dr. Ada Lee');
      expect(recommendations.api.deleteRecommender).not.toHaveBeenCalled();
    });

    it('removes them and their letters, and nobody else’s', async () => {
      const { recommendations } = open({
        letters: [
          { recommender_id: 'Dr. Ada Lee', application_id: 'stanford' },
          { recommender_id: 'Prof. Sam Ortiz', application_id: 'stanford' },
        ],
      });
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
      const dialog = await askToDelete('Dr. Ada Lee');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete recommender' }));
      expect(await screen.findByText('Deleted Dr. Ada Lee.')).toBeInTheDocument();
      await gone('Delete this recommender?');
      expect(people()).toEqual(['Prof. Sam Ortiz']);
      expect(recommendations.requests.map((row) => row.recommender_id)).toEqual([
        'Prof. Sam Ortiz',
      ]);
      expect(within(lettersOf('Prof. Sam Ortiz')!).getAllByRole('listitem')).toHaveLength(1);
    });

    it('goes back to the invitation after the last person is deleted', async () => {
      open({ people: [ortiz()] });
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Prof. Sam Ortiz' });
      const dialog = await askToDelete('Prof. Sam Ortiz');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete recommender' }));
      expect(await screen.findByRole('heading', { name: 'No recommenders yet.' })).toBeVisible();
    });

    it('stays open and explains when deleting fails, and works on the next try', async () => {
      const { recommendations } = open();
      recommendations.api.deleteRecommender.mockRejectedValueOnce(new DataError('network'));
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
      const dialog = await askToDelete('Dr. Ada Lee');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete recommender' }));
      expect(await within(dialog).findByText("Couldn't delete this recommender")).toBeVisible();
      expect(dialog).toHaveTextContent("Can't reach the server");
      expect(people()).toContain('Dr. Ada Lee');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete recommender' }));
      expect(await screen.findByText('Deleted Dr. Ada Lee.')).toBeInTheDocument();
    });
  });

  describe('editing and removing a letter from here', () => {
    it('edits a request', async () => {
      const { recommendations } = open({
        letters: [
          { recommender_id: 'Dr. Ada Lee', application_id: 'stanford', status: 'requested' },
        ],
      });
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
      chooseFromLetterMenu('Dr. Ada Lee', STANFORD, 'Edit request');
      const dialog = await screen.findByRole('dialog', { name: 'Edit letter request' });
      expect(dialog).toHaveTextContent('Dr. Ada Lee');
      expect(dialog).toHaveTextContent(STANFORD);
      setField(dialog, 'Status', 'confirmed');
      setField(dialog, 'Notes', 'She said yes.');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
      expect(await screen.findByText('Saved the request to Dr. Ada Lee.')).toBeInTheDocument();
      expect(recommendations.api.updateRequest).toHaveBeenCalled();
      expect(statusOf('Dr. Ada Lee', STANFORD)).toBe('Confirmed');
      expect(letterRow('Dr. Ada Lee', STANFORD)).toHaveTextContent('She said yes.');
    });

    it('removes a request but keeps the person', async () => {
      const { recommendations } = open({
        letters: [{ recommender_id: 'Dr. Ada Lee', application_id: 'stanford' }],
      });
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
      chooseFromLetterMenu('Dr. Ada Lee', STANFORD, 'Remove request…');
      const dialog = await screen.findByRole('dialog', { name: 'Remove this letter request?' });
      expect(dialog).toHaveTextContent(
        `The request to Dr. Ada Lee for ${STANFORD} will be removed.`,
      );
      fireEvent.click(within(dialog).getByRole('button', { name: 'Remove request' }));
      expect(await screen.findByText('Removed the request to Dr. Ada Lee.')).toBeInTheDocument();
      expect(recommendations.requests).toHaveLength(0);
      expect(people()).toContain('Dr. Ada Lee');
      expect(cardFor('Dr. Ada Lee')).toHaveTextContent('No letters requested yet.');
    });
  });

  describe('when the server is not reachable', () => {
    it('says the list could not be loaded, and tries again on request', async () => {
      const { recommendations } = open();
      recommendations.api.listRecommenders.mockRejectedValueOnce(new DataError('network'));
      expect(await screen.findByText('Unable to load recommenders')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the server");
      expect(screen.queryByRole('heading', { name: 'No recommenders yet.' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
    });

    it('says so when the programs could not be loaded', async () => {
      const { applications } = open();
      applications.api.list.mockRejectedValueOnce(new DataError('network'));
      expect(await screen.findByText('Unable to load recommenders')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
    });

    it('keeps showing the last list when a refresh fails', async () => {
      const { recommendations } = open({
        letters: [{ recommender_id: 'Dr. Ada Lee', application_id: 'stanford' }],
      });
      await ready();
      await screen.findByRole('heading', { level: 2, name: 'Dr. Ada Lee' });
      recommendations.api.listRequests.mockRejectedValueOnce(new DataError('network'));
      fireEvent.click(statusButton('Dr. Ada Lee', STANFORD));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Submitted' }));
      expect(await screen.findByText('Unable to refresh recommenders')).toBeInTheDocument();
      expect(people()).toContain('Dr. Ada Lee');
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await waitFor(() =>
        expect(screen.queryByText('Unable to refresh recommenders')).not.toBeInTheDocument(),
      );
    });
  });
});
