import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { DataError } from '@/lib/dataError';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import { createFakeApplicationsApi, daysFromNow, fakeRecord } from '@/test/fakeApplicationsApi';
import { createFakeRequirementsApi, fakeRequirement } from '@/test/fakeRequirementsApi';
import { renderApp } from '@/test/renderApp';

function open(records = [fakeRecord()], path = '/app/applications') {
  const fake = createFakeApplicationsApi(records);
  const view = renderApp(path, createFakeAuth(fakeSession()).client, { api: fake.api });
  return { ...view, fake };
}

const rowFor = (name: string) => screen.getByRole('link', { name }).closest('tr') as HTMLElement;
const universityNames = () =>
  within(screen.getByRole('region', { name: 'Applications' }))
    .getAllByRole('link')
    .map((link) => link.textContent);

const stanford = () =>
  fakeRecord({
    program_name: 'Computer Science',
    degree_type: 'MS',
    status: 'documents_in_progress',
    priority: 'dream',
    deadline: daysFromNow(5),
    application_fee: 90,
    university: { name: 'Stanford University', country: 'United States' },
  });
const mit = () =>
  fakeRecord({
    program_name: 'Artificial Intelligence',
    degree_level: 'phd',
    degree_type: 'PhD',
    status: 'researching',
    priority: 'target',
    deadline: daysFromNow(40),
    is_favorite: true,
    university: { name: 'MIT', country: 'United States' },
  });
const toronto = () =>
  fakeRecord({
    program_name: 'Data Science',
    status: 'submitted',
    deadline: daysFromNow(-10),
    application_fee: 120,
    fee_currency: 'CAD',
    fee_paid_on: daysFromNow(-12),
    university: { name: 'University of Toronto', country: 'Canada' },
  });

