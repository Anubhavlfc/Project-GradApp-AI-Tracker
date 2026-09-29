import { render } from '@testing-library/react';
import themeInit from '../../public/theme-init.js?raw';
import { ThemeProvider } from './ThemeProvider';

// public/theme-init.js runs before the app does, so nobody sees a flash of the wrong theme. These
// tests run that very file and check that it decides exactly what ThemeProvider decides later.

function setSystemDark(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function resetPage() {
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = '';
}

function appliedTheme() {
  return {
    dark: document.documentElement.classList.contains('dark'),
    colorScheme: document.documentElement.style.colorScheme,
  };
}

function runThemeInit() {
  // The browser runs the file as a classic script; a function body behaves the same way here.
  new Function(themeInit)();
}

describe('public/theme-init.js', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['dark', false, true],
    ['light', true, false],
    ['system', true, true],
    ['system', false, false],
  ])('for a saved "%s" theme and a dark system of %s, dark is %s', (saved, systemDark, dark) => {
    setSystemDark(systemDark);
    window.localStorage.setItem('theme', saved);
    runThemeInit();
    expect(appliedTheme()).toEqual({ dark, colorScheme: dark ? 'dark' : 'light' });
  });

  it('follows the system when nothing is saved', () => {
    setSystemDark(true);
    runThemeInit();
    expect(appliedTheme()).toEqual({ dark: true, colorScheme: 'dark' });
  });

  it('follows the system, and does not throw, when storage is blocked', () => {
    setSystemDark(true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => runThemeInit()).not.toThrow();
    expect(appliedTheme()).toEqual({ dark: true, colorScheme: 'dark' });
  });

  it('stays light, and does not throw, when the browser cannot tell the system setting', () => {
    window.matchMedia = vi.fn().mockImplementation(() => {
      throw new Error('unsupported');
    });
    expect(() => runThemeInit()).not.toThrow();
    expect(appliedTheme()).toEqual({ dark: false, colorScheme: 'light' });
  });

  describe.each([true, false])('when the system prefers dark: %s', (systemDark) => {
    it.each([null, 'light', 'dark', 'system', 'purple', ''])(
      'decides what ThemeProvider decides for a saved value of %j',
      (saved) => {
        setSystemDark(systemDark);
        if (saved !== null) window.localStorage.setItem('theme', saved);

        runThemeInit();
        const early = appliedTheme();
        resetPage();

        const { unmount } = render(
          <ThemeProvider>
            <p>app</p>
          </ThemeProvider>,
        );
        expect(appliedTheme()).toEqual(early);
        unmount();
      },
    );
  });
});
