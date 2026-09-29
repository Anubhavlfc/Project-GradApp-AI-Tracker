import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AuthProvider } from './AuthProvider';
import { GuestOnly, RequireAuth } from './RouteGuards';

function Where() {
  const { pathname, search } = useLocation();
  return <p>at {pathname + search}</p>;
}

function renderRoutes(path: string, fake = createFakeAuth()) {
  render(
    <ThemeProvider>
      <AuthProvider client={fake.client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<GuestOnly />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route path="/app/*" element={<Where />} />
            </Route>
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>,
  );
  return fake;
}

describe('route guards', () => {
  it('lets signed-in people through to protected pages', async () => {
    renderRoutes('/app/anything', createFakeAuth(fakeSession()));
    expect(await screen.findByText('at /app/anything')).toBeInTheDocument();
  });

  it('turns signed-out visitors away from protected pages', async () => {
    renderRoutes('/app/anything');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText(/^at /)).not.toBeInTheDocument();
  });

  it('brings people back to the page they wanted after they sign in', async () => {
    const fake = renderRoutes('/app/applications?status=submitted');
    await screen.findByRole('heading', { name: 'Sign in' });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('at /app/applications?status=submitted')).toBeInTheDocument();
    expect(fake.client.signInWithPassword).toHaveBeenCalledTimes(1);
  });

  it('keeps signed-in people off the login page', async () => {
    renderRoutes('/login', createFakeAuth(fakeSession()));
    expect(await screen.findByText('at /app')).toBeInTheDocument();
  });
});
