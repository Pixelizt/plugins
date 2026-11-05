## Module: forms (0.2.0)

Every website form posts to `POST /api/submit`. Ported from the reference project (rules 8–10, 12, 17–20, 22, 24).

**Pipeline**: validate against the form definition (same `lib/validate.ts` as the page) → honeypot `_gotcha` →
rate limit (HMAC'd IP, counted in the table) → insert into `submissions` (**this decides success**) → in parallel:
Google Sheet (opt-in), team email (`FORMS_EMAIL_TO`), customer confirmation → each outcome written to `delivery`.

**Using it**
- Definitions live in `src/content/forms.json` (zod-validated at build). Make a form live by listing its id in
  `client.yaml → modules.forms.forms`. Render it anywhere with `<Form id="contact" />`, or use the `contact-form` section.
- Field `key`s are permanent once data exists (rule 17). Change labels freely; never rename keys.
- `customer_email` wording is fixed text. Never put visitor input in it (rule 9). Say what the request is *not* (rule 18).
- Restyle by copying `components/Form.astro` into `src/components/` and keeping its `data-*` attributes and field names.
- Not CMS-editable in 0.1: the server must validate against exactly what the page shows.

**Config** (`client.yaml → modules.forms`): `phone_region` (ISO code), `retention_days` (default 100, must match
the privacy policy), `rate_limit {max, window_minutes}`, `sheets` (default false), `forms` (live form ids).

**Quote hooks** (0.2.0, the one extension point; types in `lib/hooks.ts`)
- A form definition may name a hook: `"quote": "meal-plans"`. Hooks live in any module's `form-hooks.ts`
  (default export `{ name, quote(input, ctx) }` or an array), found by `server/hooks.ts` with `import.meta.glob`.
- On submit, after validation and the rate limit and before the save, the pipeline calls `hook.quote(body.quote, ctx)`.
  `ctx = { cfg, formId, def, fields (copy), now, env }`. The hook returns
  `{ delivery, fields?, sheet?, subjectTag?, teamBlocks?, customerBlocks?, teamNote? }` or `{ error, fields?, sheet? }`.
- `fields` overrides only keys the form defines (`""` removes one): the server's text replaces the browser's (rule 8).
  `sheet` adds columns to the form tab and "All". `delivery.quote` records `priced …` or `price to confirm: <why>`.
- `{ error }`, a throw, or a missing hook never fails the visitor: the enquiry is saved, the team email gets a
  "Price to confirm" note, and the customer gets the form's fixed wording only. The response adds `quoted: true|false`.
- `customerBlocks` must be server-generated data only (rule 9). Reviewing a new hook = checking that.
- Browser side: `Form.astro` dispatches a cancellable `kit:before-submit` event on the `<form>` with `detail.payload`.
  A module script sets `payload.quote` or calls `preventDefault()` (after showing its own message).
- `<Form>` fails the build if its `quote` hook isn't installed. Forms without `quote` behave exactly as in 0.1.0.

**Checking delivery**: the admin's Enquiries view shows `delivery` per row: `ok`, `off` (not set up), `none`, or `error: …`.
After changing any email/Sheets env var, send one test enquiry and check that column.
