import { z } from 'zod';
import { TASK_PRIORITY_VALUES, TASK_STATUS_VALUES } from './kinds';

// The shape the database returns for one task. Every row is checked against this when it arrives,
// so a mismatch between the schema and the app fails loudly here instead of as "undefined" on
// screen. Column names stay snake_case, exactly as stored.
export const taskRowSchema = z.object({
  id: z.string(),
  /** The program it belongs to; null for a task that is not tied to one ("Renew passport"). */
  application_id: z.string().nullable(),
  title: z.string(),
  due_date: z.string().nullable(),
  priority: z.enum(TASK_PRIORITY_VALUES),
  status: z.enum(TASK_STATUS_VALUES),
  /** When it was marked complete; the database sets and clears it. */
  completed_at: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type TaskRow = z.infer<typeof taskRowSchema>;

/** What the add/edit form submits: everything about a task that a person can change. */
export type TaskFields = Pick<
  TaskRow,
  'application_id' | 'title' | 'due_date' | 'priority' | 'status' | 'notes'
>;
