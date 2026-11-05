## Module: booking-core (0.1.0)

The booking engine behind `table-booking` and `space-booking` (install one or both of those; they bring this).
Real bookings with live availability, no payments (D3). New design, not a port.

**Data** (`migrations/0001_bookings.sql`, RLS on, no anonymous access, server-only writes, rule 12)
- `bookings`: one row per booking. `status` pending | confirmed | declined | cancelled | expired, `starts_at`/`ends_at`
  (timestamptz), `party_size`, `units` (capacity used), `hold_until`, contact, `fields` (occasion, extras), `facts`
  (server-built display rows for emails), `cancel_token_hash`, `ip_hash`, `delivery`, `decided_by/at`, `reminded_at`.
- `booking_resources`: a mirror of the configured resources (`table:covers`, `table:4-seats`, `space:<id>`) with
  capacity and buffer. `create_booking` refreshes it on every call: **client.yaml is the source of truth**.
- `booking_blocks`: staff closures (whole day or a time range; everything, a kind, or one space).
- Rules (hours, slots, lead time, horizon, blackout dates) are NOT in the database: they're config, shared by page and server.
- Staff (admin + editor) can SELECT (not the token or IP hash columns). Nobody gets UPDATE: status changes go through
  `set_booking_status`, called only by the server after `requireRole` (rule 11).

**No double booking**: `create_booking(...)` takes a transaction advisory lock per candidate resource (sorted, no
deadlocks), then counts the peak units in use over the requested time (confirmed + pending with `hold_until > now()`),
then inserts. `set_booking_status(..., 'confirmed')` takes the same lock and re-checks. Two requests for the last seat
run one after the other; the second gets `full` → the visitor sees "Sorry, that time has just been taken" (409).
`lib/capacity.ts` is the same maths in TypeScript, for showing free times only. Change both together.

**Holds expire lazily**: an unanswered approve-mode request stops counting at `hold_until` (no frequent cron, D5).
The daily cron then marks it `expired` (staff can still accept it if there's room).

**Endpoints** (`routes/`)
| Method + path | Who | What |
|---|---|---|
| `GET /api/bookings/availability?type=…&date=…` (+ `party`, or `space`+`duration`) | public | free start times, no personal data, `s-maxage=15` |
| `POST /api/bookings/book` | public | honeypot `_gotcha`, rate limit (hashed IP), create, emails, `delivery` |
| `GET/POST /bookings/cancel?id=…&t=…` | link holder | page: GET shows, POST cancels (idempotent), works without JS |
| `POST /api/bookings/status` `{id, status, notify?}` | editor+ | accept / decline / cancel, emails the customer |
| `POST /api/bookings/manual` | editor+ | phone booking: confirmed, skips lead time, capacity still applies |
| `POST /api/bookings/block` `{action:add|remove,…}` | editor+ | closures; reports how many bookings are already inside |
| `GET /api/bookings/meta` | editor+ | types, spaces, block scopes for the admin view |

**Booking types** (the extension point): a module exports `default () => BookingType | null` from its
`booking-type.ts` (contract in `lib/schema.ts`): `kind`, `label`, `configured`, `resolve(ask, {staff})` → rules,
duration, candidates, units, mode, hold, `facts` (config text only), `fields`; and `describe()`. Found by
`server/types.ts` with `import.meta.glob`. Dates, slots, capacity, emails and the database are booking-core's job.

**Emails** (`server/emails.ts`, HTML + text, rule 22). Customer: received (approve mode: "NOT confirmed yet", rule 18),
confirmed, declined, cancelled, reminder. They carry fixed wording + reference, date/time and `facts`; **never the
visitor's name, notes or anything they typed** (rule 9). Team: new booking / request to decide / customer cancelled,
to `BOOKINGS_EMAIL_TO` (else `FORMS_EMAIL_TO`). Every outcome lands in `delivery` (rule 20).

**Cancel links**: token = HMAC-SHA256(`BOOKING_TOKEN_SECRET`, booking id); the row keeps sha256(token) only. The
reminder rebuilds the link from the id. Changing the secret retires all links; no secret = emails say "call us".

**Config** (`client.yaml → modules.booking-core`, all optional): `retention_days` (100, D17: deletes bookings that
ENDED that long ago; privacy policy must match), `rate_limit {max: 5, window_minutes: 10}`, `require_phone` (true),
`reminders` (true; daily cron batch), `customer_cancel_minutes` (0 = until the start), `emails.<received|confirmed|
declined|cancelled|reminder>: {subject, heading, body[]}` to replace the default wording.

**Admin**: the custom view `bookings` (`admin/bookings.tsx`, registered in `module.ts → adminViews`): day/week list,
accept/decline/cancel, closures, phone bookings, CSV. No generic `tables` entry on purpose (it reads `select=*`).

**Install / launch checklist**
1. Install `table-booking` and/or `space-booking`. Run the new migration (needs the cms one first).
2. Set `BOOKING_TOKEN_SECRET` (32+ random chars), `BOOKINGS_EMAIL_TO`, plus the forms/email vars.
3. Run `tests/sql.md` against the real database once (privileges, capacity, **the two-session concurrency check**).
4. Make one test booking of each type; check the emails, the cancel link and the `delivery` column in the admin.

**Gotchas**
- Time zone = `client.timezone` everywhere (rule 21). Don't format times with the server's clock or `toLocaleString()` without `timeZone`.
- Times skipped by a DST change have no slot; a repeated hour books the first occurrence.
- A new closure doesn't cancel existing bookings: staff call those customers (the admin says how many).
- Reminders run once a day (free tier, D5). A separate schedule on the paid tier isn't built: add one only with the owner.
- Availability is cached 15 s at the edge: a just-taken slot can still show; the database refuses it anyway.
