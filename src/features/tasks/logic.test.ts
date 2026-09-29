import { fakeTask } from '@/test/fakeTasksApi';
import { permutations } from '@/test/permutations';
import {
  DEFAULT_TASK_FILTER,
  DUE_SOON_DAYS,
  filterTasks,
  isDefaultFilter,
  NO_PROGRAM,
  parseTaskFilter,
  sortTasks,
  summarizeTasks,
  taskDue,
  taskFilterParams,
  type TaskFilter,
} from './logic';
import type { TaskRow } from './types';

const TODAY = '2026-10-15';

describe('taskDue', () => {
  it('has nothing to say about a task with no due date', () => {
    expect(taskDue({ due_date: null, status: 'todo' }, TODAY)).toEqual({
      state: 'none',
      days: null,
      text: null,
      tone: 'neutral',
    });
  });

  it('counts down to an open task’s due date, and calls a missed one overdue', () => {
    expect(taskDue({ due_date: '2026-10-20', status: 'todo' }, TODAY)).toMatchObject({
      state: 'soon',
      days: 5,
      text: 'In 5 days',
    });
    expect(taskDue({ due_date: '2026-10-15', status: 'in_progress' }, TODAY)).toMatchObject({
      state: 'today',
      text: 'Due today',
    });
    expect(taskDue({ due_date: '2026-10-12', status: 'todo' }, TODAY)).toMatchObject({
      state: 'overdue',
      days: -3,
      text: '3 days overdue',
      tone: 'red',
    });
  });

  it('is history once the task is complete, however late it was', () => {
    expect(taskDue({ due_date: '2026-10-01', status: 'complete' }, TODAY)).toEqual({
      state: 'closed',
      days: -14,
      text: null,
      tone: 'neutral',
    });
    expect(taskDue({ due_date: '2026-12-01', status: 'complete' }, TODAY).state).toBe('closed');
  });

  it('ignores a date that is not a real calendar day', () => {
    expect(taskDue({ due_date: '2026-02-30', status: 'todo' }, TODAY).state).toBe('none');
  });
});

describe('summarizeTasks', () => {
  const rows = (
    ...specs: [status: TaskRow['status'], due: string | null][]
  ): Pick<TaskRow, 'status' | 'due_date'>[] =>
    specs.map(([status, due_date]) => ({ status, due_date }));

  it('has nothing to count, and no percentage, without tasks', () => {
    expect(summarizeTasks([], TODAY)).toEqual({
      total: 0,
      complete: 0,
      open: 0,
      inProgress: 0,
      overdue: 0,
      dueSoon: 0,
      percent: null,
    });
  });

  it('counts each kind of task', () => {
    const summary = summarizeTasks(
      rows(
        ['todo', null],
        ['in_progress', '2026-10-10'], // overdue
        ['todo', '2026-10-15'], // today: due soon
        ['todo', '2026-10-22'], // exactly a week away: due soon
        ['todo', '2026-10-23'], // eight days away: not soon
        ['complete', '2026-10-01'], // done, so not overdue
        ['complete', null],
      ),
      TODAY,
    );
    expect(summary).toEqual({
      total: 7,
      complete: 2,
      open: 5,
      inProgress: 1,
      overdue: 1,
      dueSoon: 2,
      percent: 29,
    });
    expect(DUE_SOON_DAYS).toBe(7);
  });

  it('never counts a task as both overdue and due soon', () => {
    const summary = summarizeTasks(rows(['todo', '2026-10-14'], ['todo', '2026-10-16']), TODAY);
    expect(summary).toMatchObject({ overdue: 1, dueSoon: 1 });
  });

  it('is 100% only when every task is complete, and never 0% once one is', () => {
    expect(summarizeTasks(rows(['complete', null], ['complete', null]), TODAY).percent).toBe(100);
    expect(summarizeTasks(rows(['complete', null], ['todo', null]), TODAY).percent).toBe(50);
    const many = (complete: number, total: number) =>
      summarizeTasks(
        Array.from({ length: total }, (_, index) => ({
          status: index < complete ? ('complete' as const) : ('todo' as const),
          due_date: null,
        })),
        TODAY,
      ).percent;
    expect(many(199, 200)).toBe(99);
    expect(many(1, 300)).toBe(1);
    expect(many(0, 300)).toBe(0);
  });
});

