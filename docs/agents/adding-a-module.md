# Adding or changing a module

The module contract (folder layout + `module.ts` manifest) is defined in `docs/ARCHITECTURE.md` §5.
The plan and specs for every module are in `docs/MODULES.md`. Follow both exactly.

## Files every module has
`module.json` (name, version, dependsOn: read by the installer), `module.ts` (runtime manifest: config schema,
docs, tables, admin views; spreads module.json), `AGENTS.md` (full rules, copied into the module folder; the client's root AGENTS.md gets a one-line index entry),
`CHANGELOG.md`, optional `env.example` (appended to the client's .env.example), `migrations/*.sql`,
`routes/**` (auto-mounted: `routes/api/x.ts` → `/api/x`), `sections/<id>.astro` (usable in client.yaml pages),
`content-source.ts` (cms only), `cron/daily.ts` (run by the daily cron), `lib/`, `server/`, `tests/`.

Module code imports the core with relative paths from its installed location (`src/modules/<m>/`):
`../../kit/...`. Verify with `node scripts/playground.mjs && cd .playground && npm run check && npm test && npm run build`.

## Rules
- **Rule of two:** generalize a feature into a module once it has been built for 2 clients, or when the owner
  asks. The reference project counts as #1: its code is a first draft to port, not a design to copy.
- Business logic lives in `server/` + `lib/` (pure, tested), never inside visual components.
- Everything client-specific goes through the module's config schema in `schema.ts`, validated at build.
  **No client values in module code**: no currency, tax, time zone, phone region, brand color or wording.
- Content the client edits = a CMS document declared in `module.ts → docs` with a zod schema. The admin
  editor is generated from it. Don't write editor UI unless a generated one truly can't work.
- Live data = real tables + migrations + RLS (no anonymous policy on private tables).
- Every public endpoint: validate with the shared schema, honeypot + rate limit, and write side-effect outcomes to the row.
- Migrations are numbered, idempotent where possible, and **never edited after release**. Add a new one instead.
- Bump `version` in `module.ts` and write a `CHANGELOG.md` entry for any change.
- A bug fixed in a client project must be back-ported here (`/harvest` handles this).
- Tests: every pure function, every bug fix, and one end-to-end happy path per endpoint (with stubbed services).
- Changing a module's schema, migrations, RLS, or endpoint contract needs **owner approval** (AGENTS.md §6).
