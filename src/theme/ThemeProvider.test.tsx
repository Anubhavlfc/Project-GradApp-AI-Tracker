import { act, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from './ThemeProvider';
import { useTheme } from './useTheme';

function Probe() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <p data-testid="state">{`${theme}/${resolvedTheme}`}</p>
      <button onClick={() => setTheme('dark')}>dark</button>
      <button onClick={() => setTheme('light')}>light</button>
      <button onClick={() => setTheme('system')}>system</button>
    </div>
  );
}

function mockSystemDark(matches: boolean) {
  let listener: ((event: MediaQueryListEvent) => void) | undefined;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: (_: string, callback: (event: MediaQueryListEvent) => void) => {
      listener = callback;
    },
    removeEventListener: vi.fn(),
  }));
  return (next: boolean) => listener?.({ matches: next } as MediaQueryListEvent);
}

describe('ThemeProvider', () => {
  it('defaults to the system preference', () => {
    mockSystemDark(true);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('state')).toHaveTextContent('system/dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('applies and persists an explicit choice', () => {
    mockSystemDark(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText('dark'));
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(window.localStorage.getItem('theme')).toBe('dark');
    fireEvent.click(screen.getByText('light'));
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('restores the saved choice and ignores garbage values', () => {
    mockSystemDark(false);
    window.localStorage.setItem('theme', 'dark');
    const { unmount } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('state')).toHaveTextContent('dark/dark');
    unmount();

    window.localStorage.setItem('theme', 'purple');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('state')).toHaveTextContent('system/light');
  });

  it('follows system changes only while set to system', () => {
    const emit = mockSystemDark(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    act(() => emit(true));
    expect(screen.getByTestId('state')).toHaveTextContent('system/dark');
    fireEvent.click(screen.getByText('light'));
    act(() => emit(true));
    expect(screen.getByTestId('state')).toHaveTextContent('light/light');
  });
});
