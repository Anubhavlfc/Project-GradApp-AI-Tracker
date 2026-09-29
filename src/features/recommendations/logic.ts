import { describeOpenDeadline, type DeadlineInfo } from '@/features/applications/dates';
import { isClosedStatus, type ApplicationStatus } from '@/features/applications/status';
import { isLetterSent } from './statuses';
import type { RecommenderFields, RecommenderRow, RequestRow } from './types';

// The small rules behind the recommendation screens: how a letter is dated and counted, and in
// what order things are shown. Pure functions: no screens, no database.

/** "Associate Professor · MIT": what someone does and where, or null when neither is known. */
export function recommenderSubtitle(
  recommender: Pick<RecommenderFields, 'title' | 'institution'>,
): string | null {
  const parts = [recommender.title?.trim(), recommender.institution?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export type LetterSummary = {
  /** Letters asked of someone (or planned) for the program. */
  total: number;
  submitted: number;
  /** Marked "Needs Follow-Up" by you. */
  needsFollowUp: number;
};

export function summarizeRequests(rows: readonly Pick<RequestRow, 'status'>[]): LetterSummary {
  return {
    total: rows.length,
    submitted: rows.filter((row) => isLetterSent(row.status)).length,
    needsFollowUp: rows.filter((row) => row.status === 'needs_follow_up').length,
  };
}

/** "3 letters · 1 submitted · 1 to follow up": a person's letters at a glance. */
export function describeLetters(summary: LetterSummary): string {
  if (summary.total === 0) return 'No letters requested';
  const parts = [`${summary.total} ${summary.total === 1 ? 'letter' : 'letters'}`];
  if (summary.submitted > 0) parts.push(`${summary.submitted} submitted`);
  if (summary.needsFollowUp > 0) parts.push(`${summary.needsFollowUp} to follow up`);
  return parts.join(' · ');
}

/** Letters grouped by the person writing them, each group in the order `sortRequests` gives. */
export function groupByRecommender(
  rows: readonly RequestRow[],
  nameOf: (row: RequestRow) => string,
): Map<string, RequestRow[]> {
  const grouped = new Map<string, RequestRow[]>();
  for (const row of sortRequests(rows, nameOf)) {
    const group = grouped.get(row.recommender_id);
    if (group) group.push(row);
    else grouped.set(row.recommender_id, [row]);
  }
  return grouped;
}

/**
 * What a letter's deadline means right now. A submitted letter, and every letter once the program
 * itself has been sent, decided or withdrawn, is history and never shown as overdue.
 */
export function requestDue(
  row: Pick<RequestRow, 'deadline' | 'status'>,
  applicationStatus: ApplicationStatus,
  today: string,
): DeadlineInfo {
  if (!row.deadline) return { state: 'none', days: null, text: null, tone: 'neutral' };
  const open = describeOpenDeadline(row.deadline, today);
  if (open.state === 'none') return open;
  return isLetterSent(row.status) || isClosedStatus(applicationStatus)
    ? { state: 'closed', days: open.days, text: null, tone: 'neutral' }
    : open;
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/** People in alphabetical order, oldest entry first among equal names. */
export function sortRecommenders(rows: readonly RecommenderRow[]): RecommenderRow[] {
  return [...rows].sort(
    (a, b) =>
      collator.compare(a.name, b.name) ||
      collator.compare(a.created_at, b.created_at) ||
      collator.compare(a.id, b.id),
  );
}

/**
 * Letters in the order to deal with them: soonest deadline first, letters without a deadline
 * last, then by the writer's name. `nameOf` says who wrote (or will write) each one.
 */
export function sortRequests(
  rows: readonly RequestRow[],
  nameOf: (row: RequestRow) => string,
): RequestRow[] {
  return [...rows].sort((a, b) => {
    if (a.deadline !== b.deadline) {
      if (a.deadline === null) return 1;
      if (b.deadline === null) return -1;
      return a.deadline < b.deadline ? -1 : 1;
    }
    return (
      collator.compare(nameOf(a), nameOf(b)) ||
      collator.compare(a.created_at, b.created_at) ||
      collator.compare(a.id, b.id)
    );
  });
}
