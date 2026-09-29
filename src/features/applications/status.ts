import type { Tone } from '@/components/ui/tone';

// Order matches the application workflow, from first research to final outcome.
export const APPLICATION_STATUSES = [
  { value: 'researching', label: 'Researching', tone: 'neutral' },
  { value: 'shortlisted', label: 'Shortlisted', tone: 'blue' },
  { value: 'planning_to_apply', label: 'Planning to Apply', tone: 'blue' },
  { value: 'application_started', label: 'Application Started', tone: 'indigo' },
  { value: 'documents_in_progress', label: 'Documents In Progress', tone: 'amber' },
  { value: 'ready_to_submit', label: 'Ready to Submit', tone: 'teal' },
  { value: 'submitted', label: 'Submitted', tone: 'teal' },
  { value: 'interview', label: 'Interview', tone: 'violet' },
  { value: 'waitlisted', label: 'Waitlisted', tone: 'orange' },
  { value: 'accepted', label: 'Accepted', tone: 'green' },
  { value: 'rejected', label: 'Rejected', tone: 'red' },
  { value: 'withdrawn', label: 'Withdrawn', tone: 'neutral' },
] as const satisfies readonly { value: string; label: string; tone: Tone }[];

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]['value'];

export function getStatusMeta(status: ApplicationStatus) {
  const meta = APPLICATION_STATUSES.find((item) => item.value === status);
  if (!meta) throw new Error(`Unknown application status: ${status}`);
  return meta;
}

export const STATUS_VALUES = APPLICATION_STATUSES.map((status) => status.value);

// After these the application is out of your hands (sent, decided, or dropped), so its deadline
// no longer needs attention.
const CLOSED: ReadonlySet<ApplicationStatus> = new Set([
  'submitted',
  'interview',
  'waitlisted',
  'accepted',
  'rejected',
  'withdrawn',
]);

export function isClosedStatus(status: ApplicationStatus): boolean {
  return CLOSED.has(status);
}

// Statuses that imply the application was actually sent, so a submission date makes sense.
const SENT: ReadonlySet<string> = new Set([
  'submitted',
  'interview',
  'waitlisted',
  'accepted',
  'rejected',
]);

export function wasSubmitted(status: string): boolean {
  return SENT.has(status);
}

/** Statuses where the school has answered (or is holding you on a list). */
export function hasDecision(status: ApplicationStatus): boolean {
  return status === 'accepted' || status === 'waitlisted' || status === 'rejected';
}
