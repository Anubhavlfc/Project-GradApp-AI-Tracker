import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { App } from '@/App';
import type { ApplicationsApi } from '@/features/applications/api';
import { ApplicationsApiContext } from '@/features/applications/api-context';
import { AuthProvider, type AuthClient } from '@/features/auth/AuthProvider';
import type { DocumentsApi } from '@/features/documents/api';
import { DocumentsApiContext } from '@/features/documents/api-context';
import type { FundingApi } from '@/features/funding/api';
import { FundingApiContext } from '@/features/funding/api-context';
import type { RecommendationsApi } from '@/features/recommendations/api';
import { RecommendationsApiContext } from '@/features/recommendations/api-context';
import type { RequirementsApi } from '@/features/requirements/api';
import { RequirementsApiContext } from '@/features/requirements/api-context';
import { QueryProvider } from '@/lib/QueryProvider';
import { createQueryClient } from '@/lib/queryClient';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { createFakeApplicationsApi } from './fakeApplicationsApi';
import { createFakeDocumentsApi } from './fakeDocumentsApi';
import { createFakeFundingApi } from './fakeFundingApi';
import { createFakeRecommendationsApi } from './fakeRecommendationsApi';
import { createFakeRequirementsApi } from './fakeRequirementsApi';

type Options = {
  /** The database to use. Defaults to an empty in-memory one, so tests never reach a real server. */
  api?: ApplicationsApi;
  /** The same for checklist items. */
  requirementsApi?: RequirementsApi;
  /** The same for recommenders and their letters. */
  recommendationsApi?: RecommendationsApi;
  /** The same for funding. */
  fundingApi?: FundingApi;
  /** The same for documents. */
  documentsApi?: DocumentsApi;
};

/** Renders the whole app at `path`. A null `client` means Supabase is not configured. */
export function renderApp(
  path: string,
  client: AuthClient | null,
  {
    api = createFakeApplicationsApi().api,
    requirementsApi = createFakeRequirementsApi().api,
    recommendationsApi = createFakeRecommendationsApi().api,
    fundingApi = createFakeFundingApi().api,
    documentsApi = createFakeDocumentsApi().api,
  }: Options = {},
) {
  const queryClient = createQueryClient({ retry: false });
  const result = render(
    <ThemeProvider>
      <AuthProvider client={client}>
        <ApplicationsApiContext value={api}>
          <RequirementsApiContext value={requirementsApi}>
            <RecommendationsApiContext value={recommendationsApi}>
              <FundingApiContext value={fundingApi}>
                <DocumentsApiContext value={documentsApi}>
                  <QueryProvider client={queryClient}>
                    <MemoryRouter initialEntries={[path]}>
                      <App />
                    </MemoryRouter>
                  </QueryProvider>
                </DocumentsApiContext>
              </FundingApiContext>
            </RecommendationsApiContext>
          </RequirementsApiContext>
        </ApplicationsApiContext>
      </AuthProvider>
    </ThemeProvider>,
  );
  return {
    ...result,
    api,
    requirementsApi,
    recommendationsApi,
    fundingApi,
    documentsApi,
    queryClient,
  };
}
