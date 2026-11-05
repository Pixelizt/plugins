# Decision log

Every architectural decision for the kit, who made it, and why. **Agents: never reverse a decision
here on your own.** If you think one is wrong, propose a change in your summary with evidence.

Status: `decided` (by the owner) · `derived` (follows directly from a decided item, can be challenged) · `open`

| # | Date | Decision | Status | Why |
|---|---|---|---|---|
| D1 | 2026-11-04 | **Stack: Astro** (static-first, server endpoints only where needed, React islands only for interactive parts) | decided (owner's criteria: loads fast, modular, cheap) | Static HTML with zero JS by default is the fastest and cheapest to host. Islands allow React component libraries and 3D only where used. The reference project's  static model and Supabase CMS carry over |
| D2 | 2026-11-04 | **Copy per client.** Each client gets its own repo, its own Supabase project, its own Vercel project. The kit's code and structure are reused, not shared at runtime | decided | Clients are fully isolated; no shared outage; each client owns its code |
| D3 | 2026-11-04 | **New modules: real table booking and space/event booking.** No online payments for now | decided | The reference project only had enquiry forms. Payments wait until a client needs them |
| D4 | 2026-11-04 | **English only for now.** Arabic/RTL is not in the core | decided | Upcoming clients are English. See D12 for keeping the door open |
| D5 | 2026-11-04 | **Hosting tier is configurable** (`client.yaml → hosting.tier: free | paid`) | decided | Free tier needs workarounds (keep-alive cron, delivery status on rows); paid doesn't |
| D6 | 2026-11-04 | **Booking confirmation is configurable per client and per booking type** (`auto` or `approve`) | decided | Some venues want instant confirmations, others vet every booking |
| D7 | 2026-11-04 | **Admin dashboard is redesigned as schema-driven.** Each module declares its content shape once; the dashboard generates editors, validation, CSV and history from it | decided (owner: "redesign if simpler and best practice") | In the reference project, every new section meant editing 5 files in lockstep |
| D8 | 2026-11-04 | **Drafts are private.** Only signed-in staff and the build (server key) can read the `docs` table | decided | In the reference project, unpublished prices and offers were readable with the public key |
| D9 | 2026-11-04 | **TypeScript (strict) + zod** everywhere. One zod schema per content type drives admin forms, build validation, and types | derived from D7 | The reference project's lesson: "use a typed schema for each document" |
| D10 | 2026-11-04 | **Tailwind CSS v4 + CSS variable tokens** | derived from D1 + the owner wanting shadcn/Magic UI/Aceternity as sources to pull from | Those libraries are Tailwind-based, so tokens keep reskinning to one file. They are approved component sources (`docs/agents/ui-sources.md`), not a required framework. The admin dashboard is custom Tailwind |
| D11 | 2026-11-04 | **Supabase stays** (Postgres, Auth, Storage), with **real migrations** (`supabase/migrations/`) instead of the reference project's single hand-run SQL file | derived | The reference project lesson. Free tier fits D5 |
| D12 | 2026-11-04 | **CSS logical properties** (`margin-inline-start`, not `margin-left`) and stable field keys stay as rules, even with English only | derived from D4 | Costs nothing now; makes adding Arabic/RTL later a module, not a rewrite |
| D13 | 2026-11-04 | **Content model: the reference project's `docs` + `docs_history` pattern** (one JSON document per section, version history, optimistic-concurrency saves, publish = static rebuild via deploy hook). **Live data (bookings, submissions) uses real tables** read at runtime | derived | The docs model was the reference project's most reusable part. Bookings need live availability, which a 1 to 3 minute rebuild can't give |
| D14 | 2026-11-04 | **Package manager: npm.** Tests: Vitest (unit) + Playwright (smoke) | derived | npm is already installed everywhere. Vitest is Astro's recommended runner. `npm test` stays Vitest (what CI runs). Playwright is `npm run test:e2e` in the starter: Chromium only, so CI does not download browsers |
| D15 | 2026-11-04 | **CI from day one:** GitHub Actions runs typecheck, tests, the secret scan and the build on every push | derived | The reference project had no CI; its tests ran locally only |
| D16 | 2026-11-04 | **Roles are split:** `admin` = everything, including users, site settings and publish. `editor` = edit content and manage bookings, but can't publish or change settings. `demo` = read-only | decided | In the reference project the two roles were identical |
| D17 | 2026-11-04 | **Retention: 100 days by default** for submissions and bookings, configurable per client (`modules.forms.retention_days`, booking equivalent). The privacy policy must match | decided | Same as the reference project |
| D18 | 2026-11-04 | **Google Sheets sync is opt-in per client** (`modules.forms.sheets: false` by default) | decided | Less setup; no Google service account unless needed |
| D19 | 2026-11-04 | **Email provider: Resend** | decided | Proven in the reference project, with its templates |
| D20 | 2026-11-05 | **Kit repo: exactly one `git push`**, done by the main agent at the end, after owner approval. Sub-agents commit on local branches only, never push or add remotes | decided | Owner instruction |
| D21 | 2026-11-05 | **Reuse existing agent skills/tools found by web search** (SEO, performance, a11y, Astro, Supabase…) before writing our own | decided | Owner instruction: don't remake what exists |
| D22 | 2026-11-05 | **Agent models:** Haiku 5.5 for mechanical work, Sonnet 5.5 (effort ≤ high) for module ports, Opus 5.5 (effort ≤ medium) for the hardest ports. No Fable | decided | Owner instruction; cost |
| D23 | 2026-11-05 | **Menu search:** a pure `searchItems()` with normalization (accents, case), per-word matching, ranking (name > description), tags and allergens searchable. MiniSearch only if a client needs typos or thousands of items. No Bloom filters or hashing | derived (owner agreed) | Menus are ≤ ~2,000 items; quality matters, not speed |
| D24 | 2026-11-05 | Menu: unknown tags/sizes/nutrition keys in content **warn**, never fail the build | decided | A typo in the admin must not block publishing |
| D25 | 2026-11-05 | Menu heading is config (`modules.menu.heading`, default "Menu", "" = page supplies its own h1) | decided | Pages own their headings |
| D26 | 2026-11-05 | Content lists are **off by default**; each client enables what it uses (`modules.content-lists.enabled`) | decided | No unused editors in the admin |
| D27 | 2026-11-05 | Blog path stays `/blog` | decided | Not needed yet |
| D28 | 2026-11-05 | Events get an optional `end_time` (24h, business time zone); without it they last the whole last day | decided | Evening events shouldn't show as upcoming after they end |
| D29 | 2026-11-05 | `brand.shadow` token (none/soft/strong) → `shadow-sm/md/lg` | decided | Elevation is part of the brand, like radius |
| D30 | 2026-11-05 | Pill-shaped components (chips, pill nav, arrow bubbles) are always fully round; everything else follows `brand.radius` | decided | Pills by design |
| D31 | 2026-11-05 | Meal plans: a plan with missing picks is **blocked in the browser**; the server still saves a slipped-through one as "price to confirm" | decided | |
| D32 | 2026-11-05 | Meal plans: the customer confirmation **shows the full plan and price** (server-generated data only, rule 9 holds) | decided | |
| D33 | 2026-11-05 | **Content snapshot:** the build fetches CMS documents once and bundles them; pages and server functions read the same snapshot, so servers price/validate against what was published, not unpublished edits | decided | Closes the Save-vs-Publish drift |
| D34 | 2026-11-05 | No live Supabase test before release; `/new-client` ships without a dry run | decided | Owner's call; first real client is the test |
| D35 | 2026-11-05 | Bookings: build `booking-core`, `table-booking`, `space-booking` with configurable defaults (owner: "do it") | decided | Business rules stay per-client config |
| D36 | 2026-11-05 | **Do not add `@supabase/supabase-js` or the `resend` SDK.** Supabase (PostgREST + Auth) and Resend are called with plain `fetch` | decided | Lean dependencies, next to D14. The starter only makes a handful of HTTP calls, and Vitest stubs `fetch`. Helpers: `starter/src/kit/server/supabase.ts`, `modules/cms/lib/client.ts`, `modules/admin/app/session.ts`, `starter/src/kit/email/send.ts` (`POST https://api.resend.com/emails`). Do not "complete" the integration by installing either package |
