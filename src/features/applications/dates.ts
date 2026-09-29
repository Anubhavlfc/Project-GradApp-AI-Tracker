import type { Tone } from '@/components/ui/tone';
import { isClosedStatus, type ApplicationStatus } from './status';

// Deadlines are calendar dates ('YYYY-MM-DD'), not moments in time, so all the arithmetic here is
// on whole days and never touches time zones: "due Dec 15" means the same day for everyone.

const pad = (value: number) => String(value).padStart(2, '0');

/** A date as a local calendar day, 'YYYY-MM-DD'. Defaults to today. */
export function toISODate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whole days since 1970-01-01 for a real calendar date, or null when it is not one. */
function dayNumber(iso: string): number | null {
  const match = ISO_DATE.exec(iso);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // setUTCFullYear, unlike Date.UTC, does not read years 0-99 as 1900-1999.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  // 2026-02-30 rolls over to March; reject anything that did not come out as written.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1) return null;
  if (date.getUTCDate() !== day) return null;
  return date.getTime() / 86_400_000;
}

/** Days from `from` to `to` (positive when `to` is later); NaN when either is not a real date. */
export function daysBetween(from: string, to: string): number {
  const start = dayNumber(from);
  const end = dayNumber(to);
  return start === null || end === null ? Number.NaN : end - start;
}

const dateFormat = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/** 'Dec 15, 2026'. Unambiguous in any country, unlike 12/15/2026. */
export function formatDate(iso: string): string {
  const days = dayNumber(iso);
  return days === null ? iso : dateFormat.format(new Date(days * 86_400_000));
}

const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** A moment in time (e.g. an interview) shown in the viewer's own time zone. */
export function formatDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : dateTimeFormat.format(date);
}

const timeFormat = new Intl.DateTimeFormat('en-US', { timeStyle: 'short' });

/** The time of day of a moment, in the viewer's own time zone: '2:30 PM'. */
export function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : timeFormat.format(date);
}

/** Value for an <input type="datetime-local">: the moment in the viewer's local time. */
export function toDateTimeLocal(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return `${toISODate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The reverse: a datetime-local value (local time) as a UTC timestamp, or null if invalid. */
export function fromDateTimeLocal(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
  const date = new Date(value); // no offset in the string, so it is read as local time
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export type DeadlineState = 'none' | 'closed' | 'overdue' | 'today' | 'soon' | 'upcoming';

export type DeadlineInfo = {
  state: DeadlineState;
  /** Days from today; negative when past. Null when there is no usable deadline. */
  days: number | null;
  /** "Due today", "In 5 days", "3 days overdue". Null when the date alone says enough. */
  text: string | null;
  tone: Tone;
};

const SOON_WITHIN_DAYS = 14;
const SHOW_RELATIVE_TEXT_WITHIN_DAYS = 60;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** How far away a date is, in words: "Due today", "In 5 days", "3 days overdue". */
export function describeOpenDeadline(deadline: string, today: string = toISODate()): DeadlineInfo {
  const days = daysBetween(today, deadline);
  if (Number.isNaN(days)) return { state: 'none', days: null, text: null, tone: 'neutral' };
  if (days < 0) {
    return { state: 'overdue', days, text: `${plural(-days, 'day')} overdue`, tone: 'red' };
  }
  if (days === 0) return { state: 'today', days, text: 'Due today', tone: 'amber' };
  if (days === 1) return { state: 'soon', days, text: 'Due tomorrow', tone: 'amber' };
  if (days <= SOON_WITHIN_DAYS) {
    return { state: 'soon', days, text: `In ${plural(days, 'day')}`, tone: 'amber' };
  }
  return {
    state: 'upcoming',
    days,
    text: days <= SHOW_RELATIVE_TEXT_WITHIN_DAYS ? `In ${plural(days, 'day')}` : null,
    tone: 'neutral',
  };
}

/**
 * What a deadline means right now. Once an application is submitted, decided or withdrawn its
 * deadline is history, so it is never shown as overdue.
 */
export function getDeadlineInfo(
  application: { deadline: string | null; status: ApplicationStatus },
  today: string = toISODate(),
): DeadlineInfo {
  if (!application.deadline) return { state: 'none', days: null, text: null, tone: 'neutral' };
  const open = describeOpenDeadline(application.deadline, today);
  if (open.state === 'none') return open;
  return isClosedStatus(application.status)
    ? { state: 'closed', days: open.days, text: null, tone: 'neutral' }
    : open;
}
