# AGENTS.md — the kit

You are working in **the kit**, our agency's reusable website kit. Every client site (restaurants, cafes,
food subscriptions) starts from here. Your job is almost never to invent backend logic: **assemble,
configure and reskin** proven pieces. Read this file fully, then the doc for your task (§3).

---

## 1. Stack

- **Astro** (static first) + Vercel adapter; server endpoints only where they must be live
- **TypeScript strict + zod**: one schema per content type drives types, admin and validation
- **Tailwind CSS v4 + CSS variable tokens**. The admin is custom Tailwind. Libraries in `docs/agents/ui-sources.md` (shadcn/ui, 21st.dev, Astro components, GSAP, Aceternity, Magic UI, Awwwards, awesome-ui lists, Rare UI, Kobra, EasyUI, Pin UI, Three.js, and the rest of that list) are approved sources to pull and adapt components from, not the admin's implementation
- **React islands only** for interactive parts (`client:visible` / `client:idle`); static by default
- **Supabase** (Postgres + Auth + Storage), one project per client, real migrations, plain `fetch` (no `@supabase/supabase-js`)
- Motion: GSAP (+ScrollTrigger, SplitText), Motion, Lenis. 3D: Three.js / React Three Fiber in islands
- **English only** for now; always use CSS logical properties and stable keys
- **No online payments.** Bookings are real (availability + capacity); meal plans are priced requests. Email is Resend only, also via `fetch` (no Resend SDK)
- npm · Vitest (`npm test`, CI) + Playwright (`npm run test:e2e`, not in CI) · GitHub Actions CI

## 1b. Locked decisions (do not reverse)

These used to live in `docs/DECISIONS.md`. Change one only after the owner decides, then edit this list.

- **One repo, Supabase project, and Vercel project per client.** Copy the kit. Do not share it at runtime.
- **Hosting defaults to `paid` (Vercel Pro)** for a paying client. `free` is Hobby and only for demos; it still needs the daily keep-alive cron. Hobby terms are non-commercial.
- **Bookings** are `auto` or `approve` per client, with real capacity. Drafts are private. Roles: admin publishes, editor edits, demo is read-only.
- **Admin is schema-driven custom Tailwind.** One zod schema per content type. Do not rebuild it on shadcn.
- **Content:** `docs` + history for editable copy; real tables for submissions and bookings. The build snapshots published docs so servers never price from unpublished edits.
- **Retention is 100 days** unless the client changes it, and the privacy policy must match (Q3 closed). **Google Sheets sync is off** unless the client opts in (Q4 closed). **Email is Resend via `fetch`** (Q5 closed). Do not add either SDK.
- **Menu search** stays the pure `searchItems()`. Unknown tags, sizes, or nutrition keys warn and do not fail the build. The menu heading comes from config.
- **Content lists start disabled.** Blog stays `/blog`. An event may set `end_time` or it lasts the whole last day.
- **`brand.shadow`** maps to shadow tokens. Pills are fully round; everything else follows `brand.radius`.
- **Meal plans:** the browser blocks a plan with missing picks, so a visitor cannot submit a hole. If one still arrives, the server saves it as "price to confirm" and does not drop the enquiry. The customer email shows the full plan and the server's price, and never the visitor's free text.
- **Reuse an existing skill or library** before writing one. Do not require a live Supabase round-trip before a kit change ships.
- **Open questions:** Q1 (payments) stays deferred: Razorpay first, Stripe later, and not built. Q2 is unused: no code, doc, or config refers to it. Q3, Q4, and Q5 are closed above.

## 2. Repo map

Full map, commands, catalog: `README.md` (master file, keep current) and `catalog.yaml` (mirrors README §5).
Key places: `starter/`, `modules/<name>/` (own `AGENTS.md` each), `registry/` (+ `PROVENANCE.md`),
`clients/<slug>/client.yaml` (untracked; template `client.example.yaml`), `docs/` (architecture and procedures;
lock-ins are §1b above), `docs/agents/` (procedures + `LEARNINGS.md`, `FEEDBACK.md`, `CHANGELOG.md`), `skills/` (list in
`skills/help-me/SKILL.md`), `START-HERE.md`, `prompts/`, `reference/` (local, untracked first-client handoff).

## 3. Which doc to read

| Task | Read |
|---|---|
| Anything (first time in this repo) | this file §1b, then `docs/ARCHITECTURE.md` |
| Starting a new client site | `docs/agents/new-client-workflow.md`, `docs/BOILERPLATE-BOUNDARIES.md` |
| Changing look & feel | `docs/agents/reskinning-guide.md` |
| Need any UI component | `docs/agents/ui-sources.md` |
| Animation, scroll effects, 3D, "make it awwwards" | `docs/agents/motion-and-3d.md` |
| Creating / changing a module | `docs/agents/adding-a-module.md`, `docs/MODULES.md` |
| Porting code from the reference project | the local handoff in `reference/` (untracked), `docs/BOILERPLATE-BOUNDARIES.md` §2 |
| Forms, emails, bookings, CMS, security, deploy | `docs/agents/rules-learned.md` (**always applies**) |
| Saving a component for reuse | `docs/agents/component-registry.md` |
| Before writing any skill, script or checklist | `docs/agents/skill-sources.md` (reuse existing tools first, D21) |

