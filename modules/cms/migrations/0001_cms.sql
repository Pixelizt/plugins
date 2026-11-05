-- cms 0.1.0: content documents with history, private drafts (D8) and split roles (D16).
-- Ported from the reference project's supabase/schema.sql. Never edit after release: add a new migration.
--
-- Roles live in auth.users.app_metadata.role, set by the agency (never by the user):
--   admin  = everything, including settings_* documents and publishing
--   editor = edit content documents (not settings_*), manage bookings
--   demo   = read-only look around
-- Keys starting with "_" are bookkeeping rows written only by server functions (service key).

create or replace function public.kit_role() returns text
language sql stable as $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '')
$$;

create table if not exists public.docs (
  key text primary key check (key ~ '^_?[a-z][a-z0-9_]*$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.docs enable row level security;

-- Drafts are private (D8): no anonymous read. The build reads with the service key.
drop policy if exists "staff read docs" on public.docs;
create policy "staff read docs" on public.docs for select to authenticated
  using (public.kit_role() in ('admin', 'editor', 'demo') and key not like '\_%');

drop policy if exists "staff insert docs" on public.docs;
create policy "staff insert docs" on public.docs for insert to authenticated
  with check (key not like '\_%' and (public.kit_role() = 'admin' or (public.kit_role() = 'editor' and key not like 'settings\_%')));

drop policy if exists "staff update docs" on public.docs;
create policy "staff update docs" on public.docs for update to authenticated
  using (key not like '\_%' and (public.kit_role() = 'admin' or (public.kit_role() = 'editor' and key not like 'settings\_%')))
  with check (key not like '\_%' and (public.kit_role() = 'admin' or (public.kit_role() = 'editor' and key not like 'settings\_%')));

drop policy if exists "admin delete docs" on public.docs;
create policy "admin delete docs" on public.docs for delete to authenticated
  using (key not like '\_%' and public.kit_role() = 'admin');

revoke all on public.docs from anon;

-- updated_at doubles as the version for optimistic concurrency (rule 32), so the server sets it, not the client.
create or replace function public.docs_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce((select auth.jwt()) ->> 'email', new.updated_by, 'server');
  return new;
end $$;
drop trigger if exists docs_touch_trg on public.docs;
create trigger docs_touch_trg before insert or update on public.docs for each row execute function public.docs_touch();

-- History: every save keeps the previous version (last 20 per key) for History / Restore (rule 33).
create table if not exists public.docs_history (
  id bigserial primary key,
  key text not null,
  value jsonb not null,
  saved_at timestamptz not null,
  saved_by text
);
create index if not exists docs_history_key_idx on public.docs_history (key, saved_at desc);
alter table public.docs_history enable row level security;
revoke all on public.docs_history from anon;
drop policy if exists "staff read history" on public.docs_history;
create policy "staff read history" on public.docs_history for select to authenticated
  using (public.kit_role() in ('admin', 'editor', 'demo'));

create or replace function public.docs_keep_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.key like '\_%' or old.value is not distinct from new.value then return new; end if;
  insert into docs_history (key, value, saved_at, saved_by) values (old.key, old.value, old.updated_at, old.updated_by);
  delete from docs_history where id in (
    select id from docs_history where key = old.key order by saved_at desc, id desc offset 20
  );
  return new;
end $$;
drop trigger if exists docs_history_trg on public.docs;
create trigger docs_history_trg before update on public.docs for each row execute function public.docs_keep_history();

-- Media uploaded from the admin. Public read so the site can show them; staff write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 5242880, array['image/webp', 'image/jpeg', 'image/png', 'image/avif'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 20971520, array['video/mp4', 'image/webp', 'image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "staff write media" on storage.objects;
create policy "staff write media" on storage.objects for insert to authenticated
  with check (bucket_id in ('images', 'videos') and public.kit_role() in ('admin', 'editor'));
drop policy if exists "staff update media" on storage.objects;
create policy "staff update media" on storage.objects for update to authenticated
  using (bucket_id in ('images', 'videos') and public.kit_role() in ('admin', 'editor'));
drop policy if exists "staff delete media" on storage.objects;
create policy "staff delete media" on storage.objects for delete to authenticated
  using (bucket_id in ('images', 'videos') and public.kit_role() in ('admin', 'editor'));
