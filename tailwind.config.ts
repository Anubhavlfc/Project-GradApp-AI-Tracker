import type { Config } from 'tailwindcss';

// Colors are CSS variables (see src/styles/index.css) holding "R G B" triplets, so light and dark
// are each hand-tuned and Tailwind opacity modifiers (bg-accent/10) still work.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
const tone = (name: string) => ({ DEFAULT: token(`tone-${name}`), fg: token(`tone-${name}-fg`) });

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Inter Variable"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      colors: {
        bg: token('bg'),
        surface: { DEFAULT: token('surface'), muted: token('surface-muted') },
        border: { DEFAULT: token('border'), strong: token('border-strong') },
        fg: { DEFAULT: token('fg'), muted: token('fg-muted'), subtle: token('fg-subtle') },
        accent: {
          DEFAULT: token('accent'),
          hover: token('accent-hover'),
          fg: token('accent-fg'),
          soft: token('accent-soft'),
          'soft-fg': token('accent-soft-fg'),
        },
        danger: { DEFAULT: token('danger'), hover: token('danger-hover'), fg: token('danger-fg') },
        tone: {
          neutral: tone('neutral'),
          blue: tone('blue'),
          indigo: tone('indigo'),
          teal: tone('teal'),
          violet: tone('violet'),
          amber: tone('amber'),
          orange: tone('orange'),
          green: tone('green'),
          red: tone('red'),
        },
      },
      borderColor: { DEFAULT: token('border') },
    },
  },
  plugins: [],
} satisfies Config;
