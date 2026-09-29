import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { App } from './App';
import { brand } from './config/brand';
import { ThemeProvider } from './theme/ThemeProvider';

function renderAt(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('routing', () => {
  it('renders the landing page at /', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: brand.tagline })).toBeInTheDocument();
  });

  it('renders the dashboard inside the app shell at /app', () => {
    renderAt('/app');
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No applications yet.' })).toBeInTheDocument();
    const link = screen.getAllByRole('link', { name: 'Dashboard' })[0];
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('renders a not-found page for unknown routes', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('lists only navigation items for pages that exist', () => {
    renderAt('/app');
    const nav = screen.getAllByRole('navigation', { name: 'Primary' })[0];
    expect(nav?.querySelectorAll('a')).toHaveLength(1);
  });
});

describe('app shell', () => {
  it('collapses the sidebar and remembers the choice', () => {
    const { unmount } = renderAt('/app');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    unmount();

    renderAt('/app');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });

  it('opens and closes the mobile navigation drawer', () => {
    renderAt('/app');
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const drawer = screen.getByRole('dialog', { name: 'Navigation', hidden: true });
    expect(drawer).toHaveAttribute('open');
    fireEvent.click(screen.getByRole('button', { name: 'Close navigation', hidden: true }));
    expect(drawer).not.toHaveAttribute('open');
  });
});
