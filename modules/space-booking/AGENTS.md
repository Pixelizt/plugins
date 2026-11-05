## Module: space-booking (0.1.0)

Space / private-hire booking (D3: no payment; prices are display-only). The `space-booking` section asks
space → date → length → free start times → guests, occasion, extras → details, and books through booking-core.

**Using it**
- List the spaces in `client.yaml → modules.space-booking.spaces` and add `space-booking` to a page.
  Hidden (rule 4) until at least one space has opening hours.
- Descriptions and photos = CMS document `spaces` (seed `src/content/spaces.json`, demo entry `sample: true`).
  Its `spaces[].id` must match a config id (the build warns otherwise). Use only the client's own photos (rule 35).
- `success_pending` must say the booking is NOT confirmed and nothing has been paid (rule 18).
- Restyle by copying the section to `src/sections/space-booking.astro`; keep `data-*` attributes, names and ids.

**Config** (empty = hidden). Never invent spaces, prices or rules: ask the client (rule 34).
```yaml
space-booking:
  mode: approve               # usual for spaces (D6); auto = confirmed at once if free
  hold_minutes: 2880          # a request holds the space for 2 days while staff decide
  buffer_minutes: 30          # kept free between two bookings of a space (set-up, cleaning)
  slot_minutes: 30            # start times and lengths go in these steps
  lead_time_minutes: 1440
  max_days_ahead: 180
  opening_hours: { mon-sun: "10:00-23:00" }   # the WHOLE booking must fit inside; default client.hours
  blackout_dates: []
  spaces:
    - { id: rooftop, name: Rooftop, capacity: 25, min_guests: 8, min_hours: 2, max_hours: 5, price_per_hour: 100 }
    # per space: opening_hours overrides the module's
  occasions: [Birthday, Work event, Other]   # empty = not asked
  addons: [{ key: cake, label: Celebration cake }]   # requests only: staff confirm them
  enquiry_url: /contact
  label: Space
```
- A space is booked whole (one booking at a time + buffer); guests are checked against its `capacity`.
- Resources are `space:<id>`. Never change a space `id` once it has bookings (rule 17).
- Occasion and extras are stored as keys in `fields` and shown (config labels) in emails as "Extras requested".

**Gotchas**
- `price_per_hour` is shown as a guide with the doc's `price_note`. No total is computed or charged.
- Staff block a single space from the admin ("Block a date or time" → the space's name).
