## Module: menu (0.1.0)

The menu is one CMS document, `menu` (categories, items, add-ons), rendered as a static page with instant search.
Ported from the reference project's `menu.js`, `menuStatic` and menu CSV; every the reference project-specific value is now config or data.

**Using it**
- Add `menu-full` to a page's sections for the whole menu (static HTML, JSON-LD, search and filters).
  Add `menu-preview` to the home page for a few highlights with a link to `modules.menu.menu_path`.
- Content: `src/content/menu.json` is the seed; once saved in the admin, the saved document wins (check the admin).
  Seed items carry `"sample": true` and are **dropped from production builds**: replace them before launch.
- Category and item `id`s are permanent once the site is live (they are anchors and CSV keys). Rename `name` instead.
- Currency comes from `client.yaml → client.currency` (Intl). Never put a currency in the menu or in a component.

**Config** (`client.yaml → modules.menu`, all optional)
- `show_prices` (true), `allergens` (true), `price_filter` (false: adds a "max price" box)
- `sizes`: size vocabulary, e.g. `[Small, Large]`. Empty = any text. Unknown sizes warn at build.
- `tags`: `[{ key: vegan, label: Vegan, filterable: true }]`. Only listed tags are shown on items; filterable ones
  that some item uses get a filter pill. Tag keys are the client's vocabulary, never hardcode them in a component.
- `nutrition_fields`: `[{ key: calories, label: Calories, unit: kcal }]`. Items store `nutrition: { calories: 150 }`;
  only configured fields display, in this order. Never format nutrition as one string.
- `preview: { tag, count }`: which items menu-preview shows (tag empty = first available).
- Vocabulary problems are build **warnings**, not errors: a typo in the admin must not block a publish.

**Search** (`lib/search.ts`, D23): pure. `buildIndex()` normalizes each item once at build; the browser gets the index as
JSON in `data-index` and calls `searchItems(index, q, {tags, maxPrice, category})`. All words must match (any order, prefix
or substring); rank = name start > name word > name substring > group/tags/allergens > description; ties keep menu order.
Don't add a search library, typo tolerance or hashing unless a client has thousands of items (D23).

**Restyling**: copy `sections/menu-full.astro`, `components/MenuItem.astro` or `components/MenuFilter.astro` to `src/`
and edit classes. Keep the `data-*` attributes (`data-kit-menu`, `data-index`, `data-list`, `data-results`, `data-item`,
`data-section`, `data-group`, `data-controls`, `data-search`, `data-cat`, `data-tag`, `data-count`, `data-empty`): the
script finds elements by them. The script is vanilla (no React, no inline script), and without JS the full menu still shows.

**CSV** (`lib/csv-columns.ts`): column spec and pure row/item converters only. The generic engine is `modules/admin/lib/csv.ts`.
Prices read `Regular 4.50 | Large 5.20`; lists use ` | `; one nutrition column per configured field.
`rowToItem` does not preserve fields the CSV doesn't carry (such as `sample`); the importer should merge by `id`.

**Gotchas**
- JSON-LD lists only available items; sold-out items stay visible in the HTML.
- Search results are clones of the static articles, so item markup must not carry `id` attributes (use `data-*`).
- A schema change that saved documents don't pass breaks the build: add defaults instead of making fields required.
