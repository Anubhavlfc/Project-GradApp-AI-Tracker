import { fakeTask } from '@/test/fakeTasksApi';
import { emptyTaskValues, taskFormSchema, taskValuesFromRow } from './form';

/** A copy of `values` without one key, like a browser leaving a field out of the form data. */
const without = (values: Record<string, unknown>, key: string) =>
  Object.fromEntries(Object.entries(values).filter(([name]) => name !== key));

/** What the browser submits: text for every control. */
function submitted(overrides: Record<string, string | undefined> = {}) {
  return { ...emptyTaskValues(), title: 'Email Prof. Lee', ...overrides };
}

function errorsOf(input: unknown) {
  const result = taskFormSchema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
  );
}

describe('taskFormSchema', () => {
  it('needs a title and nothing else', () => {
    expect(taskFormSchema.parse(submitted())).toEqual({
      application_id: null,
      title: 'Email Prof. Lee',
      due_date: null,
      priority: 'medium',
      status: 'todo',
      notes: null,
    });
    const message = 'Enter a title, like "Email Prof. Lee about the deadline".';
    expect(errorsOf(submitted({ title: '' }))).toEqual({ title: message });
    expect(errorsOf(submitted({ title: '   ' }))).toEqual({ title: message });
  });

  it('tidies what was typed', () => {
    expect(
      taskFormSchema.parse(
        submitted({
          title: '  Order   transcripts ',
          notes: '  Registrar closes at 4\r\nBring ID  ',
          due_date: ' 2026-11-30 ',
        }),
      ),
    ).toMatchObject({
      title: 'Order transcripts',
      notes: 'Registrar closes at 4\nBring ID',
      due_date: '2026-11-30',
    });
  });

  it('leaves the program empty for a task tied to none, and keeps one that is chosen', () => {
    expect(taskFormSchema.parse(submitted({ application_id: '' })).application_id).toBeNull();
    expect(taskFormSchema.parse(submitted({ application_id: ' app-1 ' })).application_id).toBe(
      'app-1',
    );
    const withoutProgram = without(submitted(), 'application_id');
    expect(taskFormSchema.parse(withoutProgram).application_id).toBeNull();
  });

  it('refuses a priority or status that does not exist', () => {
    expect(errorsOf(submitted({ priority: 'urgent' })).priority).toBe('Choose a priority.');
    expect(errorsOf(submitted({ status: 'done' })).status).toBe('Choose a status.');
  });

  it('reads the due date as a real calendar date', () => {
    expect(taskFormSchema.parse(submitted({ due_date: '2026-12-01' })).due_date).toBe('2026-12-01');
    expect(errorsOf(submitted({ due_date: '2026-02-30' })).due_date).toBe(
      'Enter a valid due date.',
    );
    expect(errorsOf(submitted({ due_date: '0026-12-01' })).due_date).toBe(
      'Enter a date between 2000 and 2100.',
    );
  });

  it('limits the length of the title and the notes', () => {
    expect(errorsOf(submitted({ title: 'x'.repeat(301) })).title).toBe(
      'Title must be 300 characters or fewer.',
    );
    expect(errorsOf(submitted({ title: 'x'.repeat(300) })).title).toBeUndefined();
    expect(errorsOf(submitted({ notes: 'x'.repeat(10_001) })).notes).toBe(
      'Notes must be 10000 characters or fewer.',
    );
    expect(errorsOf(submitted({ notes: 'x'.repeat(10_000) })).notes).toBeUndefined();
  });

  it('reports every problem at once', () => {
    expect(
      Object.keys(errorsOf(submitted({ title: '', due_date: 'x', priority: 'x' }))).sort(),
    ).toEqual(['due_date', 'priority', 'title']);
  });
});

describe('emptyTaskValues', () => {
  it('starts as a medium priority task that is still to do', () => {
    expect(emptyTaskValues()).toEqual({
      application_id: '',
      title: '',
      due_date: '',
      priority: 'medium',
      status: 'todo',
      notes: '',
    });
  });

  it('can start on a program', () => {
    expect(emptyTaskValues('app-1').application_id).toBe('app-1');
  });
});

describe('taskValuesFromRow', () => {
  it('shows every field as text, empty for what is not set', () => {
    expect(taskValuesFromRow(fakeTask({ title: 'A' }))).toEqual({
      application_id: '',
      title: 'A',
      due_date: '',
      priority: 'medium',
      status: 'todo',
      notes: '',
    });
    expect(
      taskValuesFromRow(
        fakeTask({
          application_id: 'app-1',
          title: 'B',
          due_date: '2026-12-01',
          priority: 'high',
          status: 'in_progress',
          notes: 'n',
        }),
      ),
    ).toEqual({
      application_id: 'app-1',
      title: 'B',
      due_date: '2026-12-01',
      priority: 'high',
      status: 'in_progress',
      notes: 'n',
    });
  });

  it('round-trips through the form unchanged', () => {
    const row = fakeTask({
      application_id: 'app-1',
      title: 'B',
      due_date: '2026-12-01',
      priority: 'low',
      status: 'complete',
      notes: 'note',
    });
    expect(taskFormSchema.parse(taskValuesFromRow(row))).toEqual({
      application_id: row.application_id,
      title: row.title,
      due_date: row.due_date,
      priority: row.priority,
      status: row.status,
      notes: row.notes,
    });
  });
});
