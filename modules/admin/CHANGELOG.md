# admin changelog

## Unreleased
- Duplicate code removed: link parsing and embed URL come from the core (src/kit/lib/video-link.ts), `slugify` from src/kit/lib/text.ts, `canon`/`humanize` from the cms module, role order from src/kit/lib/roles.ts. No change for editors.

## 0.2.0 (2026-11-05)
- Custom views: modules' `adminViews` appear under "Tools" (`#/view/<id>`), role-gated by `minRole`, loaded lazily from
  `src/modules/<module>/admin/<id>.tsx` (`app/views.ts`, tested). Existing editors and tables unchanged.

## 0.1.0 (2026-11-05)
- Redesigned from the reference project's 2,000-line admin.js (D7): editors generated from zod → JSON Schema, browser
  validation via z.fromJSONSchema, history/restore via cms, CSV import with diff preview, image upload to WebP,
  role-aware UI (D16), table views for module tables.
- Helper libraries (csv, image, video, video-link) ported by the admin-helpers agent.