describe('sortTasks', () => {
  const ids = (list: TaskRow[]) => list.map((row) => row.id);

  it('puts open tasks before finished ones', () => {
    const list = sortTasks([
      fakeTask({ id: 'done', status: 'complete', completed_at: '2026-10-01T00:00:00Z' }),
      fakeTask({ id: 'open', status: 'todo' }),
      fakeTask({ id: 'busy', status: 'in_progress' }),
    ]);
    expect(ids(list).slice(0, 2).sort()).toEqual(['busy', 'open']);
    expect(ids(list)[2]).toBe('done');
  });

  it('puts the soonest due date first among open tasks, and tasks with no date last', () => {
    const list = sortTasks([
      fakeTask({ id: 'none', due_date: null }),
      fakeTask({ id: 'later', due_date: '2026-11-01' }),
      fakeTask({ id: 'overdue', due_date: '2026-09-01' }),
      fakeTask({ id: 'soon', due_date: '2026-10-16' }),
    ]);
    expect(ids(list)).toEqual(['overdue', 'soon', 'later', 'none']);
  });

  it('puts the most important first when the due dates are the same', () => {
    const list = sortTasks([
      fakeTask({ id: 'low', due_date: '2026-10-20', priority: 'low', title: 'A' }),
      fakeTask({ id: 'high', due_date: '2026-10-20', priority: 'high', title: 'Z' }),
      fakeTask({ id: 'medium', due_date: '2026-10-20', priority: 'medium', title: 'M' }),
    ]);
    expect(ids(list)).toEqual(['high', 'medium', 'low']);
  });

  it('puts the most important first among tasks with no date', () => {
    const list = sortTasks([
      fakeTask({ id: 'low', priority: 'low' }),
      fakeTask({ id: 'high', priority: 'high' }),
    ]);
    expect(ids(list)).toEqual(['high', 'low']);
  });

  it('lets a date beat importance: a low task due tomorrow comes before a high one due next week', () => {
    const list = sortTasks([
      fakeTask({ id: 'high', due_date: '2026-10-22', priority: 'high' }),
      fakeTask({ id: 'low', due_date: '2026-10-16', priority: 'low' }),
    ]);
    expect(ids(list)).toEqual(['low', 'high']);
  });

  it('puts the most recently finished task first among finished ones', () => {
    const list = sortTasks([
      fakeTask({ id: 'old', status: 'complete', completed_at: '2026-10-01T09:00:00Z' }),
      fakeTask({ id: 'new', status: 'complete', completed_at: '2026-10-09T09:00:00Z' }),
      fakeTask({ id: 'unknown', status: 'complete', completed_at: null }),
    ]);
    expect(ids(list)).toEqual(['new', 'old', 'unknown']);
  });

  it('goes by title, with numbers read as numbers, when nothing else separates tasks', () => {
    // The ids and the creation times point the other way, so only the titles can decide this.
    const list = sortTasks([
      fakeTask({ id: 'a', title: 'Letter 10', created_at: '2026-09-01T00:00:00Z' }),
      fakeTask({ id: 'b', title: 'letter 2', created_at: '2026-09-02T00:00:00Z' }),
    ]);
    expect(ids(list)).toEqual(['b', 'a']);
  });

  it('goes by when it was added when even the titles match, then by id', () => {
    const list = sortTasks([
      fakeTask({ id: 'a', title: 'Same', created_at: '2026-09-02T00:00:00Z' }),
      fakeTask({ id: 'b', title: 'Same', created_at: '2026-09-01T00:00:00Z' }),
    ]);
    expect(ids(list)).toEqual(['b', 'a']);
    const tied = sortTasks([
      fakeTask({ id: 'y', title: 'Same', created_at: '2026-09-01T00:00:00Z' }),
      fakeTask({ id: 'x', title: 'Same', created_at: '2026-09-01T00:00:00Z' }),
    ]);
    expect(ids(tied)).toEqual(['x', 'y']);
  });

  it('gives one answer whatever order the tasks arrive in, even for equal tasks', () => {
    const rows = [
      fakeTask({ id: 'a', title: 'Same', created_at: '2026-09-02T00:00:00Z' }),
      fakeTask({ id: 'b', title: 'Same', created_at: '2026-09-01T00:00:00Z' }),
      fakeTask({ id: 'c', title: 'Same', created_at: '2026-09-01T00:00:00Z' }),
      fakeTask({ id: 'd', title: 'Due', due_date: '2026-10-20', priority: 'low' }),
      fakeTask({
        id: 'e',
        title: 'Done',
        status: 'complete',
        completed_at: '2026-10-01T00:00:00Z',
      }),
    ];
    const expected = ids(sortTasks(rows));
    expect(expected).toEqual(['d', 'b', 'c', 'a', 'e']);
    for (const order of permutations(rows)) expect(ids(sortTasks(order))).toEqual(expected);
  });

  it('does not change the list it was given', () => {
    const rows = [fakeTask({ id: 'b', title: 'B' }), fakeTask({ id: 'a', title: 'A' })];
    sortTasks(rows);
    expect(ids(rows)).toEqual(['b', 'a']);
  });
});

