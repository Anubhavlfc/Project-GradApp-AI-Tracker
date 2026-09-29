// What the activity log can record. The values are stored in the database (the check constraint on
// `activity.kind`), so keep them in sync with supabase/migrations; a test compares the two.

export const ACTIVITY_KINDS = [
  'application_added',
  'status_changed',
  'application_removed',
  'requirement_updated',
  'letter_updated',
  'funding_updated',
  'task_completed',
  'document_completed',
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export function isActivityKind(value: string): value is ActivityKind {
  return (ACTIVITY_KINDS as readonly string[]).includes(value);
}
