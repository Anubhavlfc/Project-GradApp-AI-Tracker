# Application Command Center (working name)

A tracker for graduate school applications: programs, deadlines, requirements, recommendation
letters, funding, and decisions in one workspace. The product name lives in
`src/config/brand.ts` so it is easy to change.

**Status:** rebuild in progress, phase by phase. Accounts, the database with per-user data
isolation, application tracking, and a requirements checklist for every program are in place: add a
program, then search, filter, sort, edit, star, change its status, and delete it, with fees and
decisions recorded, and tick off what each program asks for (essays, transcripts, test scores,
letters) while the list shows how far along each one is. Recommenders, funding, deadlines and
tasks, and the full dashboard arrive in the next phases.

## Stack

React + TypeScript, Vite, Tailwind CSS 3, React Router, Zod, TanStack Query, and Supabase (Auth,
Postgres with row level security). Planned: deployment on Vercel.

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

- `npm run test:app`: components, routing, the sign-in flows (against a fake auth client), and the
  applications and requirements screens (against in-memory fakes of the data layer).
- `npm run test:db`: applies the real migrations to an in-process Postgres (PGlite, no Docker) and
  proves that one user cannot read, change, or attach to another user's rows, that signed-out
  visitors get nothing, that constraints reject bad data, and that what the add/edit forms send is
  accepted by the real tables.

## Project layout

```
src/
  components/ui/       design-system components (import from "@/components/ui")
  components/layout/   app shell, sidebar, account menu
  config/              brand name and navigation (one place to change each)
  features/auth/       AuthProvider, route guards, form schemas, friendly error messages
  features/applications/
                       data layer (api.ts, hooks.ts), form and list-view logic, dates and fees,
                       and the table, cards, toolbar and form components
  features/requirements/
                       a program's checklist: item types and statuses (kinds.ts), the completion
                       arithmetic (progress.ts), data layer, dialogs, and the progress meter
  lib/                 supabase client, query client, form helpers, small utilities
  pages/               route-level pages (pages/auth for sign-in, pages/applications for programs)
  theme/               light / dark / system
supabase/
  migrations/          the database schema and security rules (apply in order)
  tests/               database tests and their Postgres/Supabase test harness
  verify-setup.sql     read-only checks to run on a real project
docs/                  setup guides
```

## How applications are loaded

Every screen reads programs from one cached list (`useApplicationsQuery`, one request that includes
each program's university). The details page finds its program in that list, so the list and the
details can never disagree, and an edit shows up everywhere at once. Status changes and stars are
applied immediately and undone with a message if the server refuses. The cache is per person and is
cleared on sign-out. The list's search, filters, and sort live in the page address, so a view can
be bookmarked and survives a reload.

## How requirements are loaded

Checklist items follow the same pattern as programs: one cached list of every item on every
program (`useRequirementsQuery`, one request), read by the program's Requirements tab, its Overview
card, and the Completion column of the applications list, so the three can never disagree. It is
per person and cleared on sign-out, and deleting a program removes its items from it. Changing an
item's status is applied immediately and undone with a message if the server refuses.

**Completion** is the share of a program's _required_ items that are Complete or Submitted (for
example 8 of 11, 73%). Optional items never count, a program with no required items has no
percentage (shown as a dash), and rounding never claims more than is true: it is 100% only when
every required item is done, and never 0% once one is.

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
