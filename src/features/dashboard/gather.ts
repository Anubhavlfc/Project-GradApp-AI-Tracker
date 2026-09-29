import { toDataError } from '@/lib/dataError';

// Each card on the dashboard needs a few of the cached lists (programs, checklists, letters, ...).
// A card whose lists cannot be loaded says so by itself and the rest of the dashboard carries on,
// so what a card shows is one of these three states.

/** Something to tell the person about a card that is still showing what it can. */
export type CardWarning = { title: string; message: string; retry: () => void };

export type CardState =
  | { status: 'loading' }
  | { status: 'failed'; error: unknown; retry: () => void }
  | { status: 'ready'; warning: CardWarning | null };

/** The part of a query result that decides which state a card is in. */
export type QueryLike = {
  data: unknown;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
};

/**
 * The state of a card that needs all of these lists. It is `failed` as soon as a list has nothing
 * to show and an error, `loading` while any list has nothing yet, and otherwise `ready`, with a
 * warning when a list could not be refreshed (so what is shown may be a little old). Trying again
 * asks only for the lists that failed.
 */
export function gather(queries: readonly QueryLike[]): CardState {
  const retry = () => {
    for (const query of queries) if (query.isError) void query.refetch();
  };

  const failed = queries.find((query) => query.data === undefined && query.isError);
  if (failed) return { status: 'failed', error: failed.error, retry };
  if (queries.some((query) => query.data === undefined)) return { status: 'loading' };

  const stale = queries.find((query) => query.isError);
  return {
    status: 'ready',
    warning: stale
      ? {
          title: 'Unable to refresh',
          message: `Showing what loaded last. ${toDataError(stale.error).message}`,
          retry,
        }
      : null,
  };
}
