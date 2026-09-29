import type { ApplicationStatus } from './status';

// The headline counts on the dashboard. Every number is counted from the person's own programs;
// nothing here is a placeholder. Withdrawn programs are only in the total, and are counted on
// their own so the dashboard can say how many of the total they are.
const GROUPS: readonly { label: string; statuses: readonly ApplicationStatus[] }[] = [
  { label: 'Not started', statuses: ['researching', 'shortlisted', 'planning_to_apply'] },
  {
    label: 'In progress',
    statuses: ['application_started', 'documents_in_progress', 'ready_to_submit'],
  },
  { label: 'Submitted', statuses: ['submitted'] },
  { label: 'Interviews', statuses: ['interview'] },
  { label: 'Accepted', statuses: ['accepted'] },
  { label: 'Waitlisted', statuses: ['waitlisted'] },
  { label: 'Rejected', statuses: ['rejected'] },
];

export type StatusSummary = {
  total: number;
  withdrawn: number;
  groups: { label: string; count: number }[];
};

export function summarizeStatuses(
  records: readonly { status: ApplicationStatus }[],
): StatusSummary {
  return {
    total: records.length,
    withdrawn: records.filter((record) => record.status === 'withdrawn').length,
    groups: GROUPS.map(({ label, statuses }) => ({
      label,
      count: records.filter((record) => statuses.includes(record.status)).length,
    })),
  };
}
