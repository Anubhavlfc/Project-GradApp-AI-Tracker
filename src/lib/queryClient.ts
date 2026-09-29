import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(options: { retry?: number | false } = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is refetched when you come back to the tab, so a change made on another device
        // shows up; this only stops it refetching on every navigation.
        staleTime: 30_000,
        retry: options.retry ?? 1,
      },
    },
  });
}
