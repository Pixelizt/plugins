# table-booking changelog

## Unreleased
- Duplicate code removed: shared schema fields come from booking-core, `DAYS` from the core.

## 0.1.0 (2026-11-05)
- New: `table-booking` section (date → guests → free times → details), vanilla bundled script, no-JS fallback.
- Capacity models: covers pool or table groups (smallest fitting table first). Auto or approve mode (D6).
- Large parties → enquiry link. Arrival-time opening hours (default client.hours), blackout dates, lead time, horizon.
- CMS document `table_booking` for the wording.
