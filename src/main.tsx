import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import '@fontsource-variable/inter';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { AppErrorScreen } from '@/components/errors/ErrorScreens';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { QueryProvider } from '@/lib/QueryProvider';
import { preloadSignedInApp } from '@/signedIn';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { App } from './App';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

// Someone opening the app itself (a bookmark, a reload) needs its code as early as possible, in
// parallel with the sign-in check rather than after it.
if (window.location.pathname.startsWith('/app')) preloadSignedInApp();

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary scope="app" fallback={({ error }) => <AppErrorScreen error={error} />}>
      <ThemeProvider>
        <AuthProvider>
          <QueryProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </QueryProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
