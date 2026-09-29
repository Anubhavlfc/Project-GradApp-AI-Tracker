import {
  getTaskPriorityMeta,
  getTaskStatusMeta,
  isOpenTask,
  priorityRank,
  TASK_PRIORITIES,
  TASK_PRIORITY_VALUES,
  TASK_STATUSES,
  TASK_STATUS_VALUES,
} from './kinds';

describe('task statuses', () => {
  it('are the three the brief asks for, in the order of a task’s life', () => {
    expect(TASK_STATUSES.map((status) => status.label)).toEqual([
      'To Do',
      'In Progress',
      'Complete',
    ]);
    expect(TASK_STATUS_VALUES).toEqual(['todo', 'in_progress', 'complete']);
  });

  it('look up by value, and refuse one they do not know', () => {
    expect(getTaskStatusMeta('in_progress')).toMatchObject({ label: 'In Progress', tone: 'amber' });
    expect(() => getTaskStatusMeta('done' as never)).toThrow('Unknown task status: done');
  });

  it('call a task open until it is complete', () => {
    expect(isOpenTask('todo')).toBe(true);
    expect(isOpenTask('in_progress')).toBe(true);
    expect(isOpenTask('complete')).toBe(false);
  });
});

describe('task priorities', () => {
  it('run from low to high, like the database', () => {
    expect(TASK_PRIORITY_VALUES).toEqual(['low', 'medium', 'high']);
    expect(TASK_PRIORITIES.map((priority) => priority.label)).toEqual(['Low', 'Medium', 'High']);
  });

  it('rank high above medium above low', () => {
    expect(priorityRank('high')).toBeGreaterThan(priorityRank('medium'));
    expect(priorityRank('medium')).toBeGreaterThan(priorityRank('low'));
  });

  it('look up by value, and refuse one they do not know', () => {
    expect(getTaskPriorityMeta('high')).toMatchObject({ label: 'High', tone: 'red' });
    expect(() => getTaskPriorityMeta('urgent' as never)).toThrow('Unknown task priority: urgent');
  });
});
