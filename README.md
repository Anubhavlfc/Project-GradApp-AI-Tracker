# Application Command Center (working name)

A tracker for graduate school applications: programs, deadlines, requirements, recommendation
letters, funding, and decisions in one workspace. The product name lives in
`src/config/brand.ts` so it is easy to change.

**Status:** rebuild in progress, phase by phase. Accounts, the database with per-user data
isolation, application tracking, a requirements checklist for every program, recommendation
letters, funding, documents, tasks, notes and a deadlines list are in place: add a program, then
search, filter, sort, edit, star, change its status, and delete it, with fees and decisions
recorded; tick off what each program asks for (essays, transcripts, test scores, letters) while
the list shows how far along each one is; keep a list of recommenders with who has been asked for
which letter, when it is due, and whether it has been sent; track scholarships, fellowships and
assistantships with amounts, deadlines and where each one stands; keep a library of your resume,
statements and score reports, with the document each checklist item will use; keep a to-do list,
for one program or for none, and free-form notes on every program; and see every date you have
written down, from all of those, in one list, soonest first. The full dashboard arrives in the
next phase.

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
  applications, requirements, recommenders, funding, documents, tasks, notes and deadlines screens
  (against in-memory fakes of the data layer).
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
  features/recommendations/
                       recommenders and their letter requests: statuses, deadline rules
                       (logic.ts), data layer, dialogs, and the cards and rows that show them
  features/funding/    scholarships, fellowships and assistantships: types and statuses (kinds.ts),
                       money and deadline rules (logic.ts), data layer, dialog, and the rows,
                       totals and list cell that show them
  features/documents/  your resume, statements and score reports: types and statuses (kinds.ts),
                       which document suits which checklist item (logic.ts), data layer, dialogs,
                       and the rows and the per-item document choice that show them
  features/tasks/      to-dos, for one program or none: statuses and priorities (kinds.ts), ordering,
                       filters and summary (logic.ts), data layer, dialog, and the rows and cards
  features/deadlines/  the one list of every date (logic.ts collects and groups them from the other
                       features' cached lists), the hook that reads those lists, and the row
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

## How recommenders are loaded

Recommenders and their letter requests follow the same pattern: two cached lists (one request
each), read by the Recommenders page, a program's Recommendations tab and its Overview card, so
they can never disagree. A **recommender** is a person; a **letter request** is one person's letter
for one program, with a status (Not Requested, Requested, Confirmed, Submitted, Needs Follow-Up), the
date it was asked for, and its own deadline (which starts as the program's). A person can be asked
about many programs but only once per program (the database enforces that). Deleting a recommender
removes their requests; deleting a program removes its requests and keeps the people. Marking a
letter Requested notes today as the date asked unless a date is already there. A letter's deadline
is never shown as overdue once it is Submitted or once the program itself has been sent, decided or
withdrawn.

## How funding is loaded

Funding follows the same pattern: one cached list of every item (`useFundingQuery`, one request),
read by the Funding page, a program's Funding tab and Overview card, and the Funding column and
filter of the applications list, so they can never disagree. An item may belong to a program or to
none (an outside scholarship). Deleting a program removes its items and keeps the ones tied to
none. Status changes are applied immediately and undone with a message if the server refuses.

- **Money** is added up per currency and never mixed: _Accepted_ is what you have said yes to,
  _Offered_ is waiting for your answer, and _Waiting to hear_ is what you have applied for.
  Amounts are added in cents, so small amounts never pick up rounding errors. Items without an
  amount add nothing.
- **A funding deadline** is something to act on only while the item is Researching or Applying. It
  is never shown as overdue once you have applied or been answered, or once the program is
  rejected or withdrawn. Unlike an application deadline, a submitted program does not close it: a
  scholarship can be due after the application itself is in.
- **In the applications list** the Funding column shows the best news for each program (Accepted,
  then Offered, then "N being pursued", then "None available"), and the filter finds programs with
  funding offered, funding still being pursued, or none tracked. While funding is loading or could
  not be loaded the filter is not applied, and the page says so, rather than claiming no program has
  funding.

## How documents are loaded

Documents follow the same pattern: one cached list of everything in your library
(`useDocumentsQuery`, one request), read by the Documents page and every program's Documents tab,
so they can never disagree. A **document** is something you send with an application (a resume, a
statement of purpose, a transcript, a score report) with a status (Not Started, In Progress,
Complete), an optional link to where the file lives (Google Drive, Dropbox), and notes. **Files are
never uploaded**: only the link is stored, so there is no file storage to secure.

The library belongs to you, not to a program. A program's **Documents** tab lists the checklist
items that need a document (resume, essays, transcript, test scores, writing sample, portfolio;
not recommendation letters or the application fee), and each one has a choice of which of your
documents you will send for it. The types that suit the item are offered first (a statement of
purpose item suggests your statements of purpose), but any document can be used for any item, and
one document can serve many items. The choice is saved on the checklist item. Deleting a document
keeps the items that used it and only clears their choice; deleting a program removes its checklist
and keeps your documents.

## How tasks and notes work

Tasks follow the same pattern: one cached list of every task (`useTasksQuery`, one request), read
by the Tasks page, a program's Tasks tab and Overview card, and the Deadlines page, so they can
never disagree. A **task** has a title, an optional due date, a priority (Low, Medium, High), a
status (To Do, In Progress, Complete), notes, and optionally a program; a task tied to none (renew
your passport) is fine. Changing a status is applied immediately and undone with a message if the
server refuses. The database notes when a task was completed (and clears it if the task is
reopened), so the finish time is never up to the browser. Deleting a program removes its tasks and
keeps the ones tied to none.

- **Order:** open tasks come before finished ones, the soonest due date first (overdue ones lead,
  tasks with no date go last), then the more important first, then by title. Finished tasks list
  the most recently finished first.
- **The Tasks page** shows open tasks by default and can show finished ones or everything, for one
  program, all programs, or only the tasks tied to none. The filters live in the page address
  (`?show=all&program=…`), so a view can be bookmarked and survives a reload. An unknown value in
  the address falls back to the default rather than showing nothing.
- **A task's date** is something to act on only while the task is open. Unlike a checklist item or
  a letter, a submitted program does not close it: "send a thank-you note" is still worth doing
  after you submit.
- **Notes** are one free-text field per program (up to 10,000 characters), on its **Notes** tab and
  shown on its Overview. Unsaved text is kept while you move between tabs and pages (for each
  program, until you save, discard or sign out); closing or reloading the browser page with
  something unsaved asks first. A save that fails keeps what you typed, and the box is read-only
  while a save is on its way so that nothing typed in that moment is lost.
- **Days roll over by themselves.** "Due tomorrow" turns into "Due today" at midnight on a page
  that was left open, and a page that was asleep through midnight checks again when it is shown
  (`useToday`), without reading anything from the server.

## How deadlines are collected

The **Deadlines** page stores nothing. It works out one list from the same cached data the other
screens show (programs, checklist items, letters, funding, tasks), so it costs no requests of its
own and can never disagree with them; a change made anywhere shows up there at once.

Each date is listed with what it is, which program it is for, and how far away it is, and links to
the place where you can deal with it. The sources are: a program's application deadline and
priority deadline, its interview, the date to reply to an offer, checklist items, letters,
funding, and tasks. Dates are grouped as Overdue, Today, Next 7 days, Next 30 days and Later, and
listed soonest first; on the same day they follow a fixed order (application, priority,
interview, reply to offer, checklist, letter, funding, task).

**History is left out**, exactly as the screens each date comes from treat it: a finished checklist
item, a letter that was sent, a scholarship you have applied for, a completed task, the deadlines
of a program that was submitted, decided or withdrawn, and the interview or offer of a program that
was rejected or withdrawn. An interview that has already happened is not something you are late
for. Interview times are shown in your own time zone. If one list cannot be loaded, the rest still
show, and the page says which dates are missing and offers to try again.

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