describe('applications list', () => {
  it('invites you to add your first program when there are none', async () => {
    open([]);
    expect(
      await screen.findByRole('heading', { name: 'No applications yet.' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Add your first graduate program to start tracking deadlines, documents, and requirements.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add program' })).toHaveAttribute(
      'href',
      '/app/applications/new',
    );
  });

  it('shows a loading state while the list arrives', async () => {
    const { fake } = open([stanford()]);
    let arrive: (records: ReturnType<typeof stanford>[]) => void = () => {};
    fake.api.list.mockReturnValueOnce(new Promise((resolve) => (arrive = resolve)));
    expect(await screen.findByText('Loading applications')).toBeInTheDocument();
    await act(async () => arrive([stanford()]));
    expect(await screen.findByRole('link', { name: 'Stanford University' })).toBeInTheDocument();
    expect(screen.queryByText('Loading applications')).not.toBeInTheDocument();
  });

  it('shows each program with what matters at a glance', async () => {
    open([stanford(), mit(), toronto()]);
    const stanfordRow = within(
      await screen
        .findByRole('link', { name: 'Stanford University' })
        .then((link) => link.closest('tr') as HTMLElement),
    );
    expect(stanfordRow.getByText('MS Computer Science')).toBeInTheDocument();
    expect(stanfordRow.getByText('In 5 days')).toBeInTheDocument();
    expect(stanfordRow.getByText('$90')).toBeInTheDocument();
    expect(stanfordRow.getByText('Reach')).toBeInTheDocument();
    expect(
      stanfordRow.getByRole('button', {
        name: 'Documents In Progress. Change status of Stanford University, Computer Science',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('3 programs')).toBeInTheDocument();
  });

  it('does not call a finished application overdue, and marks paid fees', async () => {
    open([toronto()]);
    const row = within(
      (await screen.findByRole('link', { name: 'University of Toronto' })).closest('tr')!,
    );
    expect(row.queryByText(/overdue/)).not.toBeInTheDocument();
    expect(row.getByText('CA$120')).toBeInTheDocument();
    expect(row.getByText('Paid')).toBeInTheDocument();
  });

  it('warns about a missed deadline in words, not just colour', async () => {
    open([fakeRecord({ status: 'researching', deadline: daysFromNow(-3) })]);
    expect(await screen.findByText('3 days overdue')).toBeInTheDocument();
  });

  it('opens a program when its name is clicked', async () => {
    const record = stanford();
    open([record]);
    expect(await screen.findByRole('link', { name: 'Stanford University' })).toHaveAttribute(
      'href',
      `/app/applications/${record.id}`,
    );
  });

  describe('when the list cannot be loaded', () => {
    it('says so plainly and lets you try again', async () => {
      const { fake } = open([stanford()]);
      fake.api.list.mockRejectedValueOnce(new DataError('network'));
      expect(await screen.findByText('Unable to load programs')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(
        "Can't reach the server. Check your connection and try again.",
      );
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByRole('link', { name: 'Stanford University' })).toBeInTheDocument();
      expect(screen.queryByText('Unable to load programs')).not.toBeInTheDocument();
    });
  });

  describe('searching and filtering', () => {
    const records = () => [stanford(), mit(), toronto()];

    it('narrows the list as you type and says how many match', async () => {
      open(records());
      await screen.findByRole('link', { name: 'Stanford University' });
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search applications' }), {
        target: { value: 'data science' },
      });
      expect(universityNames()).toEqual(['University of Toronto']);
      expect(screen.getByText('Showing 1 of 3 programs')).toBeInTheDocument();
    });

    it('lets you type spaces between words', async () => {
      open(records());
      await screen.findByRole('link', { name: 'Stanford University' });
      const search = screen.getByRole('searchbox', { name: 'Search applications' });
      fireEvent.change(search, { target: { value: 'university ' } });
      expect(search).toHaveValue('university ');
      fireEvent.change(search, { target: { value: 'university of' } });
      expect(search).toHaveValue('university of');
      expect(universityNames()).toEqual(['University of Toronto']);
    });

    it('filters by status', async () => {
      open(records());
      await screen.findByRole('link', { name: 'Stanford University' });
      fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), {
        target: { value: 'submitted' },
      });
      expect(universityNames()).toEqual(['University of Toronto']);
    });

    it('filters by degree, priority, deadline and country', async () => {
      open(records());
      await screen.findByRole('link', { name: 'Stanford University' });
      fireEvent.change(screen.getByRole('combobox', { name: 'Filter by degree' }), {
        target: { value: 'phd' },
      });
      expect(universityNames()).toEqual(['MIT']);
      fireEvent.change(screen.getByRole('combobox', { name: 'Filter by degree' }), {
        target: { value: '' },
      });

      fireEvent.change(screen.getByRole('combobox', { name: 'Filter by priority' }), {
        target: { value: 'dream' },
      });
      expect(universityNames()).toEqual(['Stanford University']);
      fireEvent.change(screen.getByRole('combobox', { name: 'Filter by priority' }), {
        target: { value: '' },
      });

      fireEvent.change(screen.getByRole('combobox', { name: 'Filter by deadline' }), {
        target: { value: 'week' },
      });
      expect(universityNames()).toEqual(['Stanford University']);
      fireEvent.change(screen.getByRole('combobox', { name: 'Filter by deadline' }), {
        target: { value: '' },
      });

      fireEvent.change(screen.getByRole('combobox', { name: 'Filter by country' }), {
        target: { value: 'Canada' },
      });
      expect(universityNames()).toEqual(['University of Toronto']);
    });

    it('shows only favorites on request', async () => {
      open(records());
      await screen.findByRole('link', { name: 'Stanford University' });
      fireEvent.click(screen.getByRole('button', { name: 'Favorites' }));
      expect(screen.getByRole('button', { name: 'Favorites' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(universityNames()).toEqual(['MIT']);
    });

    it('explains an empty result and offers to clear the filters', async () => {
      open(records());
      await screen.findByRole('link', { name: 'Stanford University' });
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search applications' }), {
        target: { value: 'nowhere at all' },
      });
      expect(screen.getByRole('heading', { name: 'No programs match.' })).toBeInTheDocument();
      fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!);
      expect(universityNames()).toHaveLength(3);
      expect(screen.getByRole('searchbox', { name: 'Search applications' })).toHaveValue('');
    });

    it('keeps every change when several arrive before the address has caught up', async () => {
      open(records());
      await screen.findByRole('link', { name: 'Stanford University' });
      // Two changes inside one update, as when someone acts faster than the page re-renders.
      act(() => {
        fireEvent.change(screen.getByRole('combobox', { name: 'Filter by country' }), {
          target: { value: 'Canada' },
        });
        fireEvent.change(screen.getByRole('combobox', { name: 'Filter by priority' }), {
          target: { value: 'dream' },
        });
      });
      // Toronto is not a reach school and Stanford is not in Canada, so both filters must be on.
      expect(screen.getByRole('heading', { name: 'No programs match.' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Filter by country' })).toHaveValue('Canada');
      expect(screen.getByRole('combobox', { name: 'Filter by priority' })).toHaveValue('dream');
    });

    it('turns Favorites back off on a quick double click', async () => {
      open(records());
      await screen.findByRole('link', { name: 'Stanford University' });
      const favorites = screen.getByRole('button', { name: 'Favorites' });
      act(() => {
        fireEvent.click(favorites);
        fireEvent.click(favorites);
      });
      expect(favorites).toHaveAttribute('aria-pressed', 'false');
      expect(universityNames()).toHaveLength(3);
    });

    it('starts from the address, so a bookmarked view comes back the same', async () => {
      open(records(), '/app/applications?status=researching&sort=university');
      expect(await screen.findByRole('link', { name: 'MIT' })).toBeInTheDocument();
      expect(universityNames()).toEqual(['MIT']);
      expect(screen.getByRole('combobox', { name: 'Filter by status' })).toHaveValue('researching');
    });
  });

  describe('sorting', () => {
    it('starts with the nearest open deadline first', async () => {
      open([toronto(), mit(), stanford()]);
      await screen.findByRole('link', { name: 'Stanford University' });
      expect(universityNames()).toEqual(['Stanford University', 'MIT', 'University of Toronto']);
      expect(screen.getByRole('columnheader', { name: /Deadline/ })).toHaveAttribute(
        'aria-sort',
        'ascending',
      );
    });

    it('sorts by a column when its heading is clicked, and reverses on a second click', async () => {
      open([stanford(), mit(), toronto()]);
      await screen.findByRole('link', { name: 'Stanford University' });
      fireEvent.click(
        within(screen.getByRole('columnheader', { name: /University/ })).getByRole('button'),
      );
      expect(universityNames()).toEqual(['MIT', 'Stanford University', 'University of Toronto']);
      expect(screen.getByRole('columnheader', { name: /University/ })).toHaveAttribute(
        'aria-sort',
        'ascending',
      );
      fireEvent.click(
        within(screen.getByRole('columnheader', { name: /University/ })).getByRole('button'),
      );
      expect(universityNames()).toEqual(['University of Toronto', 'Stanford University', 'MIT']);
    });

    it('can also be chosen from the sort menu', async () => {
      open([stanford(), mit(), toronto()]);
      await screen.findByRole('link', { name: 'Stanford University' });
      fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), {
        target: { value: 'fee' },
      });
      // Highest fee first; the program without a fee goes last.
      expect(universityNames()).toEqual(['University of Toronto', 'Stanford University', 'MIT']);
    });
  });

  describe('changing a status from the list', () => {
    it('moves the program at once and saves it', async () => {
      const { fake } = open([stanford()]);
      const row = within(
        rowFor(
          await screen
            .findByRole('link', { name: 'Stanford University' })
            .then((l) => l.textContent!),
        ),
      );
      fireEvent.click(row.getByRole('button', { name: /Change status of Stanford University/ }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Accepted' }));
      expect(await screen.findByRole('button', { name: /^Accepted\./ })).toBeInTheDocument();
      expect(fake.api.setStatus).toHaveBeenCalledWith(fake.records[0]!.id, 'accepted', undefined);
    });

    it('records today as the submission date when you mark a program submitted', async () => {
      const { fake } = open([stanford()]);
      await screen.findByRole('link', { name: 'Stanford University' });
      fireEvent.click(screen.getByRole('button', { name: /Change status of Stanford University/ }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Submitted' }));
      await waitFor(() => expect(fake.api.setStatus).toHaveBeenCalled());
      expect(fake.api.setStatus).toHaveBeenCalledWith(
        fake.records[0]!.id,
        'submitted',
        daysFromNow(0),
      );
    });

    it('keeps an earlier submission date', async () => {
      const { fake } = open([
        fakeRecord({
          status: 'submitted',
          submitted_on: '2026-11-01',
          university: { name: 'Stanford University' },
        }),
      ]);
      await screen.findByRole('link', { name: 'Stanford University' });
      fireEvent.click(screen.getByRole('button', { name: /Change status of Stanford University/ }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Interview' }));
      await waitFor(() => expect(fake.api.setStatus).toHaveBeenCalled());
      expect(fake.api.setStatus).toHaveBeenCalledWith(fake.records[0]!.id, 'interview', undefined);
    });

    it('puts the old status back and explains when saving fails', async () => {
      const { fake } = open([stanford()]);
      fake.api.setStatus.mockRejectedValueOnce(new DataError('network'));
      await screen.findByRole('link', { name: 'Stanford University' });
      fireEvent.click(screen.getByRole('button', { name: /Change status of Stanford University/ }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Rejected' }));
      expect(await screen.findByText("Couldn't update that program")).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the server");
      expect(
        await screen.findByRole('button', { name: /^Documents In Progress\./ }),
      ).toBeInTheDocument();
    });
  });

  describe('favorites', () => {
    it('stars a program and saves it', async () => {
      const { fake } = open([stanford()]);
      const star = await screen.findByRole('button', {
        name: 'Favorite Stanford University, Computer Science',
      });
      expect(star).toHaveAttribute('aria-pressed', 'false');
      fireEvent.click(star);
      await waitFor(() => expect(star).toHaveAttribute('aria-pressed', 'true'));
      await waitFor(() => expect(fake.api.setFavorite).toHaveBeenCalled());
      expect(fake.api.setFavorite).toHaveBeenCalledWith(fake.records[0]!.id, true);
    });

    it('treats a quick second click as the opposite of the first', async () => {
      const { fake } = open([stanford()]);
      const star = await screen.findByRole('button', {
        name: 'Favorite Stanford University, Computer Science',
      });
      // The second click can land before the page has re-drawn the first: it must still undo it.
      fireEvent.click(star);
      for (let tick = 0; tick < 10; tick += 1) await Promise.resolve();
      fireEvent.click(star);
      await waitFor(() => expect(fake.api.setFavorite).toHaveBeenCalledTimes(2));
      expect(fake.api.setFavorite.mock.calls.map(([, isFavorite]) => isFavorite)).toEqual([
        true,
        false,
      ]);
      await waitFor(() => expect(star).toHaveAttribute('aria-pressed', 'false'));
    });

    it('sends quick changes one after the other, in the order they were made', async () => {
      const { fake } = open([stanford()]);
      const finished: boolean[] = [];
      let releaseFirst: () => void = () => {};
      fake.api.setFavorite
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              releaseFirst = () => {
                finished.push(true);
                resolve();
              };
            }),
        )
        .mockImplementationOnce(async () => {
          finished.push(false);
        });
      const star = await screen.findByRole('button', {
        name: 'Favorite Stanford University, Computer Science',
      });
      fireEvent.click(star);
      for (let tick = 0; tick < 10; tick += 1) await Promise.resolve();
      fireEvent.click(star);
      await new Promise((resolve) => setTimeout(resolve, 30));
      // The second request waits for the first, so the server can't apply them the wrong way round.
      expect(fake.api.setFavorite).toHaveBeenCalledTimes(1);
      await act(async () => releaseFirst());
      await waitFor(() => expect(fake.api.setFavorite).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(finished).toEqual([true, false]));
    });

    it('unstars it again and undoes the change if saving fails', async () => {
      const { fake } = open([mit()]);
      fake.api.setFavorite.mockRejectedValueOnce(new DataError('unknown'));
      const star = await screen.findByRole('button', {
        name: 'Favorite MIT, Artificial Intelligence',
      });
      expect(star).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(star);
      expect(await screen.findByText("Couldn't update that program")).toBeInTheDocument();
      await waitFor(() => expect(star).toHaveAttribute('aria-pressed', 'true'));
    });
  });

  describe('deleting', () => {
    async function askToDelete(name = 'Stanford University, Computer Science') {
      await screen.findByRole('link', { name: 'Stanford University' });
      fireEvent.click(screen.getByRole('button', { name: `Actions for ${name}` }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' }));
      return screen.findByRole('dialog', { name: 'Delete this application?' });
    }

    it('asks first, naming what will be deleted', async () => {
      const { fake } = open([stanford()]);
      const dialog = await askToDelete();
      expect(dialog).toHaveTextContent('Stanford University, Computer Science');
      expect(dialog).toHaveTextContent("can't be undone");
      expect(fake.api.remove).not.toHaveBeenCalled();
    });

    it('does nothing when you cancel', async () => {
      const { fake } = open([stanford()]);
      const dialog = await askToDelete();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(fake.api.remove).not.toHaveBeenCalled();
      expect(screen.getByRole('link', { name: 'Stanford University' })).toBeInTheDocument();
    });

    it('deletes on confirmation and says it did', async () => {
      const { fake } = open([stanford(), mit()]);
      const id = fake.records[0]!.id;
      const dialog = await askToDelete();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete application' }));
      expect(
        await screen.findByText('Deleted Stanford University, Computer Science.'),
      ).toBeInTheDocument();
      expect(fake.api.remove).toHaveBeenCalledWith(id);
      expect(screen.queryByRole('link', { name: 'Stanford University' })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'MIT' })).toBeInTheDocument();
    });

    it('stays open and explains when the delete fails', async () => {
      const { fake } = open([stanford()]);
      fake.api.remove.mockRejectedValueOnce(new DataError('network'));
      const dialog = await askToDelete();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete application' }));
      expect(
        await within(dialog).findByText("Couldn't delete this application"),
      ).toBeInTheDocument();
      expect(dialog).toHaveTextContent("Can't reach the server");
      expect(screen.getByRole('link', { name: 'Stanford University' })).toBeInTheDocument();
    });
  });

  describe('application fees', () => {
    it('adds up what has been paid and what is still to pay, per currency', async () => {
      open([stanford(), toronto()]);
      const summary = (await screen.findByRole('heading', { name: 'Application fees' })).closest(
        'div.rounded-lg',
      ) as HTMLElement;
      expect(within(summary).getByText('CAD')).toBeInTheDocument();
      expect(within(summary).getByText('USD')).toBeInTheDocument();
      // USD: $90 still to pay. CAD: CA$120 paid.
      expect(within(summary).getAllByText('$90')).toHaveLength(2); // total and still to pay
      expect(within(summary).getAllByText('CA$120')).toHaveLength(2); // total and paid
    });

    it('is left out when no program has a fee', async () => {
      open([mit()]);
      await screen.findByRole('link', { name: 'MIT' });
      expect(screen.queryByRole('heading', { name: 'Application fees' })).not.toBeInTheDocument();
    });
  });

  describe('on a phone', () => {
    beforeEach(() => {
      vi.mocked(window.matchMedia).mockImplementation(
        (query: string) =>
          ({
            matches: query === '(max-width: 767px)',
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          }) as unknown as MediaQueryList,
      );
    });
    afterEach(() => {
      vi.mocked(window.matchMedia).mockImplementation(
        (query: string) =>
          ({
            matches: false,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          }) as unknown as MediaQueryList,
      );
    });

    it('shows a card per program with the same actions', async () => {
      const { fake } = open([stanford(), mit()]);
      const list = await screen.findByRole('list', { name: 'Applications' });
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      const cards = within(list).getAllByRole('listitem');
      expect(cards).toHaveLength(2);
      const card = within(cards[0]!);
      expect(card.getByRole('link', { name: 'Stanford University' })).toBeInTheDocument();
      expect(card.getByText('In 5 days')).toBeInTheDocument();
      expect(card.getByText('$90')).toBeInTheDocument();

      fireEvent.click(card.getByRole('button', { name: /Change status of Stanford University/ }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Ready to Submit' }));
      await waitFor(() => expect(fake.api.setStatus).toHaveBeenCalled());
    });

    it('keeps the filters behind a button until asked', async () => {
      open([stanford()]);
      await screen.findByRole('list', { name: 'Applications' });
      const toggle = screen.getByRole('button', { name: 'Filters' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), {
        target: { value: 'researching' },
      });
      expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument();
    });
  });
});

describe('requirement progress in the list', () => {
  /** Programs and, for each, the checklist items to give it: `[stanford's, mit's, toronto's]`. */
  function openWithChecklists(
    records: ReturnType<typeof fakeRecord>[],
    checklists: Partial<Parameters<typeof fakeRequirement>[0]>[][],
    path = '/app/applications',
  ) {
    const applications = createFakeApplicationsApi(records);
    const checklist = createFakeRequirementsApi(
      checklists.flatMap((items, index) =>
        items.map((item) => fakeRequirement({ application_id: records[index]!.id, ...item })),
      ),
    );
    const view = renderApp(path, createFakeAuth(fakeSession()).client, {
      api: applications.api,
      requirementsApi: checklist.api,
    });
    return { ...view, applications, checklist };
  }

  const twoOfThree = [
    { kind: 'resume_cv' as const, status: 'complete' as const },
    { kind: 'transcript' as const, status: 'submitted' as const },
    { kind: 'gre' as const },
    { kind: 'portfolio' as const, is_required: false },
  ];
  const oneOfFour = [
    { kind: 'resume_cv' as const, status: 'complete' as const },
    { kind: 'transcript' as const },
    { kind: 'gre' as const },
    { kind: 'toefl' as const },
  ];

  it('shows how many required items are done, as a bar and in words', async () => {
    openWithChecklists([stanford(), mit(), toronto()], [twoOfThree, oneOfFour, []]);
    const row = within(
      rowFor(
        await screen
          .findByRole('link', { name: 'Stanford University' })
          .then((l) => l.textContent!),
      ),
    );
    expect(await row.findByText('2 of 3 · 67%')).toBeInTheDocument();
    expect(
      row.getByRole('progressbar', {
        name: 'Requirements completed for Stanford University, Computer Science',
      }),
    ).toHaveAttribute('aria-valuenow', '67');
    const mitRow = within(rowFor('MIT'));
    expect(mitRow.getByText('1 of 4 · 25%')).toBeInTheDocument();
  });

  it('shows a dash, and says why, for a program with nothing required yet', async () => {
    openWithChecklists([stanford(), toronto()], [[], [{ kind: 'portfolio', is_required: false }]]);
    await screen.findByRole('link', { name: 'Stanford University' });
    await waitFor(() =>
      expect(screen.getAllByText('No requirements to complete yet')).toHaveLength(2),
    );
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('holds a place for the progress while it loads', async () => {
    const { checklist } = openWithChecklists([stanford()], [twoOfThree]);
    let arrive: (rows: typeof checklist.rows) => void = () => {};
    checklist.api.list.mockReturnValueOnce(new Promise((resolve) => (arrive = resolve)));
    const row = within(
      rowFor(
        await screen
          .findByRole('link', { name: 'Stanford University' })
          .then((l) => l.textContent!),
      ),
    );
    expect(row.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(row.queryByText(/No requirements/)).not.toBeInTheDocument();
    await act(async () => arrive(checklist.rows));
    expect(await row.findByText('2 of 3 · 67%')).toBeInTheDocument();
  });

  it('lists the programs anyway, and says so, when progress cannot be loaded', async () => {
    const { checklist } = openWithChecklists([stanford()], [twoOfThree]);
    checklist.api.list.mockRejectedValueOnce(new DataError('network'));
    expect(await screen.findByText('Unable to load requirement progress')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Stanford University' })).toBeInTheDocument();
    expect(screen.getByText("Progress isn't available right now")).toBeInTheDocument();
    expect(screen.queryByText('No requirements to complete yet')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('2 of 3 · 67%')).toBeInTheDocument();
    expect(screen.queryByText('Unable to load requirement progress')).not.toBeInTheDocument();
  });

  describe('sorting by completion', () => {
    const three = () => [stanford(), mit(), toronto()];
    const checklists = [twoOfThree, oneOfFour, [] as typeof oneOfFour];
    const header = () => screen.getByRole('columnheader', { name: /Completion/ });

    it('puts the most complete first, then reverses, with unstarted checklists last', async () => {
      openWithChecklists(three(), checklists);
      await screen.findByText('2 of 3 · 67%');
      fireEvent.click(within(header()).getByRole('button'));
      expect(header()).toHaveAttribute('aria-sort', 'descending');
      expect(universityNames()).toEqual(['Stanford University', 'MIT', 'University of Toronto']);
      fireEvent.click(within(header()).getByRole('button'));
      expect(header()).toHaveAttribute('aria-sort', 'ascending');
      expect(universityNames()).toEqual(['MIT', 'Stanford University', 'University of Toronto']);
    });

    it('can also be chosen from the sort menu, and starts from the address', async () => {
      openWithChecklists(three(), checklists, '/app/applications?sort=completion&dir=asc');
      await screen.findByText('2 of 3 · 67%');
      expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveValue('completion');
      expect(universityNames()).toEqual(['MIT', 'Stanford University', 'University of Toronto']);
      fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), {
        target: { value: 'university' },
      });
      expect(universityNames()).toEqual(['MIT', 'Stanford University', 'University of Toronto']);
    });

    it('settles into place once the progress has arrived', async () => {
      const { checklist } = openWithChecklists(
        three(),
        checklists,
        '/app/applications?sort=completion',
      );
      let arrive: (rows: typeof checklist.rows) => void = () => {};
      checklist.api.list.mockReturnValueOnce(new Promise((resolve) => (arrive = resolve)));
      await screen.findByRole('link', { name: 'Stanford University' });
      // Without any numbers yet, the programs are in name order.
      expect(universityNames()).toEqual(['MIT', 'Stanford University', 'University of Toronto']);
      await act(async () => arrive(checklist.rows));
      await screen.findByText('2 of 3 · 67%');
      expect(universityNames()).toEqual(['Stanford University', 'MIT', 'University of Toronto']);
    });
  });

  it('follows a change made on the program’s own checklist', async () => {
    const record = stanford();
    openWithChecklists(
      [record],
      [[{ kind: 'resume_cv' }, { kind: 'transcript' }]],
      `/app/applications/${record.id}/requirements`,
    );
    await screen.findByRole('list', { name: 'Requirements' });
    fireEvent.click(screen.getByRole('button', { name: /Change status of Resume \/ CV$/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Complete' }));
    await screen.findByRole('button', { name: /^Complete\. Change status of Resume/ });
    fireEvent.click(within(screen.getByRole('main')).getByRole('link', { name: 'Applications' }));
    expect(await screen.findByText('1 of 2 · 50%')).toBeInTheDocument();
  });

  describe('on a phone', () => {
    beforeEach(() => {
      vi.mocked(window.matchMedia).mockImplementation(
        (query: string) =>
          ({
            matches: query === '(max-width: 767px)',
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          }) as unknown as MediaQueryList,
      );
    });
    afterEach(() => {
      vi.mocked(window.matchMedia).mockImplementation(
        (query: string) =>
          ({
            matches: false,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          }) as unknown as MediaQueryList,
      );
    });

    it('shows the progress on each card', async () => {
      openWithChecklists([stanford(), mit()], [twoOfThree, []]);
      const list = await screen.findByRole('list', { name: 'Applications' });
      const [first, second] = within(list).getAllByRole('listitem');
      expect(await within(first!).findByText('2 of 3 · 67%')).toBeInTheDocument();
      expect(within(first!).getByText('Completion')).toBeInTheDocument();
      expect(within(second!).getByText('No requirements to complete yet')).toBeInTheDocument();
    });
  });
});

describe('leaving the page', () => {
  it('needs a session: signed-out visitors are sent to sign in', async () => {
    renderApp('/app/applications', createFakeAuth().client);
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
  });

  it('forgets one person’s programs when they sign out', async () => {
    const fakeAuth = createFakeAuth(fakeSession());
    const fake = createFakeApplicationsApi([stanford()]);
    renderApp('/app/applications', fakeAuth.client, { api: fake.api });
    expect(await screen.findByRole('link', { name: 'Stanford University' })).toBeInTheDocument();

    // Someone else signs in on the same browser; their programs are slow to arrive.
    act(() => fakeAuth.emit('SIGNED_OUT', null));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    let resolve: (records: ReturnType<typeof fakeRecord>[]) => void = () => {};
    fake.api.list.mockReturnValueOnce(new Promise((done) => (resolve = done)));
    act(() => fakeAuth.emit('SIGNED_IN', fakeSession()));

    await screen.findByRole('heading', { level: 1, name: 'Sign in' }).catch(() => undefined);
    expect(screen.queryByRole('link', { name: 'Stanford University' })).not.toBeInTheDocument();
    await act(async () => resolve([]));
  });
});
