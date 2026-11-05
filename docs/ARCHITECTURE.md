# Architecture

How the kit works and how a client site built from it is structured.
Decisions referenced as D1, D2… are in [`DECISIONS.md`](DECISIONS.md).

---

## 1. Two kinds of repo

| | **The kit** (the kit, this repo) | **A client site** (one repo per client) |
|---|---|---|
| Purpose | Source of reusable code, rules and procedures | One live website |
| Contains | `starter/`, `modules/`, `registry/`, kit docs, skills, `clients/<slug>/client.yaml` briefs | A copy of `starter/` + chosen modules + client content and assets |
| Supabase / Vercel | none | its own project each (D2) |
| Who edits | agency (humans + agents), improved after every client | agents reskin and configure; the backend stays frozen |

The boundary between the two is strict: see [`BOILERPLATE-BOUNDARIES.md`](BOILERPLATE-BOUNDARIES.md) for what goes where and what never gets copied.

## 2. Client site layout (what `/new-client` produces)

```
<client>-site/
├── client.yaml                  # the brief: source of truth (copied from kit clients/<slug>/)
├── AGENTS.md / CLAUDE.md        # generated: starter rules + module rules + "This client"
├── astro.config.ts              # kit-managed; reads client.yaml (fonts, CSP, site URL)
├── vercel.json                  # security headers + the daily cron
├── .env.example                 # names only, with a comment per variable
├── src/
│   ├── kit/                     # 🔒 KIT CORE: config schema + loader, tokens, content loader, SEO, cron runner
│   ├── modules/<name>/          # 🔒 copied modules (backend frozen; sections overridable)
│   ├── sections/<id>.astro      # site sections: free to reskin; same id overrides a module section
│   ├── components/              # Header, Footer, Seo, Sections renderer
│   ├── layouts/Base.astro
│   ├── content/<key>.json       # seed content (the CMS document wins once saved)
│   ├── pages/
│   │   ├── [...slug].astro      # every page in client.yaml → pages, built from its section list
│   │   ├── *.astro              # optional hand-written pages (override the config route)
│   │   └── api/                 # server endpoints (prerender = false), e.g. api/cron/daily
│   └── styles/
│       ├── global.css           # Tailwind + token mapping: free to extend
│       └── tokens.css           # GENERATED from client.yaml → brand (git-ignored)
├── supabase/migrations/         # one numbered SQL file per module
├── scripts/                     # secret-scan.mjs, validate-config.ts
├── tests/                       # vitest
├── docs/LEARNINGS.md            # client-level learnings → pulled into the kit by /retro
├── .github/workflows/ci.yml     # scan, typecheck, test, build (D15)
└── .githooks/pre-commit         # secret scan
```

## 3. Rendering model: static first (D1)

- **Every public page is prerendered** to static HTML at build time, with zero JS by default.
- **Interactive parts are islands:** a React (or vanilla) component hydrated with `client:visible`
  or `client:idle`. Examples: menu search and filters, the booking widget, a 3D hero.
- **Server endpoints** (`src/pages/api/*`, `prerender = false`) run as Vercel functions, only for things
  that must be live or secret: form submit, booking availability and create, publish, cron jobs.
- **Images** go through Astro's image pipeline (responsive, WebP/AVIF, width and height set automatically).
  This replaces the reference project's 5-variant manual image system.

### Config-driven pages
`client.yaml → pages[]` lists each page's sections in order; `src/pages/[...slug].astro` renders them.
Section ids resolve to `src/sections/<id>.astro` first, then `src/modules/*/sections/<id>.astro`. An unknown
id fails the build. **Reordering a page = reordering a list.** Restyling a module section = copying it to
`src/sections/` under the same id.

## 4. Data model

### 4.1 Content (CMS): the reference project's docs pattern (D13)
```
docs          (key text PK, value jsonb, updated_at timestamptz)
docs_history  (id, key, value, saved_at, saved_by): filled by a trigger, last N per key
```
- One document per content section (`menu`, `site`, `events`, `faqs`, `gallery`, …).
- Each module **declares** its documents with a zod schema (§5). That one schema gives the type, the
  dashboard editor, save validation and build validation.
- **Save:** optimistic concurrency. The PATCH is filtered on `updated_at`; 0 rows back means a conflict.
- **Publish:** the dashboard calls `/api/publish`, which checks the role, rate-limits, and triggers the
  Vercel deploy hook. The build pulls the docs with the **service key** (drafts are private, D8), validates
  them, and renders.
- **Content snapshot (D33):** the build reads all saved documents once and bundles them (`virtual:kit/content-snapshot`).
  Server functions read the same snapshot as the pages, so prices and validation always match what was published.
- **Seed vs saved:** `src/content/*.json` is the starting copy. Once a section is saved in the dashboard,
  the saved document wins. The build logs which source each section came from (a the reference project gotcha, made visible).

