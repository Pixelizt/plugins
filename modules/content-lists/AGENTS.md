## Module: content-lists (0.1.0)

Six small editable lists, each one CMS document (`events`, `offers`, `faqs`, `reviews`, `gallery`, `posts`) with a section to show it.
Ported from the reference project's `build.js` helpers and `main.js` (rules 4, 13, 14, 21).

**Using it**
- Switch lists on in `client.yaml → modules.content-lists.enabled` (default: all six). A section for a list that isn't enabled fails the build.
- Add the section to a page: `events`, `offers`, `faqs`, `reviews`, `gallery`, `posts-list`. Typical: `/events: [events, offers]`, `/faq: [faqs]`, `/blog: [posts-list]`.
- Posts get `/blog/<slug>` pages automatically (`routes/blog/[slug].astro`). The `/blog` list is a normal page you add yourself; the path `/blog` is fixed.
- Content = `src/content/<list>.json` (seed, all `"sample": true`) or the saved CMS document, which wins (rule 31). Each document is `{ title, intro, items }`; the headings come from there, not from code.
- Samples are dropped from production builds, so an empty list renders nothing (rule 4): no heading, no "coming soon".
- Restyle by copying a section or `components/EventCard.astro` / `VideoItem.astro` into `src/sections/` / `src/components/`. Keep the `data-*` attributes: the scripts use them.

**Config** (`client.yaml → modules.content-lists`): `enabled`, `events.past_max` (default 6) and `events.show_past`, `reviews.limit`, `gallery.limit` and `gallery.lightbox`, `posts.limit`.

**Dates and expiry**
- "Today" is `client.timezone` (rule 21): `lib/dates.ts` is pure with an injected `now`. The same functions run at build and in the browser.
- Pages are static and a rebuild may be days away, so `lib/client/expire.ts` (a bundled script, no inline JS) hides what has ended since the build:
  offers disappear the day after `end` (and appear on a future `start`); events move to "Past events" (newest first, held to `past_max`).
  Needs `data-kit-list`, `data-tz`, `data-event`, `data-end`, `data-offer`, `data-events-past` on the markup.
- An event with no date never expires. `end` without `start` is rejected. `end` is the last day it is on.

**Videos** (events only): `type: file | youtube | instagram`. YouTube/Instagram store only the id (paste a link through `lib/video.ts → parseLink`;
the admin should call it). The embed address is always rebuilt from the id; YouTube uses **youtube-nocookie**.
Clips play muted while on screen and pause off screen; with `prefers-reduced-motion` nothing autostarts.
- **CSP:** embeds need `client.yaml → csp.frame_src: ["https://www.youtube-nocookie.com", "https://www.instagram.com"]`; clip files from another host need
  `csp.media_src`, and any external photo or poster needs `csp.img_src` (Supabase storage is allowed automatically). The build **fails**
  with the exact line to add if one is missing (`lib/csp.ts`). Adding hosts needs owner approval (rule 14).

**Rules**
- Item fields are stable keys: rename labels freely, never the field names once the client has content (rule 17).
- Post `slug` is part of the URL; changing it breaks links. Slugs must be unique (the build fails on duplicates).
- Post bodies are a markdown subset rendered by `lib/markdown.ts` after escaping everything (rule 13). Never switch it to raw HTML.
- JSON-LD: FAQPage (faqs) and Article (each post). Reviews emit no markup on purpose (self-serving review markup is penalised by Google).
- Inline `style=""` and inline scripts are blocked by the strict CSP: use classes and the bundled scripts.
- Gallery images can be any site path or https URL; the seed uses plain SVG data URIs so there are no missing files. Replace with the client's own photos (rule 35).
