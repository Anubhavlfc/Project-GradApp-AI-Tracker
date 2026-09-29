import type { ReactNode } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createQueryClient } from './queryClient';
import { useQuickChange } from './useQuickChange';

type Row = { id: string; status: 'open' | 'done'; note: string };
const KEY = ['rows', 'user-1'] as const;

const row = (id: string, status: Row['status'] = 'open'): Row => ({ id, status, note: '' });

/** The hook with a list already in the cache, and a `send` the test controls. */
function setup(
  rows: Row[],
  send = vi.fn<(id: string, patch: { status: Row['status'] }) => Promise<void>>(async () => {}),
) {
  const queryClient = createQueryClient({ retry: false });
  queryClient.setQueryData(KEY, structuredClone(rows));
  const refetch = vi.fn(async () => structuredClone(rows));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    () => {
      // A screen showing the list, so that the cache has someone to reload it for.
      useQuery({ queryKey: KEY, queryFn: refetch, staleTime: Infinity });
      return useQuickChange<Row, { status: Row['status'] }>({
        key: KEY,
        scope: 'test-status',
        send,
        errorMessage: (error) => `Failed: ${(error as Error).message}`,
      });
    },
    { wrapper },
  );
  const cached = () => queryClient.getQueryData<Row[]>(KEY);
  return { ...hook, send, queryClient, refetch, cached };
}

const toDone = () => ({ status: 'done' as const });

describe('useQuickChange', () => {
  it('shows the change at once, before the server has answered', async () => {
    let finish = () => {};
    const send = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { result, cached } = setup([row('a')], send);

    act(() => result.current.change(row('a'), toDone));
    await waitFor(() => expect(cached()?.[0]?.status).toBe('done'));
    expect(send).toHaveBeenCalledWith('a', { status: 'done' });
    act(() => finish());
  });

  it('sends nothing when the decision is "no change"', async () => {
    const { result, send } = setup([row('a', 'done')]);
    act(() =>
      result.current.change(row('a', 'done'), (current) =>
        current.status === 'done' ? null : toDone(),
      ),
    );
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(send).not.toHaveBeenCalled();
  });

  it('decides from the newest copy of the row, not the one that was on screen', async () => {
    // The screen still shows the row as open, but the cache already has it done.
    const { result, send } = setup([row('a', 'done')]);
    const decide = vi.fn((current: Row) => (current.status === 'done' ? null : toDone()));
    act(() => result.current.change(row('a', 'open'), decide));
    expect(decide).toHaveBeenCalledWith(expect.objectContaining({ status: 'done' }));
    expect(send).not.toHaveBeenCalled();
  });

  it('puts the old row back and says why when the server refuses', async () => {
    const send = vi.fn(async () => {
      throw new Error('offline');
    });
    const { result, cached } = setup([row('a')], send);
    act(() => result.current.change(row('a'), toDone));
    await waitFor(() => expect(result.current.error).toBe('Failed: offline'));
    expect(cached()?.[0]?.status).toBe('open');

    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });

  it('puts the old row back even when the list cannot be reloaded either', async () => {
    const send = vi.fn(async () => {
      throw new Error('offline');
    });
    const { result, cached, refetch } = setup([row('a')], send);
    refetch.mockRejectedValue(new Error('offline'));
    act(() => result.current.change(row('a'), toDone));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(cached()?.[0]?.status).toBe('open');
  });

  it('sends changes one at a time, in the order they were made', async () => {
    const started: string[] = [];
    const finishers: (() => void)[] = [];
    const send = vi.fn(
      (id: string) =>
        new Promise<void>((resolve) => {
          started.push(id);
          finishers.push(resolve);
        }),
    );
    const { result } = setup([row('a'), row('b')], send);
    act(() => {
      result.current.change(row('a'), toDone);
      result.current.change(row('b'), toDone);
    });
    await waitFor(() => expect(started).toEqual(['a']));
    // The second waits for the first.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(started).toEqual(['a']);
    act(() => finishers[0]!());
    await waitFor(() => expect(started).toEqual(['a', 'b']));
    act(() => finishers[1]!());
  });

  it('asks the server for the list once, after the last queued change', async () => {
    const { result, send, refetch } = setup([row('a'), row('b')]);
    act(() => {
      result.current.change(row('a'), toDone);
      result.current.change(row('b'), toDone);
    });
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(refetch).toHaveBeenCalled());
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