### 4.2 Live data: real tables
| Table | Module | Notes |
|---|---|---|
| `submissions` | forms | Enquiries; RLS with no anonymous policy; server writes only; retention cron |
| `booking_resources` | booking-core | Bookable things (`table:covers`, `table:<n>-seats`, `space:<id>`), synced from config on each booking |
| `booking_blocks` | booking-core | Staff closures (a date/time for everything, one kind, or one space) |
| `bookings` | booking-core | `status: pending | confirmed | declined | cancelled | expired`, party size, start and end, contact, `delivery` jsonb |

- **Rules live in config, not a table** (hours, slot length, lead time, horizon, blackout dates): zod-validated, shared
  by browser and server. Quick staff closures go in `booking_blocks`.
- **No double booking:** bookings are created through a Postgres function (`create_booking`) that locks
  the resource and checks capacity in one transaction.
- **Holds expire lazily:** capacity queries ignore `pending` rows past `hold_until`, so no frequent cron
  is needed on the free tier (D5). A paid-tier cron can tidy them up.
- **Time zone** comes from `client.yaml → client.timezone`. It never comes from the server clock (The reference project rule 35).

### 4.3 Storage
Supabase Storage buckets `images` and `videos`: public read, editor write, size and type limits.
Images are converted to WebP in the browser before upload (from the reference project).

## 5. Module contract

Every module in `modules/<name>/` has the same shape:

```
modules/<name>/
├── AGENTS.md            # purpose, config, extension points, install steps, gotchas
├── module.ts            # the manifest (below)
├── schema.ts            # zod: content documents + client.yaml config block
├── migrations/          # SQL, numbered, idempotent
├── server/              # endpoint handlers + pure business logic (frozen per client)
├── lib/                 # pure functions shared by browser and server (one rule, one place)
├── components/          # Astro components (static) + islands (interactive): token-themed
├── admin/               # optional custom dashboard views (most modules need none, see §6)
├── emails/              # email templates (team + customer, HTML + text)
├── seed/                # demo content
└── tests/
```

```ts
// module.ts: what the kit reads to install and wire a module
export default defineModule({
  name: "table-booking",
  version: "0.1.0",
  dependsOn: ["booking-core", "forms"],
  config: TableBookingConfig,                     // zod: validated against client.yaml
  docs: { booking_page: BookingPageDoc },         // CMS documents → auto dashboard editors
  tables: ["bookings"],                           // live tables → dashboard list views
  routes: { "/api/bookings": "./server/create.ts", "/api/availability": "./server/availability.ts" },
  admin: [{ id: "bookings", label: "Bookings", view: "./admin/BookingsView.tsx" }],
  env: ["RESEND_API_KEY"],
  crons: [{ path: "/api/bookings/reminders", schedule: "0 6 * * *", tier: "paid" }],
});
```

## 6. Admin dashboard: schema-driven (D7)

- A single React app at `/admin`, rendered client-only, built with shadcn/ui and kept plain (no animation).
- Auth: Supabase Auth email + password. Role in `app_metadata.role`. **RLS is the real boundary**; server
  functions re-check the role (The reference project rule 13).
- **Generated from module manifests:**
  - `docs` → a form editor generated from the zod schema (text, rich text, number, money, image, list,
    select, toggle, date) with validation, "last saved", History and Restore, and conflict detection
  - array documents → a list editor with add, edit, delete, reorder, CSV import (with diff preview) and export
  - `tables` → a filterable list with a detail view and CSV/XLSX export
- **Custom views** only where a generated view isn't enough (a bookings calendar, for example).
- **Publish** button, plus a change-summary email to the owner (from the reference project's `notify`).
- **Adding a new editable section = adding one zod schema to a module.** No other files change.

## 7. Configuration: `client.yaml`

- Validated at build start against the combined schemas of the starter and every installed module.
  An invalid config **fails the build** with a readable message.
- Generates `tokens.css` (brand), the module configs, `vercel.json` crons (filtered by `hosting.tier`)
  and JSON-LD business data.
- Secrets never go in it, only in env vars.

## 8. Hosting tiers (D5)

| | `free` | `paid` |
|---|---|---|
| Supabase keep-alive cron (daily) | on | off |
| Crons | 1 per day, combined into `/api/cron/daily` | per module schedule |
| Delivery status written on each row | on (logs last 1 hour) | on (still useful) |
| Booking reminder emails | daily batch | scheduled |

> Note: Vercel's Hobby plan terms are for non-commercial use. Confirm before putting a paying client on it.

## 9. Security baseline
The security rules for every module (CSP, server re-validation and re-pricing, email rules, rate limits, secret
scan, private tables) are in [`agents/rules-learned.md`](agents/rules-learned.md), "Security & privacy". Each module's
`AGENTS.md` cites the rule numbers it applies.
