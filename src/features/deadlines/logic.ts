import {
  describeOpenDeadline,
  formatTime,
  getDeadlineInfo,
  toISODate,
  type DeadlineInfo,
} from '@/features/applications/dates';
import { applicationName } from '@/features/applications/labels';
import type { ApplicationRecord } from '@/features/applications/types';
import { fundingKindLabel } from '@/features/funding/kinds';
import { fundingDue } from '@/features/funding/logic';
import type { FundingRow } from '@/features/funding/types';
import { requestDue } from '@/features/recommendations/logic';
import type { RecommenderRow, RequestRow } from '@/features/recommendations/types';
import { requirementDue, requirementTitle } from '@/features/requirements/progress';
import type { RequirementRow } from '@/features/requirements/types';
import { taskDue } from '@/features/tasks/logic';
import type { TaskRow } from '@/features/tasks/types';

// Every date you have written down, from every screen, in one list. Nothing is stored here: the
// list is worked out from the same cached data the other screens show, so it can never disagree
// with them, and a change made anywhere shows up here at once.

/** Where a deadline came from. Within one day they are listed in this order. */
export const DEADLINE_SOURCES = [
  'application',
  'priority',
  'interview',
  'decision',
  'requirement',
  'letter',
  'funding',
  'task',
] as const;
export type DeadlineSource = (typeof DEADLINE_SOURCES)[number];

/** A deadline that still needs attention: it has a real date, and it is not history. */
export type OpenDeadline = DeadlineInfo & {
  state: 'overdue' | 'today' | 'soon' | 'upcoming';
  days: number;
};

export function isOpenDeadline(info: DeadlineInfo): info is OpenDeadline {
  return (
    info.days !== null &&
    (info.state === 'overdue' ||
      info.state === 'today' ||
      info.state === 'soon' ||
      info.state === 'upcoming')
  );
}

export type DeadlineItem = {
  /** Unique across the list: the source and the row it came from. */
  id: string;
  source: DeadlineSource;
  /** The calendar day it falls on, 'YYYY-MM-DD'. */
  date: string;
  /** What it is: "Application deadline", "GRE", "Letter from Dr. Lee". */
  title: string;
  /** What kind of thing it is, or the time of day, when the title does not already say. */
  detail: string | null;
  /** The program it is for; null for a scholarship or task that is not tied to one. */
  applicationId: string | null;
  /** That program's name, for showing. */
  program: string | null;
  /** Where to go to deal with it. */
  href: string;
  info: OpenDeadline;
};

export type DeadlineInputs = {
  applications: readonly ApplicationRecord[];
  /** A list that has not loaded (or could not be) is left out, and so are its deadlines. */
  requirements?: readonly RequirementRow[];
  recommenders?: readonly RecommenderRow[];
  requests?: readonly RequestRow[];
  funding?: readonly FundingRow[];
  tasks?: readonly TaskRow[];
  today: string;
};

function programPath(id: string, tab?: string): string {
  return tab ? `/app/applications/${id}/${tab}` : `/app/applications/${id}`;
}

/** An interview is not "due": it happens. So it is "Today" and "Tomorrow", not "Due today". */
function eventInfo(info: DeadlineInfo): DeadlineInfo {
  if (info.state === 'today') return { ...info, text: 'Today' };
  if (info.days === 1) return { ...info, text: 'Tomorrow' };
  return info;
}

/** After these the school's answer no longer needs a reply from you. */
function isOver(record: ApplicationRecord): boolean {
  return record.status === 'rejected' || record.status === 'withdrawn';
}

type Candidate = {
  source: DeadlineSource;
  /** The row it came from, to make the id unique. */
  rowId: string;
  date: string;
  info: DeadlineInfo;
  title: string;
  detail?: string | null;
  program: ApplicationRecord | null;
  href: string;
};

/**
 * Everything that is still ahead of you, or overdue, soonest first. Finished checklist items, sent
 * letters, tasks that are complete, and the dates of applications that have been sent, decided or
 * withdrawn are history and are left out, exactly as the screens they come from treat them.
 */
