# Gallery

An optional front door for [Pixelizt Plugins](https://github.com/Pixelizt/plugins). It looks like a plugin marketplace: browse the modules and registry blocks, then fill a short brief and download `client.yaml`.

It does **not** replace the git / CLI path. Cloning the repo and running `node scripts/new-client.mjs` works exactly as before. The gallery never calls Supabase, Vercel or Resend, and it never asks for a password or a secret.

## Run it

From this folder (Node 22):

```bash
npm install
npm run dev      # http://localhost:4321
npm run check    # astro typecheck
npm test         # brief + catalog tests
npm run build    # static site in dist/
```

The dev server reads `catalog.yaml`, `modules/*/module.json` and registry READMEs from the repo root. Run it inside the plugins repo, not as a copy on its own.

## Pages

| Path | What it is |
|---|---|
| `/` | Home |
| `/catalog` | Every module and registry block, with category filters and search |
| `/catalog/<slug>` | One module or block, from the repo’s own metadata |
| `/start` | Multi-step brief. Download or copy `client.yaml` |

## How the file is written

The form runs in the browser. `src/lib/brief.ts` builds an object and checks it with `starter/src/kit/config/schema.ts` (the same core schema as `npm run validate`). Module blocks are shaped to each module’s schema (`MenuConfig`, `FormsConfig`, and the rest) and the gallery tests parse them with those schemas.

The file includes the business details you typed, colours, and which plugins are on. It does **not** invent covers, room prices, or a meal-plan rate card. Those sections stay hidden until someone fills the real numbers. Notes at the bottom of the file say what is still open.

A developer saves the download to `clients/<slug>/client.yaml` and runs:

```bash
node scripts/new-client.mjs <slug>
```

## What was left alone

`starter/`, `modules/`, and `scripts/new-client.mjs` are unchanged. The gallery has its own `package.json` so a client site does not install it.

Registry components were not reused here. They are restaurant page blocks that expect a client theme. This site is a marketplace, so it has its own layout. Nothing was copied from a paid UI kit.
