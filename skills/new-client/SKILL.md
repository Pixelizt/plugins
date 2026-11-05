---
name: new-client
description: Create a complete new client site from clients/<slug>/client.yaml: starter, modules, docs, skills, registry, fresh git repo, then theme, pages, motion and content. Run from the kit repo when starting a new client.
argument-hint: <client-slug> [target-dir]
---

1. Read `AGENTS.md`, `docs/agents/new-client-workflow.md` and `docs/BOILERPLATE-BOUNDARIES.md` §1.
2. Check `clients/$ARGUMENTS/client.yaml` exists. If not: copy `client.example.yaml` there and run `/sharpen-brief` with the client's brief, then stop for the owner to confirm the values.
3. Show a short plan (modules, pages + sections, motion level) and wait for approval.
4. Run `node scripts/new-client.mjs <slug> [target-dir]` (default `../<slug>-site`): workflow steps 2–4.
5. In the new site, continue with workflow steps 5–8 (`/add-ui` for gaps, `/add-motion`, `/setup` content import, `/unslop` on copy), all within the client's rules.
6. Run the Definition of Done (`AGENTS.md` §5). Fix failures; don't report done with failing checks.
7. Report: installed modules, pages, sources used, missing content, the human checklist the script printed, open questions.
   Add the client to `catalog.yaml` only in a private fork; the public kit lists no clients.
