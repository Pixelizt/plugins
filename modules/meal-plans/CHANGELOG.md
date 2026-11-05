# meal-plans changelog

## Unreleased
- Duplicate code removed: date helpers, `todayIn` and money formatting come from the core (src/kit/lib/time.ts, money.ts), `slug` from the menu module, `gridLabel` is one function in lib/engine.ts. Blackout dates now reject impossible dates such as 2026-02-30.

## 0.1.0 (2026-11-05)
- Ported from the reference project's plans.js (`engine()`, `price()`, `mealDates()`, `choiceOptions()`), plan-quote.js and
  the subscription branch of api/submit.js, rewritten in TypeScript.
- Everything the reference project hardcoded is config: currency (client.currency), tax rate/label/inclusive, rounding step/mode/scope,
  discount rounding, slots and picks, plans and combos, grids, lengths and their display groups, rate card, start rules,
  time zone (client.timezone instead of +4h).
- New: blackout (closed) dates, `rounding.scope` (total vs per day, the reference project's discrepancy), tax-inclusive pricing,
  zero/three-decimal currencies, start lead time and horizon, flat CSV-friendly set-menu rows for the generated admin.
- Server re-pricing through the forms 0.2.0 quote-hook extension point; "price to confirm" fallback kept.
- Rate-card test template (rule 23).
