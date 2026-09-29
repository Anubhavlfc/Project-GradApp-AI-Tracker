import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import '@fontsource-variable/inter';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { QueryProvider } from '@/lib/QueryProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { App } from './App';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <QueryProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
