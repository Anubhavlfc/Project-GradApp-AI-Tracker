import type { Tone } from '@/components/ui';

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
