---
name: setup
description: Single entry point for website work in the kit or a client site: picks the matching playbook and runs it to a verified result. Use for "/setup <anything>", or any request to build, change, fix, launch or review a client website.
argument-hint: <what you want, in plain words>
---

# /setup

## 1. Start
0. **Where am I?** The kit has `starter/` and `modules/`; a client site has `client.yaml` and `src/kit/`.
   Anywhere else, say so: `unslop`, `sharpen-brief`, `catch-up`, `help-me` still work, and a site can be created from the kit (https://github.com/Pixelizt/plugins).
1. Read `AGENTS.md` (and `client.yaml` in a client site).
2. Say in two lines what they're after and the least work that gets there.
3. Pick one playbook below and do every step in order. If a step doesn't apply, say why.

## 2. Playbooks

| Request sounds like | Playbook |
|---|---|
| new client, start a site | `/new-client` (kit repo only) |
| look, feel, layout, colors, fonts, "more premium", reorder sections | `/reskin` |
| need a section/component (gallery, pricing, testimonials…) | `/add-ui` |
| animation, scroll effect, 3D, "awwwards" | `/add-motion` |
| backend feature (forms, menu, booking, meal plans) | `/add-module` |
| client sent content (menu sheet, photos, copy, events) | **Content import** below |
| something is broken | **Bug fix** below |
| client feedback round ("change these 12 things") | **Feedback round** below |
| going live | **Launch** below |
| where are we / pick up old work | `/catch-up` |
| vague brief | `/sharpen-brief` |
| any text a visitor reads | `/unslop` before it ships |
| after a client ships | `/harvest`, then `/retro` |
| not sure | `/help-me` |

### Content import
1. Identify the target document/schema (`src/content/*.json` or module seed) and its field keys.
2. Convert the client's material to that shape with a script, not by hand (menu → the admin CSV import).
3. Validate (`npm run validate`, `npm run build` fails on bad content). Remove `sample: true` only from real items.
4. Photos: client's own only (rule 35), record the source. Copy: `/unslop`, but keep the client's own wording where it's theirs.
5. List anything missing as questions for the client. Never invent prices, dishes, hours or policies (rule 34).

### Bug fix
1. Reproduce first, on the same surface. No repro, no fix.
2. Find the root cause (first place it goes wrong), not where it shows.
3. Write a failing test, fix, see it pass.
4. If the bug is in `src/kit/**` or a module, fix it in the kit and note the back-port (`/harvest`).

### Feedback round
1. Turn the feedback into a numbered checklist, one item per change. Ask about anything ambiguous before starting.
2. Group by type (copy, layout, content, behavior). Behavior changes to frozen modules need owner approval.
3. Do them in order, screenshot each changed page at 390 and 1440 px.
4. Reply with the checklist: done / skipped (why) / needs client input.

### Launch
1. Definition of done (`AGENTS.md`) on the production build: check, test, build, scan, Lighthouse mobile, axe (see `docs/agents/skill-sources.md`).
2. No `sample` items, no `TODO`, no placeholder images. Privacy page matches retention days.
3. Env vars set in Vercel (names from `.env.example`). Send one test form/booking and check its `delivery` column.
4. Domain, email sending domain (SPF/DKIM), Google Business Profile, Search Console, sitemap submitted.
5. **Only with explicit approval:** deploy / push to the production branch.

## 3. Rules while working
- **Facts, test them; taste, ask.** If running something answers it (renders, fast, submits), run it. Design, wording and business rules are the owner's or client's call: ask.
- **Long or unattended runs:** log each real choice in `docs/decisions.tsv` (`when, step, choice, reason, proof, outcome`); proof is a file, commit or screenshot.
- **Parallel agents:** first write down what blocks, what's independent, and which files each agent owns. One agent writes each shared file.
- **Repeated lesson?** Encode it as a test, lint or script, not another sentence (AGENTS.md §7).

## 4. Reply contract (every playbook ends with this)
1. Goal (one line) and what changed.
2. What you verified, with evidence. What you did NOT verify.
3. Decisions you made and why. Questions for the owner/client.
4. Docs updated (AGENTS.md §7).
