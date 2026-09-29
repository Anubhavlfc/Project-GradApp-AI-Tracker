import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { TaskRow } from '@/features/tasks/types';
import { DataError } from '@/lib/dataError';
import { createFakeApplicationsApi, daysFromNow, fakeRecord } from '@/test/fakeApplicationsApi';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import { createFakeTasksApi, fakeTask } from '@/test/fakeTasksApi';
import { renderApp } from '@/test/renderApp';

const stanford = (overrides: Parameters<typeof fakeRecord>[0] = {}) =>
  fakeRecord({
    program_name: 'Computer Science',
    degree_type: 'MS',
    status: 'documents_in_progress',
    university: { name: 'Stanford University' },
    ...overrides,
  });

type Item = Partial<TaskRow> & { title: string };

/** Opens one program's Tasks tab, with these tasks on file (for this program by default). */
function open({
  items = [],
  record = stanford(),
  otherPrograms = [],
  path = 'tasks',
}: {
  items?: Item[];
  record?: ReturnType<typeof stanford>;
  otherPrograms?: ReturnType<typeof stanford>[];
  path?: string;
} = {}) {
  const applications = createFakeApplicationsApi([record, ...otherPrograms]);
  const tasks = createFakeTasksApi(
    items.map((item) => fakeTask({ id: item.title, application_id: record.id, ...item })),
  );
  const view = renderApp(
    `/app/applications/${record.id}/${path}`,
    createFakeAuth(fakeSession()).client,
    { api: applications.api, tasksApi: tasks.api },
  );
  return { ...view, record, applications, tasks };
}

const list = () => screen.getByRole('list', { name: 'Tasks for this program' });
const ready = () => screen.findByRole('list', { name: 'Tasks for this program' });
/** The tasks on the list, top to bottom. */
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

function changeStatus(title: string, status: string) {
  fireEvent.click(statusButton(title));
  fireEvent.click(screen.getByRole('menuitemradio', { name: status }));
}
function chooseAction(title: string, action: 'Edit task' | 'Delete task…') {
  fireEvent.click(within(rowFor(title)).getByRole('button', { name: `Actions for ${title}` }));
  fireEvent.click(screen.getByRole('menuitem', { name: action }));
}

const field = (dialog: HTMLElement, label: RegExp | string) =>
  within(dialog).getByLabelText(label) as HTMLInputElement;
const setField = (dialog: HTMLElement, label: RegExp | string, value: string) =>
  fireEvent.change(field(dialog, label), { target: { value } });
const gone = (name: string) =>
  waitFor(() => expect(screen.queryByRole('dialog', { name })).not.toBeInTheDocument());

async function openAddForm() {
  fireEvent.click((await screen.findAllByRole('button', { name: 'Add task' }))[0]!);
  return screen.findByRole('dialog', { name: 'Add task' });
}
const submitAdd = (dialog: HTMLElement) =>
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add task' }));

