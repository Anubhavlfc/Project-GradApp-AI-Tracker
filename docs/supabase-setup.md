# Supabase setup

This walks through creating the Supabase project that stores accounts and data, connecting the app
to it, and confirming the setup is safe. It takes about 20 minutes.

**What has and hasn't been verified.** The database rules are tested on a real Postgres engine
(PGlite) using the same roles and sign-in mechanism as Supabase (`npm test`). The sign-in screens
are tested against fakes and a mock auth server. The app has **not** yet been run against a real
hosted Supabase project, because none existed when this was built. That is why this guide ends with
a script and a short manual test to run on your own project.

Dashboard menu names change from time to time. If a label below doesn't match, search the dashboard
for the setting by name.

## 1. Create the project

1. Sign in at [supabase.com](https://supabase.com) and choose **New project**.
2. Pick a region close to you and set a database password. Store it in a password manager. The app
   never needs it.
3. Wait until the project finishes setting up.

## 2. Create the tables

The database is described by the files in `supabase/migrations/`. Apply each one once, in order
(there are three so far: `20260929000000_initial_schema.sql`, `20260930000000_activity_feed.sql`,
then `20261001000000_delete_account.sql`).

**Option A: SQL Editor (no tools needed)**

1. Open **SQL Editor** and choose **New query**.
2. Paste the whole contents of `supabase/migrations/20260929000000_initial_schema.sql` and run it.
   It should finish with "Success. No rows returned". Run it on an empty project, and only once.
3. Choose **New query** again, paste the whole contents of
   `supabase/migrations/20260930000000_activity_feed.sql`, and run it the same way. It adds the
   triggers that record changes to your programs, checklists, letters, funding, tasks and
   documents in the activity log, so run it after the first one.
4. Do the same with `supabase/migrations/20261001000000_delete_account.sql`. It adds the one
   database function the app may call, `delete_my_account()`, which **Settings → Delete account**
   uses. It can only ever delete the person who is signed in.

**Option B: Supabase CLI**

```bash
npx supabase init                       # only if supabase/config.toml doesn't exist yet
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

(The CLI route has not been tried in this repo.)

**Then check it.** Paste `supabase/verify-setup.sql` into a new query and run it. It changes
nothing and lists a handful of checks (row level security on, no anonymous access, and so on).
Every row must say `true`. Also open **Database → Advisors** and confirm there are no security errors.

## 3. Configure sign-in

Under **Authentication**:

- **Providers → Email**: enabled. Keep **Confirm email** on (people must click a link before they
  can sign in). Set the minimum password length to **8** or more; the app already requires 8.
- **URL Configuration**: set **Site URL** to your live address (use `http://localhost:3000` while
  developing) and add these to **Redirect URLs**:
  - `http://localhost:3000/**`
  - `https://YOUR-DOMAIN/**`
  - for Vercel preview deployments, `https://*-YOUR-TEAM.vercel.app/**`

  Confirmation links return to `/app` and password reset links to `/reset-password`. If an address
  isn't on the list, Supabase sends people to the Site URL instead and the reset form never
  appears.

- **Email delivery**: Supabase's built-in sender is meant for testing. It is heavily rate limited
  and may only deliver to your own team's addresses. Add an SMTP provider under **SMTP Settings**
  before inviting anyone else.
- **Optional**: once your own account exists you can turn off **Allow new users to sign up** to keep
  the app private until launch.

## 4. Connect the app

Open **Project Settings → API** (or the **Connect** button) and copy the project URL and the
**publishable** key (or the legacy `anon` key). Then:

```bash
cp .env.example .env.local
```

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

Run `npm run dev` and open <http://localhost:3000>.

**Never use the `service_role` or secret key here.** Anything starting with `VITE_` is copied into
the JavaScript every visitor downloads. The app and the build both refuse to run with a secret key
(the build fails with an explanation) as a safety net.

## 5. Create the first user

1. Go to `/signup`, enter your email and a password of at least 8 characters.
2. Click the link in the confirmation email. You land on the dashboard, signed in.
3. In **Table Editor → profiles** you should see one row for your account (a database trigger
   creates it).

## 6. Deploy on Vercel

The full walkthrough (project settings, environment variables, security headers, a test to run on
the live site, rollback and troubleshooting) is in [deployment.md](deployment.md). In short:

1. Import the repository in Vercel. It detects Vite; the defaults are correct. `vercel.json`
   sends deep links such as `/reset-password` to the app and adds the security headers.
2. Under **Settings → Environment Variables** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   for Production and Preview (and, optionally, `VITE_SITE_URL`). They are baked in at build time,
   so **redeploy after changing them**.
3. Add the Vercel address to Supabase's **Site URL** / **Redirect URLs** (step 3).

## 7. Manual test on your own project

1. Sign up, confirm, sign in. The dashboard shows your email in the account menu.
2. Sign out. You land on the login page, and visiting `/app` sends you back to it.
3. Choose **Forgot password?**, follow the emailed link, set a new password. You end up in the app.
4. Sign in with the old password; it must fail.
5. Open **Applications → Add program**, enter a university and a program, and save. It appears in
   the list, and the dashboard counts it.
6. Check that data is private: sign up a second account (a second email address works; plus
   addressing such as `you+two@gmail.com` is fine), and confirm its **Applications** page is empty.
   Then, while signed in as the second account, paste the address of one of the first account's
   programs (`/app/applications/…`). You should get "Program not found", not the program.
