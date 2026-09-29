-- Application Command Center: initial schema.
--
-- Security model
--   * Every table is owned by exactly one user (`user_id`) and has row level security (RLS) on.
--   * The client-facing roles are `authenticated` (signed-in users) and `anon` (not signed in).
--     `anon` gets no table access at all.
--   * Child rows reference their parent with a composite key (parent_id, user_id), so a row can
--     never point at another user's data, even if the caller supplies a foreign id.
--   * Privileges are least-privilege: no TRUNCATE/TRIGGER/REFERENCES for clients, and the
--     `activity` log is written only by triggers.
--
-- When you add a table: enable RLS, add a policy, index `user_id`, grant only the privileges the
-- client needs, and extend supabase/tests/rls.test.ts (its guard tests fail otherwise).

-- ---------------------------------------------------------------------------
-- Validated types
-- ---------------------------------------------------------------------------

-- http(s) only: rejects javascript:, data:, etc. so stored links are safe to render as hrefs.
create domain public.http_url as text
  check (char_length(value) <= 2048 and value ~* '^https?://[^[:space:]]+$');

create domain public.email_address as text
  check (char_length(value) <= 254 and value ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

create domain public.currency_code as text
  check (value ~ '^[A-Z]{3}$');

create domain public.money_amount as numeric(12, 2)
  check (value >= 0);

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.degree_level as enum ('masters', 'phd', 'other');

-- Keep in sync with src/features/applications/status.ts
create type public.application_status as enum (
  'researching', 'shortlisted', 'planning_to_apply', 'application_started',
  'documents_in_progress', 'ready_to_submit', 'submitted', 'interview',
  'waitlisted', 'accepted', 'rejected', 'withdrawn'
);

create type public.application_priority as enum ('dream', 'target', 'safety');
create type public.fee_waiver_status as enum ('not_requested', 'requested', 'granted', 'denied');

create type public.requirement_kind as enum (
  'resume_cv', 'statement_of_purpose', 'personal_statement', 'supplemental_essay', 'transcript',
  'gre', 'gmat', 'toefl', 'ielts', 'writing_sample', 'portfolio', 'recommendation_letter',
  'application_fee', 'other'
);
create type public.requirement_status as enum ('not_started', 'in_progress', 'complete', 'submitted');

create type public.document_kind as enum (
  'resume', 'cv', 'statement_of_purpose', 'personal_statement', 'transcript', 'writing_sample',
  'portfolio', 'gre_score', 'toefl_score', 'ielts_score', 'other'
);
create type public.document_status as enum ('not_started', 'in_progress', 'complete');

create type public.recommendation_status as enum (
  'not_requested', 'requested', 'confirmed', 'submitted', 'needs_follow_up'
);

create type public.funding_kind as enum (
  'university_scholarship', 'external_scholarship', 'fellowship', 'research_assistantship',
  'teaching_assistantship', 'tuition_waiver', 'stipend', 'other'
);
create type public.funding_status as enum (
  'researching', 'applying', 'applied', 'offered', 'accepted', 'declined', 'rejected'
);

create type public.task_priority as enum ('low', 'medium', 'high');
create type public.task_status as enum ('todo', 'in_progress', 'complete');

-- ---------------------------------------------------------------------------
-- Shared trigger functions
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users, created automatically on sign-up)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 100), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- universities
-- ---------------------------------------------------------------------------

create table public.universities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  city text check (char_length(city) <= 100),
  region text check (char_length(region) <= 100),
  country text check (char_length(country) <= 100),
  website_url public.http_url,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index universities_user_name_key
  on public.universities (user_id, lower(btrim(name)));