## 4. Golden rules (non-negotiable)

1. **`client.yaml` is the source of truth** for a client. If something isn't in it, ask — don't guess.
   If you learn something new, propose adding it to `client.yaml`.
2. **Never hardcode brand values.** Colors, fonts, radius, spacing, shadows → theme tokens only.
   A raw hex code or font name in a component is a bug.
3. **Frontend is free, backend is frozen.** You may freely change layout, section order, styling, copy,
   images, animations and component choice. You may **not** change module backend logic, DB schema, auth,
   payments or webhooks without explicit human approval. Customize modules through their config and
   extension points (in each module's `AGENTS.md`).
4. **Reuse ladder — always in this order:**
   1. `registry/` (our own components)
   2. Installed module components
   3. Curated sources in `docs/agents/ui-sources.md`
   4. Build from scratch — only after stating why 1–3 didn't fit
5. **Every borrowed component gets logged** in `registry/PROVENANCE.md` (source URL, license, date, client).
6. **No paid/pro-tier code** unless `client.yaml` says we own that license.
7. **Motion respects the client's `motion.level`** and always honors `prefers-reduced-motion`.
8. **Never commit secrets.** Env vars go in `.env.example` with a comment, values in `.env.local`.
9. **Verify visually.** For any UI change: run the dev server, screenshot desktop + mobile, look at it.
   "It compiles" is not "it's done."
10. **When unsure, stop and ask** rather than making an architectural decision silently. New lock-ins
    get recorded in §1b only after the owner makes them.
11. **Follow `docs/agents/rules-learned.md`.** Those rules were paid for with real bugs.
12. **Never copy from one client into another.** Copy from the kit only (`docs/BOILERPLATE-BOUNDARIES.md`).

## 5. Definition of done (every task)

- [ ] `typecheck`, `lint`, `build` pass
- [ ] Every form in scope actually submits and lands in the DB / admin dashboard
- [ ] Admin pages for enabled modules load and can edit content
- [ ] Desktop (1440) + mobile (390) screenshots checked
- [ ] Lighthouse performance ≥ 85 on mobile for the home page (≥ 75 if `motion.level: awwwards`)
- [ ] `prefers-reduced-motion` tested
- [ ] New env vars documented in `.env.example`
- [ ] `registry/PROVENANCE.md` updated for anything borrowed
- [ ] `README.md` catalog + `catalog.yaml` updated if anything was added/changed
- [ ] Short summary: what changed, what was skipped, anything the human must do

## 6. Requires human approval

- DB schema / migration changes
- Anything touching payments, auth, webhooks, RLS policies or CSP hosts
- Adding a dependency > 100 kB gzipped, or a second animation/3D engine
- Deploying, or anything that sends email/SMS to real people
- Deleting files outside the current client folder

## 7. Self-improvement — these docs update themselves

Update the agent docs when you learn something (a gotcha a future agent would hit, a human correction, a doc
that no longer matches the code, a dead `ui-sources.md` link or changed license, a better approach, a task that
ran long for missing info). Stale rules are worse than no rules.

**Edit directly (no approval):**
- `docs/agents/LEARNINGS.md`: append learnings (always)
- `docs/agents/ui-sources.md`: sources, dead links, licenses, Quick picker
- `docs/agents/motion-and-3d.md` §4: add effects to the signature menu
- `docs/agents/*.md`: fix factual errors (path, command, API)
- `modules/*/AGENTS.md`: gotchas and corrected facts for that module
- `registry/**/README.md`: "used by", notes
- `README.md` §2, §5, §8 + `catalog.yaml`: **must** update, in sync, when you add/change/remove a module, registry item, client, skill or command, or finish a roadmap item

**Propose in your summary, don't apply:** anything in §4, §5 or §6; deleting or weakening any rule; changing
motion levels, performance budgets or the reuse ladder; restructuring docs.

**How to write an update:**
1. One learning = one short imperative, testable rule + **why** + **evidence** (client, date, what happened).
2. Most specific file wins (module AGENTS.md > topic doc > LEARNINGS.md > this file).
3. Search for an existing rule first; update it, don't duplicate.
4. If a test, lint or script can enforce it, write that instead of more text; text only for judgment calls, with an example of the failure.
5. Log it in `docs/agents/CHANGELOG.md` (date, file, one line) and list it under **"Docs updated"** in your summary.

After each client ships run `/retro` (promotes repeated learnings, removes outdated ones). Keep this file under ~250 lines.
