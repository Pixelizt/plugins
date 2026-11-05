# Rules learned on the reference project 

Learned the hard way on our first client (Oct to Nov 2026). Each rule has its reason. These apply to
**every client site** unless a module's `AGENTS.md` says otherwise. Source:
the local, untracked handoff in `reference/` §8 and §10.

Rules that only applied to the reference project's stack (ES5-only browser code, Arabic in every commit, the reference project's copywriting
rules) were left out on purpose. See `docs/BOILERPLATE-BOUNDARIES.md`.

---

## Code structure
1. **One rule, one place.** A business rule (price, phone/email validity, availability) lives in one pure
   function in `lib/` and is imported by both the browser and the server. *Why: page and server disagreed and rejected valid input.*
2. **Pure functions at the core, I/O at the edges.** Calculations take the clock, data and config as
   arguments, so they can be tested. *Why: the reference project's pricing engine only became testable and reusable once it was extracted.*
3. **Fail loudly at build** for content mistakes (invalid doc, missing required field, unknown reference)
   rather than shipping a broken page.
4. **Never show half-finished content.** Empty or `sample` data hides its section. Never render "TBC",
   "coming soon" or "price on request". *Why: a client rule that will apply to most clients.*
5. **When you edit code with a script, never use `String.replace(str, str)` if the replacement can contain `$`.**
   Use `split().join()` or a replacer function. *Why: `$$` became `$` and broke every form on the site.*
6. **A committed generated file must have a staleness test,** and be regenerated in the same commit as its source.
   *Why: the server priced from a stale generated file.*
7. **Keep the every-page JS payload under a byte budget** enforced by a test. Page-only data goes in that page's bundle.

## Security & privacy
8. **The server re-prices and re-validates everything.** Never trust a price, total, item name or
   field from the request body. *Why: otherwise a visitor can edit the page and get an official email quoting a price of 1.*
9. **Customer emails never echo the visitor's free text** (not even their name). Use fixed wording plus
   server-generated data only. *Why: otherwise the form becomes a spam relay from the client's domain.*
10. **Email recipients come from env vars only,** never from the request.
11. **Permissions are enforced in the database** (RLS on `app_metadata.role`) **and** re-checked in every
    server function, not only in the UI. *Why: the anon key is public.*
12. **Private tables** (submissions, bookings): RLS on, no anonymous policy, service-key writes only,
    automatic retention delete that matches the privacy policy.
13. **Escape everything** a visitor or editor typed before it reaches HTML or email.
14. **Strict CSP** (`script-src 'self'`). No inline scripts (they're blocked silently), no CDNs. Adding a host
    for images, media, frames or connections needs approval.
15. **Never `git add -A` blindly.** Check `git status` first. Keep `.env` ignored, and run the secret scan in a
    pre-commit hook and in CI from the first commit. *Why: real keys were pushed once.*
16. **If a secret is ever pushed, rotate it at the provider.** Rewriting history is cleanup, not the fix.

## Forms, emails, bookings
17. **Every form field has a stable `key`,** separate from its label. Never rename a key once data exists.
    *Why: the sheet columns, the dashboard and stored JSON all join on keys.*
18. **Tell the customer what a request is *not*:** "your table is not confirmed yet", "nothing has been
    paid yet". *Why: a generic "we got your enquiry" was read as a confirmation.*
19. **Phone validation is region-aware** (local formats plus international with a country code). Show the
    message under the field, and scroll and focus to the first error on submit.
20. **Write each side effect's outcome onto its row** (`delivery: { sheet: "ok", team_email: "error: …" }`).
    *Why: free-tier logs last 1 hour; a silent sheet failure was only found this way.*
21. **Dates and "today" come from the business's time zone,** never the server's UTC.
22. **HTML email:** table layout, inline styles, absolute image URLs, a plain-text twin. Don't rely on `<details>`
    (Gmail shows it open).
23. **Match the client's printed prices exactly** in a data test before shipping any pricing. Report any
    rounding difference to the client in writing.

## Environment & deploy
24. **Before parsing a pasted env value** (JSON key, ID), strip non-breaking and zero-width spaces, and
    accept the full-URL form. Log "not set" separately from "unparseable". *Why: a pasted key silently turned the sheet off.*
25. **Free-tier database:** use a daily keep-alive, and make the build **fail loudly** when the DB is unreachable,
    rather than building with stale data.
26. **Test deployed changes in a fresh tab or after a hard reload.** Log which client version sent a request.
    *Why: an old open tab sent an old payload and looked like a server bug.*
27. **Never push to the production branch without explicit approval** in that session. Feature work goes on a
    preview branch. Limit which branches build.
28. **Before merging a long-lived branch,** trial-merge it in a throwaway worktree and run the tests and build there.
29. **Sub-agents in git worktrees must fast-forward to the current branch first.** Worktrees start from `main`.
30. **Give clients a share link** for previews that sit behind deployment protection.

## CMS & admin
31. **Before saying a content change is live,** check whether a saved dashboard document overrides the seed
    file. *Why: menu fixes were reported live while the saved copy still won.*
32. **Saves use optimistic concurrency** (filter the PATCH on `updated_at`; 0 rows back = conflict).
33. **Every CMS document keeps history** (last N versions, with the editor's email). Restore loads the version
    as *unsaved* changes in the editor.

## Content & client
34. **Ask before inventing any business fact:** prices, dishes, hours, policies, payment wording. List unknowns as open questions.
35. **Use only the client's own photos** unless they explicitly allow stock. Record each image's source.
36. **Mark any machine-drafted translation as a draft** for native review.

## Process
37. **Write a test for every pure function and every bug you fix.** Tests never call real services: stub
    `fetch` and use fake keys.
38. **Keep the docs true:** when behavior changes, update `AGENTS.md`, module docs and the README in the same piece of work.
39. **Report honestly:** list what changed, what you verified, what you *didn't* verify, your assumptions,
    and the questions for the client.
