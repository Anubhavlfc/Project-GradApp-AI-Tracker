import type { Config } from 'tailwindcss';

// Design tokens (colors, type scale, radii) are defined in Phase 3.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
