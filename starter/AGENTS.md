# AGENTS.md: {{CLIENT_NAME}} website

Built from the **the kit** kit. Most work here is **reskinning and content**, not new backend logic.
Read this whole file before changing anything. `/new-client` generates this file: the starter part
below, then each installed module's rules, then the "This client" section at the end.

## 1. Stack
Astro (static first) · TypeScript strict + zod · Tailwind v4 with CSS variable tokens · React islands only
where needed · Supabase (this client's own project) · Vercel. English only.

## 2. What you may change, and what you may not

| Path | Rule |
|---|---|
| `client.yaml` | The brief and the source of truth. Brand, pages, section order, module settings. Change it here first |
| `src/sections/*.astro`, `src/components/*`, `src/layouts/*`, `src/styles/global.css` | **Free to reskin**: layout, classes, markup, motion |
| `src/content/*.json` | Seed content (before the dashboard is used). Must match its schema |
| `src/pages/*.astro` | Free to add hand-written pages. A file for a path overrides the config-driven page |
| `src/kit/**` | 🔒 **Kit core. Do not edit.** Fix it in the kit and back-port |
| `src/modules/<m>/server|lib|schema.ts|module.ts|migrations` | 🔒 **Frozen backend.** Changes need owner approval and go back to the kit |
| `src/modules/<m>/sections/*`, `components/*` | Don't edit in place. To restyle, copy the section to `src/sections/<same-id>.astro`; the site copy wins |
| `src/styles/tokens.css` | 🔒 Generated from `client.yaml → brand`. Never edit |
| `supabase/migrations/*` | 🔒 Never edit a released migration. New ones need approval |

## 3. How pages work
- `client.yaml → pages[]` lists each page and its `sections` in order. To reorder a page, reorder that list.
- A section id maps to `src/sections/<id>.astro` (site-level, wins) or `src/modules/<m>/sections/<id>.astro`.
- An unknown section id **fails the build** and lists the available ids.
- Sections load their content with `loadDoc(key, Schema)`: the CMS document if one is saved, else `src/content/<key>.json`.
- Items with `"sample": true` show in dev and are **dropped from production builds** (never ship placeholder content).

## 4. Brand & styling
- Use token utilities only: `bg-primary`, `text-primary-foreground`, `bg-muted`, `text-muted-text`, `border-border`,
  `rounded-md`, `font-heading`. **No raw hex values, font names or px radii in components.**
- Use logical properties (`ms-*`, `ps-*`, `start-*`, `text-start`), never left/right.
- Change colors, fonts or radius in `client.yaml → brand`, then restart dev. The build warns about unreadable contrast.
- Don't import `virtual:kit/config` inside React islands (the whole config would ship to the browser). Pass props.

## 5. Commands
| Command | What |
|---|---|
| `npm run dev` | Local dev at http://localhost:4321 |
| `npm run validate` | Check `client.yaml` without building |
| `npm run check && npm test && npm run build` | **All must pass before you say you're done** |
| `npm run test:e2e` | Playwright smoke test (home page + key pages). Once: `npx playwright install chromium` |
| `npm run scan` | Secret scan (also runs in the pre-commit hook and CI) |
| `git config core.hooksPath .githooks` | Enable the pre-commit hook (once per clone) |

## 6. Rules that always apply
- `docs/agents/rules-learned.md`: security, forms, emails, bookings, CMS, deploy. **Read it.**
- `docs/agents/reskinning-guide.md`, `ui-sources.md`, `motion-and-3d.md` for design work.
- Never commit secrets; env var names go in `.env.example` with a comment.
- Never invent business facts (prices, hours, dishes, policies). Ask.
- Never copy anything from another client's repo.
- Never push to the production branch or deploy without explicit approval in this session.

## 7. Definition of done
- [ ] `npm run check`, `npm test`, `npm run build` pass, and `npm run scan` is clean
- [ ] Changed pages checked at 390px and 1440px (screenshots looked at)
- [ ] Forms or bookings in scope actually submit and land in the dashboard
- [ ] `prefers-reduced-motion` respected
- [ ] New env vars in `.env.example`
- [ ] Report: what changed, what you verified, what you didn't, assumptions, questions for the client
- [ ] Learned something a future agent should know? Add it to `docs/LEARNINGS.md` (the kit pulls these back with `/retro`)

## Installed modules
Each module's full rules live in `src/modules/<name>/AGENTS.md`. **Read them before you change that module, its sections, its config block or its data.**

<!-- MODULE RULES: the installer adds one line per installed module below -->

## This client
<!-- /new-client fills this from client.yaml: brand.copy_rules, notes, contacts, anything client-specific -->
