import { getDeadlineInfo, toISODate } from './dates';
import { DEGREE_LEVEL_VALUES, PRIORITY_VALUES, type DegreeLevel, type Priority } from './labels';
import {
  APPLICATION_STATUSES,
  isClosedStatus,
  STATUS_VALUES,
  type ApplicationStatus,
} from './status';
import type { ApplicationRecord, UniversityRow } from './types';

// What the applications list shows: which programs (search + filters) in which order (sort).
// All of it lives in the page address (?q=...&status=...), so a refresh, the back button and a
// bookmark all keep the same view.

export const SORT_KEYS = [
  'deadline',
  'university',
  'status',
  'priority',
  'fee',
  'updated',
] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDirection = 'asc' | 'desc';

export const SORT_LABELS: Record<SortKey, string> = {
  deadline: 'Deadline',
  university: 'University',
  status: 'Status',
  priority: 'Priority',
  fee: 'Fee',
  updated: 'Recently updated',
};

/** The direction people expect first for each column. */
export const DEFAULT_DIRECTION: Record<SortKey, SortDirection> = {
  deadline: 'asc',
  university: 'asc',
  status: 'asc',
  priority: 'asc',
  fee: 'desc',
  updated: 'desc',
};

export const DEADLINE_FILTERS = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'week', label: 'Next 7 days' },
  { value: 'month', label: 'Next 30 days' },
  { value: 'none', label: 'No deadline' },
] as const;
export type DeadlineFilter = (typeof DEADLINE_FILTERS)[number]['value'];
const DEADLINE_FILTER_VALUES = DEADLINE_FILTERS.map((filter) => filter.value);

export type ViewState = {
  query: string;
  status: ApplicationStatus | null;
  degree: DegreeLevel | null;
  priority: Priority | null;
  deadline: DeadlineFilter | null;
  country: string | null;
  favoritesOnly: boolean;
  sort: SortKey;
  direction: SortDirection;
};

/** A change to the view, written as a function of the view it applies to (like `setState(fn)`). */
export type ViewUpdate = (view: ViewState) => ViewState;

export const DEFAULT_VIEW: ViewState = {
  query: '',
  status: null,
  degree: null,
  priority: null,
  deadline: null,
  country: null,
  favoritesOnly: false,
  sort: 'deadline',
  direction: 'asc',
};

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return allowed.find((item) => item === value) ?? null;
}

/** Reads a view from the page address. Anything unrecognised is ignored, never an error. */
export function parseView(params: URLSearchParams): ViewState {
  const sort = oneOf(params.get('sort'), SORT_KEYS) ?? DEFAULT_VIEW.sort;
  return {
    query: params.get('q')?.trim() ?? '',
    status: oneOf(params.get('status'), STATUS_VALUES),
    degree: oneOf(params.get('degree'), DEGREE_LEVEL_VALUES),
    priority: oneOf(params.get('priority'), PRIORITY_VALUES),
    deadline: oneOf(params.get('deadline'), DEADLINE_FILTER_VALUES),
    country: params.get('country')?.trim() || null,
    favoritesOnly: params.get('fav') === '1',
    sort,
    direction: oneOf(params.get('dir'), ['asc', 'desc'] as const) ?? DEFAULT_DIRECTION[sort],
  };
}

/** The page address for a view. Defaults are left out so the plain list has a plain address. */
export function serializeView(view: ViewState): URLSearchParams {
  const params = new URLSearchParams();
  const query = view.query.trim();
  if (query) params.set('q', query);
  if (view.status) params.set('status', view.status);
  if (view.degree) params.set('degree', view.degree);
  if (view.priority) params.set('priority', view.priority);
  if (view.deadline) params.set('deadline', view.deadline);
  if (view.country) params.set('country', view.country);
  if (view.favoritesOnly) params.set('fav', '1');
  if (view.sort !== DEFAULT_VIEW.sort) params.set('sort', view.sort);
  if (view.direction !== DEFAULT_DIRECTION[view.sort]) params.set('dir', view.direction);
  return params;
}

export function activeFilterCount(view: ViewState): number {
  return (
    [view.status, view.degree, view.priority, view.deadline, view.country].filter(Boolean).length +
    (view.favoritesOnly ? 1 : 0)
  );
}

/** True when search or any filter narrows the list (sorting does not count). */
export function isFiltered(view: ViewState): boolean {
  return view.query.trim() !== '' || activeFilterCount(view) > 0;
}

/** Same sort, no search or filters. */
export function clearFilters(view: ViewState): ViewState {
  return { ...DEFAULT_VIEW, sort: view.sort, direction: view.direction };
}

