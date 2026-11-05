-- booking-core 0.1.0: live booking tables + the two functions that make double booking impossible.
--
-- Holds names, phones and emails, so (rule 12): RLS on, no anonymous policy, no write policy for anyone.
-- Only the server writes (service key), and status changes go through set_booking_status. admin + editor read
-- (D16). Bookings that ended more than modules.booking-core.retention_days ago (default 100, D17) are deleted by
-- the daily cron.
--
-- Rules (opening hours, slot length, lead time, blackout dates…) are NOT in the database: they live in client.yaml,
-- validated by zod at build and shared by the page and the server (rule 1). booking_resources is a mirror of the
-- configured resources that create_booking refreshes on every call, so capacity here always matches the deploy.
-- Needs public.kit_role() from the cms migration. Idempotent: safe to run twice.

create table if not exists public.booking_resources (
  id text primary key check (id ~ '^(table|space):[a-z0-9][a-z0-9-]*$'),
  kind text not null check (kind in ('table', 'space')),
  name text not null,
  -- in units: covers (covers model), tables in a group (tables model), 1 for a space (booked whole)
  capacity integer not null check (capacity >= 0),
  -- minimum gap between two bookings on this resource (spaces: cleaning/turnaround)
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 1440),
  active boolean not null default true,
  details jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('table', 'space')),
  resource_id text not null references public.booking_resources (id) on update cascade on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  party_size integer not null check (party_size between 1 and 10000),
  -- capacity used on the resource: party size (covers), 1 (a table), 1 (a space)
  units integer not null check (units >= 1),
  status text not null check (status in ('pending', 'confirmed', 'declined', 'cancelled', 'expired')),
  -- pending bookings hold capacity until this time; after it they stop counting (lazy expiry) and the cron marks them expired
  hold_until timestamptz,
  source text not null default 'web' check (source in ('web', 'staff')),
  name text not null,
  email text,
  phone text,
  notes text,
  fields jsonb not null default '{}',   -- extra validated answers (occasion, add-ons)
  facts jsonb not null default '[]',    -- server-built display rows for emails, from config text only
  cancel_token_hash text,               -- sha256 of the HMAC cancel token; the token itself is never stored
  ip_hash text,
  delivery jsonb not null default '{}', -- outcome of each email (rule 20)
  decided_by text,
  decided_at timestamptz,
  reminded_at timestamptz,
  constraint bookings_time_order check (ends_at > starts_at),
  constraint bookings_pending_hold check (status <> 'pending' or hold_until is not null)
);
create index if not exists bookings_resource_time_idx on public.bookings (resource_id, starts_at);
create index if not exists bookings_starts_idx on public.bookings (starts_at);
create index if not exists bookings_ends_idx on public.bookings (ends_at);
create index if not exists bookings_ip_idx on public.bookings (ip_hash, created_at desc);
create index if not exists bookings_pending_idx on public.bookings (hold_until) where status = 'pending';

-- Staff closures ("private event Friday night"). null kind / resource_id = everything.
create table if not exists public.booking_blocks (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  kind text check (kind in ('table', 'space')),
  resource_id text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default '',
  created_by text,
  constraint booking_blocks_time_order check (ends_at > starts_at)
);
create index if not exists booking_blocks_time_idx on public.booking_blocks (starts_at, ends_at);

-- ---------- privileges: nothing for anon; staff may only SELECT (and not the token or IP hashes) ----------
alter table public.booking_resources enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_blocks enable row level security;

revoke all on public.booking_resources, public.bookings, public.booking_blocks from anon, authenticated;
revoke all on sequence public.booking_blocks_id_seq from anon, authenticated;
grant select on public.booking_resources, public.booking_blocks to authenticated;
grant select (id, created_at, kind, resource_id, starts_at, ends_at, party_size, units, status, hold_until, source,
  name, email, phone, notes, fields, facts, delivery, decided_by, decided_at, reminded_at) on public.bookings to authenticated;

drop policy if exists "staff read booking resources" on public.booking_resources;
create policy "staff read booking resources" on public.booking_resources for select to authenticated
  using (public.kit_role() in ('admin', 'editor'));
drop policy if exists "staff read bookings" on public.bookings;
create policy "staff read bookings" on public.bookings for select to authenticated
  using (public.kit_role() in ('admin', 'editor'));
