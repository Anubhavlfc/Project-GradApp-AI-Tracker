import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';
import { AppErrorScreen, PageErrorScreen } from './ErrorScreens';

// React reports every error it hands to a boundary on the console; keep the test output readable
// and check what was logged instead.
let logged: MockInstance<typeof console.error>;
beforeEach(() => {
  logged = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  logged.mockRestore();
});

const state = { broken: true };

function Fragile({ label = 'All good' }: { label?: string }) {
  if (state.broken) throw new Error('kaboom');
  return <p>{label}</p>;
}

function Guarded({ resetKey }: { resetKey?: unknown }) {
  return (
    <ErrorBoundary
      scope="test"
      resetKey={resetKey}
      fallback={({ error, reset }) => (
        <div>
          <p>Failed: {error instanceof Error ? error.message : 'unknown'}</p>
          <button type="button" onClick={reset}>
            Retry
          </button>
        </div>
      )}
    >
      <Fragile />
    </ErrorBoundary>
  );
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    state.broken = false;
  });

  it('shows its children while nothing fails', () => {
    render(<Guarded />);
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('shows the fallback instead of a blank page when a child fails to render', () => {
    state.broken = true;
    render(<Guarded />);
    expect(screen.getByText('Failed: kaboom')).toBeInTheDocument();
    expect(screen.queryByText('All good')).not.toBeInTheDocument();
  });

  it('logs the failure under its scope', () => {
    state.broken = true;
    render(<Guarded />);
    expect(logged.mock.calls.some(([scope]) => scope === '[test]')).toBe(true);
  });

  it('draws the children again when the fallback asks to reset and the cause is gone', () => {
    state.broken = true;
    render(<Guarded />);
    state.broken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('keeps showing the fallback when the reset fails again', () => {
    state.broken = true;
    render(<Guarded />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByText('Failed: kaboom')).toBeInTheDocument();
  });

  it('recovers when the reset key changes, so moving to another page clears a failure', () => {
    state.broken = true;
    const { rerender } = render(<Guarded resetKey="/one" />);
    expect(screen.getByText('Failed: kaboom')).toBeInTheDocument();
    state.broken = false;
    rerender(<Guarded resetKey="/two" />);
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('does not clear a failure that the change of key itself caused', () => {
    const { rerender } = render(<Guarded resetKey="/one" />);
    expect(screen.getByText('All good')).toBeInTheDocument();
    state.broken = true;
    rerender(<Guarded resetKey="/two" />);
    expect(screen.getByText('Failed: kaboom')).toBeInTheDocument();
  });

  it('leaves a failure alone while the reset key stays the same', () => {
    state.broken = true;
    const { rerender } = render(<Guarded resetKey="/one" />);
    state.broken = false;
    rerender(<Guarded resetKey="/one" />);
    expect(screen.getByText('Failed: kaboom')).toBeInTheDocument();
  });
});

describe('PageErrorScreen', () => {
  const renderScreen = (error: unknown, reset = vi.fn()) => {
    render(
      <MemoryRouter>
        <PageErrorScreen error={error} reset={reset} />
      </MemoryRouter>,
    );
    return reset;
  };

  it('says what happened and offers to try again or go to the dashboard', () => {
    const reset = renderScreen(new Error('kaboom'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Something went wrong on this page' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute('href', '/app');
  });

  it('never shows the technical message to the person', () => {
    renderScreen(new Error('Cannot read properties of undefined'));
    expect(screen.queryByText(/cannot read properties/i)).not.toBeInTheDocument();
  });

  it.each([
    'Failed to fetch dynamically imported module: https://example.com/assets/x.js',
    'error loading dynamically imported module',
    'Importing a module script failed.',
  ])('asks for a reload when part of the app could not be downloaded (%s)', (message) => {
    renderScreen(new Error(message));
    expect(
      screen.getByRole('heading', { level: 1, name: "This page couldn't be loaded" }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    // Trying the same download again in place would not help after an update.
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});

describe('AppErrorScreen', () => {
  it('works with no router or provider around it, and links home with a plain link', () => {
    render(<AppErrorScreen error={new Error('kaboom')} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
  });

  it('has its own wording for a part of the app that could not be downloaded', () => {
    render(<AppErrorScreen error={new Error('Failed to fetch dynamically imported module: x')} />);
    expect(screen.getByRole('heading', { name: "The app couldn't be loaded" })).toBeInTheDocument();
  });
});
