-- Minimal stand-in for the parts of a Supabase project that our migrations rely on, so the
-- schema and its row level security can be tested in-process (PGlite) without Docker.
-- It mirrors how Supabase works: PostgREST connects as `anon`/`authenticated` and exposes the
-- caller's JWT claims through the `request.jwt.claim*` settings that `auth.uid()` reads.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
-- Supabase's default: new public tables/functions are open to the API roles, which is why the
-- migration has to revoke explicitly.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
