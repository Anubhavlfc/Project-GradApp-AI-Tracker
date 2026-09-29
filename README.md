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

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, and build on every PR.
