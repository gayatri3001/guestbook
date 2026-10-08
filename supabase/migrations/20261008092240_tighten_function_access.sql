-- Keep helper functions out of the public API, and make policies evaluate
-- auth.uid() once per query instead of once per row (Supabase advisors).
--
-- Functions in `public` are callable as /rest/v1/rpc/<name>. These ones
-- aren't meant to be called directly, so they move to a `private` schema the
-- API doesn't expose. Policies can still use them.

create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- "Is the signed-in user the admin?" — used by the policies below.
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

-- Trigger functions: move them, then point them at the new is_admin().
-- (Triggers reference functions by identity, so they keep working.)
alter function public.entries_before_insert() set schema private;
alter function public.entries_before_update() set schema private;

create or replace function private.entries_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.owner_id := auth.uid();
  new.created_at := now();
  new.hidden := false;
  new.z_index := nextval('public.entries_z_index_seq');

  if not private.is_admin() and exists (
    select 1 from public.entries
    where owner_id = new.owner_id and created_at > now() - interval '1 minute'
  ) then
    raise exception 'Please wait a minute before adding another note.'
      using errcode = 'P0001', hint = 'rate_limited';
  end if;

  return new;
end;
$$;

create or replace function private.entries_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.hidden is distinct from old.hidden and not private.is_admin() then
    raise exception 'Only the admin can hide or unhide notes.' using errcode = '42501';
  end if;

  if new.x is distinct from old.x or new.y is distinct from old.y then
    new.z_index := nextval('public.entries_z_index_seq');
  end if;

  return new;
end;
$$;

-- Triggers run regardless of EXECUTE grants; nobody should call these directly.
revoke all on function private.entries_before_insert() from public, anon, authenticated;
revoke all on function private.entries_before_update() from public, anon, authenticated;

-- Recreate the policies against private.is_admin(), with auth.uid() evaluated once.
drop policy "Visible notes are public" on public.entries;
create policy "Visible notes are public"
  on public.entries for select
  to anon, authenticated
  using (not hidden or (select private.is_admin()));

drop policy "Visitors add their own notes" on public.entries;
create policy "Visitors add their own notes"
  on public.entries for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and (image_path is null or image_path like (select auth.uid())::text || '/%')
  );

drop policy "Admin moves and hides notes" on public.entries;
create policy "Admin moves and hides notes"
  on public.entries for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy "Visitors upload photos to their own folder" on storage.objects;
create policy "Visitors upload photos to their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop function public.is_admin();
