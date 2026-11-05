## Module: meal-plans (0.1.0)

Priced meal-plan **requests** (no payment, D3). The customer picks meals per day from the menu for a plan length and
sees a live price; the request goes through the `forms` pipeline, where the **server prices it again** from its own
menu, config and set menus (rule 8). Ported from the reference project's `plans.js` engine/price and `plan-quote.js`.

**Pieces**
- `lib/engine.ts`: the one pure engine (dates, set menus, picks, price) for page AND server (rule 1). Clock injected.
- `form-hooks.ts` → `server/quote.ts`: the `meal-plans` quote hook (forms 0.2.0 extension point).
- Sections: `meal-plan-builder` (builder + the request form, one per page) and `meal-plan-rates` (discount table).
- `lib/client/builder.ts`: vanilla bundled script (no React, no inline JS); data arrives in `data-plan`.
- CMS document `meal_plans`: title, intro, set menus (flat rows: day, meal, item or "of your choice"), wording.

**Install**
1. `node scripts/install-module.mjs <client> meal-plans` (brings `menu` and `forms`).
2. The plan form: `src/content/forms.json` already exists, so the installer does NOT copy it. Merge the `"meal-plan"`
   entry of `src/modules/meal-plans/forms/meal-plan.json` into `src/content/forms.json` by hand (keep `"quote": "meal-plans"`
   and the `plan` textarea; adjust wording with the client). Add `meal-plan` to `client.yaml → modules.forms.forms`.
3. Fill `client.yaml → modules.meal-plans` (below), add a page: `sections: [meal-plan-builder, meal-plan-rates]`.
4. Fill `tests/rate-card.test.ts` with the client's PRINTED figures (rule 23) and report any difference in writing.

**Config** (`client.yaml → modules.meal-plans`; empty = sections hide). All business numbers live here, nothing in code:
```yaml
meal-plans:
  form: meal-plan          # form id; plan_field: plan (the textarea the plan text goes in)
  slots:                   # meals of the day; each pick lists menu category ids
    - { key: lunch, label: Lunch, picks: [{ key: main, label: Dish, categories: [mains] }, { key: drink, label: Drink, categories: [drinks], required: false }] }
  plans:                   # meals a day; several combos = "which meals?" question
    - { key: one, label: 1 meal a day, combos: [{ key: lunch, label: Lunch, slots: [lunch] }] }
  grids:   [{ key: weekdays, label: Monday to Friday, days: [mon, tue, wed, thu, fri] }]
  lengths: [{ key: m20, label: 4 weeks, days: 20, grid: weekdays, group: Monthly, note: "" }]  # days = delivery days
  rates:   [{ plan: one, length: m20, discount: 10 }]        # percent; missing pair = no discount
  rounding: { step: 5, mode: nearest, scope: total, discount_step: 1 }   # scope total | per_day
  tax: { rate: 5, label: VAT, inclusive: false }
  start: { lead_days: 1, max_ahead_days: 90, weekdays: [] }   # weekdays: allowed start days, [] = any
  blackout_dates: ["2026-12-25"]   # closed days: skipped, the plan runs on past them
  sets: true                       # offer the CMS set menus
```
Currency = `client.currency`, "today" = `client.timezone` (rule 21), locale = `client.locale`.

**Price rule** (`priceOf`): menu prices over the actual delivery dates → round to `rounding.step` (once on the total,
or each day with `scope: per_day`: they can differ by a few units, the reference project's open discrepancy) → less the rate-card % →
round to `discount_step` → tax (added, or the included part when `inclusive`). Integer minor units throughout.
A set row's `price` overrides the menu price; an "of your choice" row always costs the set's price.

**Rules**
- Never trust anything priced by the browser. The page sends picks only (`PlanInput`, strict: extra keys are refused).
  `shown_total` is only compared: a mismatch puts a note in the team email (stale tab, or menu saved after the build).
- Unpriceable requests are still saved: `delivery.quote = "price to confirm: …"`, the plan field starts with
  `PRICE TO CONFIRM` and keeps the customer's text for the team only. The customer email never echoes visitor text (rule 9).
- Customer emails always say nothing has been paid (form wording + `copy.payment_note`, rule 18). Keep both.
- Incomplete sets (a day × meal with nothing, an unknown item or size, a choice with no options) are hidden and logged
  as build warnings (rule 4). Set menus must cover every meal any plan uses on every day any length uses.
- Sheet columns `plan_name, plan_meals, plan_length, plan_first_day, plan_last_day, plan_total` are stable keys (rule 17).
- Restyle by copying a section to `src/sections/`; keep ids (`mp-*`), `data-mp*` attributes and radio names.

**Gotchas**
- The server prices from the build's content snapshot (D33), the same menu and plan data the page was built from,
  so unpublished edits never change a price. The `shown_total` comparison stays as a second guard; a mismatch adds a team note.
- Seed items are `sample: true`, so production builds hide the builder until real menu items and config exist.
- Not handled (yet): nutrition totals, "customise this set", per-request capacity, price changes after the request.
