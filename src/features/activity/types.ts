import { z } from 'zod';

// The shape the database returns for one entry of the activity log. The log is written only by
// database triggers, when something happens to a program, checklist, letter, scholarship, task or
// document. The app reads it and nothing else.
//
// `kind` is a plain string here on purpose: an entry kind added by a later migration must not make
// the whole list fail to load in an older copy of the app. Unknown kinds are worded generically.
export const activityRowSchema = z.object({
  id: z.string(),
  /** The program it happened to; null when it is not about one, or the program has been deleted. */
  application_id: z.string().nullable(),
  kind: z.string(),
  /** What it happened to: a program's name, a scholarship, a task title, a document. */
  subject: z.string(),
  /** The new status, for the kinds that change one. */
  detail: z.string().nullable(),
  /** Extra words for the entry, such as which checklist item; never trusted to have any key. */
  meta: z.record(z.string(), z.unknown()),
  created_at: z.string(),
});

export type ActivityRow = z.infer<typeof activityRowSchema>;