describe('a program’s tasks tab', () => {
  describe('getting there', () => {
    it('is a tab on the program page', async () => {
      const { record } = open({ path: '' });
      const tabs = await screen.findByRole('navigation', { name: 'Sections of this program' });
      fireEvent.click(within(tabs).getByRole('link', { name: 'Tasks' }));
      expect(
        await screen.findByRole('heading', { name: 'No tasks for this program yet.' }),
      ).toBeVisible();
      expect(within(tabs).getByRole('link', { name: 'Tasks' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(within(tabs).getByRole('link', { name: 'Tasks' })).toHaveAttribute(
        'href',
        `/app/applications/${record.id}/tasks`,
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
      expect(
        screen.queryByRole('list', { name: 'Tasks for this program' }),
      ).not.toBeInTheDocument();
      release();
      await ready();
      expect(names()).toEqual(['Email Prof. Lee']);
    });
  });

  describe('with no tasks', () => {
    it('invites you to add the first one', async () => {
      open();
      expect(
        await screen.findByRole('heading', { name: 'No tasks for this program yet.' }),
      ).toBeVisible();
      expect(screen.getByRole('button', { name: 'Add task' })).toBeEnabled();
      expect(screen.queryByText('Tasks at a glance')).not.toBeInTheDocument();
    });
  });

  describe('the tasks', () => {
    it('lists the open ones by due date, then those without one, then the finished ones', async () => {
      open({
        items: [
          { title: 'Finished', status: 'complete', completed_at: '2026-09-20T00:00:00+00:00' },
          { title: 'No date' },
          { title: 'Later', due_date: '2027-01-15' },
          { title: 'Sooner', due_date: '2026-11-20', status: 'in_progress' },
        ],
      });
      await ready();
      expect(names()).toEqual(['Sooner', 'Later', 'No date', 'Finished']);
    });

    it('shows the priority, due date, status and notes of a task', async () => {
      open({
        items: [
          {
            title: 'Email Prof. Lee',
            priority: 'high',
            due_date: '2027-01-05',
            status: 'in_progress',
            notes: 'Ask about the funding.',
          },
        ],
      });
      await ready();
      const row = rowFor('Email Prof. Lee');
      expect(row).toHaveTextContent('High');
      expect(row).toHaveTextContent('Due Jan 5, 2027');
      expect(within(row).getByText('Ask about the funding.')).toBeInTheDocument();
      expect(statusOf('Email Prof. Lee')).toBe('In Progress');
    });

    it('does not name the program on every row: you are already on its page', async () => {
      open({ items: [{ title: 'Email Prof. Lee' }] });
      await ready();
      expect(rowFor('Email Prof. Lee')).not.toHaveTextContent('Stanford');
      expect(within(rowFor('Email Prof. Lee')).queryByRole('link')).not.toBeInTheDocument();
    });

    it('only shows this program’s tasks', async () => {
      open({
        items: [
          { title: 'Ours' },
          { title: 'Theirs', application_id: 'some-other-program' },
          { title: 'Nobody’s', application_id: null },
        ],
      });
      await ready();
      expect(names()).toEqual(['Ours']);
    });

    it('sums up how many are done', async () => {
      open({
        items: [
          { title: 'A', status: 'complete', completed_at: 'x' },
          { title: 'B', due_date: daysFromNow(-1) },
          { title: 'C', due_date: daysFromNow(3) },
          { title: 'D' },
        ],
      });
      await ready();
      const glance = screen.getByText('Tasks at a glance').closest('div.rounded-lg') as HTMLElement;
      expect(glance).toHaveTextContent('1 of 4 tasks complete');
      expect(glance).toHaveTextContent('25%');
      expect(glance).toHaveTextContent('3 open · 1 overdue · 1 due in the next 7 days');
    });

    it('counts down while a task is open, and stops once it is complete', async () => {
      open({
        items: [
          { title: 'Late', due_date: daysFromNow(-4) },
          { title: 'Soon', due_date: daysFromNow(1) },
          { title: 'Done', due_date: daysFromNow(-4), status: 'complete', completed_at: 'x' },
        ],
      });
      await ready();
      expect(within(rowFor('Late')).getByText('4 days overdue')).toBeInTheDocument();
      expect(within(rowFor('Soon')).getByText('Due tomorrow')).toBeInTheDocument();
      expect(rowFor('Done')).not.toHaveTextContent('overdue');
      expect(rowFor('Done')).toHaveTextContent('Due');
    });

    it('still counts down after the program has been submitted: thank-you notes come later', async () => {
      open({
        record: stanford({ status: 'submitted' }),
        items: [{ title: 'Thank-you note', due_date: daysFromNow(5) }],
      });
      await ready();
      expect(within(rowFor('Thank-you note')).getByText('In 5 days')).toBeInTheDocument();
    });
  });

  describe('adding tasks', () => {
    it('starts with the program decided and sensible defaults', async () => {
      open();
      const dialog = await openAddForm();
      expect(dialog).toHaveTextContent('Stanford University, Computer Science');
      expect(within(dialog).queryByRole('combobox', { name: /^Program/ })).toBeNull();
      expect(field(dialog, /^Title/)).toHaveFocus();
      expect(field(dialog, 'Priority')).toHaveValue('medium');
      expect(field(dialog, 'Status')).toHaveValue('todo');
      expect(field(dialog, 'Due date')).toHaveValue('');
    });

    it('saves a task for this program', async () => {
      const { tasks, record } = open();
      const dialog = await openAddForm();
      setField(dialog, /^Title/, '  Email   Prof. Lee ');
      setField(dialog, 'Due date', '2026-12-01');
      setField(dialog, 'Priority', 'high');
      setField(dialog, 'Status', 'in_progress');
      setField(dialog, 'Notes', 'About the funding.');
      submitAdd(dialog);

      expect(await screen.findByText('Added Email Prof. Lee.')).toBeInTheDocument();
      await gone('Add task');
      expect(tasks.api.create.mock.calls[0]![0]).toEqual({
        application_id: record.id,
        title: 'Email Prof. Lee',
        due_date: '2026-12-01',
        priority: 'high',
        status: 'in_progress',
        notes: 'About the funding.',
      });
      expect(names()).toEqual(['Email Prof. Lee']);
    });

    it('explains a missing title without saving', async () => {
      const { tasks } = open();
      const dialog = await openAddForm();
      submitAdd(dialog);
      expect(
        await within(dialog).findByText(
          'Enter a title, like "Email Prof. Lee about the deadline".',
        ),
      ).toBeInTheDocument();
      expect(field(dialog, /^Title/)).toHaveAttribute('aria-invalid', 'true');
      expect(tasks.api.create).not.toHaveBeenCalled();
    });

    it('says why when saving fails, and keeps what was typed', async () => {
      const { tasks } = open();
      tasks.api.create.mockRejectedValueOnce(new DataError('network'));
      const dialog = await openAddForm();
      setField(dialog, /^Title/, 'Email Prof. Lee');
      submitAdd(dialog);
      expect(await within(dialog).findByText('Failed to save task')).toBeInTheDocument();
      expect(field(dialog, /^Title/)).toHaveValue('Email Prof. Lee');
    });
  });

  describe('editing tasks', () => {
    it('edits a task in place', async () => {
      const { tasks } = open({
        items: [{ title: 'Email Prof. Lee', priority: 'low', due_date: '2026-12-01' }],
      });
      await ready();
      chooseAction('Email Prof. Lee', 'Edit task');
      const dialog = await screen.findByRole('dialog', { name: 'Edit task' });
      expect(field(dialog, /^Title/)).toHaveValue('Email Prof. Lee');
      expect(field(dialog, 'Due date')).toHaveValue('2026-12-01');
      expect(field(dialog, 'Priority')).toHaveValue('low');
      setField(dialog, /^Title/, 'Email Prof. Lee and Prof. Kim');
      setField(dialog, 'Due date', '');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

      expect(await screen.findByText('Saved Email Prof. Lee and Prof. Kim.')).toBeInTheDocument();
      expect(tasks.api.update.mock.calls[0]![1]).toMatchObject({
        title: 'Email Prof. Lee and Prof. Kim',
        due_date: null,
      });
      expect(names()).toEqual(['Email Prof. Lee and Prof. Kim']);
    });

    it('keeps the program fixed: this is its page', async () => {
      open({ items: [{ title: 'Email Prof. Lee' }] });
      await ready();
      chooseAction('Email Prof. Lee', 'Edit task');
      const dialog = await screen.findByRole('dialog', { name: 'Edit task' });
      expect(dialog).toHaveTextContent('Stanford University, Computer Science');
    });
  });

  describe('changing a status', () => {
    it('changes it from the row, at once', async () => {
      const { tasks } = open({ items: [{ title: 'Email Prof. Lee' }] });
      await ready();
      changeStatus('Email Prof. Lee', 'In Progress');
      await waitFor(() => expect(statusOf('Email Prof. Lee')).toBe('In Progress'));
      expect(tasks.api.setStatus).toHaveBeenCalledWith('Email Prof. Lee', 'in_progress');
    });

    it('moves a task to the end when it is finished, and back when it is reopened', async () => {
      open({
        items: [
          { title: 'First', due_date: '2026-12-01' },
          { title: 'Second', due_date: '2026-12-02' },
        ],
      });
      await ready();
      changeStatus('First', 'Complete');
      await waitFor(() => expect(names()).toEqual(['Second', 'First']));
      expect(rowFor('First')).not.toHaveTextContent('overdue');
      changeStatus('First', 'To Do');
      await waitFor(() => expect(names()).toEqual(['First', 'Second']));
    });

    it('updates the summary', async () => {
      open({ items: [{ title: 'A' }, { title: 'B' }] });
      await ready();
      const glance = screen.getByText('Tasks at a glance').closest('div.rounded-lg') as HTMLElement;
      expect(glance).toHaveTextContent('0 of 2 tasks complete');
      changeStatus('A', 'Complete');
      await waitFor(() => expect(glance).toHaveTextContent('1 of 2 tasks complete'));
      changeStatus('B', 'Complete');
      await waitFor(() => expect(glance).toHaveTextContent('2 of 2 tasks complete'));
      expect(screen.getByText('Every task is complete.')).toBeVisible();
    });

    it('puts the old status back and says why when the server refuses', async () => {
      const { tasks } = open({ items: [{ title: 'Email Prof. Lee' }] });
      tasks.api.setStatus.mockRejectedValueOnce(new DataError('network'));
      await ready();
      changeStatus('Email Prof. Lee', 'Complete');
      expect(await screen.findByText("Couldn't update that task")).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the server");
      await waitFor(() => expect(statusOf('Email Prof. Lee')).toBe('To Do'));
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(screen.queryByText("Couldn't update that task")).not.toBeInTheDocument();
    });
  });

  describe('deleting tasks', () => {
    it('deletes a task after asking', async () => {
      const { tasks } = open({ items: [{ title: 'Email Prof. Lee' }, { title: 'Book the GRE' }] });
      await ready();
      chooseAction('Book the GRE', 'Delete task…');
      const dialog = await screen.findByRole('dialog', { name: 'Delete this task?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete task' }));
      expect(await screen.findByText('Deleted Book the GRE.')).toBeInTheDocument();
      expect(names()).toEqual(['Email Prof. Lee']);
      expect(tasks.rows.map((row) => row.title)).toEqual(['Email Prof. Lee']);
    });

    it('shows the empty state again after the last task is deleted', async () => {
      open({ items: [{ title: 'Only one' }] });
      await ready();
      chooseAction('Only one', 'Delete task…');
      const dialog = await screen.findByRole('dialog', { name: 'Delete this task?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete task' }));
      expect(
        await screen.findByRole('heading', { name: 'No tasks for this program yet.' }),
      ).toBeVisible();
    });
  });

  describe('when the server is not reachable', () => {
    it('says the tasks could not be loaded, and tries again on request', async () => {
      const { tasks } = open({ items: [{ title: 'Email Prof. Lee' }] });
      tasks.api.list.mockRejectedValueOnce(new DataError('network'));
      expect(await screen.findByText('Unable to load tasks')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the server");
      expect(screen.queryByRole('heading', { name: 'No tasks for this program yet.' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await ready();
      expect(names()).toEqual(['Email Prof. Lee']);
    });

    it('keeps showing the last list when a refresh fails', async () => {
      const { tasks } = open({ items: [{ title: 'Email Prof. Lee' }] });
      await ready();
      tasks.api.list.mockRejectedValueOnce(new DataError('network'));
      changeStatus('Email Prof. Lee', 'In Progress');
      expect(await screen.findByText('Unable to refresh tasks')).toBeInTheDocument();
      expect(names()).toEqual(['Email Prof. Lee']);
      expect(screen.getByText(/Showing the last list that loaded\./)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await waitFor(() =>
        expect(screen.queryByText('Unable to refresh tasks')).not.toBeInTheDocument(),
      );
    });
  });

  describe('on the overview', () => {
    const card = async () =>
      (await screen.findByRole('heading', { name: 'Tasks' })).closest(
        'div.rounded-lg',
      ) as HTMLElement;

    it('invites you to add a task when there is none', async () => {
      const { record } = open({ path: '' });
      const tasks = await card();
      expect(await within(tasks).findByText('No tasks yet.')).toBeInTheDocument();
      expect(within(tasks).getByRole('link', { name: 'Add a task' })).toHaveAttribute(
        'href',
        `/app/applications/${record.id}/tasks`,
      );
    });

    it('shows how many are done, what is late, and what to do next', async () => {
      const { record } = open({
        path: '',
        items: [
          { title: 'Done already', status: 'complete', completed_at: 'x' },
          { title: 'Late one', due_date: daysFromNow(-2) },
          { title: 'Next one', due_date: daysFromNow(4) },
        ],
      });
      const tasks = await card();
      expect(await within(tasks).findByText('1 of 3 complete')).toBeInTheDocument();
      expect(tasks).toHaveTextContent('1 overdue');
      // The list is in the order to deal with tasks, so the first open one is next.
      expect(tasks).toHaveTextContent('Next: Late one');
      expect(tasks).toHaveTextContent('2 days overdue');
      expect(within(tasks).getByRole('link', { name: 'View tasks' })).toHaveAttribute(
        'href',
        `/app/applications/${record.id}/tasks`,
      );
    });

    it('names an upcoming task with when it is due', async () => {
      open({ path: '', items: [{ title: 'Book the GRE', due_date: daysFromNow(4) }] });
      const tasks = await card();
      expect(await within(tasks).findByText('0 of 1 complete')).toBeInTheDocument();
      expect(tasks).toHaveTextContent('Next: Book the GRE');
      expect(tasks).toHaveTextContent('In 4 days');
      expect(tasks).not.toHaveTextContent('overdue');
    });

    it('says when every task is complete', async () => {
      open({ path: '', items: [{ title: 'A', status: 'complete', completed_at: 'x' }] });
      const tasks = await card();
      expect(await within(tasks).findByText('1 of 1 complete')).toBeInTheDocument();
      expect(tasks).toHaveTextContent('Every task is complete.');
    });

    it('says when the tasks could not be loaded, and tries again', async () => {
      const { tasks } = open({ path: '', items: [{ title: 'Email Prof. Lee' }] });
      tasks.api.list.mockRejectedValueOnce(new DataError('network'));
      expect(await screen.findByText('Unable to load tasks')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('0 of 1 complete')).toBeInTheDocument();
    });
  });

  describe('when the program is deleted', () => {
    it('takes its tasks out of what is remembered', async () => {
      const { tasks, queryClient } = open({
        items: [{ title: 'Ours' }, { title: 'Theirs', application_id: 'some-other-program' }],
      });
      await ready();
      const remembered = () => queryClient.getQueryData<TaskRow[]>(['tasks', 'user-1']);
      expect(remembered()).toHaveLength(2);

      // The fake database keeps the rows (the real one deletes them along with the program), so
      // hold back the reload to see what was done to the remembered list itself.
      tasks.api.list.mockImplementation(() => new Promise(() => {}));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      const dialog = await screen.findByRole('dialog', { name: 'Delete this application?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete application' }));
      await screen.findByRole('heading', { name: 'No applications yet.' });

      expect(remembered()?.map((row) => row.title)).toEqual(['Theirs']);
    });
  });
});
