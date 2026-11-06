# Learnings

Agents append here when they learn something a future agent should know (see AGENTS.md §7).
`/retro` promotes repeated learnings into the proper docs and archives the rest.

Format:
```
### YYYY-MM-DD — <client> — <short title>
Rule: <imperative, testable>
Why: <what went wrong / what was discovered>
Where it should live: <target doc, if known>
Seen: 1   ← bump this when the same learning happens again
```

---

<!-- newest first -->

### 2026-11-06 — kit — gallery briefs follow module zod, not the example tag list
Rule: When writing `client.yaml`, check each `modules.<name>` block with that module's schema. `modules.menu.tags` is `{ key, label, filterable }[]`. A list of bare strings fails. Keep the gallery in `gallery/` and do not import it from `starter/` or `new-client`.
Why: Core `ClientConfig` types `modules` as `z.unknown()`, so `npm run validate` accepts tag strings that `MenuConfig` rejects at build. The example file still shows the string list. The gallery is an extra door; wiring it into the generator would put a marketing site on every client build.
Where it should live: `client.example.yaml` (tag shape — proposed, not changed here), `gallery/README.md`
Seen: 1

### 2026-11-05 — kit — do not emit self-serve review schema or put provider secrets on argv
Rule: Do not add Review or aggregateRating JSON-LD from on-site quotes. Do not pass a database password or API token as a CLI argument. Do not add Remotion or pnpm to the starter.
Why: Search engines treat a business rating itself as spam (content-lists already skipped it). `supabase projects create` wants `--db-password` on argv, which shows up in the process list, so provisioning only runs `db push` and prints the create command. Remotion is a video toolchain, not a page dependency. The kit package manager is npm (D14).
Where it should live: docs/MODULES.md SEO line, scripts/provision.mjs, tools/handover/README.md
Seen: 1

### 2026-11-05 — kit — admin is custom Tailwind; emails are fetch helpers
Rule: Do not rebuild `/admin` on shadcn, do not add an `emails/` folder, and do not add `@supabase/supabase-js` or the `resend` package.
Why: The docs described a shadcn admin and `emails/` templates. The shipped admin is custom Tailwind, and mail is `server/emails.ts` (or cms `server/email.ts`) sent with `fetch` to Resend. The owner treats shadcn, 21st.dev, Aceternity, Magic UI and the rest of `ui-sources.md` as places to pull components from.
Where it should live: already in AGENTS.md, `docs/agents/ui-sources.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` D10 and D36
Seen: 1

### 2026-11-05 — kit — agent worktrees inside the repo get staged by `git add -A`
Rule: Keep `.claude/worktrees/` in `.gitignore`; stage specific paths, not `git add -A`, while sub-agents run.
Why: `git add -A` staged four agent worktrees as embedded repos; the secret scan crashed on them (now skips non-files).
Where it should live: rules-learned.md rule 15 / adding-a-module.md
Seen: 1

### 2026-11-05 — kit — round before flooring to an even pixel size
Rule: When scaling media dimensions, `Math.round` to an integer first, then floor to even.
Why: floating-point scaling gave 1279.999…, which floored-to-even became 1278/638 instead of 1280/640 (admin video helpers).
Where it should live: modules/admin/AGENTS.md
Seen: 1

### 2026-11-05 — kit — sample seed data makes a fresh playground build look empty
Rule: To eyeball a module section in a production build, drop `sample: true` from `.playground/src/content/*.json` (gitignored); never from the module seed.
Why: production builds strip sample items (rule 4), so the menu rendered empty in the playground.
Where it should live: docs/agents/adding-a-module.md
Seen: 1

### 2026-11-05 — kit — module.ts must import only src/kit/module-def.ts
Rule: In `module.ts`, import `defineModule` from `../../kit/module-def.ts`, never from `modules.ts`.
Why: `modules.ts` eagerly imports every `module.ts`; importing back created a cycle and prerender failed with "defineModule is not a function" once 5 modules were installed.
Where it should live: docs/agents/adding-a-module.md (encode as a test later)
Seen: 1

### 2026-11-05 — kit — server functions read the latest *saved* content, pages show the *published* build
Rule: Anything a server function prices or validates against CMS content must account for Save-without-Publish drift (compare with what the page sent, note mismatches).
Why: meal-plans re-prices from `loadDoc` at request time; between Save and Publish its price can differ from the page. Mitigated with a `shown_total` comparison; fixed 2026-11-05 by the per-build content snapshot (D33). Keep the `shown_total` check as a second guard.
Where it should live: docs/ARCHITECTURE.md §4.1
Seen: 1

### 2026-11-05 — kit — zod 4: `.default({})` skips inner defaults
Rule: For a config object whose fields have their own defaults, use `.prefault({})`, not `.default({})`.
Why: `.default({})` returns `{}` as-is in zod 4, so nested defaults never applied (booking config).
Where it should live: docs/agents/adding-a-module.md
Seen: 1

### 2026-11-05 — kit — sub-agents leave dev servers running
Rule: Agents that start `astro dev` must stop it before reporting; the lead checks `ps` after every agent.
Why: two agents left `astro dev --port 4399` running from worktrees that were later deleted.
Where it should live: docs/agents/adding-a-module.md
Seen: 1
