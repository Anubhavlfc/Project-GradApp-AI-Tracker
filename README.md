# Application Command Center (working name)

A tracker for graduate school applications: programs, deadlines, requirements, recommendation
letters, funding, and decisions in one workspace. The product name lives in
`src/config/brand.ts` so it is easy to change.

**Status:** rebuild in progress, phase by phase. Sign-up, sign-in, password reset, and the
database with per-user data isolation are in place. Applications, requirements, recommenders,
funding, deadlines, and the dashboard arrive in the next phases, so the signed-in app is still a
shell with an empty dashboard.

## Stack

React + TypeScript, Vite, Tailwind CSS 3, React Router, Zod, and Supabase (Auth, Postgres with row
level security). Planned: TanStack Query, deployment on Vercel.

## Development

```bash
npm install
cp .env.example .env.local   # then fill in the two Supabase values (see below)
npm run dev                  # http://localhost:3000
npm run lint
npm run typecheck
npm test                     # app tests + database tests
npm run build
```

Without Supabase settings the app still runs; the login and app pages show a "Sign-in isn't set
up yet" message and the landing page works.

### Supabase

Accounts and data live in Supabase. **[docs/supabase-setup.md](docs/supabase-setup.md)** explains
creating the project, applying `supabase/migrations`, configuring sign-in, setting the two
environment variables, deploying to Vercel, and creating the first user. It also links the check
script `supabase/verify-setup.sql`, which you run on your project to confirm the security setup.

Only public values go in `VITE_*` variables (they are copied into the browser bundle). The build
refuses to run if the key looks like a `service_role` or secret key.

## Tests

- `npm run test:app`: components, routing, and the sign-in flows (against a fake auth client).
- `npm run test:db`: applies the real migrations to an in-process Postgres (PGlite, no Docker) and
  proves that one user cannot read, change, or attach to another user's rows, that signed-out
  visitors get nothing, and that constraints reject bad data.

## Project layout

```
src/
  components/ui/       design-system components (import from "@/components/ui")
  components/layout/   app shell, sidebar, account menu
  config/              brand name and navigation (one place to change each)
  features/auth/       AuthProvider, route guards, form schemas, friendly error messages
  lib/                 supabase client, form helpers, small utilities
  pages/               route-level pages (pages/auth for sign-in screens)
  theme/               light / dark / system
supabase/
  migrations/          the database schema and security rules (apply in order)
  tests/               database tests and their Postgres/Supabase test harness
  verify-setup.sql     read-only checks to run on a real project
docs/                  setup guides
```

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
