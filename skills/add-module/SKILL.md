---
name: add-module
description: Install a module (cms, admin, forms, menu, content-lists, booking-core, table-booking, space-booking, meal-plans) into a client project, or create/extend one in modules/. Use when a client needs a backend feature.
argument-hint: <module-name> [client-slug]
---

Installing into a client:
1. Read `modules/<name>/AGENTS.md` and `module.json`.
2. Run `node scripts/install-module.mjs <client-dir> <module…>`: it installs `dependsOn` modules first, merges migrations, mounts routes and admin views, and adds env vars to `.env.example`.
3. Validate the `client.yaml` block against the module's `schema.ts` (`npm run validate`).
4. Test the main flow end to end (e.g. submit a booking → appears in admin).

Creating / changing a module:
- Follow `docs/agents/adding-a-module.md`. Schema, payment, auth changes need human approval. Bump version + CHANGELOG.
