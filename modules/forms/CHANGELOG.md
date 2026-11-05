# forms changelog

## Unreleased
- Duplicate code removed: `sheetTime` is the core's `nowIn`, `oneLine`, site URL and the delivery `attempt` wrapper come from the core. Date form fields now reject impossible dates such as 2026-02-30 (they were accepted before).

## 0.2.0 (2026-11-05)
- New extension point: form definitions can name a quote hook (`"quote": "<name>"`); modules provide hooks in
  `form-hooks.ts` (`lib/hooks.ts`, `server/hooks.ts`). The hook re-works the request on the server before the save;
  its field overrides, sheet columns and email blocks are applied; failure means "price to confirm", never a lost enquiry.
- `Form.astro`: cancellable `kit:before-submit` event (lets a page script add `payload.quote`); build fails on a missing hook.
- `teamMail` / `customerMail` take optional extra blocks. Forms without `quote` are unchanged (existing tests pass).

## 0.1.0 (2026-11-04)
- Ported from the reference project's api/submit.js, _lib/sheets.js, _lib/emails.js and main.js validation.
- New: region-aware phones via libphonenumber-js (the reference project only handled one country), Sheets opt-in (D18), retention from config (D17),
  sheet times in the client's time zone (The reference project hardcoded +4), form definitions validated by zod at build,
  vanilla bundled script (no React) shares lib/validate.ts with the server.
