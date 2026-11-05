# Pixelizt Plugins: restaurant website kit

**A reusable website kit for restaurants, cafés and food businesses, built to be driven by AI coding agents.**
Forms, menu, events, bookings, meal plans and an admin dashboard come ready-made. Per-client work is mostly
filling in one `client.yaml` and reskinning the frontend; agents (Claude Code) do most of it, following the
rules and skills in this repo. Open source under the [MIT license](LICENSE).

**Stack:** Astro (static first) · TypeScript + zod · Tailwind v4 (admin is custom Tailwind) · React islands · Supabase · Vercel.
Vercel Web Analytics is wired and stays off until `client.yaml → hosting.analytics: true`.
UI comes from the registry, then from approved external libraries you pull and adapt (`docs/agents/ui-sources.md`).
Why: [`docs/DECISIONS.md`](docs/DECISIONS.md) · How: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

> This README is the **master file**: what the kit is, how to use it, every command, and a catalog of
> everything inside. Humans read this first. Agents read `AGENTS.md` first and keep this file and
> `catalog.yaml` up to date.

---

## Getting started (new here?)

**Not technical?** Read [`START-HERE.md`](START-HERE.md) and type `/setup-guide` in Claude Code. It does the rest with you,

**Install the skills in Claude Code:** `/plugin install kit --marketplace Pixelizt/plugins` (other assistants: see `START-HERE.md`).
step by step. 
**You need:** Node.js 22+, git, [Claude Code](https://claude.com/claude-code) (optional but recommended), and for a
live site a free [Supabase](https://supabase.com) project and a [Vercel](https://vercel.com) account.

```bash
git clone https://github.com/Pixelizt/plugins.git && cd plugins
mkdir -p clients/my-cafe && cp client.example.yaml clients/my-cafe/client.yaml   # then fill it in
node scripts/new-client.mjs my-cafe                  # creates ../my-cafe-site, ready to `npm run dev`
cd ../my-cafe-site && npm run dev                    # http://localhost:4321  (admin at /admin)
```

Using Claude Code instead: open this folder, type **`/help-me`**, or just **`/setup build a site for <your brief>`**.

**Just want the skills in another project?** Install them as a plugin: see [`START-HERE.md`](START-HERE.md#use-the-skills-in-other-ai-assistants). The site-building commands need this repo cloned.
The `new-client` script prints the remaining human steps (Supabase migrations, Vercel env vars, email domain).

**Status:** v0.1. Every module is type-checked, unit-tested and builds together, and the generator was run on a test
brief. **Not yet tested end to end against a live Supabase/Vercel deployment**, and the admin's image/video upload
hasn't had a manual browser pass. Treat the first real site as the integration test, and open an issue for anything
that breaks.

---

## Contents
1. [Quick start: new client in 5 steps](#1-quick-start--new-client-in-5-steps)
2. [Commands](#2-commands)
3. [How the kit works](#3-how-the-kit-works)
4. [Repo map](#4-repo-map)
5. [Catalog: modules, components, effects, clients](#5-catalog)
6. [Motion levels](#6-motion-levels)
7. [How the docs improve themselves](#7-how-the-docs-improve-themselves)
8. [Status & roadmap](#8-status--roadmap)

---

## 1. Quick start: new client in 5 steps

1. `mkdir -p clients/<slug> && cp client.example.yaml clients/<slug>/client.yaml`, then fill it in (no TODOs left).
2. Open Claude Code in this repo and run `/new-client <slug>`.
3. Iterate with `/reskin` and `/add-motion`.
4. After it ships: `/harvest <path>` to save the best components, then `/retro <slug>`.

The full procedure: [`docs/agents/new-client-workflow.md`](docs/agents/new-client-workflow.md).

## 2. Commands

### Claude Code skills (type these in Claude Code)

**Start with `/setup <what you want>`**: it picks the right playbook. **`/help-me`** lists every command with example
prompts (the table lives in [`skills/help-me/SKILL.md`](skills/help-me/SKILL.md)); ready-made prompts are in
[`prompts/README.md`](prompts/README.md). Each skill is a folder in [`skills/`](skills/).

**Recommended companion tools** (official, free): Supabase agent skills, Vercel web-design guidelines, the shadcn MCP,
Lighthouse and axe-core. Install commands and what we deliberately skipped: [`docs/agents/skill-sources.md`](docs/agents/skill-sources.md).

### Kit commands (in this repo)

| Command | Purpose |
|---|---|
| `node scripts/new-client.mjs <slug> [dir]` | Create a client site from `clients/<slug>/client.yaml` (what `/new-client` runs) |
| `node scripts/install-module.mjs <client-dir> <module…>` | Install modules into a client site (deps first, migrations, env vars, agent rules) |
| `node scripts/playground.mjs [module…]` | Throwaway site in `.playground/` with the starter + modules, to check/test/build module code |
| `cd .playground && npm run check && npm test && npm run build` | Verify modules before committing them |

### Shell commands (inside a client project)

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Run locally at http://localhost:4321 |
| `npm run check && npm test && npm run build` | Must pass before any task is "done" (typecheck + Vitest + build) |
| `npm run test:e2e` | Playwright smoke test: home page renders and the brief's key pages load. Once per machine: `npx playwright install chromium` |
| `npm run preview` | Preview the production build |
| `npm run validate` | Check `client.yaml` without building |
| `npm run scan` | Secret scan |
| `npx supabase db push` | Apply migrations to the client's Supabase project (human step) |
| `npx shadcn@latest add <component>` | Install a component from a shadcn-compatible registry (one approved source; see `ui-sources.md`) |
| `npx gltfjsx model.glb --transform` | Compress a 3D model + generate its React component |
| `git config core.hooksPath .githooks` | Enable the secret-scan pre-commit hook (once per clone) |

## 3. How the kit works

```
client.yaml  ──►  /new-client  ──►  starter/ (skeleton)
 (the brief)                        + modules/ (backend features)
                                    + registry/ (our components)
                                    + ui-sources.md (curated external components)
                                    + motion-and-3d.md (animation rules)
                                         │
                                         ▼
                                   client website ──► /harvest + /retro ──► kit gets better
```

The principles (client.yaml as the brief, frontend free / backend frozen, the reuse ladder, no hardcoded brand values) are in [`AGENTS.md`](AGENTS.md) §4. How the pieces fit together: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 4. Repo map

The full map of folders and files is in [`AGENTS.md`](AGENTS.md) §2. Humans start with this README and
[`START-HERE.md`](START-HERE.md); the rest is for agents and for anyone changing the kit.

## 5. Catalog

> Kept in sync with `catalog.yaml`. **Agents: if you add, change or remove a module, registry item,
> client or source, update both.**

### Modules

Specs and build order: [`docs/MODULES.md`](docs/MODULES.md). Versions and dependencies: `catalog.yaml`. Each module's rules: `modules/<name>/AGENTS.md`.

| Module | Status | What it does |
|---|---|---|
| `starter` | ✅ v0.1 | Astro skeleton, client.yaml config, tokens, layout, SEO, security headers, CI, secret scan |
| `cms` | ✅ v0.1 | Content documents + version history, private drafts, publish (rebuild), change emails |
| `admin` | ✅ v0.2 | Schema-driven dashboard: editors generated from module schemas, CSV, uploads, history |
| `forms` | ✅ v0.2 | Form definitions, shared validation, spam protection, submissions table, emails, optional Google Sheets |
| `menu` | ✅ v0.1 | Static SEO menu + search/filter island, tags, allergens, nutrition, CSV |
| `content-lists` | ✅ v0.1 | Events (auto-expire, videos), offers, FAQs, reviews, gallery, posts |
| `booking-core` | ✅ v0.1 | Shared booking engine: resources, slots, capacity, no double booking, auto/approve modes |
| `table-booking` | ✅ v0.1 | Table reservations with live availability |
| `space-booking` | ✅ v0.1 | Book private spaces for birthdays/events |
| `meal-plans` | ✅ v0.1 | Priced meal-plan requests with server re-pricing |
| `payments` | ⏸ later | Online payments, waiting on a provider choice (Q1) |
| `i18n` | ⏸ later | Second language / RTL |

Status key: 🔜 planned · 🚧 in progress · ✅ stable · ⚠️ needs work · ⏸ later

### Registry components (`registry/`)

| Name | Type | Vibe | Motion level | Deps | Used by |
|---|---|---|---|---|---|
| UI: `pill-nav`, `button`, `card`, `card-grid`, `section`, `section-head`, `announcement-strip`, `mobile-action-bar`, `lightbox`, `chip` | ui | neutral, token-driven | any | none | seed set |
| UI: `menu-tabs`, `hours-map`, `reviews`, `gallery`, `instagram-feed`, `book-bar` | ui | neutral, token-driven | any | gallery uses lightbox | restaurant blocks |
| Motion: `reveal`, `marquee`, `float`, `scroll-drift` | motion | any | subtle–expressive | none | seed set |
| Motion: `hero-stagger` (+ `drift-frame`) | motion | expressive | expressive–awwwards | gsap | seed set |

### Clients

| Client | Slug | Type | Modules | Motion | Status | Live URL |
|---|---|---|---|---|---|---|
| _none yet in this repo: client briefs live in `clients/<slug>/` and are git-ignored_ | | | | | | |

### External sources

Approved places to **pull and adapt** components from, after `registry/`. shadcn/ui is one of them. It is not how the admin is built (the dashboard is custom Tailwind). The list, with what each source is good for and its license: [`docs/agents/ui-sources.md`](docs/agents/ui-sources.md). It includes shadcn/ui, 21st.dev, Astro components, GSAP, Aceternity, Magic UI, Awwwards (inspiration only), awesome-ui style lists, rareui.com, kobra.systems, easyui.site, pinui.xyz and Three.js.

## 6. Motion levels

Set per client in `client.yaml → motion.level`: `subtle`, `expressive` (default) or `awwwards`.
What each level allows: [`docs/agents/motion-and-3d.md`](docs/agents/motion-and-3d.md) §1.

## 7. How the docs improve themselves

Agents add lessons and fix facts as they work; core rules change only with human approval. The rules are in
[`AGENTS.md`](AGENTS.md) §7, and every change is logged in `docs/agents/CHANGELOG.md`.
**Humans:** skim `CHANGELOG.md` and `FEEDBACK.md` weekly, and run `/retro` after each client.

## 8. Status & roadmap

- [x] Agent rules, workflows, skills, UI/motion source guides, `client.yaml` template
- [x] Stack + architecture decided (`docs/DECISIONS.md`, `docs/ARCHITECTURE.md`), boundaries and rules extracted from the first client
- [x] `starter/` and every module in the catalog above (details: each module's `CHANGELOG.md`)
- [x] Module installer (`scripts/install-module.mjs`) + test playground (`scripts/playground.mjs`)
- [x] `registry/`: 15 generic UI + motion components
- [x] `/setup`, `/help-me`, `/setup-guide`, `/unslop`, `/catch-up`, `/sharpen-brief` skills
- [x] `/new-client` script (`scripts/new-client.mjs`) + content snapshot (D33)
- [ ] Answer the open questions in `docs/DECISIONS.md`
- [ ] First new client built with the kit, then `/retro`
- [ ] Publish `registry/` as a shadcn-compatible registry (`@kit/...`) — future step; the URL in `ui-sources.md` stays a placeholder until then
- [ ] Link-check `ui-sources.md`
