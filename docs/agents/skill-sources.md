# Existing skills & tools to reuse (D21)

Check this list **before writing a skill, script or checklist of our own**. Researched 2026-11-05 by web search;
items marked *unverified* were seen only in listings. Update this file when you adopt, reject or find something.

## Adopt (official, maintained)

| Tool | For | Install | Notes |
|---|---|---|---|
| **supabase/agent-skills** (MIT, Supabase) | RLS, migrations, Auth, Storage, Postgres best practices | `npx skills add supabase/agent-skills` | Use when writing module migrations and policies |
| **vercel-labs/agent-skills** → `web-design-guidelines` (MIT, Vercel) | UI + accessibility + forms + animation review (100+ rules) | `npx skills add vercel-labs/agent-skills` (verify form) | Use as the UI/a11y reviewer before "done" |
| **shadcn MCP** (official) | Browse/install components from registries incl. ours | `npx shadcn@latest mcp init --client claude` | Fits the reuse ladder in `ui-sources.md` |
| **Lighthouse CLI** (`lighthouse`, Google, Apache-2.0) | Performance / Core Web Vitals for the definition of done | `npx lighthouse <url> --preset=desktop` / mobile default | A tool in CI, not a skill |
| **axe-core** (Deque, MPL-2.0) | WCAG checks in Playwright smoke tests | `npm i -D @axe-core/playwright` | The engine most a11y MCPs wrap |
| Already installed in the session | GSAP (8 official skills), `ui-ux-pro-max`, `threejs-animation` | — | Don't add duplicates |

## Maybe (evaluate before adopting)
- `anthropics/skills` → `frontend-design` (official, but the repo says demonstration/educational; overlaps `ui-ux-pro-max`).
- Schema Detector (github.com/IvanNon/schema-detector-skill), *unverified*: JSON-LD validator from a URL.
- a11y-mcp (PyPI), *unverified*: only if axe-core in Playwright isn't enough.
- Community Astro skills (incluud, astrolicious): **not official**; check against docs.astro.build.

## Gaps: no good existing tool, so we own these
- Restaurant structured data (Restaurant, Menu/MenuItem with offers, FAQPage, Event, reservation action): in our modules, validated with Google's Rich Results Test.
- Google Business Profile launch checklist.
- Astro / Tailwind v4 token conventions: our own docs (`reskinning-guide.md`, `ARCHITECTURE.md`).
- SEO audit against `client.yaml` (existing tools audit URLs, not briefs).
