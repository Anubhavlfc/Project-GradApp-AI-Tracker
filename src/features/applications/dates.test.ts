import {
  daysBetween,
  formatDate,
  fromDateTimeLocal,
  getDeadlineInfo,
  toDateTimeLocal,
  toISODate,
} from './dates';

describe('toISODate', () => {
  it('uses the local calendar day, zero padded', () => {
    expect(toISODate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toISODate(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });
});

describe('daysBetween', () => {
  it('counts whole calendar days', () => {
    expect(daysBetween('2026-12-01', '2026-12-15')).toBe(14);
    expect(daysBetween('2026-12-15', '2026-12-01')).toBe(-14);
    expect(daysBetween('2026-12-15', '2026-12-15')).toBe(0);
  });

  it('is not thrown off by month ends, leap years or daylight saving changes', () => {
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });

  it('gives NaN for anything that is not a real date', () => {
    expect(daysBetween('2026-02-30', '2026-03-01')).toBeNaN();
    expect(daysBetween('2026-13-01', '2026-03-01')).toBeNaN();
    expect(daysBetween('soon', '2026-03-01')).toBeNaN();
  });
});

describe('formatDate', () => {
  it('writes the month as a word so it reads the same in any country', () => {
    expect(formatDate('2026-12-15')).toBe('Dec 15, 2026');
    expect(formatDate('2027-01-01')).toBe('Jan 1, 2027');
  });

  it('falls back to the raw text for a bad value instead of throwing', () => {
    expect(formatDate('garbage')).toBe('garbage');
  });
});

describe('datetime-local conversion', () => {
  it('round-trips a moment through the local time an input shows', () => {
    const local = '2026-12-15T14:30';
    const timestamp = fromDateTimeLocal(local);
    expect(timestamp).not.toBeNull();
    expect(toDateTimeLocal(timestamp!)).toBe(local);
  });

  it('refuses text that is not a date and time', () => {
    expect(fromDateTimeLocal('')).toBeNull();
    expect(fromDateTimeLocal('2026-12-15')).toBeNull();
    expect(fromDateTimeLocal('2026-13-45T99:99')).toBeNull();
    expect(toDateTimeLocal('nonsense')).toBe('');
  });
});

describe('getDeadlineInfo', () => {
  const today = '2026-12-01';
  const info = (deadline: string | null, status: Parameters<typeof getDeadlineInfo>[0]['status']) =>
    getDeadlineInfo({ deadline, status }, today);

  it('has nothing to say without a deadline', () => {
    expect(info(null, 'researching')).toMatchObject({ state: 'none', days: null, text: null });
  });

  it('flags a missed deadline as overdue while the application is still open', () => {
    expect(info('2026-11-29', 'application_started')).toMatchObject({
      state: 'overdue',
      days: -2,
      text: '2 days overdue',
      tone: 'red',
    });
    expect(info('2026-11-30', 'researching').text).toBe('1 day overdue');
  });

  it('counts down to an upcoming deadline', () => {
    expect(info('2026-12-01', 'researching')).toMatchObject({ state: 'today', text: 'Due today' });
    expect(info('2026-12-02', 'researching')).toMatchObject({
      state: 'soon',
      text: 'Due tomorrow',
    });
    expect(info('2026-12-15', 'researching')).toMatchObject({
      state: 'soon',
      text: 'In 14 days',
      tone: 'amber',
    });
    expect(info('2026-12-16', 'researching')).toMatchObject({
      state: 'upcoming',
      text: 'In 15 days',
      tone: 'neutral',
    });
  });

  it('stops counting for far-off deadlines: the date says enough', () => {
    expect(info('2027-01-30', 'researching')).toMatchObject({
      state: 'upcoming',
      text: 'In 60 days',
    });
    expect(info('2027-01-31', 'researching')).toMatchObject({ state: 'upcoming', text: null });
  });

  it.each(['submitted', 'interview', 'waitlisted', 'accepted', 'rejected', 'withdrawn'] as const)(
    'never calls a %s application overdue',
    (status) => {
      expect(info('2026-11-01', status)).toMatchObject({ state: 'closed', text: null });
    },
  );

  it('treats an impossible date as no deadline', () => {
    expect(info('2026-02-30', 'researching').state).toBe('none');
  });
});
