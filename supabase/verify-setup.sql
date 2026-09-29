-- Read-only health check for a Supabase project, run after applying supabase/migrations.
-- Paste it into the SQL Editor and run it. Every row must show `true` in the `passed` column.
-- It changes nothing. The same script runs against a local test database in
-- supabase/tests/verify-setup.test.ts, so a wrong check would fail CI.

with app_tables as (
  select c.oid, c.relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
),
app_functions as (
  select p.oid, p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
)
select 'Row level security is on for every table in public' as check_name,
       not exists (select 1 from app_tables where not relrowsecurity) as passed
union all
select 'Every table in public has at least one policy',
       not exists (
         select 1 from app_tables t
         where not exists (select 1 from pg_policy p where p.polrelid = t.oid)
       )
union all
select 'Signed-out visitors (anon) have no access to any table in public',
       not exists (
         select 1 from app_tables t
         where has_table_privilege('anon', t.oid,
                 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
            or has_any_column_privilege('anon', t.oid, 'SELECT, INSERT, UPDATE, REFERENCES')
       )
union all
select 'Signed-in users cannot truncate, add triggers to, or reference any table',
       not exists (
         select 1 from app_tables t
         where has_table_privilege('authenticated', t.oid, 'TRUNCATE, REFERENCES, TRIGGER')
       )
union all
select 'Signed-out visitors (anon) cannot call functions in public directly',
       not exists (
         select 1 from app_functions f
         where has_function_privilege('anon', f.oid, 'EXECUTE')
       )
union all
select 'Signed-in users can call only delete_my_account among the functions in public',
       exists (
         select 1 from app_functions f
         where f.proname = 'delete_my_account'
           and has_function_privilege('authenticated', f.oid, 'EXECUTE')
       )
       and not exists (
         select 1 from app_functions f
         where f.proname <> 'delete_my_account'
           and has_function_privilege('authenticated', f.oid, 'EXECUTE')
       )
union all
select 'Every view in public runs with the caller''s permissions (security_invoker)',
       not exists (
         select 1
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'v'
           and not coalesce('security_invoker=true' = any (c.reloptions), false)
       )
union all
select 'New sign-ups get a profile automatically',
       exists (
         select 1 from pg_trigger
         where tgname = 'on_auth_user_created' and tgrelid = 'auth.users'::regclass
           and not tgisinternal
       );
