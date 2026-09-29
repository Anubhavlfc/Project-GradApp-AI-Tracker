import { describeOpenDeadline, type DeadlineInfo } from '@/features/applications/dates';
import { isClosedStatus, type ApplicationStatus } from '@/features/applications/status';
import {
  isDone,
  requirementKindLabel,
  requirementKindOrder,
  type CommonRequirement,
} from './kinds';
import type { RequirementRow } from './types';

// The arithmetic behind "8 of 11 required done, 73%", and the small rules for how a checklist is
// named, ordered and dated. Pure functions: no screens, no database.

export type Completion = {
  /** Required items that are Complete or Submitted. */
  done: number;
  /** Required items in all. */
  total: number;
  /** done / total as a whole percent; null while nothing is required yet. */
  percent: number | null;
  inProgress: number;
  notStarted: number;
  /** Items marked optional. They never count towards the percentage, done or not. */
  optional: number;
};

/** done of total as a whole percent that never claims more than is true; null with nothing to count. */
export function percentOf(done: number, total: number): number | null {
  if (total === 0) return null;
  if (done === total) return 100;
  // Rounding must not claim more than is true: 199 of 200 is not "100%", and 1 of 300 is not "0%".
  const rounded = Math.round((done / total) * 100);
  return Math.min(99, Math.max(done > 0 ? 1 : 0, rounded));
}

export function summarize(
  rows: readonly Pick<RequirementRow, 'is_required' | 'status'>[],
): Completion {
  let done = 0;
  let total = 0;
  let inProgress = 0;
  let notStarted = 0;
  let optional = 0;
  for (const row of rows) {
    if (!row.is_required) {
      optional += 1;
      continue;
    }
    total += 1;
    if (isDone(row.status)) done += 1;
    else if (row.status === 'in_progress') inProgress += 1;
    else notStarted += 1;
  }
  return { done, total, percent: percentOf(done, total), inProgress, notStarted, optional };
}

/** Progress per program. A program with no checklist items at all is not in the map. */
export function completionsByApplication(rows: readonly RequirementRow[]): Map<string, Completion> {
  const grouped = new Map<string, RequirementRow[]>();
  for (const row of rows) {
    const group = grouped.get(row.application_id);
    if (group) group.push(row);
    else grouped.set(row.application_id, [row]);
  }
  return new Map([...grouped].map(([applicationId, group]) => [applicationId, summarize(group)]));
}

/** What the list of programs knows about checklists: loading, failed, or the numbers. */
export type ProgressLookup = {
  status: 'loading' | 'ready' | 'unavailable';
  byApplication: ReadonlyMap<string, Completion>;
};

/** The item's own name if it has one, otherwise what kind of item it is. */
export function requirementTitle(row: Pick<RequirementRow, 'kind' | 'label'>): string {
  return row.label?.trim() || requirementKindLabel(row.kind);
}

/** The kind, shown under a custom name so "Why Stanford" is still known to be an essay. */
export function requirementSubtitle(row: Pick<RequirementRow, 'kind' | 'label'>): string | null {
  const label = row.label?.trim();
  if (!label) return null;
  const kind = requirementKindLabel(row.kind);
  return label.toLowerCase().includes(kind.toLowerCase()) ? null : kind;
}

const LETTER = /^recommendation letter (\d+)$/i;

/** "Recommendation Letter 2": the lowest number no letter on the list already uses. */
export function nextLetterLabel(rows: readonly Pick<RequirementRow, 'kind' | 'label'>[]): string {
  const used = new Set<number>();
  for (const row of rows) {
    if (row.kind !== 'recommendation_letter') continue;
    const match = LETTER.exec(row.label?.trim() ?? '');
    if (match) used.add(Number(match[1]));
  }
  let next = 1;
  while (used.has(next)) next += 1;
  return `Recommendation Letter ${next}`;
}

/** Whether an item from the "common requirements" picker is already on the list. */
export function hasRequirement(
  rows: readonly Pick<RequirementRow, 'kind' | 'label'>[],
  item: CommonRequirement,
): boolean {
  const title = (item.label ?? requirementKindLabel(item.kind)).toLowerCase();
  return rows.some(
    (row) => row.kind === item.kind && requirementTitle(row).toLowerCase() === title,
  );
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/** A steady order: by kind, then by name ("Letter 2" before "Letter 10"), then oldest first. */
export function sortRequirements(rows: readonly RequirementRow[]): RequirementRow[] {
  return [...rows].sort(
    (a, b) =>
      requirementKindOrder(a.kind) - requirementKindOrder(b.kind) ||
      collator.compare(requirementTitle(a), requirementTitle(b)) ||
      collator.compare(a.created_at, b.created_at) ||
      collator.compare(a.id, b.id),
  );
}

/**
 * What an item's due date means right now. Finished items, and every item once the application
 * itself has been sent, decided or withdrawn, are history and never shown as overdue.
 */
export function requirementDue(
  row: Pick<RequirementRow, 'due_date' | 'status'>,
  applicationStatus: ApplicationStatus,
  today: string,
): DeadlineInfo {
  if (!row.due_date) return { state: 'none', days: null, text: null, tone: 'neutral' };
  const open = describeOpenDeadline(row.due_date, today);
  if (open.state === 'none') return open;
  return isDone(row.status) || isClosedStatus(applicationStatus)
    ? { state: 'closed', days: open.days, text: null, tone: 'neutral' }
    : open;
}