drop policy if exists "staff read booking blocks" on public.booking_blocks;
create policy "staff read booking blocks" on public.booking_blocks for select to authenticated
  using (public.kit_role() in ('admin', 'editor'));

-- ---------- capacity ----------
-- The most units in use at any moment of [p_start, p_end + buffer) on one resource. Each booking occupies
-- [starts_at, ends_at + buffer). Counts confirmed bookings and pending ones whose hold hasn't run out.
-- Mirrors peakUnits() in lib/capacity.ts: change both together.
create or replace function public.booking_peak(p_resource text, p_start timestamptz, p_end timestamptz, p_buffer integer, p_exclude uuid default null)
returns integer
language sql stable
set search_path = public, pg_temp
as $$
  with occ as (
    select b.starts_at, b.ends_at + make_interval(mins => p_buffer) as ends_b, b.units
    from public.bookings b
    where b.resource_id = p_resource
      and (p_exclude is null or b.id <> p_exclude)
      and (b.status = 'confirmed' or (b.status = 'pending' and b.hold_until > now()))
      and b.starts_at < p_end + make_interval(mins => p_buffer)
      and b.ends_at + make_interval(mins => p_buffer) > p_start
  ),
  pts as (
    select p_start as t
    union
    select o.starts_at from occ o where o.starts_at > p_start
  ),
  load as (
    select (select coalesce(sum(o.units), 0) from occ o where o.starts_at <= pts.t and o.ends_b > pts.t) as total
    from pts
  )
  select coalesce(max(total), 0)::integer from load;
$$;

-- Creates a booking on the first candidate resource that has room, or returns why not. Takes a transaction-scoped
-- advisory lock per candidate resource (in id order, so two calls can never deadlock) BEFORE reading capacity:
-- two concurrent requests for the last seat run one after the other, and the second sees the first's row.
-- Returns {"ok":true,"id","resource_id"} or {"ok":false,"reason":"full"|"blocked"|"invalid"}.
create or replace function public.create_booking(
  p_id uuid, p_kind text, p_candidates jsonb, p_units integer,
  p_starts_at timestamptz, p_ends_at timestamptz, p_party_size integer,
  p_status text, p_hold_until timestamptz, p_source text,
  p_name text, p_email text, p_phone text, p_notes text,
  p_fields jsonb, p_facts jsonb, p_cancel_token_hash text, p_ip_hash text, p_decided_by text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c jsonb;
  v_id text;
  v_cap integer;
  v_buf integer;
  v_open boolean := false;
begin
  if p_status not in ('pending', 'confirmed') or p_kind not in ('table', 'space') or p_source not in ('web', 'staff')
     or p_ends_at <= p_starts_at or p_units < 1 or p_party_size < 1
     or (p_status = 'pending' and p_hold_until is null)
     or jsonb_typeof(p_candidates) <> 'array' or jsonb_array_length(p_candidates) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  -- keep the resource mirror in step with the deployed config
  insert into public.booking_resources as r (id, kind, name, capacity, buffer_minutes, active, updated_at)
  select x ->> 'id', p_kind, x ->> 'name', (x ->> 'capacity')::integer, coalesce((x ->> 'buffer_minutes')::integer, 0), true, now()
  from jsonb_array_elements(p_candidates) x
  on conflict (id) do update
    set kind = excluded.kind, name = excluded.name, capacity = excluded.capacity,
        buffer_minutes = excluded.buffer_minutes, active = true, updated_at = now()
    where (r.kind, r.name, r.capacity, r.buffer_minutes, r.active) is distinct from
          (excluded.kind, excluded.name, excluded.capacity, excluded.buffer_minutes, true);

  for v_id in select distinct x ->> 'id' from jsonb_array_elements(p_candidates) x order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended('kit_booking:' || v_id, 0));
  end loop;

  -- each statement below takes a fresh snapshot (READ COMMITTED), so it sees bookings committed before we got the lock
  for c in select x from jsonb_array_elements(p_candidates) with ordinality as t(x, n) order by n loop
    v_id := c ->> 'id';
    v_cap := (c ->> 'capacity')::integer;
    v_buf := coalesce((c ->> 'buffer_minutes')::integer, 0);
    if exists (
      select 1 from public.booking_blocks k
      where (k.kind is null or k.kind = p_kind) and (k.resource_id is null or k.resource_id = v_id)
        and k.starts_at < p_ends_at and k.ends_at > p_starts_at
    ) then
      continue;
    end if;
    v_open := true;
    if public.booking_peak(v_id, p_starts_at, p_ends_at, v_buf, null) + p_units <= v_cap then
      insert into public.bookings (id, kind, resource_id, starts_at, ends_at, party_size, units, status, hold_until, source,
        name, email, phone, notes, fields, facts, cancel_token_hash, ip_hash, decided_by, decided_at)
      values (p_id, p_kind, v_id, p_starts_at, p_ends_at, p_party_size, p_units, p_status, p_hold_until, p_source,
        p_name, p_email, p_phone, p_notes, coalesce(p_fields, '{}'), coalesce(p_facts, '[]'), p_cancel_token_hash, p_ip_hash,
        p_decided_by, case when p_decided_by is not null then now() end);
      return jsonb_build_object('ok', true, 'id', p_id, 'resource_id', v_id);
    end if;
  end loop;
  return jsonb_build_object('ok', false, 'reason', case when v_open then 'full' else 'blocked' end);
