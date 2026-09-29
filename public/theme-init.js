// Applies the saved theme before the first paint, so someone who prefers dark mode never sees a
// light flash. It is a file of its own, not an inline script, so that the Content-Security-Policy
// in vercel.json can forbid inline scripts altogether.
// Keep in sync with src/theme/ThemeProvider.tsx (src/theme/themeInit.test.tsx checks that it is).
(function () {
  var stored = null;
  var systemDark = false;
  try {
    stored = localStorage.getItem('theme');
  } catch (e) {
    // Storage can be blocked (some private windows, strict settings): use the system setting.
  }
  try {
    systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (e) {
    // No matchMedia: stay light.
  }
  var dark = stored === 'dark' || (stored !== 'light' && systemDark);
  var root = document.documentElement;
  if (dark) root.classList.add('dark');
  root.style.colorScheme = dark ? 'dark' : 'light';
})();