-- ---------------------------------------------------------------------------
-- applications: one program the user is tracking (program + application in one row)
-- ---------------------------------------------------------------------------

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  university_id uuid not null,

  -- Program
  school_college text check (char_length(school_college) <= 200),
  department text check (char_length(department) <= 200),
  program_name text not null check (char_length(btrim(program_name)) between 1 and 200),
  degree_level public.degree_level not null default 'masters',
  degree_type text check (char_length(degree_type) <= 50), -- e.g. MS, MA, MEng
  program_url public.http_url,
  program_length_months smallint check (program_length_months between 1 and 120),
  is_stem boolean not null default false,

  -- Workflow
  status public.application_status not null default 'researching',
  priority public.application_priority,
  is_favorite boolean not null default false,
  deadline date,
  priority_deadline date,
  portal_url public.http_url,
  interview_at timestamptz,
  submitted_on date,

  -- Cost
  application_fee public.money_amount,
  fee_currency public.currency_code not null default 'USD',
  fee_waiver_available boolean not null default false,
  fee_waiver_status public.fee_waiver_status not null default 'not_requested',
  fee_paid_on date,

  -- Decision
  decision_received_on date,
  decision_deadline date,
  enrollment_deposit public.money_amount,
  is_final_choice boolean not null default false,

  notes text check (char_length(notes) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, user_id),
  -- Deferred so deleting a user can cascade to universities and applications in either order.
  foreign key (university_id, user_id) references public.universities (id, user_id)
    deferrable initially deferred,
  check (priority_deadline is null or deadline is null or priority_deadline <= deadline)
);

create index applications_user_status_idx on public.applications (user_id, status);
create index applications_user_deadline_idx on public.applications (user_id, deadline);
create index applications_university_idx on public.applications (university_id);

