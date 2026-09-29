import { fireEvent, screen } from '@testing-library/react';
import { brand } from './config/brand';
import { createFakeAuth, fakeSession } from './test/fakeAuth';
import { renderApp } from './test/renderApp';

function renderSignedIn(path: string) {
  return renderApp(path, createFakeAuth(fakeSession()).client);
}

describe('routing', () => {
  it('renders the landing page at / with ways in for visitors', async () => {
    renderApp('/', createFakeAuth().client);
    expect(screen.getByRole('heading', { name: brand.tagline })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('offers signed-in people a way straight into the app from the landing page', async () => {
    renderSignedIn('/');
    expect(await screen.findByRole('link', { name: 'Open the app' })).toHaveAttribute(
      'href',
      '/app',
    );
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('renders the dashboard inside the app shell at /app', async () => {
    renderSignedIn('/app');
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No applications yet.' })).toBeInTheDocument();
    const link = screen.getAllByRole('link', { name: 'Dashboard' })[0];
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('renders a not-found page for unknown routes', () => {
    renderApp('/nope', createFakeAuth().client);
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('lists only navigation items for pages that exist', async () => {
    renderSignedIn('/app');
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
    const nav = screen.getAllByRole('navigation', { name: 'Primary' })[0];
    expect(nav?.querySelectorAll('a')).toHaveLength(1);
  });
});

describe('app shell', () => {
  it('collapses the sidebar and remembers the choice', async () => {
    const { unmount } = renderSignedIn('/app');
    fireEvent.click(await screen.findByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    unmount();

    renderSignedIn('/app');
    expect(await screen.findByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });

  it('opens and closes the mobile navigation drawer', async () => {
    renderSignedIn('/app');
    fireEvent.click(await screen.findByRole('button', { name: 'Open navigation' }));
    const drawer = screen.getByRole('dialog', { name: 'Navigation', hidden: true });
    expect(drawer).toHaveAttribute('open');
    fireEvent.click(screen.getByRole('button', { name: 'Close navigation', hidden: true }));
    expect(drawer).not.toHaveAttribute('open');
  });
});
