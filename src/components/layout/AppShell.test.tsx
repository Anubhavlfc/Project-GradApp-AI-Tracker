import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import { renderApp } from '@/test/renderApp';

const deadlines = vi.hoisted(() => ({ broken: true }));

// A page that throws while drawing, standing in for any bug that would otherwise blank the app.
vi.mock('@/pages/DeadlinesPage', () => ({
  DeadlinesPage: () => {
    if (deadlines.broken) throw new Error('kaboom');
    return <h1>Deadlines are fine</h1>;
  },
}));

let logged: MockInstance<typeof console.error>;
beforeEach(() => {
  deadlines.broken = true;
  logged = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  logged.mockRestore();
});

const openBrokenPage = () => renderApp('/app/deadlines', createFakeAuth(fakeSession()).client);

describe('when a page fails to draw', () => {
  it('shows a message with a way forward instead of a blank page, and keeps the menu', async () => {
    openBrokenPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on this page');
    expect(screen.getAllByRole('link', { name: 'Applications' })[0]).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute('href', '/app');
    // The person sees plain words, not the error.
    expect(screen.queryByText(/kaboom/)).not.toBeInTheDocument();
  });

  it('recovers when the person opens another page from the menu', async () => {
    openBrokenPage();
    await screen.findByRole('alert');
    fireEvent.click(screen.getAllByRole('link', { name: 'Tasks' })[0]!);
    expect(await screen.findByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('draws the page again on "Try again" once the cause is gone', async () => {
    openBrokenPage();
    await screen.findByRole('alert');
    deadlines.broken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Deadlines are fine' })).toBeInTheDocument();
  });

  it('fails again, without breaking anything else, on a page that is still broken', async () => {
    openBrokenPage();
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on this page');
    expect(screen.getAllByRole('link', { name: 'Dashboard' })[0]).toBeInTheDocument();
  });
});
