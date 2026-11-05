## Module: cms (0.1.0)

Content the client edits in the admin is stored as **documents**: one JSON value per section, in the `docs` table.
Ported from the reference project (rules 31–33).

**How it works**
- A section calls `loadDoc("hero", HeroDoc)`. The build reads all saved docs **once** with the service key (drafts are
  private, D8) into a bundled content snapshot (D33). Pages and server functions both read that snapshot, so servers
  never see unpublished edits. A saved doc wins over `src/content/<key>.json`.
- The build **fails** if Supabase is configured but unreachable (`CMS_REQUIRED=false` overrides; local only).
- Saves are optimistic: a stale editor gets a conflict, never silently overwrites (`lib/client.ts`).
- Every save keeps the previous version in `docs_history` (last 20) for History / Restore.
- **Publish** (admin only) → `POST /api/publish` → Vercel deploy hook → full static rebuild (1–3 min) → email to `OWNER_EMAIL`
  listing what changed since the last publish (labels from the doc schemas).

**Rules**
- New editable content = a zod schema in a module's `module.ts → docs` (or the starter's `docs.ts`). Give fields
  `.meta({ label })`; the admin, history and emails use it. Don't write editor UI.
- Admin-only documents must use keys starting with `settings_` (the database policy keys off the prefix).
- Keys starting with `_` are server bookkeeping (`_publish`); never read or write them from the browser.
- Before saying "it's live": a saved document overrides the seed file (rule 31). Check the admin.
- Changing a schema in a way old saved data won't pass **breaks the build**. Add defaults or migrate the saved doc.

**Setup (human)**: run `supabase/migrations/*_cms.sql`, set `SUPABASE_SERVICE_KEY`, `DEPLOY_HOOK_URL`, `OWNER_EMAIL`.
