// Display labels for the values stored in the database. Keep the values in sync with the enums in
// supabase/migrations.

export const DEGREE_LEVELS = [
  { value: 'masters', label: "Master's" },
  { value: 'phd', label: 'PhD' },
  { value: 'other', label: 'Other' },
] as const;
export type DegreeLevel = (typeof DEGREE_LEVELS)[number]['value'];
export const DEGREE_LEVEL_VALUES = DEGREE_LEVELS.map((level) => level.value);

// Stored as dream/target/safety; shown with the more professional "Reach".
export const PRIORITIES = [
  { value: 'dream', label: 'Reach' },
  { value: 'target', label: 'Target' },
  { value: 'safety', label: 'Safety' },
] as const;
export type Priority = (typeof PRIORITIES)[number]['value'];
export const PRIORITY_VALUES = PRIORITIES.map((priority) => priority.value);

export const FEE_WAIVER_STATUSES = [
  { value: 'not_requested', label: 'Not requested' },
  { value: 'requested', label: 'Requested' },
  { value: 'granted', label: 'Granted' },
  { value: 'denied', label: 'Denied' },
] as const;
export type FeeWaiverStatus = (typeof FEE_WAIVER_STATUSES)[number]['value'];
export const FEE_WAIVER_VALUES = FEE_WAIVER_STATUSES.map((status) => status.value);

export function degreeLevelLabel(level: DegreeLevel): string {
  return DEGREE_LEVELS.find((item) => item.value === level)?.label ?? level;
}

export function priorityLabel(priority: Priority): string {
  return PRIORITIES.find((item) => item.value === priority)?.label ?? priority;
}

export function feeWaiverLabel(status: FeeWaiverStatus): string {
  return FEE_WAIVER_STATUSES.find((item) => item.value === status)?.label ?? status;
}

/** Suggestions for the free-text degree field. */
export const DEGREE_TYPE_SUGGESTIONS = [
  'MS',
  'MA',
  'MEng',
  'MBA',
  'MFA',
  'MPH',
  'MPP',
  'MPA',
  'LLM',
  'MSW',
  'PhD',
  'EdD',
] as const;

export const CURRENCIES = [
  'USD',
  'CAD',
  'GBP',
  'EUR',
  'AUD',
  'CHF',
  'SEK',
  'SGD',
  'HKD',
  'JPY',
  'CNY',
  'KRW',
  'INR',
] as const;

/** Suggestions for the country field, merged with countries already used. */
export const COMMON_COUNTRIES = [
  'United States',
  'Canada',
  'United Kingdom',
  'Germany',
  'Netherlands',
  'Switzerland',
  'France',
  'Sweden',
  'Denmark',
  'Norway',
  'Finland',
  'Ireland',
  'Australia',
  'New Zealand',
  'Singapore',
  'Hong Kong',
  'Japan',
  'South Korea',
  'China',
  'India',
] as const;

/** "Stanford University, Computer Science": how a program is named in labels and messages. */
export function applicationName(record: {
  program_name: string;
  university: { name: string };
}): string {
  return `${record.university.name}, ${record.program_name}`;
}

/** "MS Computer Science": the program with its degree, without repeating it if already there. */
export function programLine(record: { program_name: string; degree_type: string | null }): string {
  const degree = record.degree_type?.trim();
  if (!degree || record.program_name.toLowerCase().startsWith(degree.toLowerCase())) {
    return record.program_name;
  }
  return `${degree} ${record.program_name}`;
}
