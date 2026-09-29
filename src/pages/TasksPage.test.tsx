import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { TaskRow } from '@/features/tasks/types';
import { DataError } from '@/lib/dataError';
import { createFakeApplicationsApi, daysFromNow, fakeRecord } from '@/test/fakeApplicationsApi';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import { createFakeTasksApi, fakeTask } from '@/test/fakeTasksApi';
import { renderApp } from '@/test/renderApp';

const stanford = () =>
  fakeRecord({
    id: 'stanford',
    program_name: 'Computer Science',
    university: { name: 'Stanford University' },
  });
const toronto = () =>
  fakeRecord({
    id: 'toronto',
    program_name: 'Applied Computing',
    university: { name: 'University of Toronto' },
  });

type Item = Partial<TaskRow> & { title: string };

function open({
  items = [],
  programs = [stanford(), toronto()],
  search = '',
}: { items?: Item[]; programs?: ReturnType<typeof stanford>[]; search?: string } = {}) {
  const applications = createFakeApplicationsApi(programs);
  const tasks = createFakeTasksApi(items.map((item) => fakeTask({ id: item.title, ...item })));
  const view = renderApp(`/app/tasks${search}`, createFakeAuth(fakeSession()).client, {
    api: applications.api,
    tasksApi: tasks.api,
  });
  return { ...view, applications, tasks };
}

const ready = () => screen.findByRole('list', { name: 'Tasks' });
const list = () => screen.getByRole('list', { name: 'Tasks' });
const names = () =>
  within(list())
    .getAllByRole('button', { name: /^Actions for / })
    .map((button) => button.getAttribute('aria-label')!.slice('Actions for '.length));
const rowFor = (title: string) =>
  within(list())
    .getByRole('button', { name: `Actions for ${title}` })
    .closest('li') as HTMLElement;
const statusButton = (title: string) =>
  within(rowFor(title)).getByRole('button', {
    name: (label) => label.endsWith(`. Change status of ${title}`),
  });
const statusOf = (title: string) => statusButton(title).getAttribute('aria-label')!.split('.')[0];

const show = () => screen.getByRole('combobox', { name: 'Show tasks' }) as HTMLSelectElement;
const program = () =>
  screen.getByRole('combobox', { name: 'Filter by program' }) as HTMLSelectElement;
const choose = (select: HTMLSelectElement, value: string) =>
  fireEvent.change(select, { target: { value } });

const field = (dialog: HTMLElement, label: RegExp | string) =>
  within(dialog).getByLabelText(label) as HTMLInputElement;
const setField = (dialog: HTMLElement, label: RegExp | string, value: string) =>
  fireEvent.change(field(dialog, label), { target: { value } });
const gone = (name: string) =>
  waitFor(() => expect(screen.queryByRole('dialog', { name })).not.toBeInTheDocument());

function chooseAction(title: string, action: 'Edit task' | 'Delete task…') {
  fireEvent.click(within(rowFor(title)).getByRole('button', { name: `Actions for ${title}` }));
  fireEvent.click(screen.getByRole('menuitem', { name: action }));
}

/** A spread of tasks: late, soon, far, undated, tied to programs or not, and one finished. */
const mixed = (): Item[] => [
  {
    title: 'Email Prof. Lee',
    application_id: 'stanford',
    due_date: daysFromNow(2),
    priority: 'high',
  },
  {
    title: 'Order transcripts',
    application_id: 'toronto',
    due_date: daysFromNow(-3),
    status: 'in_progress',
  },
  { title: 'Renew passport', application_id: null, due_date: daysFromNow(40), priority: 'low' },
  { title: 'Book the GRE', application_id: 'stanford' },
  {
    title: 'Send thank-you note',
    application_id: 'stanford',
    status: 'complete',
    completed_at: '2026-09-20T00:00:00+00:00',
  },
];

