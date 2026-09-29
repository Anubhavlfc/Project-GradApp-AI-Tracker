import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(options: { retry?: number | false } = {}) {
  return new QueryClient({
    defaultOptions: {
      // Try the request whatever the browser says about being online. The default is to wait for a
      // connection, which shows a spinner with no explanation, and a save the person has already
      // cancelled would still go through when the connection comes back. Trying at once fails with
      // a message ("Can't reach the server") and never acts later.
      mutations: { networkMode: 'always' },
      queries: {
        networkMode: 'always',
        // Data is refetched when you come back to the tab, so a change made on another device
        // shows up; this only stops it refetching on every navigation.
        staleTime: 30_000,
        retry: options.retry ?? 1,
      },
    },
  });
}
