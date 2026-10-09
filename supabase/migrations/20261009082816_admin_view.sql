-- Admin view support.
--
-- 1. A signed-in user can check whether they are the admin (they can read
--    their own row in `admins`, and nothing else).
-- 2. `hidden_entries`: the ids of hidden notes, readable by everyone and sent
--    over live updates. When the admin hides a note, visitors' read access to
--    it ends, so they'd never hear about the change; this tiny table tells
--    their open walls to take it down. It holds ids only, no content.

-- 1. Admin self-check ---------------------------------------------------------

grant select on public.admins to authenticated;

create policy "Users can see whether they are an admin"
  on public.admins for select
  to authenticated
  using (user_id = (select auth.uid()));

-- 2. Hidden notes signal ------------------------------------------------------

create table public.hidden_entries (
  entry_id uuid primary key references public.entries (id) on delete cascade,
  hidden_at timestamptz not null default now()
);

alter table public.hidden_entries enable row level security;

revoke all on public.hidden_entries from anon, authenticated;
grant select on public.hidden_entries to anon, authenticated;

create policy "Anyone can see which notes are hidden"
  on public.hidden_entries for select
  to anon, authenticated
  using (true);

-- Kept in step with entries.hidden by a trigger (never written via the API).
create function private.sync_hidden_entries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.hidden and not old.hidden then
    insert into public.hidden_entries (entry_id) values (new.id) on conflict do nothing;
  elsif old.hidden and not new.hidden then
    delete from public.hidden_entries where entry_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_hidden_entries() from public, anon, authenticated;

create trigger entries_sync_hidden
  after update of hidden on public.entries
  for each row execute function private.sync_hidden_entries();

alter publication supabase_realtime add table public.hidden_entries;
