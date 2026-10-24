# Pixelizt Booking — Project Plan

A reusable, multi-client **backend** for table reservations and event management. One hosted system serves every client website. Each client keeps its own custom frontend and connects through an API and a JavaScript SDK. Staff manage everything from one simple admin dashboard.

---

## 1. Goals

- **Build once, use for every client.** Fixes and features ship to all clients at the same time.
- **Headless.** Each client's frontend is custom (Framer, WordPress, React, plain HTML). The backend never dictates the UI.
- **Simple admin.** Restaurant and venue staff can use the dashboard without training, on a phone, tablet or laptop.
- **Safe multi-tenancy.** One client can never see another client's data.
- **Fast onboarding.** A new client goes live by creating an account, setting hours and tables, and copying an API key.

## 2. Architecture

```
 Client A site (Framer)   Client B site (WordPress)   Client C (custom React)
   custom UI                  custom UI                   custom UI
        └────────────── @pixelizt/booking-sdk (JS) ─────────────┘
                                   │  publishable key = which client
                                   ▼
                    ┌───────────────────────────────┐
                    │ Booking API (REST, /v1)       │
                    │  /availability /reservations  │
                    │  /events /tickets /checkin    │
                    └──────────────┬────────────────┘
                                   │
         Postgres (multi-tenant, RLS) · Email/SMS · Webhooks · Stripe
                                   │
                    Admin dashboard (client staff + agency super-admin)
```

### Deliverables

| # | Deliverable | Description |
|---|---|---|
| 1 | **Booking API** | Versioned REST API (`/v1/...`) with an OpenAPI spec. The single source of truth. |
| 2 | **JS/TS SDK** | `@pixelizt/booking-sdk`, which wraps the API (`getAvailability`, `reserve`, `listEvents`, `buyTicket`, ...). Works in any frontend. |
| 3 | **Admin dashboard** | The one UI we own. Used by client staff and by the agency super-admin. |
| 4 | **Webhooks** | `reservation.created`, `reservation.cancelled`, `ticket.checked_in`, etc., pushed to client systems (CRM, Slack, Zapier). |
| 5 | **Integration docs** | A "connect a new client site in 10 minutes" guide plus the API reference. |

### Tech stack

- **Backend:** Supabase (Postgres, Auth, Edge Functions, Realtime, Storage)
- **Dashboard:** Next.js + Tailwind + shadcn/ui
- **SDK:** TypeScript, zero dependencies, published to npm
- **Email:** Resend · **SMS/WhatsApp (later):** Twilio · **Payments (later):** Stripe Connect
- **Repo:** monorepo (pnpm workspaces)

## 3. Multi-tenancy and security

- Each client is an **organization**. An organization can have multiple **venues** (branches).
- **Row-Level Security** on `org_id` for every table, so data isolation is enforced by the database, not only by app code.
- **API keys per organization:**
  - `pk_live_...` **Publishable key.** Safe to use in frontend code. Can only call public endpoints (availability, create booking, list events). Locked to allowed domains (CORS) and rate limited.
  - `sk_live_...` **Secret key.** Server-side use only, with full access.
- **Abuse protection:** Cloudflare Turnstile on public booking endpoints, per-IP and per-key rate limits.
- **GDPR:** consent flags, guest data export and deletion, data retention settings.

## 4. Data model (phase 1–3)

```
organizations ─┬─ venues ─┬─ tables (capacity, min/max party, combinable)
               │          ├─ opening_hours / blackout_dates / slot_rules
               │          ├─ reservations (guest, party_size, start/end, status, source)
               │          └─ events ── ticket_types ── tickets (QR code, check-in status)
               ├─ guests (shared across venues; consent, notes, visit & no-show count)
               ├─ staff_members (role: owner / manager / host)
               ├─ api_keys · webhooks · notification_templates
               └─ audit_log
```

## 5. Booking engine rules

