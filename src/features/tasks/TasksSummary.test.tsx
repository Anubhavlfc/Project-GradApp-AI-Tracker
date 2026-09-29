import { render, screen } from '@testing-library/react';
import { fakeTask } from '@/test/fakeTasksApi';
import { TasksSummary } from './TasksSummary';

const TODAY = '2026-10-15';

const done = () => fakeTask({ status: 'complete', completed_at: '2026-10-01T00:00:00Z' });
const open = (due: string | null = null) => fakeTask({ status: 'todo', due_date: due });

describe('TasksSummary', () => {
  it('shows nothing until there is a task', () => {
    const { container } = render(<TasksSummary tasks={[]} today={TODAY} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says how many are done, in words, in a bar and as a percentage', () => {
    render(<TasksSummary tasks={[done(), open(), open(), open()]} today={TODAY} />);
    expect(screen.getByRole('heading', { name: 'Tasks at a glance' })).toBeVisible();
    expect(screen.getByText('1 of 4')).toBeVisible();
    expect(screen.getByText('tasks complete')).toBeVisible();
    expect(screen.getByText('25%')).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Tasks completed' })).toHaveAttribute(
      'aria-valuenow',
      '25',
    );
  });

  it('says "task", not "tasks", for a single task', () => {
    render(<TasksSummary tasks={[open()]} today={TODAY} />);
    expect(screen.getByText('task complete')).toBeVisible();
    expect(screen.queryByText('tasks complete')).not.toBeInTheDocument();
  });

  it('says every task is complete when they are, and only then', () => {
    const { rerender } = render(<TasksSummary tasks={[done(), done()]} today={TODAY} />);
    expect(screen.getByText('Every task is complete.')).toBeVisible();
    expect(screen.getByText('100%')).toBeVisible();
    expect(screen.queryByText(/open/)).not.toBeInTheDocument();

    rerender(<TasksSummary tasks={[done(), open()]} today={TODAY} />);
    expect(screen.queryByText('Every task is complete.')).not.toBeInTheDocument();
  });

  it('counts what is still open, and says nothing about lateness when nothing is late or close', () => {
    render(
      <TasksSummary
        tasks={[done(), open(null), open('2026-12-01'), open('2026-10-23')]}
        today={TODAY}
      />,
    );
    expect(screen.getByText(/3 open/)).toBeVisible();
    expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
    expect(screen.queryByText(/due in the next/)).not.toBeInTheDocument();
  });

  it('says what is overdue, in red words', () => {
    render(<TasksSummary tasks={[open('2026-10-10'), open('2026-10-11'), open()]} today={TODAY} />);
    const overdue = screen.getByText('2 overdue');
    expect(overdue).toBeVisible();
    expect(overdue).toHaveClass('text-tone-red-fg');
    expect(screen.queryByText(/due in the next/)).not.toBeInTheDocument();
  });

  it('says what is due in the next week', () => {
    render(
      <TasksSummary
        tasks={[open('2026-10-15'), open('2026-10-22'), open('2026-10-23')]}
        today={TODAY}
      />,
    );
    expect(screen.getByText(/2 due in the next 7 days/)).toBeVisible();
    expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
  });

  it('does not count a finished task as overdue or due soon', () => {
    render(
      <TasksSummary
        tasks={[
          fakeTask({
            status: 'complete',
            due_date: '2026-10-01',
            completed_at: '2026-10-02T00:00:00Z',
          }),
          open(),
        ]}
        today={TODAY}
      />,
    );
    expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
  });
});
