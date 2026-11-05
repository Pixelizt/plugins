# booking-core: manual database checks (first real deployment)

The SQL in `migrations/0001_bookings.sql` was written without a database to run it against. Before the first
client takes bookings, run these in the Supabase SQL editor of a **staging** project (or the client's project
before launch) and tick each one. Anything unexpected: stop, don't ship, report it.

All `select public.create_booking(...)` calls below run as the SQL editor's role (postgres), like the service key.

## 0. Migrate twice
Run the cms migration, then `0001_bookings.sql` **twice**. The second run must finish without errors (idempotent).

## 1. Privileges and RLS
```sql
-- RLS on for all three tables
select relname, relrowsecurity from pg_class where relname in ('bookings', 'booking_resources', 'booking_blocks');
-- anon: nothing; authenticated: SELECT only (bookings: not cancel_token_hash / ip_hash)
select grantee, table_name, privilege_type from information_schema.role_table_grants
  where table_name in ('bookings', 'booking_resources', 'booking_blocks') and grantee in ('anon', 'authenticated');
select grantee, column_name from information_schema.column_privileges
  where table_name = 'bookings' and grantee = 'authenticated' and column_name in ('cancel_token_hash', 'ip_hash'); -- expect 0 rows
-- functions: service_role only
select routine_name, grantee from information_schema.role_routine_grants
  where routine_name in ('create_booking', 'set_booking_status', 'booking_peak');   -- expect service_role (+ postgres), no anon/authenticated/PUBLIC
```
Then from a browser console with the **anon key** (no login): `fetch(URL + "/rest/v1/bookings?select=id", {headers:{apikey:ANON}})` → `[]` or 401/permission error,
and `POST /rest/v1/rpc/create_booking` → permission denied. Signed in as a `demo` user: bookings → `[]`. As `editor`: rows, and
`select=cancel_token_hash` → permission denied. A `PATCH` on `bookings` as editor → permission denied.

## 2. Happy path and capacity
```sql
-- a pool of 4 covers
select public.create_booking(gen_random_uuid(), 'table', '[{"id":"table:covers","name":"Covers","capacity":4,"buffer_minutes":0}]',
  3, '2030-01-04 19:00+00', '2030-01-04 20:30+00', 3, 'confirmed', null, 'web', 'T1', null, null, null, '{}', '[]', null, null, null);
-- → {"ok": true, ...}; booking_resources has table:covers with capacity 4
select public.create_booking(gen_random_uuid(), 'table', '[{"id":"table:covers","name":"Covers","capacity":4,"buffer_minutes":0}]',
  2, '2030-01-04 20:00+00', '2030-01-04 21:30+00', 2, 'confirmed', null, 'web', 'T2', null, null, null, '{}', '[]', null, null, null);
-- → {"ok": false, "reason": "full"}  (3 + 2 > 4 at 20:00)
select public.create_booking(gen_random_uuid(), 'table', '[{"id":"table:covers","name":"Covers","capacity":4,"buffer_minutes":0}]',
  2, '2030-01-04 20:30+00', '2030-01-04 22:00+00', 2, 'confirmed', null, 'web', 'T3', null, null, null, '{}', '[]', null, null, null);
-- → ok (the first booking ends at 20:30: end times are free)
```
- [ ] `select public.booking_peak('table:covers', '2030-01-04 18:00+00', '2030-01-04 23:00+00', 0)` → 3 (never more than 3 at once).
- [ ] Bad input (`p_ends_at <= p_starts_at`, `'pending'` without hold, empty candidates) → `{"ok":false,"reason":"invalid"}`.
- [ ] Table groups: candidates `[{"id":"table:2-seats","capacity":1},{"id":"table:4-seats","capacity":1}]`, three bookings at the same time:
      first → `table:2-seats`, second → `table:4-seats`, third → `full`.

## 3. Holds expire lazily
- [ ] Create a `pending` booking with `p_hold_until = now() + interval '1 minute'` that fills the pool. A second booking → `full`.
- [ ] Wait a minute. The second booking now → `ok` (the hold stopped counting; no cron involved).
- [ ] `select public.set_booking_status(<first id>, 'confirmed', 'me')` → `{"ok":false,"reason":"full"}` (the time was taken meanwhile).

## 4. Status changes
- [ ] pending → confirmed → `changed: true`; same again → `changed: false`.
- [ ] confirmed → declined → `invalid_transition`; confirmed → cancelled → ok; cancelled → confirmed → `invalid_transition`.
- [ ] The returned `booking` has no `cancel_token_hash` or `ip_hash` keys.

## 5. Blocks
- [ ] `insert into booking_blocks (kind, starts_at, ends_at) values ('table', '2030-01-05 18:00+00', '2030-01-05 23:00+00');`
      A table booking inside it → `{"ok":false,"reason":"blocked"}`; a space booking at the same time → ok.

## 6. Concurrency: two sessions, one last seat (the important one)
Pool of 2 covers, empty. Open **two** SQL editor tabs (two connections).

Session A:
```sql
begin;
select public.create_booking(gen_random_uuid(), 'table', '[{"id":"table:race","name":"Race","capacity":2,"buffer_minutes":0}]',
  2, '2030-02-01 19:00+00', '2030-02-01 20:30+00', 2, 'confirmed', null, 'web', 'A', null, null, null, '{}', '[]', null, null, null);
-- don't commit yet
```
Session B (while A is open): the same call with name `'B'`. **It must wait** (it is blocked on the advisory lock).

Session A: `commit;` → Session B now returns `{"ok":false,"reason":"full"}`.
- [ ] Exactly one row for `table:race`: `select name from bookings where resource_id = 'table:race';` → only `A`.
- [ ] Repeat with A doing `rollback;` instead: B must then succeed.
- [ ] Repeat with session A calling `set_booking_status(<a pending id>, 'confirmed', ...)` inside an open transaction while
      B creates on the same resource: B waits, then sees the confirmed row.

Optional load test: from a laptop, fire 20 parallel `POST /api/bookings/book` for the same last slot (different emails and IPs
or a raised rate limit). Exactly as many succeed as there are seats; the rest get 409 "just been taken".

## 7. Retention and the daily cron
- [ ] `GET /api/cron/daily` (with `CRON_SECRET`) answers `booking-core: expired holds ok; retention 100d: ...; reminders ...`.
- [ ] A booking with `ends_at` 101 days ago is gone after the run; one 99 days ago stays.
- [ ] A confirmed booking for tomorrow (business time zone) gets one reminder email; a second run sends nothing (`reminded_at` set).

## 8. Clean up
`delete from bookings where starts_at >= '2030-01-01'; delete from booking_blocks where starts_at >= '2030-01-01';
delete from booking_resources where id in ('table:race');`
