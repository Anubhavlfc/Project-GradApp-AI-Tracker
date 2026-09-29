import { daysBetween, formatDate, toISODate } from '@/features/applications/dates';

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** Past this many days an entry is dated rather than counted back. */
export const RELATIVE_DAYS = 7;

/**
 * How long ago something happened, in words: "just now", "5 minutes ago", "3 hours ago",
 * "yesterday", and a date once it is more than a week old. The last few hours are always counted
 * back, even across midnight; beyond that, days are calendar days in the viewer's own time zone,
 * so something from 11 pm last night is "yesterday" at 2 pm. Empty when the moment cannot be read.
 */
export function describeAge(timestamp: string, now: Date = new Date()): string {
  const then = new Date(timestamp);
  if (Number.isNaN(then.getTime())) return '';

  const seconds = (now.getTime() - then.getTime()) / 1000;
  // A clock a little ahead of ours would otherwise say "in 2 minutes".
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return relative.format(-minutes, 'minute');
  if (seconds < 12 * 3600) return relative.format(-Math.round(seconds / 3600), 'hour');

  const days = daysBetween(toISODate(then), toISODate(now));
  if (days <= 0) return relative.format(-Math.round(seconds / 3600), 'hour');
  if (days < RELATIVE_DAYS) return relative.format(-days, 'day');
  return formatDate(toISODate(then));
}