export function collectDeadlines(input: DeadlineInputs): DeadlineItem[] {
  const { today } = input;
  const programs = new Map(input.applications.map((record) => [record.id, record]));
  const people = new Map((input.recommenders ?? []).map((person) => [person.id, person]));
  const items: DeadlineItem[] = [];

  function add(candidate: Candidate) {
    const { info } = candidate;
    if (!isOpenDeadline(info)) return;
    items.push({
      id: `${candidate.source}:${candidate.rowId}`,
      source: candidate.source,
      date: candidate.date,
      title: candidate.title,
      detail: candidate.detail ?? null,
      applicationId: candidate.program?.id ?? null,
      program: candidate.program ? applicationName(candidate.program) : null,
      href: candidate.href,
      info,
    });
  }

  for (const record of input.applications) {
    const own = { rowId: record.id, program: record, href: programPath(record.id) };

    if (record.deadline) {
      add({
        ...own,
        source: 'application',
        date: record.deadline,
        info: getDeadlineInfo(record, today),
        title: 'Application deadline',
      });
    }

    if (record.priority_deadline) {
      add({
        ...own,
        source: 'priority',
        date: record.priority_deadline,
        info: getDeadlineInfo({ deadline: record.priority_deadline, status: record.status }, today),
        title: 'Priority deadline',
      });
    }

    if (record.interview_at && !isOver(record)) {
      const moment = new Date(record.interview_at);
      if (!Number.isNaN(moment.getTime())) {
        const date = toISODate(moment);
        const info = describeOpenDeadline(date, today);
        // One that has already happened is history, not something you are late for.
        if (info.state !== 'overdue') {
          add({
            ...own,
            source: 'interview',
            date,
            info: eventInfo(info),
            title: 'Interview',
            detail: formatTime(record.interview_at),
          });
        }
      }
    }

    // The date to accept or decline an offer, until you have made your final choice.
    if (record.decision_deadline && !record.is_final_choice && !isOver(record)) {
      add({
        ...own,
        source: 'decision',
        date: record.decision_deadline,
        info: describeOpenDeadline(record.decision_deadline, today),
        title: 'Reply to offer',
      });
    }
  }

  for (const row of input.requirements ?? []) {
    const record = programs.get(row.application_id);
    if (!record || !row.due_date) continue;
    add({
      source: 'requirement',
      rowId: row.id,
      date: row.due_date,
      info: requirementDue(row, record.status, today),
      title: requirementTitle(row),
      detail: 'Requirement',
      program: record,
      href: programPath(record.id, 'requirements'),
    });
  }

  for (const request of input.requests ?? []) {
    const record = programs.get(request.application_id);
    if (!record || !request.deadline) continue;
    const person = people.get(request.recommender_id);
    add({
      source: 'letter',
      rowId: request.id,
      date: request.deadline,
      info: requestDue(request, record.status, today),
      title: person ? `Letter from ${person.name}` : 'Recommendation letter',
      program: record,
      href: programPath(record.id, 'recommendations'),
    });
  }

  for (const row of input.funding ?? []) {
    if (!row.deadline) continue;
    const record = row.application_id ? (programs.get(row.application_id) ?? null) : null;
    add({
      source: 'funding',
      rowId: row.id,
      date: row.deadline,
      info: fundingDue(row, record?.status ?? null, today),
      title: row.name,
      detail: fundingKindLabel(row.kind),
      program: record,
      href: record ? programPath(record.id, 'funding') : '/app/funding',
    });
  }

  for (const task of input.tasks ?? []) {
    if (!task.due_date) continue;
    const record = task.application_id ? (programs.get(task.application_id) ?? null) : null;
    add({
      source: 'task',
      rowId: task.id,
      date: task.due_date,
      info: taskDue(task, today),
      title: task.title,
      detail: 'Task',
      program: record,
      href: record ? programPath(record.id, 'tasks') : '/app/tasks',
    });
  }

  return items.sort(compareDeadlines);
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
const sourceRank = new Map<DeadlineSource, number>(
  DEADLINE_SOURCES.map((source, index) => [source, index]),
);

/** Soonest first (the most overdue first among those that are late), then a steady order. */
export function compareDeadlines(a: DeadlineItem, b: DeadlineItem): number {
  return (
    a.info.days - b.info.days ||
    (sourceRank.get(a.source) ?? 0) - (sourceRank.get(b.source) ?? 0) ||
    collator.compare(a.title, b.title) ||
    collator.compare(a.program ?? '', b.program ?? '') ||
    collator.compare(a.id, b.id)
  );
}

// ---------------------------------------------------------------------------------------------
// Grouping by how soon

export const WEEK_DAYS = 7;
export const MONTH_DAYS = 30;

export const DEADLINE_GROUPS = [
  { key: 'overdue', title: 'Overdue' },
  { key: 'today', title: 'Today' },
  { key: 'week', title: 'Next 7 days' },
  { key: 'month', title: 'Next 30 days' },
  { key: 'later', title: 'Later' },
] as const;
export type DeadlineGroupKey = (typeof DEADLINE_GROUPS)[number]['key'];

/** Which group a date that is `days` from today belongs in. */
export function groupKeyOf(days: number): DeadlineGroupKey {
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= WEEK_DAYS) return 'week';
  if (days <= MONTH_DAYS) return 'month';
  return 'later';
}

export type DeadlineGroup = {
  key: DeadlineGroupKey;
  title: string;
  items: DeadlineItem[];
};

/** The groups that have something in them, soonest first. Each keeps the order it was given. */
export function groupDeadlines(items: readonly DeadlineItem[]): DeadlineGroup[] {
  return DEADLINE_GROUPS.map(({ key, title }) => ({
    key,
    title,
    items: items.filter((item) => groupKeyOf(item.info.days) === key),
  })).filter((group) => group.items.length > 0);
}

export type DeadlineCounts = Record<DeadlineGroupKey, number>;

export function countDeadlines(items: readonly DeadlineItem[]): DeadlineCounts {
  const counts: DeadlineCounts = { overdue: 0, today: 0, week: 0, month: 0, later: 0 };
  for (const item of items) counts[groupKeyOf(item.info.days)] += 1;
  return counts;
}

/** "2 overdue · 1 due today · 4 in the next 7 days": what needs attention, and nothing else. */
export function describeDeadlineCounts(counts: DeadlineCounts): string {
  const parts: string[] = [];
  if (counts.overdue > 0) parts.push(`${counts.overdue} overdue`);
  if (counts.today > 0) parts.push(`${counts.today} due today`);
  if (counts.week > 0) parts.push(`${counts.week} in the next 7 days`);
  return parts.length > 0 ? parts.join(' · ') : 'Nothing is due in the next 7 days.';
}
