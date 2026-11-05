# cms changelog

## Unreleased
- `canon` no longer turns hex or exponent text into a number when comparing ("0x1F" is not 31, "1e3" is not 1000): the stricter rule the admin CSV preview already used, now the single copy.

## 0.1.0 (2026-11-04)
- Ported from the reference project: docs + docs_history (last 20), optimistic-concurrency saves, publish via deploy hook, change summary email.
- New: drafts are private (D8), roles split (D16; settings_* documents admin-only), labels come from schemas,
  one change email per publish (The reference project sent after saves too), media buckets in the migration.
