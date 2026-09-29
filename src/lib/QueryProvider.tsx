import { useEffect, useState, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { createQueryClient } from './queryClient';

type QueryProviderProps = { client?: QueryClient; children: ReactNode };

/**
 * Caches data fetched from the server. Sits inside AuthProvider so the cache is emptied when the
 * person signs out: the next person to sign in on this browser never sees the previous one's data.
 */
export function QueryProvider({ client, children }: QueryProviderProps) {
  const [fallback] = useState(() => createQueryClient());
  const queryClient = client ?? fallback;
  const { state } = useAuth();
  const signedOut = state.status === 'signed_out';

  useEffect(() => {
    if (signedOut) queryClient.clear();
  }, [signedOut, queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
