import type { DeadlineInfo } from '@/features/applications/dates';
import { applicationName } from '@/features/applications/labels';
import { isClosedStatus } from '@/features/applications/status';
import type { ApplicationRecord } from '@/features/applications/types';
import { isOpenDeadline } from '@/features/deadlines/logic';
import {
  requestDue,
  summarizeRequests,
  type LetterSummary,
} from '@/features/recommendations/logic';
import { isLetterSent } from '@/features/recommendations/statuses';
import type { RecommenderRow, RequestRow } from '@/features/recommendations/types';
import { percentOf, type Completion } from '@/features/requirements/progress';

// The numbers behind the dashboard, worked out from the same cached lists as every other screen.
// Pure functions: no screens, no database, nothing stored.

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/**
 * The programs you are still preparing: not yet sent, decided or withdrawn. Soonest deadline
 * first (a missed one leads), those with no deadline last, then by name.
 */
export function programsToPrepare(records: readonly ApplicationRecord[]): ApplicationRecord[] {
  return records
    .filter((record) => !isClosedStatus(record.status))
    .sort((a, b) => {
      if (a.deadline !== b.deadline) {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline < b.deadline ? -1 : 1;
      }
      return (
        collator.compare(applicationName(a), applicationName(b)) || collator.compare(a.id, b.id)
      );
    });
}

export type OverallProgress = {
  /** Required checklist items that are Complete or Submitted. */
  done: number;
  /** Required checklist items in all. */
  total: number;
  /** done / total as a whole percent; null while no program has a required item. */
  percent: number | null;
  /** How many programs that counts. */
  programs: number;
};

/**
 * How far along you are with everything still to prepare: the required checklist items done, over
 * the required items, across the programs you are still preparing. Programs that have been sent
 * are left out (their lists say nothing about the work still ahead), and so are programs with no
 * required items yet.
 */
export function overallProgress(
  records: readonly ApplicationRecord[],
  completions: ReadonlyMap<string, Completion>,
): OverallProgress {
  let done = 0;
  let total = 0;
  let programs = 0;
  for (const record of programsToPrepare(records)) {
    const completion = completions.get(record.id);
    if (!completion || completion.total === 0) continue;
    done += completion.done;
    total += completion.total;
    programs += 1;
  }
  return { done, total, percent: percentOf(done, total), programs };
}

/** Days ahead at which a letter that has not been sent starts to be a worry. */
export const LETTER_WARNING_DAYS = 14;

export type LetterWarning = {
  request: RequestRow;
  /** Who is writing it; null when that person is not in the list. */
  recommender: RecommenderRow | null;
  record: ApplicationRecord;
  /** What its deadline means today (`days` is null when the letter has no deadline). */
  info: DeadlineInfo;
};

const daysOf = (warning: LetterWarning) => warning.info.days ?? Number.POSITIVE_INFINITY;
const nameOf = (warning: LetterWarning) => warning.recommender?.name ?? '';

/**
 * Letters worth a nudge: not yet sent, for a program that is still open, and either late, due
 * within two weeks, or marked Needs Follow-Up by you. The most urgent first; a letter with no date
 * comes after those that have one.
 */
export function lettersNeedingAttention(input: {
  records: readonly ApplicationRecord[];
  recommenders: readonly RecommenderRow[];
  requests: readonly RequestRow[];
  today: string;
}): LetterWarning[] {
  const programs = new Map(input.records.map((record) => [record.id, record]));
  const people = new Map(input.recommenders.map((person) => [person.id, person]));
  const warnings: LetterWarning[] = [];

  for (const request of input.requests) {
    const record = programs.get(request.application_id);
    if (!record || isClosedStatus(record.status) || isLetterSent(request.status)) continue;
    const info = requestDue(request, record.status, input.today);
    const soon = isOpenDeadline(info) && info.days <= LETTER_WARNING_DAYS;
    if (!soon && request.status !== 'needs_follow_up') continue;
    warnings.push({
      request,
      recommender: people.get(request.recommender_id) ?? null,
      record,
      info,
    });
  }

  return warnings.sort(
    (a, b) =>
      (daysOf(a) === daysOf(b) ? 0 : daysOf(a) < daysOf(b) ? -1 : 1) ||
      collator.compare(nameOf(a), nameOf(b)) ||
      collator.compare(a.request.id, b.request.id),
  );
}

/** The letters of the programs you are still preparing, counted. */
export function letterProgress(
  records: readonly ApplicationRecord[],
  requests: readonly RequestRow[],
): LetterSummary {
  const preparing = new Set(programsToPrepare(records).map((record) => record.id));
  return summarizeRequests(requests.filter((request) => preparing.has(request.application_id)));
}
