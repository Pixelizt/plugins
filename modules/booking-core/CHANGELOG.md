# booking-core changelog

## Unreleased
- Duplicate code removed: calendar and time-zone maths moved to the core (src/kit/lib/time.ts; lib/time.ts keeps only the date wording); `oneLine`, site URL and the delivery `attempt` wrapper come from the core; staff endpoints reuse `fail`/`NO_STORE` from book.ts; table/space shared schema fields live in lib/schema.ts.

## 0.1.0 (2026-11-05)
- New: `bookings`, `booking_resources` (config mirror), `booking_blocks`; RLS on, staff SELECT only (no token/IP hash columns).
- `create_booking` / `set_booking_status` with per-resource advisory locks and exact peak-capacity checks: no double booking.
  Lazy hold expiry; the daily cron marks expired holds, applies retention (D17) and sends tomorrow's reminders.
- Pure libs: time-zone maths (DST-safe), slots from opening hours, capacity (covers, tables, whole spaces with buffers).
- Endpoints: availability, book, cancel page (signed HMAC links, hash stored), staff status / manual / block / meta.
- Emails: received (not confirmed), confirmed, declined, cancelled, reminder; team notifications; wording overridable.
- Admin custom view `bookings` (day/week list, decisions, closures, phone bookings, CSV).
- Booking-type extension point (`booking-type.ts`), used by table-booking and space-booking.