-- ---------------------------------------------------------------------------
-- documents: things the user prepares once and reuses (CV, statement, transcript, ...)
-- ---------------------------------------------------------------------------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  kind public.document_kind not null,
  status public.document_status not null default 'not_started',
  url public.http_url, -- Google Drive / Dropbox link; no file uploads in the MVP
  notes text check (char_length(notes) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index documents_user_idx on public.documents (user_id);

-- ---------------------------------------------------------------------------
-- requirements: per-application checklist
-- ---------------------------------------------------------------------------

create table public.requirements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid not null,
  kind public.requirement_kind not null,
  label text check (char_length(label) <= 200), -- e.g. "Recommendation Letter 2"
  is_required boolean not null default true,
  status public.requirement_status not null default 'not_started',
  due_date date,
  document_id uuid,
  notes text check (char_length(notes) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (application_id, user_id) references public.applications (id, user_id)
    on delete cascade,
  foreign key (document_id, user_id) references public.documents (id, user_id)
    on delete set null (document_id)
);

create index requirements_application_idx on public.requirements (application_id);
create index requirements_document_idx on public.requirements (document_id);
create index requirements_user_idx on public.requirements (user_id);

-- ---------------------------------------------------------------------------
-- recommenders and their per-application requests
-- ---------------------------------------------------------------------------

create table public.recommenders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  title text check (char_length(title) <= 200),
  institution text check (char_length(institution) <= 200),
  email public.email_address,
  notes text check (char_length(notes) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index recommenders_user_idx on public.recommenders (user_id);

create table public.recommendation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recommender_id uuid not null,
  application_id uuid not null,
  status public.recommendation_status not null default 'not_requested',
  requested_on date,
  deadline date,
  notes text check (char_length(notes) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (recommender_id, application_id),
  foreign key (recommender_id, user_id) references public.recommenders (id, user_id)
    on delete cascade,
  foreign key (application_id, user_id) references public.applications (id, user_id)
    on delete cascade
);

create index recommendation_requests_application_idx
  on public.recommendation_requests (application_id);
create index recommendation_requests_user_deadline_idx
  on public.recommendation_requests (user_id, deadline);

-- ---------------------------------------------------------------------------
-- funding: scholarships, fellowships, assistantships (application_id null = not tied to a program)
-- ---------------------------------------------------------------------------

create table public.funding (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  kind public.funding_kind not null,
  amount public.money_amount,
  currency public.currency_code not null default 'USD',
  deadline date,
  application_required boolean not null default false,
  status public.funding_status not null default 'researching',
  url public.http_url,
  notes text check (char_length(notes) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (application_id, user_id) references public.applications (id, user_id)
    on delete cascade
);

create index funding_application_idx on public.funding (application_id);
create index funding_user_deadline_idx on public.funding (user_id, deadline);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  due_date date,
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'todo',
  completed_at timestamptz,
  notes text check (char_length(notes) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (application_id, user_id) references public.applications (id, user_id)
    on delete cascade
);

create index tasks_application_idx on public.tasks (application_id);
create index tasks_user_status_due_idx on public.tasks (user_id, status, due_date);

create function public.set_task_completed_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'complete' then
    if tg_op = 'INSERT' or old.status is distinct from 'complete' then
      new.completed_at = now();
    end if;
  else
    new.completed_at = null;
  end if;
  return new;
end;
$$;

create trigger tasks_set_completed_at
  before insert or update on public.tasks
  for each row execute function public.set_task_completed_at();

-- ---------------------------------------------------------------------------
-- activity: append-only log shown on the dashboard; written by triggers only
-- ---------------------------------------------------------------------------

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid,
  kind text not null check (kind in ('application_added', 'status_changed', 'application_removed')),
  subject text not null check (char_length(subject) <= 500), -- e.g. "Stanford University - MS Computer Science"
  detail text check (char_length(detail) <= 500),            -- e.g. the new status value
  created_at timestamptz not null default now(),
  foreign key (application_id, user_id) references public.applications (id, user_id)
    on delete set null (application_id)
);

create index activity_user_created_idx on public.activity (user_id, created_at desc);

create function public.log_application_activity() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  university_name text;
begin
  if tg_op = 'DELETE' then
    -- When a whole account is deleted the user is already gone; there is nobody to log for.
    if exists (select 1 from auth.users where id = old.user_id) then
      select name into university_name
        from public.universities where id = old.university_id and user_id = old.user_id;
      insert into public.activity (user_id, kind, subject)
      values (old.user_id, 'application_removed',
              coalesce(university_name, 'Unknown university') || ' - ' || old.program_name);
    end if;
    return null;
  end if;

  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;

  select name into university_name
    from public.universities where id = new.university_id and user_id = new.user_id;

  insert into public.activity (user_id, application_id, kind, subject, detail)
  values (
    new.user_id,
    new.id,
    case tg_op when 'INSERT' then 'application_added' else 'status_changed' end,
    coalesce(university_name, 'Unknown university') || ' - ' || new.program_name,
    case tg_op when 'INSERT' then null else new.status::text end
  );
  return null;
end;
$$;

create trigger applications_log_activity
  after insert or update or delete on public.applications
  for each row execute function public.log_application_activity();

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger universities_set_updated_at before update on public.universities
  for each row execute function public.set_updated_at();
create trigger applications_set_updated_at before update on public.applications
  for each row execute function public.set_updated_at();
create trigger documents_set_updated_at before update on public.documents
  for each row execute function public.set_updated_at();
create trigger requirements_set_updated_at before update on public.requirements
  for each row execute function public.set_updated_at();
create trigger recommenders_set_updated_at before update on public.recommenders
  for each row execute function public.set_updated_at();
create trigger recommendation_requests_set_updated_at before update on public.recommendation_requests
  for each row execute function public.set_updated_at();
create trigger funding_set_updated_at before update on public.funding
  for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.universities enable row level security;
alter table public.applications enable row level security;
alter table public.documents enable row level security;
alter table public.requirements enable row level security;
alter table public.recommenders enable row level security;
alter table public.recommendation_requests enable row level security;
alter table public.funding enable row level security;
alter table public.tasks enable row level security;
alter table public.activity enable row level security;

-- `(select auth.uid())` is evaluated once per query instead of once per row.

create policy "Users can read their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Users can update their own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Users manage their own universities" on public.universities
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their own applications" on public.applications
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their own documents" on public.documents
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their own requirements" on public.requirements
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their own recommenders" on public.recommenders
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their own recommendation requests" on public.recommendation_requests
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their own funding" on public.funding
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their own tasks" on public.tasks
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users can read their own activity" on public.activity
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Privileges (least privilege; RLS above decides which rows)
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- Tables created by later migrations must not be reachable by anon by default.
alter default privileges in schema public revoke all on tables from anon;

grant select, insert, update, delete on
  public.universities,
  public.applications,
  public.documents,
  public.requirements,
  public.recommenders,
  public.recommendation_requests,
  public.funding,
  public.tasks
to authenticated;

grant select, update (display_name) on public.profiles to authenticated;
grant select on public.activity to authenticated;
