# Prompt: extract a handoff from an existing site

Use when you inherit an existing site and want its knowledge before porting. Paste everything below the line into a Claude Code session opened **inside that site's repo**.
It produces `HANDOFF.md`; keep it outside the public kit repo (it describes a client's internals).

---

We're turning this project (<project>) into the foundation of a reusable agency kit called
**the kit**: a starter template + reusable modules (menu, table booking, space/event booking,
subscriptions, CMS, contact forms, admin dashboard) that AI agents will use to build future
restaurant/cafe client sites, where per-client work is mostly reskinning the frontend.

I need you to deeply analyze this codebase and write a handoff report to `HANDOFF.md` at the repo
root. Read the actual code — don't guess from file names. Where you're unsure, say so explicitly.
**Never include secret values** (API keys, passwords, tokens, connection strings) — only variable names.

Structure the report exactly like this:

## 1. Stack & infrastructure
- Framework + version, language, package manager, styling approach, UI libraries
- Database, ORM, auth provider, payments provider, email/SMS, file storage
- Hosting/deployment setup, CI/CD, domains, cron jobs, webhooks
- Every env var name and what it's for (from `.env.example` and code usage)
- Animation/3D libraries used (GSAP, Motion/Framer Motion, Three.js, Lenis, Lottie, etc.)

## 2. Folder structure
Annotated tree (2–3 levels) explaining what lives where.

## 3. Feature inventory
For **each** feature (subscriptions, forms, menu, booking, admin dashboard, CMS, auth, emails, etc.):
- What it does from the user's and admin's perspective
- Files involved (paths)
- Data model (tables/collections, fields, relations)
- API routes / server actions and what they do
- Third-party integrations and webhook flows
- **Reusability rating**: Generic (reusable as-is) / Needs generalization (say what's hardcoded) / project-specific
- What would need to become config to reuse it for another cafe

## 4. Database schema
Full schema (all tables/models with fields and relations), plus how migrations are managed.

## 5. Admin dashboard
How it's built, how admins log in, roles/permissions, what admins can edit, how content edits reach the live site (revalidation, caching).

## 6. Frontend & design system
- How theming works (CSS vars? Tailwind config? hardcoded?) — list where brand colors/fonts are hardcoded
- Reusable components that already exist, and which are tightly coupled to this project's content
- Animations/effects that turned out well and are worth reusing (file paths)
- External component sources used (shadcn, Aceternity, Magic UI, etc.)

## 7. Payments & subscriptions deep-dive
Plans, checkout flow, webhook handling, subscription lifecycle (renew/cancel/fail), how state syncs to the DB, edge cases handled or not.

## 8. Lessons learned
- Bugs that were hard to fix and how they were fixed
- Things that were painful or slow to build
- What you would do differently if starting over
- Known tech debt, TODOs, hacks, and fragile areas
- Anything the client asked to change repeatedly (signals of what should be configurable)

## 9. Recommendations for the kit
- Proposed module list with boundaries (what goes in each)
- Which parts belong in the shared "starter" (auth, admin shell, theme, layout)
- Suggested order of extraction (easiest/highest-value first)
- Any concerns about reusing this code

## 10. Rules for future agents
Turn everything you learned into rules that future AI agents building similar sites should follow.
Write each one as: **Rule** (imperative, testable) → **Why** (what went wrong or was discovered here)
→ **Topic** (one of: stack, modules, payments, booking, admin, theming, motion, deploy, content).
Include gotchas, conventions this project settled on, and mistakes you or earlier sessions made.
Aim for 15–40 rules. These go straight into our agent docs, so be concrete
(e.g. "Verify the payment webhook signature against the raw request body before trusting the event", not "be careful with payments").

## 11. Open questions
Anything you couldn't determine from the code that a human should answer.

Be thorough — this report is the only thing the next agent will see. Long is fine; vague is not.
When finished, give me a 10-line summary in chat.
