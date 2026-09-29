# Application Command Center (working name)

A tracker for graduate school applications: programs, deadlines, requirements, recommendation
letters, funding, and decisions in one workspace. The product name lives in
`src/config/brand.ts` so it is easy to change.

**Status:** rebuild in progress. The app is currently a bare shell (landing page, `/app`
placeholder). Auth, database, and features arrive in later phases.

## Stack

React + TypeScript, Vite, Tailwind CSS 3, React Router. Planned: Supabase (Auth, Postgres, RLS),
Zod, TanStack Query, deployment on Vercel.

## Development

```bash
npm install
npm run dev          # http://localhost:3000
npm run lint
npm run typecheck
npm test
npm run build
```

Copy `.env.example` to `.env.local` for environment variables (only public values; nothing is
read yet). Never put secret keys in `VITE_*` variables.

## Design system

- **Tokens:** colors, focus ring, and dark mode live in `src/styles/index.css` (CSS variables) and
  `tailwind.config.ts`. Light and dark are tuned separately, not inverted. Use the semantic classes
  (`bg-surface`, `text-fg-muted`, `border-border`, `bg-accent`, `bg-tone-blue/10`), not raw colors.
- **Theme:** light, dark, or system, saved in `localStorage`; `index.html` applies it before first
  paint. Use `useTheme()` from `src/theme/useTheme.ts`.
- **Components:** `src/components/ui` (buttons, form fields, cards, table, badges, modal, menu,
  alerts, progress, skeletons, empty state). Import from `@/components/ui`.
- **Layout:** `src/components/layout/AppShell.tsx` (collapsible sidebar; drawer below 1024px).
  Add a nav entry in `src/config/nav.ts` only when its page exists.
- **Statuses:** the 12 application statuses and their colors are defined once in
  `src/features/applications/status.ts`.
- **Gallery:** `npm run dev`, then open `/app/design-system` (development only; not in production
  builds).

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, and build on every PR.
