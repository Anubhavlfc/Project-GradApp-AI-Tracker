import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { lazyComponent } from './lazyComponent';

function Loaded() {
  return <p>The loaded page</p>;
}

function renderLazy(Lazy: ReturnType<typeof lazyComponent>) {
  return render(
    <ErrorBoundary scope="test" fallback={({ error }) => <p>Failed: {String(error)}</p>}>
      <Suspense fallback={<p>Loading…</p>}>
        <Lazy />
      </Suspense>
    </ErrorBoundary>,
  );
}

let logged: MockInstance<typeof console.error>;
beforeEach(() => {
  logged = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  logged.mockRestore();
});

describe('lazyComponent', () => {
  it('shows the fallback while the code downloads, then the component', async () => {
    let arrive: (module: { default: typeof Loaded }) => void = () => {};
    const Lazy = lazyComponent(
      () =>
        new Promise((resolve) => {
          arrive = resolve;
        }),
    );
    renderLazy(Lazy);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    arrive({ default: Loaded });
    expect(await screen.findByText('The loaded page')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('renders at once, with no fallback, when the code was preloaded', async () => {
    const Lazy = lazyComponent(() => Promise.resolve({ default: Loaded }));
    await Lazy.preload();
    renderLazy(Lazy);
    expect(screen.getByText('The loaded page')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('downloads only once, however often it is preloaded or rendered', async () => {
    const load = vi.fn(() => Promise.resolve({ default: Loaded }));
    const Lazy = lazyComponent(load);
    void Lazy.preload();
    void Lazy.preload();
    renderLazy(Lazy);
    await screen.findByText('The loaded page');
    renderLazy(Lazy);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('reports a failed download to the nearest error boundary', async () => {
    const Lazy = lazyComponent(() => Promise.reject(new Error('offline')));
    renderLazy(Lazy);
    expect(await screen.findByText('Failed: Error: offline')).toBeInTheDocument();
  });

  it('recovers by itself if the code arrives later, for instance from a second preload', async () => {
    const load = vi
      .fn<() => Promise<{ default: typeof Loaded }>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ default: Loaded });
    const Lazy = lazyComponent(load);
    const first = renderLazy(Lazy);
    await screen.findByText('Failed: Error: offline');
    first.unmount();

    await Lazy.preload();
    renderLazy(Lazy);
    expect(screen.getByText('The loaded page')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('lets an early preload fail quietly and still recovers when the page needs it', async () => {
    const load = vi
      .fn<() => Promise<{ default: typeof Loaded }>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ default: Loaded });
    const Lazy = lazyComponent(load);
    await expect(Lazy.preload()).rejects.toThrow('offline');
    renderLazy(Lazy);
    expect(await screen.findByText('The loaded page')).toBeInTheDocument();
  });
});
