export type DataErrorKind =
  'network' | 'session' | 'permission' | 'not_found' | 'invalid' | 'conflict' | 'unknown';

const MESSAGES: Record<DataErrorKind, string> = {
  network: "Can't reach the server. Check your connection and try again.",
  session: 'Your session expired. Sign in again.',
  permission: "You don't have access to that. Try signing out and back in.",
  not_found: 'That application no longer exists. It may have been deleted in another tab.',
  invalid: "Some values aren't allowed. Check the form and try again.",
  conflict: 'This changed somewhere else. Reload the page and try again.',
  unknown: 'Something went wrong. Try again in a moment.',
};

/** A failed data request, with a message that is safe and useful to show to the person. */
export class DataError extends Error {
  readonly kind: DataErrorKind;

  constructor(kind: DataErrorKind, options?: { cause?: unknown }) {
    super(MESSAGES[kind], options);
    this.name = 'DataError';
    this.kind = kind;
  }
}

function read(error: unknown, key: string): unknown {
  return typeof error === 'object' && error !== null
    ? (error as Record<string, unknown>)[key]
    : undefined;
}

// Postgres codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
// PGRST codes: https://docs.postgrest.org/en/stable/references/errors.html
const INVALID_CODES = new Set(['23514', '23502', '22001', '22003', '22007', '22008', '22P02']);

/** Turns whatever the data layer threw into a DataError. */
export function toDataError(error: unknown): DataError {
  if (error instanceof DataError) return error;
  const code = String(read(error, 'code') ?? '');
  const message = String(read(error, 'message') ?? '');

  if (code === 'PGRST301' || code === 'PGRST303' || read(error, 'status') === 401) {
    return new DataError('session', { cause: error });
  }
  if (code === '42501') return new DataError('permission', { cause: error });
  if (code === 'PGRST116') return new DataError('not_found', { cause: error });
  if (code === '23505' || code === '23503') return new DataError('conflict', { cause: error });
  if (INVALID_CODES.has(code)) return new DataError('invalid', { cause: error });
  // supabase-js reports a failed fetch as an error with no code and the browser's own message.
  if (error instanceof TypeError || (code === '' && /fetch|network|load failed/i.test(message))) {
    return new DataError('network', { cause: error });
  }
  return new DataError('unknown', { cause: error });
}

/**
 * The message for a failed request about `noun` ("requirement", "task"): the general message,
 * except that a missing item is named rather than called an application.
 */
export function describeDataError(error: unknown, noun: string): string {
  const failure = toDataError(error);
  return failure.kind === 'not_found'
    ? `That ${noun} no longer exists. It may have been deleted in another tab.`
    : failure.message;
}
