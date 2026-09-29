import { describeAge, RELATIVE_DAYS } from './time';

// Tests run in America/Los_Angeles (see vite.config.ts), so "yesterday" is about local midnight.
const NOW = new Date('2026-10-15T20:00:00Z'); // 1 pm on Oct 15 in Los Angeles

const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

describe('describeAge', () => {
  it('says "just now" for the last moments, and for a clock that is slightly ahead', () => {
    expect(describeAge(ago(0), NOW)).toBe('just now');
    expect(describeAge(ago(44 * SECOND), NOW)).toBe('just now');
    expect(describeAge(ago(-30 * SECOND), NOW)).toBe('just now');
    expect(describeAge(ago(-5 * MINUTE), NOW)).toBe('just now');
  });

  it('counts minutes', () => {
    expect(describeAge(ago(45 * SECOND), NOW)).toBe('1 minute ago');
    expect(describeAge(ago(5 * MINUTE), NOW)).toBe('5 minutes ago');
    expect(describeAge(ago(59 * MINUTE), NOW)).toBe('59 minutes ago');
  });

  it('counts hours', () => {
    expect(describeAge(ago(60 * MINUTE), NOW)).toBe('1 hour ago');
    expect(describeAge(ago(90 * MINUTE), NOW)).toBe('2 hours ago');
    expect(describeAge(ago(11 * HOUR), NOW)).toBe('11 hours ago');
  });

  it('counts hours later in the day too, while it is still the same calendar day', () => {
    // 11:30 pm on Oct 15 in Los Angeles; something from 9 am the same day is 14 hours ago.
    const lateNight = new Date('2026-10-16T06:30:00Z');
    expect(describeAge('2026-10-15T16:00:00Z', lateNight)).toBe('15 hours ago');
  });

  it('says "yesterday" for the calendar day before, once it was half a day or more ago', () => {
    // 1 pm now. 11 pm last night is 14 hours ago, and yesterday.
    expect(describeAge('2026-10-15T06:00:00Z', NOW)).toBe('yesterday'); // 11 pm on the 14th
    // Just past noon, midnight was a little over half a day ago.
    const noon = new Date('2026-10-15T19:01:00Z'); // 12:01 pm on the 15th
    expect(describeAge('2026-10-15T07:00:00Z', noon)).toBe('12 hours ago'); // midnight, same day
    expect(describeAge('2026-10-15T06:59:00Z', noon)).toBe('yesterday'); // 11:59 pm on the 14th
  });

  it('keeps counting hours across midnight while it was only a few hours ago', () => {
    const justAfterMidnight = new Date('2026-10-15T07:20:00Z'); // 12:20 am on the 15th
    expect(describeAge('2026-10-15T06:30:00Z', justAfterMidnight)).toBe('50 minutes ago');
    expect(describeAge('2026-10-15T05:20:00Z', justAfterMidnight)).toBe('2 hours ago'); // 10:20 pm
    const earlyMorning = new Date('2026-10-15T16:00:00Z'); // 9 am on the 15th
    expect(describeAge('2026-10-15T06:00:00Z', earlyMorning)).toBe('10 hours ago'); // 11 pm on the 14th
  });

  it('counts calendar days up to a week', () => {
    expect(describeAge('2026-10-13T20:00:00Z', NOW)).toBe('2 days ago');
    expect(describeAge('2026-10-09T20:00:00Z', NOW)).toBe('6 days ago');
  });

  it('gives the date once it is a week old or more', () => {
    expect(RELATIVE_DAYS).toBe(7);
    expect(describeAge('2026-10-08T20:00:00Z', NOW)).toBe('Oct 8, 2026');
    expect(describeAge('2026-01-02T20:00:00Z', NOW)).toBe('Jan 2, 2026');
  });

  it('uses the viewer’s own day, not UTC, for that date', () => {
    // 5 pm on Oct 7 in Los Angeles is already Oct 8 in UTC.
    expect(describeAge('2026-10-08T00:30:00Z', NOW)).toBe('Oct 7, 2026');
  });

  it('is empty for a moment it cannot read', () => {
    expect(describeAge('not a date', NOW)).toBe('');
    expect(describeAge('', NOW)).toBe('');
  });

  it('measures from the present when no moment is given', () => {
    expect(describeAge(new Date().toISOString())).toBe('just now');
  });
});
