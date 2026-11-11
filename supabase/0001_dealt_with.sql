-- Dealt With on the shared Life Regulation Lab server (project xgeacgbeiivcbrgdfpbf, Zurich).
--
-- The other apps' tables are in "public"; Dealt With has its own schema, "dealt_with", as Regulate
-- has "regulate". One sign-in can belong to several apps, so nothing here is made when a sign-in
-- is made: rows appear only when the person saves something in Dealt With.
--
-- Two tables hold everything the app syncs, as the screens already see it:
--   records: one row per letter, renewal, benefit or money entry (the app's four collections)
--   docs:    one row per named document (settings)
-- Photos never come here; they stay on the device. The words read from them are in the record.

create schema if not exists dealt_with;
grant usage on schema dealt_with to authenticated, service_role;

create table dealt_with.records (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  collection text not null check (collection in ('items', 'renewals', 'benefits', 'money')),
  id text not null check (char_length(id) between 1 and 64),
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 400000),
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);

create table dealt_with.docs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (name in ('settings')),
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 100000),
  updated_at timestamptz not null default now(),
  primary key (user_id, name)
);

alter table dealt_with.records enable row level security;
alter table dealt_with.docs enable row level security;

-- Only the signed-in person, and only their own rows. Nobody who is not signed in.
revoke all on dealt_with.records from anon, public;
revoke all on dealt_with.docs from anon, public;
grant select, insert, update, delete on dealt_with.records to authenticated;
grant select, insert, update, delete on dealt_with.docs to authenticated;

create policy "records_select" on dealt_with.records for select to authenticated using (user_id = auth.uid());
create policy "records_insert" on dealt_with.records for insert to authenticated with check (user_id = auth.uid());
create policy "records_update" on dealt_with.records for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "records_delete" on dealt_with.records for delete to authenticated using (user_id = auth.uid());

create policy "docs_select" on dealt_with.docs for select to authenticated using (user_id = auth.uid());
create policy "docs_insert" on dealt_with.docs for insert to authenticated with check (user_id = auth.uid());
create policy "docs_update" on dealt_with.docs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "docs_delete" on dealt_with.docs for delete to authenticated using (user_id = auth.uid());

-- Leaving another app never removes the sign-in of someone who uses Dealt With.
create or replace function public.lrl_still_used(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.lrl_app_users where user_id = uid)
    or exists (select 1 from public.answers where user_id = uid)
    or exists (select 1 from public.progress where user_id = uid)
    or exists (select 1 from public.profiles where user_id = uid)
    or exists (select 1 from public.pace_profiles where user_id = uid)
    or exists (select 1 from public.pace_friends where user_id = uid)
    or exists (select 1 from public.pace_blocks where user_id = uid)
    or exists (select 1 from public.pace_presence where user_id = uid)
    or exists (select 1 from public.pace_rooms where created_by = uid)
    or exists (select 1 from public.pace_room_members where user_id = uid)
    or exists (select 1 from public.pace_entitlements where user_id = uid)
    or exists (select 1 from public.pace_ai_usage where user_id = uid)
    or exists (select 1 from public.mull_entitlements where user_id = uid)
    or exists (select 1 from public.mull_ai_usage where user_id = uid)
    or exists (select 1 from public.desk_ai_usage where user_id = uid)
    or exists (select 1 from regulate.profiles where user_id = uid)
    or exists (select 1 from dealt_with.records where user_id = uid)
    or exists (select 1 from dealt_with.docs where user_id = uid);
$$;