end;
$$;

-- Staff decisions and customer cancels. Allowed: pending|expired → confirmed|declined|cancelled, confirmed → cancelled.
-- Confirming re-checks capacity under the same lock as create_booking (the hold may have run out and the time been
-- taken meanwhile). Same status again = no change (idempotent).
-- Returns {"ok":true,"changed","from","booking"} or {"ok":false,"reason":"not_found"|"invalid"|"invalid_transition"|"full"|"past"}.
create or replace function public.set_booking_status(p_id uuid, p_status text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  b public.bookings;
  r public.booking_resources;
  v_resource text;
  v_from text;
begin
  if p_status not in ('confirmed', 'declined', 'cancelled') then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  select resource_id into v_resource from public.bookings where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if p_status = 'confirmed' then
    perform pg_advisory_xact_lock(hashtextextended('kit_booking:' || v_resource, 0));
  end if;
  select * into b from public.bookings where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  v_from := b.status;
  if b.status = p_status then
    return jsonb_build_object('ok', true, 'changed', false, 'from', v_from, 'booking', to_jsonb(b) - 'cancel_token_hash' - 'ip_hash');
  end if;
  if not ((b.status in ('pending', 'expired') and p_status in ('confirmed', 'declined', 'cancelled'))
          or (b.status = 'confirmed' and p_status = 'cancelled')) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_transition', 'from', v_from);
  end if;
  if p_status = 'confirmed' then
    if b.starts_at <= now() then
      return jsonb_build_object('ok', false, 'reason', 'past', 'from', v_from);
    end if;
    select * into r from public.booking_resources where id = b.resource_id;
    if public.booking_peak(b.resource_id, b.starts_at, b.ends_at, r.buffer_minutes, b.id) + b.units > r.capacity then
      return jsonb_build_object('ok', false, 'reason', 'full', 'from', v_from);
    end if;
  end if;
  update public.bookings
    set status = p_status, decided_by = coalesce(p_actor, decided_by), decided_at = now()
    where id = p_id
    returning * into b;
  return jsonb_build_object('ok', true, 'changed', true, 'from', v_from, 'booking', to_jsonb(b) - 'cancel_token_hash' - 'ip_hash');
end;
$$;

-- Server only: the endpoints check the role first (rule 11) and send the emails.
revoke all on function public.booking_peak(text, timestamptz, timestamptz, integer, uuid) from public, anon, authenticated;
revoke all on function public.create_booking(uuid, text, jsonb, integer, timestamptz, timestamptz, integer, text, timestamptz, text, text, text, text, text, jsonb, jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.set_booking_status(uuid, text, text) from public, anon, authenticated;
grant execute on function public.booking_peak(text, timestamptz, timestamptz, integer, uuid) to service_role;
grant execute on function public.create_booking(uuid, text, jsonb, integer, timestamptz, timestamptz, integer, text, timestamptz, text, text, text, text, text, jsonb, jsonb, text, text, text) to service_role;
grant execute on function public.set_booking_status(uuid, text, text) to service_role;
