import { useState } from 'react';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';

type QuickChangeOptions<Patch> = {
  /** Where the list of rows is cached. */
  key: QueryKey;
  /** Names this kind of change. Changes with the same name are sent one at a time, in order. */
  scope: string;
  send: (id: string, patch: Patch) => Promise<void>;
  /** The sentence shown when the server refuses a change. */
  errorMessage: (error: unknown) => string;
};

/**
 * A one-click change to a row in a cached list (its status, say). It shows at once, and is undone,
 * with a message, if the server refuses.
 */
export function useQuickChange<Row extends { id: string }, Patch extends Partial<Row>>({
  key,
  scope,
  send,
  errorMessage,
}: QuickChangeOptions<Patch>) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const mutationKey = ['quick-change', scope] as const;

  const mutation = useMutation({
    mutationKey,
    // One at a time, in the order they were made: a quick second click must not be applied by the
    // server before the first one.
    scope: { id: scope },
    mutationFn: ({ id, patch }: { id: string; patch: Patch }) => send(id, patch),
    onMutate: async ({ id, patch }) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Row[]>(key);
      queryClient.setQueryData<Row[]>(key, (old) =>
        old?.map((row) => (row.id === id ? ({ ...row, ...patch } as Row) : row)),
      );
      return { previous };
    },
    onError: (failure, _change, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      setError(errorMessage(failure));
    },
    onSettled: () => {
      // Only look at the server once the last change is in; earlier, it would still show the
      // state from before the changes that are queued behind this one.
      if (queryClient.isMutating({ mutationKey }) <= 1) {
        return queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });

  // The row as the list has it right now. After a click that the page hasn't drawn yet, that is
  // newer than the row the click came from.
  const newest = (row: Row) =>
    queryClient.getQueryData<Row[]>(key)?.find((item) => item.id === row.id) ?? row;

  return {
    /**
     * Applies the change that `decide` asks for, judged against the newest copy of the row.
     * `decide` returns null when there is nothing to change (the row already has that value).
     */
    change(shown: Row, decide: (current: Row) => Patch | null) {
      const row = newest(shown);
      const patch = decide(row);
      if (patch) mutation.mutate({ id: row.id, patch });
    },
    /** Message for the last change that failed, until the next change starts. */
    error,
    clearError: () => setError(null),
  };
}