describe('filtering tasks', () => {
  const rows = [
    fakeTask({ id: 'open-here', application_id: 'app-1', status: 'todo' }),
    fakeTask({ id: 'busy-here', application_id: 'app-1', status: 'in_progress' }),
    fakeTask({ id: 'done-here', application_id: 'app-1', status: 'complete' }),
    fakeTask({ id: 'open-there', application_id: 'app-2', status: 'todo' }),
    fakeTask({ id: 'open-free', application_id: null, status: 'todo' }),
    fakeTask({ id: 'done-free', application_id: null, status: 'complete' }),
  ];
  const shown = (filter: TaskFilter) => filterTasks(rows, filter).map((row) => row.id);

  it('shows open tasks by default: to do and in progress', () => {
    expect(shown(DEFAULT_TASK_FILTER)).toEqual([
      'open-here',
      'busy-here',
      'open-there',
      'open-free',
    ]);
  });

  it('can show only finished tasks, or everything', () => {
    expect(shown({ show: 'complete', program: '' })).toEqual(['done-here', 'done-free']);
    expect(shown({ show: 'all', program: '' })).toHaveLength(6);
  });

  it('can show one program’s tasks', () => {
    expect(shown({ show: 'all', program: 'app-1' })).toEqual([
      'open-here',
      'busy-here',
      'done-here',
    ]);
    expect(shown({ show: 'open', program: 'app-1' })).toEqual(['open-here', 'busy-here']);
  });

  it('can show only the tasks that belong to no program', () => {
    expect(shown({ show: 'all', program: NO_PROGRAM })).toEqual(['open-free', 'done-free']);
    expect(shown({ show: 'open', program: NO_PROGRAM })).toEqual(['open-free']);
  });

  it('shows nothing for a program that does not exist', () => {
    expect(shown({ show: 'all', program: 'app-9' })).toEqual([]);
  });
});

describe('the filter in the page address', () => {
  it('reads what the address says', () => {
    expect(parseTaskFilter(new URLSearchParams('show=complete&program=app-1'))).toEqual({
      show: 'complete',
      program: 'app-1',
    });
    expect(parseTaskFilter(new URLSearchParams('show=all&program=none'))).toEqual({
      show: 'all',
      program: NO_PROGRAM,
    });
  });

  it('falls back to the default for anything it does not recognise', () => {
    expect(parseTaskFilter(new URLSearchParams(''))).toEqual(DEFAULT_TASK_FILTER);
    expect(parseTaskFilter(new URLSearchParams('show=everything'))).toEqual(DEFAULT_TASK_FILTER);
    expect(parseTaskFilter(new URLSearchParams('show=open&program=%20'))).toEqual(
      DEFAULT_TASK_FILTER,
    );
  });

  it('leaves the defaults out of the address', () => {
    expect(taskFilterParams(DEFAULT_TASK_FILTER)).toEqual({});
    expect(taskFilterParams({ show: 'complete', program: '' })).toEqual({ show: 'complete' });
    expect(taskFilterParams({ show: 'open', program: 'app-1' })).toEqual({ program: 'app-1' });
    expect(taskFilterParams({ show: 'all', program: 'none' })).toEqual({
      show: 'all',
      program: 'none',
    });
  });

  it('round-trips through the address', () => {
    for (const filter of [
      DEFAULT_TASK_FILTER,
      { show: 'all', program: 'app-1' },
      { show: 'complete', program: NO_PROGRAM },
    ] as const) {
      const params = new URLSearchParams(taskFilterParams(filter));
      expect(parseTaskFilter(params)).toEqual(filter);
    }
  });

  it('knows when nothing is filtered', () => {
    expect(isDefaultFilter(DEFAULT_TASK_FILTER)).toBe(true);
    expect(isDefaultFilter({ show: 'all', program: '' })).toBe(false);
    expect(isDefaultFilter({ show: 'open', program: 'app-1' })).toBe(false);
  });
});
