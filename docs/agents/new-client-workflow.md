# New client workflow

Use `/new-client <slug>`; it runs this procedure. **Run it from the kit repo**, not from inside a client repo.
Copy rules: `docs/BOILERPLATE-BOUNDARIES.md` §1.

1. **Intake.** `clients/<slug>/client.yaml` exists and has no `TODO` in required fields. If TODOs remain, list them and stop. (The script in steps 2–4 validates the brief; in a site, `npm run validate` does the same.)
2–4. **Scaffold, modules, agent files:** `node scripts/new-client.mjs <slug> [target-dir]` does all of it: copies the
   starter outside the kit, installs cms + admin + forms + the brief's modules (dependency order, migrations, env vars,
   agent rules), copies client-facing docs, the client skills into both `.claude/skills/` (Claude Code) and `.cursor/skills/` (Cursor), and registry components, writes the client's `AGENTS.md`.
   Optional flags, all off unless named: `--supabase`, `--resend`, `--vercel`, `--analytics`, `--guide`, `--handover`, plus `--yes` (no prompt) or `--dry-run`. A non-interactive run without `--yes` or `--dry-run` does not call any provider. The Supabase step does not put a database password on the command line. `--guide` writes `ADMIN-GUIDE.md` from the brief.
   ("This client" from `client.yaml`), validates the brief and runs `git init` (nothing committed).
5. **Theme.** Generate `src/styles/tokens.css` from `brand` (see `reskinning-guide.md` §2). Self-host the fonts.
6. **Pages.** Build each page from `pages[].sections` in order. Sections come from module components,
   then `registry/`, then `ui-sources.md`.
7. **Motion pass.** Apply `motion-and-3d.md` at the client's level. Propose the plan first.
8. **Content.** Seed `src/content/` with real client content. Where content is missing, use seed items
   flagged `sample: true`. **The production build hides sample items** (rule 4), so missing content never
   goes live. List every missing item for the client.
9. **Supabase + Vercel (human steps, list them, don't do them).** Create the Supabase project, run the
   migrations, create admin users with roles, create the Vercel project, set env vars, create the deploy hook,
   and verify the email sending domain.
10. **Verify.** Definition of done in `AGENTS.md` §5 + the boundaries checklist §4.
11. **Report.** Modules installed, pages built, sources used (PROVENANCE), missing content, env vars and
    human steps left, open questions for the client. Add the client to `catalog.yaml` and the README catalog.
