# Deploying to production

This takes the app from this repository to a live website on **Vercel**, backed by a **Supabase**
project. Allow about 45 minutes, most of it clicking through dashboards. Both services have free
plans; read their current terms (a free Supabase project can be paused after a period of
inactivity, and its built-in email sender is limited).

Dashboard menu names change from time to time. If a label below doesn't match, search the dashboard
for the setting by name.

## What has and hasn't been verified

Be clear about this before you launch, so a surprise doesn't land on a real user.

**Verified here**

- **The code.** Lint, types, 1,900+ unit and component tests and the production build all pass
  (`npm run lint`, `typecheck`, `test`, `build`; CI runs them on every pull request).
- **The database rules.** One user can never read or change another's rows. The real migrations
  are applied to a real Postgres engine with the same roles as Supabase (`npm run test:db`).
- **Every screen and the full journey.** Sign up, add programs, checklists, letters, funding,
  tasks, deadlines, the dashboard, settings, sign out, sign in again, data still there: driven in a
  real browser (Chromium) against a real PostgreSQL 16, the same data API Supabase uses
  (PostgREST) and signed JWTs, with a stand-in for the sign-in server. That test kit lives with the
  project files, not in this repository, because it needs Postgres 16, PostgREST and Chromium.
- **The production build with the security headers** from `vercel.json`: the same browser, the
  built files, served by a small stand-in server that applies the headers and the rewrite from
  that file. A tab left open across an update shows a friendly screen instead of a blank page.

**Not verified yet**

