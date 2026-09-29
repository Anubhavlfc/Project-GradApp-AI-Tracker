import { z } from 'zod';
import { optionalDate, optionalText, requiredText } from '@/features/applications/form';
import { TASK_PRIORITY_VALUES, TASK_STATUS_VALUES } from './kinds';
import type { TaskFields, TaskRow } from './types';

// The add/edit form for one task. The browser gives us every field as a string, so this file has
// the two jobs: turn those strings into typed TaskFields (or a message per field), and turn a
// saved task back into strings for the form to show.

export const taskFormSchema = z.object({
  // Empty means "not tied to a program", like renewing a passport.
  application_id: z
    .string()
    .trim()
    .default('')
    .transform((value) => (value === '' ? null : value)),
  title: requiredText('Title', 'Enter a title, like "Email Prof. Lee about the deadline".', 300),
  due_date: optionalDate('Enter a valid due date.'),
  priority: z.enum(TASK_PRIORITY_VALUES, { error: 'Choose a priority.' }),
  status: z.enum(TASK_STATUS_VALUES, { error: 'Choose a status.' }),
  notes: optionalText('Notes', 10_000),
}) satisfies z.ZodType<TaskFields, unknown>;

/** What each form control starts with. Every control holds a string. */
export type TaskFormValues = {
  application_id: string;
  title: string;
  due_date: string;
  priority: string;
  status: string;
  notes: string;
};

/** A new task, for `applicationId` when opened from a program's page or filtered to one. */
export function emptyTaskValues(applicationId = ''): TaskFormValues {
  return {
    application_id: applicationId,
    title: '',
    due_date: '',
    priority: 'medium',
    status: 'todo',
    notes: '',
  };
}

const text = (value: string | null) => value ?? '';

export function taskValuesFromRow(row: TaskRow): TaskFormValues {
  return {
    application_id: text(row.application_id),
    title: row.title,
    due_date: text(row.due_date),
    priority: row.priority,
    status: row.status,
    notes: text(row.notes),
  };
}