- **No double-bookings.** A Postgres exclusion constraint on `(table_id, time range)` makes overlapping bookings impossible, even when two requests arrive at once.
- **Availability engine.** Venue + date + party size returns open slots, using opening hours, slot length, buffers between bookings, table capacity and combinations, blackout dates and existing bookings.
- **Short holds.** A selected slot is held for about 5 minutes while the guest completes details or payment, then released automatically.
- **Idempotency keys.** Retries and double-clicks never create duplicate bookings.
- **Timezones.** Stored in UTC. Each venue has its own timezone.
- **Guest self-service.** Signed links in emails let guests view, modify or cancel without an account.

## 6. Admin dashboard (simple UI, easy access)

### Access
- **Login with a magic link (email) or Google.** No passwords.
- **Mobile- and tablet-friendly**, and installable on the home screen (PWA) for the front desk.
- **One login, many venues.** Switch branches from a dropdown.
- **Roles:** Owner (everything) · Manager (bookings, events, settings) · Host (today's bookings and check-in only).

### Screens (only five)

```
┌──────────────────────────────────────────────────────────────┐
│ ☰  Jun Restaurant ▾        Today · Sat 24 Oct     [+ Booking]│
├──────────┬───────────────────────────────────────────────────┤
│ Today    │  Lunch (12)            Dinner (28)                │
│ Bookings │  ┌──────────────────────────────────────────────┐ │
│ Events   │  │ 19:00  Priya S.   4 ppl  Table 6   ✔ Arrived │ │
│ Guests   │  │ 19:30  Rahul K.   2 ppl  Table 2   ○ Pending │ │
│ Settings │  │ 20:00  Anna M.    6 ppl  T8+T9     ✖ Cancel  │ │
│          │  └──────────────────────────────────────────────┘ │
│          │  Covers tonight: 40 / 60    Walk-in [+]          │
└──────────┴───────────────────────────────────────────────────┘
```

1. **Today.** The home screen. Today's bookings in time order, one tap for Arrived / No-show / Cancel, quick walk-in, and live updates as new bookings arrive.
2. **Bookings.** Calendar and list for any date, search by name or phone, edit or move a booking.
3. **Events.** Create an event in one form (name, date, capacity, tickets), see the attendee list, check in by QR scan with the phone camera.
4. **Guests.** Visit history, no-shows, notes (for example allergies).
5. **Settings.** Opening hours, tables, booking rules, email text. Plain forms and toggles.

**Super-admin (agency only):** a **Clients** screen to add clients, manage their API keys, and log in as a client for support.

### UI principles
- One main action per screen.
- Plain language ("Tables", not "resources").
- Sensible defaults: usable after setting hours and tables.
- Confirm before destructive actions, with undo for quick mistakes.

## 7. Roadmap

| Phase | Scope |
|---|---|
| **1. Foundation** | Monorepo, Supabase project, organizations/venues/staff/roles, RLS, API keys, dashboard login, Clients screen, OpenAPI spec, SDK v0 |
| **2. Reservations** | Tables, hours, rules, availability engine, create/modify/cancel, confirmation and reminder emails, Today and Bookings screens. **Pilot with one real client.** |
| **3. Events** | Events, ticket types, free RSVP tickets, QR codes, check-in, attendee export, Events screen |
| **4. Payments & integrations** | Stripe Connect deposits and paid tickets, webhooks, SMS/WhatsApp, waitlist |
| **5. Extras** | Analytics, Google Calendar sync, floor plan data, multi-language emails |

## 8. Repository layout

```
supabase/          migrations, RLS policies, edge functions (the API)
packages/sdk       @pixelizt/booking-sdk
packages/types     shared TypeScript types (generated from DB / OpenAPI)
apps/dashboard     admin dashboard (Next.js)
docs/              API reference + client integration guide
```

## 9. Branching

- `main`: plugin source code only.
- `plan`: this planning document and other project docs.

## 10. Open questions

- Which client goes first as the pilot?
- When do the first clients need payments (deposits or paid tickets)?
- Do we manage bookings on behalf of clients, or only client staff?
- Do we need email notifications in languages other than English at launch?
