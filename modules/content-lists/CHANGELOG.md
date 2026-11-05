# content-lists changelog

## Unreleased
- Duplicate code removed: link parsing and embed URL come from the core (src/kit/lib/video-link.ts), `todayIn`/`nowIn`/date check from src/kit/lib/time.ts, JSON-LD escaping from src/kit/seo/jsonld.ts, HTML escaping from src/kit/lib/text.ts. Date fields reject impossible dates exactly as before.

## 0.1.0 (2026-11-05)
- Ported from the reference project's build.js helpers (`splitEvents`, `eventCard`, `videoItem`, offers/faqs/reviews/gallery/posts) and main.js
  (past-event moving, `data-end` expiry, video play/pause on visibility).
- New: one CMS document per list with zod schemas; lists switchable in `client.yaml`; "today" from `client.timezone` (The reference project hardcoded a UTC offset);
  `events.past_max` is config (The reference project: 6 hardcoded); offers with a future `start` appear on their start day; YouTube via youtube-nocookie;
  build fails when a video or image host is missing from `client.yaml -> csp`; FAQPage and Article JSON-LD; accessible `<dialog>` lightbox;
  blog posts as sanitized markdown; no Arabic, no hardcoded copy besides fixed UI words.
