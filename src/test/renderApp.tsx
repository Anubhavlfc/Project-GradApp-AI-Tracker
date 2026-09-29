import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { App } from '@/App';
import type { ApplicationsApi } from '@/features/applications/api';
import { ApplicationsApiContext } from '@/features/applications/api-context';
import { AuthProvider, type AuthClient } from '@/features/auth/AuthProvider';
import type { RecommendationsApi } from '@/features/recommendations/api';
import { RecommendationsApiContext } from '@/features/recommendations/api-context';
import type { RequirementsApi } from '@/features/requirements/api';
import { RequirementsApiContext } from '@/features/requirements/api-context';
import { QueryProvider } from '@/lib/QueryProvider';
import { createQueryClient } from '@/lib/queryClient';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { createFakeApplicationsApi } from './fakeApplicationsApi';
import { createFakeRecommendationsApi } from './fakeRecommendationsApi';
import { createFakeRequirementsApi } from './fakeRequirementsApi';

type Options = {
  /** The database to use. Defaults to an empty in-memory one, so tests never reach a real server. */
  api?: ApplicationsApi;
  /** The same for checklist items. */
  requirementsApi?: RequirementsApi;
  /** The same for recommenders and their letters. */
  recommendationsApi?: RecommendationsApi;
};

/** Renders the whole app at `path`. A null `client` means Supabase is not configured. */
export function renderApp(
  path: string,
  client: AuthClient | null,
  {
    api = createFakeApplicationsApi().api,
    requirementsApi = createFakeRequirementsApi().api,
    recommendationsApi = createFakeRecommendationsApi().api,
  }: Options = {},
) {
  const queryClient = createQueryClient({ retry: false });
  const result = render(
    <ThemeProvider>
      <AuthProvider client={client}>
        <ApplicationsApiContext value={api}>
          <RequirementsApiContext value={requirementsApi}>
            <RecommendationsApiContext value={recommendationsApi}>
              <QueryProvider client={queryClient}>
                <MemoryRouter initialEntries={[path]}>
                  <App />
                </MemoryRouter>
              </QueryProvider>
            </RecommendationsApiContext>
          </RequirementsApiContext>
        </ApplicationsApiContext>
      </AuthProvider>
    </ThemeProvider>,
  );
  return { ...result, api, requirementsApi, recommendationsApi, queryClient };
}
