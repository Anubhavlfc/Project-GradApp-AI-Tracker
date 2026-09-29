import { MutationObserver, onlineManager } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import { createQueryClient } from './queryClient';

// When the browser reports that it is offline, a request should still be tried (and fail with a
// message), not wait silently for a connection and then go through after the person has moved on.

const after = (ms: number) =>
  new Promise<'still waiting'>((r) => setTimeout(() => r('still waiting'), ms));

afterEach(() => onlineManager.setOnline(true));

describe('createQueryClient while the browser says it is offline', () => {
  it('runs a save at once, instead of holding it until a connection returns', async () => {
    onlineManager.setOnline(false);
    const observer = new MutationObserver(createQueryClient(), { mutationFn: async () => 'saved' });
    expect(await Promise.race([observer.mutate(), after(300)])).toBe('saved');
  });

  it('reports a failed save as a failure, at once', async () => {
    onlineManager.setOnline(false);
    const observer = new MutationObserver(createQueryClient(), {
      mutationFn: async () => {
        throw new Error("Can't reach the server");
      },
    });
    const outcome = await Promise.race([
      observer.mutate().catch((e: Error) => e.message),
      after(300),
    ]);
    expect(outcome).toBe("Can't reach the server");
  });

  it('runs a read at once too, and reports its failure, instead of showing a spinner for ever', async () => {
    onlineManager.setOnline(false);
    const client = createQueryClient({ retry: false });
    const outcome = await Promise.race([
      client
        .fetchQuery({
          queryKey: ['offline'],
          queryFn: async () => {
            throw new Error('offline');
          },
        })
        .catch((e: Error) => e.message),
      after(300),
    ]);
    expect(outcome).toBe('offline');
  });
});

describe('createQueryClient defaults', () => {
  it('tries a failed read once more, and can be told not to (for tests)', () => {
    expect(createQueryClient().getDefaultOptions().queries?.retry).toBe(1);
    expect(createQueryClient({ retry: false }).getDefaultOptions().queries?.retry).toBe(false);
  });
});