describe('the tasks page', () => {
  describe('getting there', () => {
    it('is in the sidebar', async () => {
      open();
      await screen.findByRole('heading', { level: 1, name: 'Tasks' });
      const nav = screen.getAllByRole('navigation', { name: 'Primary' })[0]!;
      expect(within(nav).getByRole('link', { name: 'Tasks' })).toHaveAttribute(
        'href',
        '/app/tasks',
      );
      expect(within(nav).getByRole('link', { name: 'Tasks' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('shows that it is loading, then the tasks', async () => {
      const { tasks } = open({ items: [{ title: 'Email Prof. Lee' }] });
      let release = () => {};
      tasks.api.list.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve(tasks.rows);
          }),
      );
      expect(await screen.findByText('Loading tasks')).toBeInTheDocument();
      release();
      await ready();
      expect(names()).toEqual(['Email Prof. Lee']);
    });
  });

  describe('with no tasks', () => {
    it('invites you to add the first one, with the program left for you to choose', async () => {
      open();
      expect(await screen.findByRole('heading', { name: 'No tasks yet.' })).toBeVisible();
      // The only "Add task" is the one in the empty state, not one in the page header as well.
      expect(screen.getAllByRole('button', { name: 'Add task' })).toHaveLength(1);
      fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
      const dialog = await screen.findByRole('dialog', { name: 'Add task' });
      expect(field(dialog, /^Program/)).toHaveValue('');
      expect(field(dialog, 'Priority')).toHaveValue('medium');
      expect(field(dialog, 'Status')).toHaveValue('todo');
    });

    it('shows no filters and no summary yet', async () => {
      open();
      await screen.findByRole('heading', { name: 'No tasks yet.' });
      expect(screen.queryByRole('combobox', { name: 'Show tasks' })).not.toBeInTheDocument();
      expect(screen.queryByText('Tasks at a glance')).not.toBeInTheDocument();
    });
  });

  describe('the tasks', () => {
    it('lists the open ones by due date, undated last, and leaves finished ones out', async () => {
      open({ items: mixed() });
      await ready();
      expect(names()).toEqual([
        'Order transcripts',
        'Email Prof. Lee',
        'Renew passport',
        'Book the GRE',
      ]);
    });

    it('shows the finished ones too, at the end, when asked', async () => {
      open({ items: mixed() });
      await ready();
      choose(show(), 'all');
      expect(names()).toEqual([
        'Order transcripts',
        'Email Prof. Lee',
        'Renew passport',
        'Book the GRE',
        'Send thank-you note',
      ]);
      choose(show(), 'complete');
      expect(names()).toEqual(['Send thank-you note']);
    });

    it('names the program of each task, with a link to that program’s tasks', async () => {
      open({
        items: [
          { title: 'Email Prof. Lee', application_id: 'stanford' },
          { title: 'Renew passport', application_id: null },
          { title: 'Orphan', application_id: 'deleted-elsewhere' },
        ],
      });
      await ready();
      expect(
        within(rowFor('Email Prof. Lee')).getByRole('link', {
          name: 'Stanford University, Computer Science',
        }),
      ).toHaveAttribute('href', '/app/applications/stanford/tasks');
      expect(rowFor('Renew passport')).toHaveTextContent('Not tied to a program');
      expect(within(rowFor('Renew passport')).queryByRole('link')).not.toBeInTheDocument();
      expect(rowFor('Orphan')).toHaveTextContent('Unknown program');
    });

    it('shows how much each matters, and when it is due', async () => {
      open({ items: mixed() });
      await ready();
      expect(rowFor('Email Prof. Lee')).toHaveTextContent('High');
      expect(rowFor('Renew passport')).toHaveTextContent('Low');
      expect(rowFor('Book the GRE')).toHaveTextContent('Medium');
      expect(within(rowFor('Order transcripts')).getByText('3 days overdue')).toBeInTheDocument();
      expect(within(rowFor('Email Prof. Lee')).getByText('In 2 days')).toBeInTheDocument();
      expect(rowFor('Book the GRE')).not.toHaveTextContent(/^Due /);
      expect(statusOf('Order transcripts')).toBe('In Progress');
      expect(statusOf('Book the GRE')).toBe('To Do');
    });

    it('does not call a finished task overdue', async () => {
      open({
        items: [
          { title: 'Old news', status: 'complete', due_date: daysFromNow(-30), completed_at: 'x' },
        ],
        search: '?show=all',
      });
      await ready();
      expect(rowFor('Old news')).not.toHaveTextContent('overdue');
    });

    it('sums up how many are done, and what is late or close', async () => {
      open({ items: mixed() });
      await ready();
      const glance = screen.getByText('Tasks at a glance').closest('div.rounded-lg') as HTMLElement;
      expect(glance).toHaveTextContent('1 of 5 tasks complete');
      expect(glance).toHaveTextContent('20%');
      expect(glance).toHaveTextContent('4 open · 1 overdue · 1 due in the next 7 days');
      expect(within(glance).getByRole('progressbar', { name: 'Tasks completed' })).toHaveAttribute(
        'aria-valuenow',
        '20',
      );
    });

    it('celebrates nothing until every task is done', async () => {
      open({
        items: [
          { title: 'A', status: 'complete', completed_at: 'x' },
          { title: 'B', status: 'complete', completed_at: 'y' },
        ],
        search: '?show=all',
      });
      await ready();
      expect(screen.getByText('Every task is complete.')).toBeVisible();
      expect(screen.getByText('Tasks at a glance').closest('div.rounded-lg')).toHaveTextContent(
        '2 of 2 tasks complete',
      );
    });
  });

  describe('filtering', () => {
    it('shows one program’s tasks, or the ones tied to none', async () => {
      open({ items: mixed() });
      await ready();
      choose(program(), 'stanford');
      expect(names()).toEqual(['Email Prof. Lee', 'Book the GRE']);
      choose(program(), 'toronto');
      expect(names()).toEqual(['Order transcripts']);
      choose(program(), 'none');
      expect(names()).toEqual(['Renew passport']);
      choose(program(), '');
      expect(names()).toHaveLength(4);
    });

    it('lists the programs by name, with the tasks that belong to none', async () => {
      open({ items: mixed() });
      await ready();
      expect(Array.from(program().options, (option) => option.textContent)).toEqual([
        'All programs',
        'Not tied to a program',
        'Stanford University, Computer Science',
        'University of Toronto, Applied Computing',
      ]);
      expect(Array.from(show().options, (option) => option.textContent)).toEqual([
        'Open tasks',
        'Completed tasks',
        'All tasks',
      ]);
    });

    it('sums up the program you chose, whichever tasks are showing', async () => {
      open({ items: mixed() });
      await ready();
      choose(program(), 'stanford');
      const glance = screen.getByText('Tasks at a glance').closest('div.rounded-lg') as HTMLElement;
      // Stanford has three tasks, one of them finished, though only the open ones are listed.
      expect(glance).toHaveTextContent('1 of 3 tasks complete');
      expect(names()).toEqual(['Email Prof. Lee', 'Book the GRE']);
    });

    it('is kept in the address, so a link or a reload shows the same list', async () => {
      open({ items: mixed(), search: '?show=all&program=stanford' });
      await ready();
      expect(show()).toHaveValue('all');
      expect(program()).toHaveValue('stanford');
      expect(names()).toEqual(['Email Prof. Lee', 'Book the GRE', 'Send thank-you note']);
    });

    it('shows everything for a program that no longer exists, rather than nothing', async () => {
      open({ items: mixed(), search: '?program=deleted-elsewhere' });
      await ready();
      expect(program()).toHaveValue('');
      expect(names()).toHaveLength(4);
    });

    it('ignores a value it does not know', async () => {
      open({ items: mixed(), search: '?show=everything' });
      await ready();
      expect(show()).toHaveValue('open');
      expect(names()).toHaveLength(4);
    });

    it('offers to clear the filters only while there are some', async () => {
      open({ items: mixed() });
      await ready();
      expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
      choose(program(), 'toronto');
      choose(show(), 'all');
      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
      expect(show()).toHaveValue('open');
      expect(program()).toHaveValue('');
      expect(names()).toHaveLength(4);
      expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    });

    describe('when the filters leave nothing', () => {
      it('says every task is done, and offers to show them', async () => {
        open({ items: [{ title: 'A', status: 'complete', completed_at: 'x' }] });
        expect(await screen.findByRole('heading', { name: 'Nothing left to do.' })).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Show all tasks' }));
        expect(names()).toEqual(['A']);
      });

      it('says none are done yet, and offers to show the open ones', async () => {
        open({ items: [{ title: 'A' }], search: '?show=complete' });
        expect(
          await screen.findByRole('heading', { name: 'No completed tasks yet.' }),
        ).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Show open tasks' }));
        expect(names()).toEqual(['A']);
      });

      it('says a program has none, and offers to show every program', async () => {
        open({ items: [{ title: 'A', application_id: 'stanford' }], search: '?program=toronto' });
        expect(
          await screen.findByRole('heading', { name: 'No tasks for this program yet.' }),
        ).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Show all programs' }));
        expect(names()).toEqual(['A']);
      });

      it('says none stand alone, and offers to show every program', async () => {
        open({ items: [{ title: 'A', application_id: 'stanford' }], search: '?program=none' });
        expect(
          await screen.findByRole('heading', { name: 'No tasks outside your programs.' }),
        ).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Show all programs' }));
        expect(names()).toEqual(['A']);
      });

      it('says a program has none, not that none are done, when its finished ones are asked for', async () => {
        open({
          items: [{ title: 'A', application_id: 'stanford' }],
          search: '?show=complete&program=toronto',
        });
        expect(
          await screen.findByRole('heading', { name: 'No tasks for this program yet.' }),
        ).toBeVisible();
        expect(
          screen.queryByRole('heading', { name: 'No completed tasks yet.' }),
        ).not.toBeInTheDocument();
      });

      it('says none stand alone, not that none are done, when the finished ones are asked for', async () => {
        open({
          items: [{ title: 'A', application_id: 'stanford' }],
          search: '?show=complete&program=none',
        });
        expect(
          await screen.findByRole('heading', { name: 'No tasks outside your programs.' }),
        ).toBeVisible();
      });

      it('says a program has no tasks left, not that it has none, when they are all done', async () => {
        open({
          items: [
            { title: 'A', application_id: 'stanford', status: 'complete', completed_at: 'x' },
            { title: 'B', application_id: 'toronto' },
          ],
          search: '?program=stanford',
        });
        expect(await screen.findByRole('heading', { name: 'Nothing left to do.' })).toBeVisible();
      });
    });
  });

  describe('adding tasks', () => {
    async function openAddForm() {
      fireEvent.click((await screen.findAllByRole('button', { name: 'Add task' }))[0]!);
      return screen.findByRole('dialog', { name: 'Add task' });
    }
    const submitAdd = (dialog: HTMLElement) =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add task' }));

    it('lets you choose the program, or none, and lists them by name', async () => {
      open({ items: [{ title: 'Existing' }] });
      await ready();
      const dialog = await openAddForm();
      expect(
        within(field(dialog, /^Program/))
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual([
        'Not tied to a program',
        'Stanford University, Computer Science',
        'University of Toronto, Applied Computing',
      ]);
      expect(field(dialog, /^Program/)).toHaveValue('');
    });

    it('saves a task for the chosen program', async () => {
      const { tasks } = open({ items: [{ title: 'Existing' }] });
      await ready();
      const dialog = await openAddForm();
      setField(dialog, /^Title/, 'Ask for a fee waiver');
      setField(dialog, /^Program/, 'stanford');
      setField(dialog, 'Due date', daysFromNow(5));
      setField(dialog, 'Priority', 'high');
      setField(dialog, 'Notes', 'Use the form on the portal.');
      submitAdd(dialog);
      expect(await screen.findByText('Added Ask for a fee waiver.')).toBeInTheDocument();
      await gone('Add task');
      expect(tasks.api.create.mock.calls[0]![0]).toEqual({
        application_id: 'stanford',
        title: 'Ask for a fee waiver',
        due_date: daysFromNow(5),
        priority: 'high',
        status: 'todo',
        notes: 'Use the form on the portal.',
      });
      expect(
        within(rowFor('Ask for a fee waiver')).getByRole('link', {
          name: 'Stanford University, Computer Science',
        }),
      ).toBeInTheDocument();
    });

    it('saves a task that belongs to no program, with no date', async () => {
      const { tasks } = open({ items: [{ title: 'Existing' }] });
      await ready();
      const dialog = await openAddForm();
      setField(dialog, /^Title/, 'Renew passport');
      submitAdd(dialog);
      expect(await screen.findByText('Added Renew passport.')).toBeInTheDocument();
      expect(tasks.api.create.mock.calls[0]![0]).toMatchObject({
        application_id: null,
        due_date: null,
        notes: null,
      });
      expect(rowFor('Renew passport')).toHaveTextContent('Not tied to a program');
    });

    it('starts on the program you are looking at', async () => {
      open({ items: mixed(), search: '?program=toronto' });
      await ready();
      const dialog = await openAddForm();
      expect(field(dialog, /^Program/)).toHaveValue('toronto');
    });

    it('starts on no program when you are not looking at one', async () => {
      open({ items: mixed(), search: '?program=none' });
      await ready();
      const dialog = await openAddForm();
      expect(field(dialog, /^Program/)).toHaveValue('');
    });

    it('saves the task on the program being looked at, unless you change it', async () => {
      const { tasks } = open({ items: mixed(), search: '?program=toronto' });
      await ready();
      const dialog = await openAddForm();
      setField(dialog, /^Title/, 'Ask about housing');
      submitAdd(dialog);
      expect(await screen.findByText('Added Ask about housing.')).toBeInTheDocument();
      expect(tasks.api.create.mock.calls[0]![0]).toMatchObject({ application_id: 'toronto' });
    });

    it('saves the task on no program when the list is of the tasks that have none', async () => {
      const { tasks } = open({ items: mixed(), search: '?program=none' });
      await ready();
      const dialog = await openAddForm();
      setField(dialog, /^Title/, 'Renew my visa');
      submitAdd(dialog);
      expect(await screen.findByText('Added Renew my visa.')).toBeInTheDocument();
      expect(tasks.api.create.mock.calls[0]![0]).toMatchObject({ application_id: null });
    });

    it('explains a missing title without saving', async () => {
      const { tasks } = open({ items: [{ title: 'Existing' }] });
      await ready();
      const dialog = await openAddForm();
      submitAdd(dialog);
      expect(
        await within(dialog).findByText(
          'Enter a title, like "Email Prof. Lee about the deadline".',
        ),
      ).toBeInTheDocument();
      expect(tasks.api.create).not.toHaveBeenCalled();
    });

    it('keeps what you typed and says why when saving fails', async () => {
      const { tasks } = open({ items: [{ title: 'Existing' }] });
      await ready();
      tasks.api.create.mockRejectedValueOnce(new DataError('network'));
      const dialog = await openAddForm();
      setField(dialog, /^Title/, 'Renew passport');
      submitAdd(dialog);
      expect(await within(dialog).findByText('Failed to save task')).toBeInTheDocument();
      expect(within(dialog).getByRole('alert')).toHaveTextContent(/Can't reach the server/);
      expect(field(dialog, /^Title/)).toHaveValue('Renew passport');
    });

    it('starts the next form clean', async () => {
      open({ items: [{ title: 'Existing' }] });
      await ready();
      let dialog = await openAddForm();
      setField(dialog, /^Title/, 'Half typed');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await gone('Add task');
      dialog = await openAddForm();
      expect(field(dialog, /^Title/)).toHaveValue('');
    });
  });

  describe('editing, finishing and deleting', () => {
    it('edits a task in place', async () => {
      const { tasks } = open({
        items: [{ title: 'Email Prof. Lee', application_id: 'stanford', priority: 'low' }],
      });
      await ready();
      chooseAction('Email Prof. Lee', 'Edit task');
      const dialog = await screen.findByRole('dialog', { name: 'Edit task' });
      expect(field(dialog, /^Program/)).toHaveValue('stanford');
      expect(field(dialog, 'Priority')).toHaveValue('low');
      setField(dialog, 'Priority', 'high');
      setField(dialog, 'Status', 'in_progress');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
      expect(await screen.findByText('Saved Email Prof. Lee.')).toBeInTheDocument();
      expect(tasks.api.update.mock.calls[0]![1]).toMatchObject({
        priority: 'high',
        status: 'in_progress',
      });
      expect(statusOf('Email Prof. Lee')).toBe('In Progress');
      expect(rowFor('Email Prof. Lee')).toHaveTextContent('High');
    });

    it('moves a task to another program', async () => {
      const { tasks } = open({ items: [{ title: 'Email Prof. Lee', application_id: 'stanford' }] });
      await ready();
      chooseAction('Email Prof. Lee', 'Edit task');
      const dialog = await screen.findByRole('dialog', { name: 'Edit task' });
      setField(dialog, /^Program/, 'toronto');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
      await screen.findByText('Saved Email Prof. Lee.');
      expect(tasks.api.update.mock.calls[0]![1]).toMatchObject({ application_id: 'toronto' });
      expect(
        within(rowFor('Email Prof. Lee')).getByRole('link', {
          name: 'University of Toronto, Applied Computing',
        }),
      ).toBeInTheDocument();
    });

    it('changes a status from the row and puts it back when saving fails', async () => {
      const { tasks } = open({ items: [{ title: 'Email Prof. Lee' }] });
      tasks.api.setStatus.mockRejectedValueOnce(new DataError('network'));
      await ready();
      fireEvent.click(statusButton('Email Prof. Lee'));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'In Progress' }));
      expect(await screen.findByText("Couldn't update that task")).toBeInTheDocument();
      await waitFor(() => expect(statusOf('Email Prof. Lee')).toBe('To Do'));
    });

    it('moves a finished task out of the open list and into the summary', async () => {
      const { tasks } = open({
        items: [{ title: 'Email Prof. Lee' }, { title: 'Book the GRE' }],
      });
      await ready();
      fireEvent.click(statusButton('Email Prof. Lee'));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Complete' }));
      await waitFor(() => expect(names()).toEqual(['Book the GRE']));
      expect(tasks.api.setStatus).toHaveBeenCalledWith('Email Prof. Lee', 'complete');
      expect(screen.getByText('Tasks at a glance').closest('div.rounded-lg')).toHaveTextContent(
        '1 of 2 tasks complete',
      );

      choose(show(), 'complete');
      expect(names()).toEqual(['Email Prof. Lee']);
      expect(statusOf('Email Prof. Lee')).toBe('Complete');
    });

    it('brings a task back to the open list when it is reopened', async () => {
      open({
        items: [{ title: 'Done', status: 'complete', completed_at: '2026-09-20T00:00:00+00:00' }],
        search: '?show=complete',
      });
      await ready();
      fireEvent.click(statusButton('Done'));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'To Do' }));
      expect(await screen.findByRole('heading', { name: 'No completed tasks yet.' })).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: 'Show open tasks' }));
      expect(names()).toEqual(['Done']);
    });

    it('deletes a task after asking', async () => {
      const { tasks } = open({ items: [{ title: 'Email Prof. Lee' }, { title: 'Book the GRE' }] });
      await ready();
      chooseAction('Book the GRE', 'Delete task…');
      const dialog = await screen.findByRole('dialog', { name: 'Delete this task?' });
      expect(dialog).toHaveTextContent('“Book the GRE” will be removed from your tasks.');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete task' }));
      expect(await screen.findByText('Deleted Book the GRE.')).toBeInTheDocument();
      expect(names()).toEqual(['Email Prof. Lee']);
      expect(tasks.rows.map((row) => row.title)).toEqual(['Email Prof. Lee']);
    });

    it('keeps the task and says why when deleting fails', async () => {
      const { tasks } = open({ items: [{ title: 'Email Prof. Lee' }] });
      tasks.api.remove.mockRejectedValueOnce(new DataError('network'));
      await ready();
      chooseAction('Email Prof. Lee', 'Delete task…');
      const dialog = await screen.findByRole('dialog', { name: 'Delete this task?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete task' }));
      expect(await within(dialog).findByText("Couldn't delete this task")).toBeInTheDocument();
      expect(names()).toEqual(['Email Prof. Lee']);
    });

    it('lets you back out of deleting', async () => {
      const { tasks } = open({ items: [{ title: 'Email Prof. Lee' }] });
      await ready();
      chooseAction('Email Prof. Lee', 'Delete task…');
      const dialog = await screen.findByRole('dialog', { name: 'Delete this task?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await gone('Delete this task?');
      expect(tasks.api.remove).not.toHaveBeenCalled();
      expect(names()).toEqual(['Email Prof. Lee']);
    });
  });

  describe('when something cannot be loaded', () => {
    it('says the tasks could not be loaded, and tries again on request', async () => {
      const { tasks } = open({ items: [{ title: 'Email Prof. Lee' }] });
      tasks.api.list.mockRejectedValueOnce(new DataError('network'));
      expect(await screen.findByText('Unable to load tasks')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the server");
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await ready();
      expect(names()).toEqual(['Email Prof. Lee']);
    });

    it('does the same when the programs cannot be loaded', async () => {
      const { applications } = open({ items: [{ title: 'Email Prof. Lee' }] });
      applications.api.list.mockRejectedValueOnce(new DataError('network'));
      expect(await screen.findByText('Unable to load tasks')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await ready();
    });

    it('warns when only the programs fail to refresh, since the names shown may be old', async () => {
      const { applications, queryClient } = open({
        items: [{ title: 'Email Prof. Lee', application_id: 'stanford' }],
      });
      await ready();
      expect(screen.queryByText('Unable to refresh tasks')).not.toBeInTheDocument();
      applications.api.list.mockRejectedValueOnce(new DataError('network'));
      await act(async () => {
        await queryClient.refetchQueries({ queryKey: ['applications', 'user-1'] });
      });
      expect(await screen.findByText('Unable to refresh tasks')).toBeInTheDocument();
      expect(names()).toEqual(['Email Prof. Lee']);
      expect(screen.getByRole('status')).toHaveTextContent("Can't reach the server");
    });

    it('keeps showing the last list when a refresh fails', async () => {
      const { tasks } = open({ items: [{ title: 'Email Prof. Lee' }] });
      await ready();
      tasks.api.list.mockRejectedValueOnce(new DataError('network'));
      fireEvent.click(statusButton('Email Prof. Lee'));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'In Progress' }));
      expect(await screen.findByText('Unable to refresh tasks')).toBeInTheDocument();
      expect(names()).toEqual(['Email Prof. Lee']);
    });
  });
});
