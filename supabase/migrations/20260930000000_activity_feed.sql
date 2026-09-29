-- Recent activity: more of what happens is recorded for the dashboard.
--
-- The log stays append-only and is written only by the triggers below; the app can read it and
-- nothing else. An entry says what happened in `kind`, which thing it happened to in `subject`, and
-- gives the screen what it needs to word it in `detail` and `meta` (for example the new status).

alter table public.activity drop constraint if exists activity_kind_check;
alter table public.activity add constraint activity_kind_check check (kind in (
  'application_added', 'status_changed', 'application_removed',
  'requirement_updated', 'letter_updated', 'funding_updated', 'task_completed', 'document_completed'
));

alter table public.activity
  add column meta jsonb not null default '{}'::jsonb
    check (jsonb_typeof(meta) = 'object' and pg_column_size(meta) <= 2000);

-- ---------------------------------------------------------------------------
-- A program's name as the log words it: "Stanford University - MS Computer Science"
-- ---------------------------------------------------------------------------

create function public.program_label(p_application_id uuid, p_user_id uuid) returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(u.name, 'Unknown university') || ' - ' || a.program_name
    from public.applications a
    left join public.universities u on u.id = a.university_id and u.user_id = a.user_id
   where a.id = p_application_id and a.user_id = p_user_id
$$;

-- ---------------------------------------------------------------------------
-- Checklist items: any change of status
-- ---------------------------------------------------------------------------

create function public.log_requirement_activity() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity (user_id, application_id, kind, subject, detail, meta)
  values (
    new.user_id,
    new.application_id,
    'requirement_updated',
    coalesce(public.program_label(new.application_id, new.user_id), 'Unknown program'),
    new.status::text,
    jsonb_build_object('requirement', new.kind::text, 'label', new.label)
  );
  return null;
end;
$$;

create trigger requirements_log_activity
  after update of status on public.requirements
  for each row when (old.status is distinct from new.status)
  execute function public.log_requirement_activity();

-- ---------------------------------------------------------------------------
-- Recommendation letters: any change of status
-- ---------------------------------------------------------------------------

create function public.log_letter_activity() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recommender_name text;
begin
  select name into recommender_name
    from public.recommenders where id = new.recommender_id and user_id = new.user_id;

  insert into public.activity (user_id, application_id, kind, subject, detail, meta)
  values (
    new.user_id,
    new.application_id,
    'letter_updated',
    coalesce(public.program_label(new.application_id, new.user_id), 'Unknown program'),
    new.status::text,
    jsonb_build_object('recommender', coalesce(recommender_name, 'Unknown recommender'))
  );
  return null;
end;
$$;

create trigger recommendation_requests_log_activity
  after update of status on public.recommendation_requests
  for each row when (old.status is distinct from new.status)
  execute function public.log_letter_activity();

-- ---------------------------------------------------------------------------
-- Funding: any change of status
-- ---------------------------------------------------------------------------

create function public.log_funding_activity() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity (user_id, application_id, kind, subject, detail, meta)
  values (
    new.user_id,
    new.application_id,
    'funding_updated',
    new.name,
    new.status::text,
    jsonb_build_object(
      'program',
      case when new.application_id is null then null
           else public.program_label(new.application_id, new.user_id) end
    )
  );
  return null;
end;
$$;

create trigger funding_log_activity
  after update of status on public.funding
  for each row when (old.status is distinct from new.status)
  execute function public.log_funding_activity();

-- ---------------------------------------------------------------------------
-- Tasks and documents: only when they are finished
-- ---------------------------------------------------------------------------

create function public.log_task_activity() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity (user_id, application_id, kind, subject, meta)
  values (
    new.user_id,
    new.application_id,
    'task_completed',
    left(new.title, 500),
    jsonb_build_object(
      'program',
      case when new.application_id is null then null
           else public.program_label(new.application_id, new.user_id) end
    )
  );
  return null;
end;
$$;

create trigger tasks_log_activity
  after update of status on public.tasks
  for each row when (old.status is distinct from new.status and new.status = 'complete')
  execute function public.log_task_activity();

create function public.log_document_activity() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity (user_id, kind, subject, meta)
  values (
    new.user_id,
    'document_completed',
    left(new.name, 500),
    jsonb_build_object('document', new.kind::text)
  );
  return null;
end;
$$;

create trigger documents_log_activity
  after update of status on public.documents
  for each row when (old.status is distinct from new.status and new.status = 'complete')
  execute function public.log_document_activity();

-- ---------------------------------------------------------------------------
-- Nobody calls these directly: only the triggers do.
-- ---------------------------------------------------------------------------

revoke all on function
  public.program_label(uuid, uuid),
  public.log_requirement_activity(),
  public.log_letter_activity(),
  public.log_funding_activity(),
  public.log_task_activity(),
  public.log_document_activity()
from public, anon, authenticated;
