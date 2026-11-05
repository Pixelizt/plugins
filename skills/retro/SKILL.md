---
name: retro
description: Consolidate LEARNINGS.md and FEEDBACK.md into the proper docs, fix stale rules, prune duplicates. Run after each client ships, or for "update the rules", "what did we learn", "clean up the docs".
argument-hint: [client-slug]
---

0. **Get three read-only second opinions** (skip for a tiny project). In one message, start three agents over the
   client's git log, `docs/decisions.tsv`, `docs/LEARNINGS.md` and the kit's `LEARNINGS.md`/`FEEDBACK.md`:
   - **What hurt** (Sonnet, effort ≤ high): mistakes, slow steps, human corrections, and the rule that would have prevented each.
   - **What to automate** (Haiku): manual or repeated checks that should become a test, lint or script.
   - **What's stale or missing** (Haiku): docs that no longer match the code, unused skills, rules nobody follows.
   Each finding must cite evidence (commit, file:line, log row). Sort them into: do now / reject (say why) / later.
   Anything a test, lint or script can enforce becomes exactly that; text is for judgment calls only.
1. Read `AGENTS.md` §7, `docs/agents/LEARNINGS.md`, `docs/agents/FEEDBACK.md`, `docs/agents/CHANGELOG.md`.
2. If a client slug is given, also review that project: git log, files that were forked from modules, places
   hardcoded values snuck in, components borrowed (PROVENANCE), and any human corrections in commit messages.
3. Group learnings by topic. For each group decide: promote (move into the most specific doc), merge
   with an existing rule, or drop (outdated/one-off). Learnings with `Seen: 2+` should almost always be promoted.
4. Check docs against reality: commands, paths, and APIs in docs still match the code and current library versions.
5. Apply edits that are in the "may edit directly" table. For anything in the "needs approval" list,
   write a proposal block instead: current rule → proposed rule → why → evidence.
6. Move promoted/dropped entries out of LEARNINGS.md (keep it short). Clear resolved FEEDBACK rows.
7. Keep AGENTS.md under ~250 lines.
8. Log every change in CHANGELOG.md and report: promoted, merged, dropped, proposals awaiting approval.