/** Lowercase and accent-free, so "zurich" finds "Zürich". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function searchText(record: ApplicationRecord): string {
  return fold(
    [
      record.university.name,
      record.university.city,
      record.university.region,
      record.university.country,
      record.program_name,
      record.degree_type,
      record.department,
      record.school_college,
      record.notes,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function matches(
  record: ApplicationRecord,
  view: ViewState,
  tokens: readonly string[],
  today: string,
): boolean {
  if (view.status && record.status !== view.status) return false;
  if (view.degree && record.degree_level !== view.degree) return false;
  if (view.priority && record.priority !== view.priority) return false;
  if (view.country && record.university.country?.toLowerCase() !== view.country.toLowerCase()) {
    return false;
  }
  if (view.favoritesOnly && !record.is_favorite) return false;

  if (view.deadline) {
    if (view.deadline === 'none') {
      if (record.deadline !== null) return false;
    } else {
      // Deadlines only matter while an application is open.
      const info = getDeadlineInfo(record, today);
      if (view.deadline === 'overdue') {
        if (info.state !== 'overdue') return false;
      } else {
        const within = view.deadline === 'week' ? 7 : 30;
        const open = info.state === 'today' || info.state === 'soon' || info.state === 'upcoming';
        if (!open || info.days === null || info.days > within) return false;
      }
    }
  }

  if (tokens.length > 0) {
    const haystack = searchText(record);
    if (!tokens.every((token) => haystack.includes(token))) return false;
  }
  return true;
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
const statusOrder = new Map<ApplicationStatus, number>(
  APPLICATION_STATUSES.map((status, index) => [status.value, index]),
);
const priorityOrder = new Map<Priority | null, number>([
  ['dream', 0],
  ['target', 1],
  ['safety', 2],
]);

const compareNumbers = (a: number, b: number) => a - b;

/** Sorts values that may be missing; missing ones always go last, whichever way you sort. */
function compareOptional<T>(
  a: T | null,
  b: T | null,
  compare: (x: T, y: T) => number,
  sign: 1 | -1,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return compare(a, b) * sign;
}

function compareRecords(view: ViewState): (a: ApplicationRecord, b: ApplicationRecord) => number {
  const sign = view.direction === 'asc' ? 1 : -1;
  const byName = (a: ApplicationRecord, b: ApplicationRecord) =>
    collator.compare(a.university.name, b.university.name) ||
    collator.compare(a.program_name, b.program_name) ||
    collator.compare(a.id, b.id);

  const primary = (a: ApplicationRecord, b: ApplicationRecord): number => {
    switch (view.sort) {
      case 'deadline': {
        // Finished applications (submitted, decided, withdrawn) sit below the ones still open,
        // because their deadline is no longer what you need to act on.
        const aClosed = isClosedStatus(a.status);
        if (aClosed !== isClosedStatus(b.status)) return aClosed ? 1 : -1;
        return compareOptional(a.deadline, b.deadline, (x, y) => collator.compare(x, y), sign);
      }
      case 'university':
        return byName(a, b) * sign;
      case 'status':
        return ((statusOrder.get(a.status) ?? 0) - (statusOrder.get(b.status) ?? 0)) * sign;
      case 'priority':
        return compareOptional(
          priorityOrder.get(a.priority) ?? null,
          priorityOrder.get(b.priority) ?? null,
          compareNumbers,
          sign,
        );
      case 'fee':
        return compareOptional(a.application_fee, b.application_fee, compareNumbers, sign);
      case 'updated':
        return (Date.parse(a.updated_at) - Date.parse(b.updated_at)) * sign;
    }
  };

  return (a, b) => primary(a, b) || byName(a, b);
}

/** The programs to show, filtered by the view and in its order. Never changes the input. */
export function applyView(
  records: readonly ApplicationRecord[],
  view: ViewState,
  today: string = toISODate(),
): ApplicationRecord[] {
  const tokens = fold(view.query).split(/\s+/).filter(Boolean);
  return records
    .filter((record) => matches(record, view, tokens, today))
    .sort(compareRecords(view));
}

/** Countries used by at least one program, for the country filter and form suggestions. */
export function usedCountries(records: readonly ApplicationRecord[]): string[] {
  // "United States" and "united states" are one country: keep the first spelling met.
  const countries = new Map<string, string>();
  for (const record of records) {
    const country = record.university.country;
    if (country && !countries.has(country.toLowerCase())) {
      countries.set(country.toLowerCase(), country);
    }
  }
  return [...countries.values()].sort(collator.compare);
}

/** Each university once (for suggestions in the form), alphabetical. */
export function knownUniversities(records: readonly ApplicationRecord[]): UniversityRow[] {
  const byId = new Map<string, UniversityRow>();
  for (const record of records) byId.set(record.university.id, record.university);
  return [...byId.values()].sort((a, b) => collator.compare(a.name, b.name));
}
