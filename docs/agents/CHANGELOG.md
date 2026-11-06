# Agent docs changelog

| Date | File | Change | By (agent/human) |
|---|---|---|---|
| 2026-11-06 | gallery/ | Removed eyebrow labels, status stamps, and sketch captions | agent |
| 2026-11-06 | gallery/ | Cut gallery copy to one line per card and switched type to Host Grotesk | agent |
| 2026-11-06 | gallery/, README, catalog.yaml, LEARNINGS | Optional gallery that writes a client.yaml from the repo catalog. CLI path unchanged | agent |
| 2026-11-04 | all | Initial kit docs | agent |
| 2026-11-04 | README.md, catalog.yaml | Added master README + machine-readable catalog | agent |
| 2026-11-04 | DECISIONS, ARCHITECTURE, MODULES, BOILERPLATE-BOUNDARIES, rules-from-reference-project | Stack decided (Astro); architecture, module plan, copy boundaries, 39 the reference project rules | agent + owner decisions |
| 2026-11-04 | AGENTS.md, README, catalog, client.example.yaml, ui-sources, motion-and-3d, reskinning, workflow, module guide | Rewritten for Astro + decisions D1–D15 | agent |
| 2026-11-04 | starter/, ARCHITECTURE §2-3, README, catalog, MODULES | Starter v0.1 built (Astro); config-driven pages; kit pre-commit secret scan | agent |
| 2026-11-04 | DECISIONS D16-D19, cms module, installer, playground, core email/server/modules | Owner answers recorded; cms v0.1 built | agent |
| 2026-11-04 | forms module, installer (npm deps, seeds), vitest virtual config | forms v0.1 built and tested (40 tests in playground) | agent |
| 2026-11-05 | docs/agents/skill-sources.md, AGENTS.md §3 | Researched reusable skills/tools (Supabase, Vercel, shadcn MCP, Lighthouse, axe-core) | agent |
| 2026-11-05 | .claude/skills (setup, help-me, unslop, catch-up, sharpen-brief, retro) AGENTS §7, README, prompts | Entry skill with playbooks, help command, copy and brief skills, prompts library | agent |
| 2026-11-05 | README, catalog, MODULES, component-registry, starter gsap | admin/menu/content-lists v0.1 + 15 registry components merged; registry conventions | agent |
| 2026-11-05 | DECISIONS D24-D30, menu, content-lists, starter tokens, registry conventions | Owner accepted all 7 defaults; implemented | agent |
| 2026-11-05 | 58 files, catalog, README, BOILERPLATE §2, rules-learned.md | Client name removed for public release; meal-plans + forms 0.2 merged | agent |
| 2026-11-05 | scripts/new-client.mjs, new-client skill/workflow, README, starter config test | /new-client automated end to end (verified on a test brief: check, 199 tests, build) | agent |
| 2026-11-05 | skills/ (moved from .claude/skills, symlinked back), .claude-plugin/, README | Installable Claude Code plugin via marketplace Pixelizt/plugins | agent |
| 2026-11-05 | START-HERE.md, skills/setup-guide, sharpen-brief interview mode, README, catalog | Non-technical path + install in other AI assistants; third-party text removed | agent |
| 2026-11-05 | ARCHITECTURE §4.2, MODULES, README, catalog, LEARNINGS | Bookings merged (317 tests with all 9 modules) | agent |
| 2026-11-05 | README, AGENTS §2, MODULES, ARCHITECTURE §9, reskinning-guide, new-client/add-module skills, registry READMEs | De-duplicated: each fact has one home, other places link to it; fixed stale paths and the module-status column | agent |
| 2026-11-05 | skills renamed to plain names (setup, help-me, setup-guide), new /diagram, plugin name kit | Plain skill names; own diagram skill (no third-party text) | agent |
| 2026-11-05 | whole repo | Old internal prefix replaced by kit everywhere (src/kit, virtual:kit, --kit-*, kit_role(), KIT_ALLOW_TODO…); booking expiry email (notify_expired) | agent |
| 2026-11-05 | skills/*/SKILL.md | Trimmed token cost: shorter descriptions (566 to ~490 words) and light body trims in setup, setup-guide, diagram; no steps or rules removed | agent |
| 2026-11-05 | AGENTS.md | Shortened ~28% (1,502 → 1,087 words) (repo map condensed to pointer to README; §7 tightened); no rule changed | agent |
| 2026-11-05 | AGENTS.md, catalog.yaml, README, ui-sources.md, ARCHITECTURE, MODULES, DECISIONS D10/D14/D36 | Admin is custom Tailwind; external libraries are approved component sources. Emails are TS helpers via Resend `fetch`. No Supabase JS or Resend SDK. Playwright smoke test in the starter. `new-client` also copies skills to `.cursor/skills/` | agent |
| 2026-11-05 | starter SEO, registry blocks, scripts/provision.mjs, scripts/kit-diff.mjs, modules/whatsapp, tools/handover | Factual highlights, optional analytics, restaurant blocks, opt-in provisioning, frozen-file diff, WhatsApp alert, Remotion walkthrough kept out of the client bundle | agent |
