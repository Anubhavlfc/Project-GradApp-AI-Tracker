-- "Delete my account": lets a signed-in person remove their own account and, through the cascades
-- from auth.users, every row they own (profile, programs, checklists, letters, funding, documents,
-- tasks, activity).
--
-- Supabase does not let the browser delete its own user, and the browser must never hold a key
-- that could delete other people's. So the deletion is a function that can only ever act on the
-- caller: the id comes from the verified sign-in token (auth.uid()), never from an argument.
--
-- Signed-out visitors (anon) cannot call it. Signed-in people can call it for themselves only.

create function public.delete_my_account() returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