- **A real hosted Supabase project** (none was available to build against). Follow the manual test
  in [supabase-setup.md](supabase-setup.md#7-manual-test-on-your-own-project), and try **Settings →
  Delete account** on a spare account.
- **The Vercel deployment itself**, including that Vercel honours `vercel.json` exactly as tested.
  After the first deploy, run the checks in [Step 4](#step-4-create-your-account-and-test).
- **Real email delivery** (confirmation and reset links). Test both flows in Step 4.
- **Firefox and Safari** (only Chromium was available). Click through the app once in each.

## Before you start

1. **Rotate exposed keys.** An OpenRouter API key sits in this repository's old git history
   (`HOW_TO_RUN.md`, before the rebuild), and a Serper key was pasted into a chat. Neither is used
   by the app any more. Revoke both at their providers; deleting the file does not remove a key
   from history.
2. **Pick the name.** The product name, tagline and description live in `src/config/brand.ts`.
   Change them there and the page title and link previews follow.
3. **Check the code locally** (Node 20 or newer):

   ```bash
   npm ci
   npm run lint && npm run typecheck && npm test && npm run build
   ```

   All four should finish without errors. `npm run preview` then serves the built site at
   <http://localhost:4173> (without the Vercel headers).

## Step 1: Create the Supabase project

Follow [supabase-setup.md](supabase-setup.md) sections 1 to 3. In short:

1. Create a project (choose a region near you; store the database password in a password manager).
2. In **SQL Editor**, run the three files in `supabase/migrations/` **in order**, each once, on an
   empty project: `20260929000000_initial_schema.sql`, `20260930000000_activity_feed.sql`, then
   `20261001000000_delete_account.sql`.
3. Run `supabase/verify-setup.sql`. Every row of the result must say `true`. Also open **Database →
   Advisors** and confirm there are no security errors.
4. **Authentication → Providers → Email**: enabled, **Confirm email** on, minimum password length 8
   or more.
5. Copy the project URL and the **publishable** key (or the legacy `anon` key) from **Project
   Settings → API**. You will need both in Step 2.

**Never copy the `service_role` or secret key anywhere in this project.** Nothing here needs it, and
the build refuses to run if it finds one in `VITE_SUPABASE_ANON_KEY`.

## Step 2: Create the Vercel project

1. Sign in to [vercel.com](https://vercel.com), choose **Add New… → Project**, and import this
   repository from GitHub.
2. Vercel detects **Vite**. Check these settings:

   | Setting          | Value                                            |
   | ---------------- | ------------------------------------------------ |
   | Framework Preset | Vite                                             |
   | Build Command    | `npm run build` (type checks first, then builds) |
   | Output Directory | `dist`                                           |
   | Install Command  | `npm install` (or `npm ci`)                      |
   | Node.js Version  | 20.x or newer                                    |

3. Open **Environment Variables** and add these for **Production** and **Preview**:

   | Name                     | Value                              | Notes                                                                   |
   | ------------------------ | ---------------------------------- | ----------------------------------------------------------------------- |
   | `VITE_SUPABASE_URL`      | `https://YOUR-PROJECT.supabase.co` | from Step 1                                                             |
   | `VITE_SUPABASE_ANON_KEY` | the publishable or `anon` key      | public by design; row level security protects the data                  |
   | `VITE_SITE_URL`          | `https://your-address`             | optional, recommended: adds the canonical link and link-preview address |

   These are copied into the JavaScript at **build time**, so **redeploy after changing any of
   them**. Do not add any other secret; the app has no server code and needs none.

4. Choose **Deploy**. When it finishes, open the address Vercel shows you. You should see the
   landing page. (If you see "Sign-in isn't set up yet" on the sign-in page, the two Supabase
   variables were missing when it was built.)

## Step 3: Tell Supabase where the site lives

Under **Authentication → URL Configuration**:

- **Site URL**: your live address, for example `https://your-app.vercel.app`.
- **Redirect URLs**: add
  - `https://your-app.vercel.app/**` (and your custom domain, if any, with `/**`)
  - `http://localhost:3000/**` for local development
  - `https://*-YOUR-TEAM.vercel.app/**` if you want sign-in to work on Vercel preview deployments

The confirmation link returns to `/app` and the password reset link to `/reset-password`. An
address that isn't on the list sends people to the Site URL instead, and the reset form never
appears.

For anyone other than yourself, also set up **SMTP** (custom email sending) under **Authentication →
Emails → SMTP Settings**: the built-in sender is meant for testing and is heavily rate limited.

## Step 4: Create your account and test

1. Open `/signup`, create your account, and click the link in the confirmation email. You land on
   the dashboard.
2. Run the checks below. They take about ten minutes and cover what could not be verified earlier.

   - [ ] **Headers.** In a terminal: `curl -sI https://YOUR-ADDRESS/ | grep -i -E 'content-security|x-frame|strict-transport'`
         shows the three headers. Open the browser console on a few pages: no red "Refused to…"
         messages.
   - [ ] **Deep link.** Open `https://YOUR-ADDRESS/app/tasks` directly (or press reload there):
         the app loads, not a 404.
   - [ ] **Sign out, sign in.** The dashboard remembers your data.
   - [ ] **Forgot password.** The email arrives, the link opens the reset form, and the new
         password works; the old one doesn't.
   - [ ] **Your data.** Add a program, a checklist item, a recommender, a task. Reload: still
         there. In the Supabase **Table Editor** the rows have your `user_id`.
   - [ ] **Privacy.** Sign up a second account. Its Applications, Tasks and Dashboard are empty,
         and pasting the address of one of your programs shows "Program not found".
   - [ ] **Settings.** Change the theme (it survives a reload); **Download my data** saves a
         `.json` file that contains your programs; with the _second_ account, **Delete account**
         works and the account is gone from **Authentication → Users**.
   - [ ] **Phone.** Open the site on a phone: nothing runs off the screen sideways.

3. Optional: once your account exists, turn off **Allow new users to sign up** (Authentication
   settings) to keep the app private until you decide to launch.
4. Optional: to fill a separate demo account for screenshots or a portfolio walkthrough, see
   "Sample data for demos" in the [README](../README.md).

## Step 5: A custom domain (optional)

1. In Vercel: **Settings → Domains**, add your domain, and follow the DNS instructions.
2. Update **Site URL** and **Redirect URLs** in Supabase (Step 3) to the new address.
3. Change `VITE_SITE_URL` to it and **redeploy**.

If you use a **custom domain for Supabase itself** (not `*.supabase.co`), add it to `connect-src` in
`vercel.json`, or the browser will refuse the app's requests. See below.

## The security headers

`vercel.json` sends these with every page. They cost nothing and close common holes.

| Header                                                                                                            | What it does                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`                                                                                         | Scripts, styles, fonts and images load only from the site itself; the browser may talk only to the site and `https://*.supabase.co`; the page cannot be framed or have its `<base>` changed; plugins are off. There is **no** `unsafe-inline` or `unsafe-eval` for scripts, which stops injected script from running even if a bug ever let some in. |
| `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` | No content sniffing; no framing; a short `Referer`; camera, microphone, location, payment and USB switched off; HTTPS only.                                                                                                                                                                                                                          |
| `X-Robots-Tag: noindex`                                                                                           | On `/app/…`, `/forgot-password` and `/reset-password`, so search engines skip them (`robots.txt` also hides `/app`).                                                                                                                                                                                                                                 |
| `Cache-Control: immutable`                                                                                        | On the fingerprinted files in `/assets`, so a returning visitor downloads nothing that has not changed.                                                                                                                                                                                                                                              |

Consequences to know about:

- **No inline scripts or styles.** The theme is applied by `public/theme-init.js` (a file) so that
  the policy can forbid inline script. `src/lib/securityHeaders.test.ts` fails the tests (and so
  CI) if an inline script or style is added to `index.html`, or if the policy is loosened.
- **A custom Supabase domain, or a new service** (analytics, fonts from elsewhere, an image host)
  must be added to the matching directive in `vercel.json` (`connect-src`, `font-src`, …).
  Symptom when one is missing: a request fails and the console says "Refused to connect".
- **Changing a header** takes effect on the next deployment.

## Running it

- **Your own backup.** **Settings → Download my data** saves everything in your account as one
  file. Supabase's automatic backups depend on your plan; check what yours includes.
- **Rolling back.** In Vercel, open **Deployments**, choose an earlier good one, and promote it to
  production. People who had the app open during the change see "The app couldn't be loaded" and
  **Reload page** fetches the current version.
- **Changing the database.** Add a new migration file with a later timestamp and run it in the SQL
  Editor. Never edit a migration that has already been applied. New tables need row level
  security; the tests in `supabase/tests/rls.test.ts` fail if it is missing.
- **Keeping dependencies fresh.** `npm audit` (0 known vulnerabilities at the time of writing),
  then `npm update` and the four checks from "Before you start". CI runs them for every pull
  request.
- **Watching for problems.** Vercel shows build and request logs; Supabase shows database and auth
  logs and the **Advisors** page. No error-tracking service is wired in.

## Troubleshooting

| What you see                                                | Likely cause and fix                                                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| "Sign-in isn't set up yet"                                  | The Supabase variables were not set when the site was built. Add them in Vercel and redeploy.                      |
| The build fails with "…is a secret (service_role) key"      | The wrong key is in `VITE_SUPABASE_ANON_KEY`. Use the publishable/anon key, and rotate the secret one in Supabase. |
| Console: "Refused to connect…" or "Refused to load…"        | The policy in `vercel.json` doesn't list that address. Add the Supabase (or other) address to the right directive. |
| Confirmation or reset link opens the wrong site             | **Site URL** in Supabase is still `localhost`. Fix Step 3.                                                         |
| Reset link lands on the sign-in page, no form               | The site isn't in **Redirect URLs**. Add `https://YOUR-ADDRESS/**`.                                                |
| Emails don't arrive                                         | The built-in sender is rate limited. Set up SMTP. Check the spam folder.                                           |
| Lists are empty or say "Unable to load" right after sign-in | A migration wasn't applied. Run `verify-setup.sql`; every row must be `true`.                                      |
| **Delete account** says it couldn't be completed            | `20261001000000_delete_account.sql` wasn't applied. Run it.                                                        |
| A refresh on `/app/tasks` gives a 404                       | The rewrite in `vercel.json` is missing or the file wasn't deployed.                                               |
| "The app couldn't be loaded"                                | A tab was open across a deployment. **Reload page**.                                                               |

## What version 1 does not include

By design (see the project brief): no university catalog, no AI suggestions, no social features, no
payments, no email or push reminders (deadlines are shown in the app), and no mobile app. The data
model and screens leave room to add them later.
