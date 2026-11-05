## Module: table-booking (0.1.0)

Real table booking (D3, no payment): the `table-booking` section asks date → guests → free times → details and books
through booking-core (live availability, no double booking, emails, cancel link). New design.

**Using it**
- Fill `client.yaml → modules.table-booking` (below) and add `table-booking` to a page's sections.
  Hidden (rule 4) until it has capacity (`covers_per_slot`, or `tables`) and opening hours.
- Wording = CMS document `table_booking` (seed `src/content/table_booking.json`). `success_pending` must say the
  table is NOT confirmed yet (rule 18). Write `no_js` so people without JavaScript know to call or enquire.
- The widget is a bundled vanilla script (`lib/client/widget.ts` + booking-core's `lib/client/ui.ts`), no React,
  no inline JS (strict CSP). Restyle by copying the section to `src/sections/table-booking.astro`; keep the
  `data-*` attributes, input names and ids. Shared steps: booking-core's `components/Times.astro` and `Details.astro`.

**Config** (all optional; empty = hidden). Never invent these: ask the client (rule 34).
```yaml
table-booking:
  mode: auto                  # auto = confirmed at once if there's room; approve = request, staff accept/decline (D6)
  hold_minutes: 120           # approve: how long a request holds its seats
  capacity_model: covers      # covers | tables
  covers_per_slot: 40         # covers: most guests booked in at the same moment (overlaps add up)
  # tables: [{ seats: 2, count: 6 }, { seats: 4, count: 4 }]   # tables: smallest table that fits; tables aren't joined
  slot_minutes: 15            # start times every 15 min
  duration_minutes: 90        # how long a table is kept
  party_size: { min: 1, max: 8 }
  large_party_enquiry_over: 6 # bigger groups get the enquiry link (default party_size.max)
  enquiry_url: /contact       # also the no-JS fallback
  lead_time_minutes: 60
  max_days_ahead: 60
  opening_hours: { mon-fri: "12:00-14:30, 18:00-21:30", sat: "12:00-21:30", sun: closed }  # ARRIVAL times; default client.hours
  blackout_dates: ["2026-12-25", "2026-12-31..2027-01-01"]
  label: Table                # in emails and the admin
```
- `opening_hours` here are **arrival** windows: "18:00-21:30" means the last table is at 21:30. Lines later in the
  list win for the days they name; "closed" closes a day; an end before the start runs past midnight.
- `tables` resources are `table:<seats>-seats`. Changing a group's seats creates a new resource; old bookings keep theirs.

**Gotchas**
- `covers_per_slot` counts guests present at the same time, not arrivals per slot. Kitchen pacing isn't modelled.
- Staff phone bookings (admin) may exceed the online party limit, up to what fits.
- Build warnings flag a covers pool smaller than the largest party, or tables too small for the online limit.
