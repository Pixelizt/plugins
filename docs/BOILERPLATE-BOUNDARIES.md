# Boilerplate boundaries: what goes where, and what never gets copied

There are three places code and files can live. Mixing them up is the most common way a kit like this
rots, so this file is the rule.

| Place | Holds | Never holds |
|---|---|---|
| **Kit** (the kit) | Generic code, rules, procedures, briefs | Client content, photos, secrets, client-specific rules |
| **Client site** (per client) | Copied kit code + that client's content, assets, config | Kit-only tooling, other clients' anything |
| **Neither** (never committed) | Secrets, generated output, local notes | |

---

## 1. Kit → client: what `/new-client` copies, and what it doesn't

| Kit path | Copied to client? | Notes |
|---|---|---|
| `starter/**` | ✅ yes | Becomes the client repo root |
| `modules/<name>/**` (enabled ones only) | ✅ yes → `src/modules/<name>/` | Migrations merged into `supabase/migrations/` |
| `registry/<item>/component.*` (used ones only) | ✅ the component file only | Not its README or preview image |
| `clients/<slug>/client.yaml` + `clients/<slug>/assets/` | ✅ yes | Becomes `client.yaml` + `src/assets/` |
| `AGENTS.md` (kit) | ❌ no | The client gets a **generated** `AGENTS.md`: client-site rules from `starter/AGENTS.md` + module rules + a "This client" section |
| `docs/agents/ui-sources.md`, `motion-and-3d.md`, `reskinning-guide.md` | ✅ yes → `docs/agents/` | Agents working on a client need them |
| `docs/agents/LEARNINGS.md`, `FEEDBACK.md`, `CHANGELOG.md` | ❌ no | Kit-level. A client agent writes learnings into its own `docs/LEARNINGS.md`; `/retro` pulls them back into the kit |
| `docs/ARCHITECTURE.md`, this file | ❌ no | Kit-level. Lock-ins live in the kit `AGENTS.md`, which is also not copied |
| `docs/agents/adding-a-module.md`, `component-registry.md` | ❌ no | Kit-level procedures |
| `skills/` | ✅ `setup`, `help-me`, `setup-guide`, `reskin`, `add-ui`, `add-motion`, `unslop`, `diagram`, `catch-up`, `sharpen-brief`, copied into **both** `.claude/skills/` and `.cursor/skills/` | Cursor reads `.cursor/skills/`. `new-client`, `add-module`, `harvest`, `retro` run **from the kit** |
| `catalog.yaml`, `README.md` (kit), `prompts/`, `reference/`, `registry/PROVENANCE.md` | ❌ no | Kit-level |
| `client.example.yaml` | ❌ no | The real `client.yaml` is copied instead |

## 2. Porting from an existing site

An existing client site is a **reference**, not a template. Port its *logic and lessons*; never fork its repo.
Extract a handoff first with `prompts/client-discovery-handoff.md`, and keep it in the local, git-ignored
`reference/` folder. Handoffs describe a client's internals and never go into this repo.

### 2.1 Never copy
| From the old site | Why not |
|---|---|
| Git history | It may contain secrets that were pushed once and purged. Start fresh, and **rotate any key that was ever committed** |
| `.env` files, key files | Secrets |
| Its `AGENTS.md`/`CLAUDE.md`, README, briefs, feedback, status notes | Client-specific rules and private material. Extract generic lessons into `docs/agents/rules-learned.md` instead |
| Content (`data/*.json` or similar): menu items, prices, facts, events | The client's data. It may also hold that client's Supabase URL/keys. Ship schemas + invented demo seeds (`sample: true`) |
| Photos, logos, PDFs, QR codes, fonts it licensed | Client assets |
| Page markup, copy and its stylesheet | Its design and words. Rebuild patterns as brand-neutral, token-driven components |
| Generated files, build output, local agent state | Not source |
| Deploy config (`vercel.json`, CSP hosts, branch filters) | Names that client's infrastructure. The kit generates its own |
| Tests that check the client's own figures or wording | Client-specific |

### 2.2 Hardcoded values to turn into config when porting logic
Look for these in the old code; each becomes a `client.yaml` value or module config, never a constant:
currency and price rounding · tax rate and label · time zone and any fixed UTC offsets · phone region rules ·
brand colors, logo URL and sign-off inside email templates · menu tag keys, size names, nutrition formats ·
plan slots, grids, lengths and rate cards · retention periods · delivery-app names and links · fixed UI wording
and form-email wording · magic numbers tied to one layout.

### 2.3 Don't port
Dead code, the old templating/build system, manual image pipelines (Astro handles images), hand-maintained
registries that the schema-driven admin replaces, and language machinery the kit doesn't support yet (keep it as
reference for a future module).

### 2.4 Where ported logic lives
| Concern | Kit module |
|---|---|
| Form validation, spam protection, submissions, team/customer emails, Sheets sync, retention | `forms` (+ shared email helper in the starter) |
| Content documents, history, publish, change emails | `cms` |
| Dashboard, CSV import/export, image/video helpers | `admin` |
| Menu data, search and filters | `menu` |
| Events, offers, FAQs, reviews, gallery, blog | `content-lists` |
| Priced meal-plan requests with server re-pricing | `meal-plans` |
| Reusable UI and motion patterns | `registry/` |
| Keep-alive cron, secret scan, CI | `starter` |

## 3. Never committed anywhere (kit or client)
- `.env`, `.env.*` except `.env.example` · service-account JSON files · any API key
- `dist/`, `.astro/`, `.vercel/`, `node_modules/`, `supabase/.temp/`
- Local agent state: `.claude/settings.local.json`, worktrees
- Screenshots and working notes (`docs/previews/`, `status.md`, `*-plan.md` scratch)
- Generated files, **unless** a test fails when they're stale (The reference project rule 37)
- Client photos **in the kit**, except in `clients/<slug>/assets/`, and only if the client agreed

## 4. Checklist: before the first commit of a new client repo
- [ ] Fresh `git init` (never a fork of another client)
- [ ] `.gitignore` from the starter in place **before** `git add`
- [ ] `.env.example` has every variable, with no values
- [ ] Secret scan passes; the pre-commit hook is enabled (`git config core.hooksPath .githooks`)
- [ ] No other client's name, domain, colors or Supabase URL anywhere (`grep -ri "<other-client>"`)
- [ ] `AGENTS.md` was generated, not copied from another client
