# menu changelog

## Unreleased
- Duplicate code removed: `formatPrice` is the core's (src/kit/lib/money.ts), `slugify` the core's (src/kit/lib/text.ts, also strips compatibility characters such as ligatures), JSON-LD escaping is the core's `jsonLdString` (now also escapes `>` and `&`); `slug` is exported for meal-plans.

## 0.1.0 (2026-11-05)
- Ported from the reference project's menu.js, build.js (`menuStatic`, menu JSON-LD) and src/admin/csv.js.
- New: config-driven tags, sizes, nutrition fields, price filter; currency from client.yaml (Intl); pure D23 search
  (accent-insensitive, multi-word, ranked); vanilla filter script with URL state; menu-preview section;
  CSV column spec for the generic admin importer. The reference project's Arabic fields and nutrition string format were not ported.
