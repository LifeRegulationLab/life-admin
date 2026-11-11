-- Dealt With on the shared server, part 2: supporter links, Plus, and deleting.
--
-- shares: one step handed to a supporter by a link. The owner makes and removes them. The
--   supporter is not signed in: they reach one share by its code, through the three functions
--   below, and can only add a reply. Nobody can list shares or read one without its code.
-- plans: whether the person has Dealt With Plus. The person may read their own row. Only the
--   server (payments) and the owner (testers, in the SQL editor) write it.
-- delete_my_account(): removes everything Dealt With holds for the person. The sign-in itself
--   goes only if no other Life Regulation Lab app still uses it.

-- The supporter's three calls are made without a sign-in.
grant usage on schema dealt_with to anon;

create table dealt_with.shares (
  code text primary key check (char_length(code) between 16 and 40),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 3000000),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index shares_owner on dealt_with.shares (owner);
alter table dealt_with.shares enable row level security;
revoke all on dealt_with.shares from anon, public;
grant select, insert, delete on dealt_with.shares to authenticated;
create policy "shares_select" on dealt_with.shares for select to authenticated using (owner = auth.uid());
create policy "shares_insert" on dealt_with.shares for insert to authenticated with check (owner = auth.uid());
create policy "shares_delete" on dealt_with.shares for delete to authenticated using (owner = auth.uid());

create function dealt_with.share_get(share_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select s.data from dealt_with.shares s where s.code = share_code
$$;

-- The supporter's answer: a reply, their name, one photo and whether their part is done. Nothing
-- else in the share can be changed, and nothing after the link has stopped working.
create function dealt_with.share_reply(
  share_code text,
  reply text,
  helper_name text,
  photo text default null,
  done boolean default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if photo is not null and (char_length(photo) > 1500000 or photo not like 'data:image/%') then
    raise exception 'That picture is too big.' using errcode = '22023';
  end if;
  update dealt_with.shares s
     set data = s.data
       || jsonb_build_object(
            'reply', left(coalesce(reply, ''), 4000),
            'helperName', left(coalesce(helper_name, ''), 80),
            'repliedAt', (extract(epoch from now()) * 1000)::bigint)
       || case when photo is null then '{}'::jsonb else jsonb_build_object('replyPhoto', photo) end
       || case when done is null then '{}'::jsonb else jsonb_build_object('helperDone', done) end
   where s.code = share_code and s.expires_at > now();
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

create function dealt_with.share_opened(share_code text)
returns void
language sql
security definer
set search_path = ''
as $$
  update dealt_with.shares s
     set data = s.data || jsonb_build_object('openedAt', (extract(epoch from now()) * 1000)::bigint)
   where s.code = share_code and s.expires_at > now() and not (s.data ? 'openedAt')
$$;

revoke all on function dealt_with.share_get(text) from public;
revoke all on function dealt_with.share_reply(text, text, text, text, boolean) from public;
revoke all on function dealt_with.share_opened(text) from public;
grant execute on function dealt_with.share_get(text) to anon, authenticated;
grant execute on function dealt_with.share_reply(text, text, text, text, boolean) to anon, authenticated;
grant execute on function dealt_with.share_opened(text) to anon, authenticated;

create table dealt_with.plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default false,
  tester boolean not null default false,
  customer text,
  subscription text,
  updated_at timestamptz not null default now()
);
alter table dealt_with.plans enable row level security;
revoke all on dealt_with.plans from anon, public, authenticated;
grant select on dealt_with.plans to authenticated;
create policy "plans_select" on dealt_with.plans for select to authenticated using (user_id = auth.uid());

-- Plus for a tester, by the owner in the SQL editor:
--   select dealt_with.grant_tester_plus('person@example.com');
--   select dealt_with.end_tester_plus('person@example.com');
create function dealt_with.grant_tester_plus(tester_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(btrim(tester_email));
  if uid is null then return 'No account has that email.'; end if;
  insert into dealt_with.plans (user_id, active, tester) values (uid, true, true)
  on conflict (user_id) do update set active = true, tester = true, updated_at = now();
  return 'Plus given.';
end;
$$;

create function dealt_with.end_tester_plus(tester_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(btrim(tester_email));
  if uid is null then return 'No account has that email.'; end if;
  update dealt_with.plans set active = false, tester = false, updated_at = now()
   where user_id = uid and tester;
  return 'Tester access ended.';
end;
$$;
revoke execute on function dealt_with.grant_tester_plus(text) from public, anon, authenticated;
revoke execute on function dealt_with.end_tester_plus(text) from public, anon, authenticated;

create function dealt_with.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  still boolean := false;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from dealt_with.records where user_id = uid;
  delete from dealt_with.docs where user_id = uid;
  delete from dealt_with.shares where owner = uid;
  delete from dealt_with.plans where user_id = uid;
  if to_regprocedure('public.lrl_still_used(uuid)') is not null then
    execute 'select public.lrl_still_used($1)' into still using uid;
  end if;
  if not coalesce(still, false) then
    delete from auth.users where id = uid;
  end if;
end;
$$;
revoke all on function dealt_with.delete_my_account() from public, anon;
grant execute on function dealt_with.delete_my_account() to authenticated;

-- The functions on the server (the helper, read aloud, and later payments) read and write plans
-- with the server's own key. Outside "public" that key is given nothing by default.
grant select, insert, update, delete on dealt_with.plans to service_role;
grant select, insert, update, delete on dealt_with.records, dealt_with.docs, dealt_with.shares to service_role;
