# Modules: specs and build order

Each module's detailed rules live in `modules/<name>/AGENTS.md` once it's built. This file is the plan.
Status and versions are tracked in `catalog.yaml` and the README catalog, not here.

| # | Module | Required? | Ports from the reference project |
|---|---|---|---|
| 0 | `starter` | always | build/SEO/security/keepalive/secret scan |
| 1 | `cms` | always | docs + history, pull, publish, notify |
| 2 | `admin` | always | admin.js patterns (redesigned, D7) |
| 3 | `forms` | always (contact form) | submit, emails, sheets, validation |
| 4 | `menu` | optional | menu.json shape, menu.js, menuStatic |
| 5 | `content-lists` | optional | events, offers, FAQs, reviews, gallery, posts |
| 6 | `booking-core` | dependency of 7 and 8 | **new** |
| 7 | `table-booking` | optional | **new** (The reference project had an enquiry form) |
| 8 | `space-booking` | optional | **new** (The reference project had a party enquiry form) |
| 9 | `meal-plans` | optional | plans.js engine + plan-quote (the reference project's "subscriptions") |
| (later) | `payments` | | Q1 open |
| (later) | `i18n` | | The reference project's Arabic system as reference |

---

## 0. starter
The site skeleton every client gets.
- Astro + Vercel adapter + React + Tailwind v4; TypeScript strict
- `client.yaml` loader + zod validation; `tokens.css` generated from `brand`
- Base layout: header and nav from `pages`, footer, mobile action bar (call / directions / book), skip link
- SEO: canonical, Open Graph, JSON-LD (`Restaurant` / `CafeOrCoffeeShop` / `LocalBusiness`), `sitemap.xml`, `robots.txt` (disallows `/admin`), `llms.txt`
- Security headers + CSP via `vercel.json` (generated)
- Free tier: `/api/cron/daily` (keep-alive + runs the modules' daily jobs)
- Tests: secret scan, build smoke, payload budget; CI workflow; pre-commit hook

## 1. cms
- **Tables:** `docs`, `docs_history` (trigger, last 20 per key). RLS: read and write for `admin`/`editor`, no anonymous access (D8)
- **Build:** `loadDoc(key, schema, seed)`. Pulls with the service key, validates against the schema, falls back to the seed file, and logs the source. Fails the build if the DB is unreachable and `CMS_REQUIRED=true` (the default in production)
- **Endpoints:** `POST /api/publish` (role check, 1 per minute, deploy hook), `POST /api/notify` (change summary to the owner, batched)
- **Lib:** `diff.ts` (human-readable change lists)

## 2. admin
- `/admin`: a client-only React + shadcn app
- Login, session refresh, role gate (`admin`, `editor`, `demo` = read-only)
- Generates from module manifests: document editors, list editors (reorder, CSV import with diff, export), table views (filters, detail, CSV/XLSX export)
- Shared widgets: image upload (→ WebP, Supabase Storage), video link or upload (trim to N seconds), money, date/time, rich text
- History and Restore, conflict detection, "Last saved", Publish button, unsaved-changes guard
- Custom views are registered by modules (e.g. a bookings calendar)

## 3. forms
- **Content:** form definitions as a CMS doc (`forms`): fields `{ key, label, type, required, options, min, max, placeholder }`, plus per-form email wording
- **Endpoint:** `POST /api/submit`. Validates against the definition (shared validator), honeypot, rate limit (HMAC IP hash, N per window), inserts the row, then sends the Sheet + team email + customer email in parallel, then patches `delivery`
- **Table:** `submissions` + retention job
- **Config:** `phone_region`, `retention_days`, `rate_limit`, `sheets: on/off`, `email.provider`
- **Components:** `<Form id="contact" />` (static markup + a small island for validation and submit)

## 4. menu
- **Doc:** `menu` = `{ currency, categories[], items[], addons[] }`. Item: `id, category, name, description, prices[{size, price}], allergens[], tags[], nutrition{}, available, image`
- **Config:** tag vocabulary + filter keys, size names, nutrition fields shown, price display
- **Components:** static full menu (SEO) + a search/filter island; menu preview section; QR code generation
- **Admin:** generated list editor + CSV import/export (The reference project's column spec)

## 5. content-lists
Small editable lists, each one schema: `events` (with start/end expiry, past events, videos), `offers`
(auto-expire), `faqs`, `reviews`, `gallery`, `posts` (blog). Each list can be switched on or off in config.

## 6. booking-core (new)
The shared engine for table and space booking.
- **Tables:** `booking_resources`, `booking_rules`, `bookings` (ARCHITECTURE §4.2)
- **DB function:** `create_booking(...)` locks the resource, checks capacity and creates the row atomically
- **Lib (pure):** slot generation from opening hours + slot length + lead time + blackout dates, in the business's time zone; capacity math
- **Statuses:** `pending → confirmed | declined | expired`, `confirmed → cancelled`
- **Mode per booking type:** `auto` (confirmed instantly if capacity allows) or `approve` (pending + `hold_until`; staff accept or decline)
- **Customer self-service:** cancel link with a signed token (HMAC), no customer accounts
- **Emails:** request received (with "not confirmed yet" wording in approve mode), confirmed, declined, cancelled, reminder (paid tier or daily batch)
- **Admin:** a day/week calendar + list, accept/decline/cancel, block dates, manual booking for phone bookings

## 7. table-booking
- Resources = table groups (`2-seaters × 6`, `4-seaters × 4`), or simply total covers per slot (config chooses)
- **Widget:** date → party size → available times → details → submit
- **Config:** `mode`, `slot_minutes`, `duration_minutes`, `party_size {min,max}`, `lead_time_minutes`, `max_days_ahead`, `capacity_model: covers | tables`, large-party threshold (falls back to an enquiry)

## 8. space-booking
- Resources = spaces (Rooftop, Back Room) with `capacity`, `min_hours`, `price_per_hour` (display only, no payment, D3), and a gallery
- **Widget:** space → date → start time + duration → guests + occasion → details
- **Config:** `mode` (often `approve`), `buffer_minutes` between bookings, add-ons list (cake, decor) as request fields

## 9. meal-plans
The reference project's "subscriptions": priced meal-plan **requests**, no payment.
- **Lib:** the reference project's `engine()` / `price()`, generalized: slots, grids, lengths, rounding step, tax rate and label, discount rate card, set menus with "of your choice" items
- **Server re-pricing** on submit (rule 8), through the `forms` pipeline
- **Config:** everything that the reference project hardcoded (BOILERPLATE-BOUNDARIES §2.2)
- **Data test template:** "match the client's printed price sheet" (rule 23)
