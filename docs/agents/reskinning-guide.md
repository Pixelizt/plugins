# Reskinning guide

## 1. What you may change freely
The "free to reskin" rows of the client `AGENTS.md` §2 (source: `starter/AGENTS.md`): theme tokens,
fonts, layout, section order, copy, images, animations, which component renders a section, nav, footer.

## 2. Theme tokens — the only place brand values live
- `src/styles/tokens.css` → CSS variables (`--primary`, `--background`, `--radius`, `--font-heading`, ...), **generated from `client.yaml → brand`**. Change `client.yaml`, not the file
- `src/styles/global.css` maps Tailwind v4 theme utilities to those variables (`@theme inline`)
- Token utilities and logical properties only: see the client `AGENTS.md` §4 (D12)
- Generate a full scale from `client.yaml → brand.colors` (foreground pairs must meet WCAG AA 4.5:1)
- If a color fails contrast, adjust lightness and note it in the summary — don't silently ship it

## 3. What you must not change (without approval)
The frozen rows of the client `AGENTS.md` §2: module backend, validation schemas, DB schema, auth, payments, webhooks.
If a design needs a new field (e.g. "dietary notes" on the booking form), that's a **module
change** → ask first, then do it in `modules/` so every future client gets it.

## 4. Changing a module's UI
Module UI components accept `className` and render-slot props. Prefer:
1. Restyle via tokens/className
2. Compose: use the module's headless hook (`useBookingForm()`, etc.) with your own markup
3. Only as last resort fork the component into the client project (note it in the summary)

## 5. Anti-template checklist (make each client feel distinct)
- [ ] Hero is not the same layout as the last client
- [ ] Type scale and font pairing chosen for this brand's vibe
- [ ] At least one signature effect from `motion-and-3d.md` §4
- [ ] Real photography given visual priority
- [ ] Microcopy written in the brand's voice, not generic
