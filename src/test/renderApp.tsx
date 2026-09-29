import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { App } from '@/App';
import { AuthProvider, type AuthClient } from '@/features/auth/AuthProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';

/** Renders the whole app at `path`. A null `client` means Supabase is not configured. */
export function renderApp(path: string, client: AuthClient | null) {
  return render(
    <ThemeProvider>
      <AuthProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>,
  );
}