7. Open a program, choose the **Requirements** tab, and choose **Add common requirements**, then
   **Add 7 requirements**. The list, the **Progress** card, and the **Completion** column on the
   Applications page should all show 0 of 7. Mark one item **Complete**: they should show 1 of 7
   (14%). In the second account, the same tab address must show "Program not found", and its own
   Applications page must not show the first account's checklist.
8. Delete that program. Its checklist disappears with it (check **Table Editor → requirements**).
9. Open **Recommenders** and choose **Add recommender**; add a name and save. On a program's
   **Recommendations** tab choose **Request a letter**, pick the person, and save. Mark the letter
   **Requested**: the date asked is filled in for you (check **Table Editor →
   recommendation_requests**). Mark it **Submitted**: the program's Overview card shows 1 of 1
   letters submitted. Try to request a letter from the same person for the same program again: they
   are greyed out. In the second account, **Recommenders** must be empty and the first account's
   program address must show "Program not found".
10. Delete the recommender. Their letter request disappears with them, and the program stays.
11. Open **Funding** and choose **Add funding**. Name it, choose a type, pick a program (or leave it
    as "Not tied to a program"), enter an amount and a status, and save. On the program's
    **Funding** tab the same item appears, and the **Funding** column on the Applications page
    shows it. Mark it **Accepted**: the column shows "Accepted" with the amount, and **Funding at a
    glance** adds it to **Accepted**. Use the **Filter by funding** menu on the Applications page
    to find programs with funding offered. In the second account, **Funding** must be empty and
    the first account's program address must show "Program not found". Delete the program: its
    funding disappears with it (check **Table Editor → funding**), while funding you had tied to
    no program stays.
12. Open **Documents** and choose **Add the usual documents**, then **Add 3 documents**. Mark one
    **Complete** and give it a link (a Google Drive address works): the row shows the host of the
    link and **Documents at a glance** shows 1 of 3 complete. Open a program that has a resume,
    statement or transcript on its checklist, choose its **Documents** tab, and pick the document
    for each item: the choice is saved (check **Table Editor → requirements**, column
    `document_id`) and the **Documents** page now says the document is "Used for 1 checklist item".
    Delete that document: the checklist item stays, with no document chosen. In the second account,
    **Documents** must be empty. Delete the program: your documents stay.
13. Open **Tasks** and choose **Add task**. Give it a title and a due date a few days away, pick a
    program (or leave it as "Not tied to a program"), and save. On the program's **Tasks** tab the
    same task appears, and its Overview shows "0 of 1 complete". Mark it **Complete**: check
    **Table Editor → tasks**, where `completed_at` is now filled in; set it back to **To Do** and
    it is cleared again. On the program's **Notes** tab type something and save (check **Table
    Editor → applications**, column `notes`). Delete the program: its tasks disappear with it,
    while a task tied to no program stays. In the second account, **Tasks** must be empty and the
    first account's program address must show "Program not found".
14. Open **Deadlines**. The application deadline of each program, and every checklist item, letter,
    scholarship and task that has a date, are listed soonest first, in groups from Overdue to Later,
    and each row opens the place where you can deal with it. Mark a task **Complete**: it drops off
    the list. In the second account, **Deadlines** must be empty.
15. Open **Dashboard**. It shows a count for each stage (total, not started, in progress, submitted,
    interviews, accepted, waitlisted, rejected), then the next dates due, how far along your
    checklists are, your open tasks, your recommendation letters and your latest changes. Every
    number comes from your own rows: change a program's status on **Applications** and come back,
    and the counts and **Recent activity** have moved. In the second account, **Dashboard** must
    say "No applications yet." and show no numbers.

16. Open **Settings**. Change the theme and reload: it is remembered. **Download my data** saves
    a `.json` file with your email and every table (open it and check your programs are in it).
    **Change password** with a new password, then sign out and sign in with the new one; the old
    one must fail. In the second account, create a program, then choose **Delete account…**, type
    its email address, and confirm. You land on the sign-in page with "Your account has been
    deleted."; signing in with that email must fail, and in **Authentication → Users** and every
    table of **Table Editor** nothing of that account is left. The first account's data must be
    untouched.

## How data is protected

- Every table has row level security, and each row belongs to one user (`user_id`). A signed-in user
  can only read or change their own rows; signed-out visitors can access nothing.
- Related rows are linked with `(parent_id, user_id)` pairs, so a row can never point at another
  user's data even if someone crafts a request by hand.
- The activity log can only be written by database triggers, never by the browser.
- Links (`http_url`) are restricted to `http://` and `https://`, so stored `javascript:` links
  can't be rendered as clickable.
- Deleting a user under **Authentication → Users** deletes all of their data. **Settings → Delete
  account** does the same for the signed-in person through the `delete_my_account()` function: it
  takes no argument (nobody's id is sent), it is not callable by signed-out visitors, and it is
  the only function in `public` that the API may call. `verify-setup.sql` checks all three.

If a secret key is ever pasted into code, chat, an issue or a commit, treat it as leaked and
regenerate it under **Project Settings → API**.

## Changing the database later

Add a new file to `supabase/migrations/` with a later timestamp (`YYYYMMDDHHMMSS_what_it_does.sql`).
Never edit a migration that has already been applied to a real project. New tables need row level
security, a policy, an index on `user_id`, minimal grants, and a section in
`supabase/tests/rls.test.ts`; the guard tests there fail if any of these is missing.

## Running the tests

```bash
npm test          # app tests and database tests
npm run test:db   # database tests only (no Docker or Supabase account needed)
```
