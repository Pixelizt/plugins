---
name: catch-up
description: Summarize where a client site (or the kit) stands from its own records, then give the next step. Use for "/catch-up", "where did we leave off", "what's the status", or before resuming old work.
---

Look, in this order, and stop as soon as you have the picture:
1. **Git:** current branch, uncommitted changes, the last ~20 commits, anything not pushed.
2. **The brief:** `client.yaml` (or `catalog.yaml` in the kit): modules, pages, any `TODO`.
3. **Notes:** the last rows of `docs/decisions.tsv`, `docs/LEARNINGS.md`, open questions in `docs/DECISIONS.md`.
4. **Health:** do `npm run check && npm test && npm run build` pass? Any `sample: true` or `TODO` left (`grep -rn`)?

Answer on one screen:
- **Where it stands** (3–5 lines).
- **Open work**, one line each, marked done / in progress / blocked (why) / not started.
- **Problems** worth knowing (at most 5).
- **Do next:** one concrete action.
