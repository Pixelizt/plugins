---
name: help-me
description: Explain which kit command or playbook fits a task, with example prompts. Use for "/help-me", "help", "what can you do", "which command do I use", or when the user is unsure how to start.
argument-hint: [what you're trying to do]
---

If the user described a task, name the ONE command that fits and show the exact prompt to type. Otherwise print this:

**First time, or not technical?** `/setup-guide`: it walks you from nothing to a live site, one step at a time.

**Start here:** `/setup <what you want>`: it picks the right playbook for you.

| Command | Use it for | Example |
|---|---|---|
| `/setup-guide` | guided setup from zero to a live site | `/setup-guide` |
| `/setup` | anything | `/setup the client wants the menu page to feel more premium` |
| `/new-client <slug>` | build a new site from `clients/<slug>/client.yaml` (kit repo) | `/new-client sunny-bakery` |
| `/sharpen-brief` | turn a vague client brief into `client.yaml` + questions | `/sharpen-brief "modern, fun, for young people, has events"` |
| `/reskin` | colors, fonts, layout, section order, copy | `/reskin make the hero bolder and move reviews above the menu` |
| `/add-ui` | a new section or component | `/add-ui testimonial carousel` |
| `/add-motion` | animation, scroll effects, 3D | `/add-motion pinned scroll story for the about section` |
| `/add-module` | forms, menu, bookings, meal plans | `/add-module table-booking` |
| `/diagram` | draw a flow, status chart, site map or table diagram (Mermaid) | `/diagram how a table booking moves from request to confirmed` |
| `/unslop` | make website/email text sound human | `/unslop src/content/about.json` |
| `/catch-up` | where does this site stand, what's next | `/catch-up` |
| `/harvest` | save a great component for future clients | `/harvest src/sections/hero.astro` |
| `/retro` | turn what we learned into better rules | `/retro sunny-bakery` |

Installed as a plugin, commands are prefixed: `/kit:setup`, `/kit:help-me`, `/kit:unslop`… Kit-only commands
(`new-client`, `add-module`, `harvest`, `retro`) need the kit repo: https://github.com/Pixelizt/plugins

More copy-paste prompts: `prompts/README.md`. Rules: `AGENTS.md`. How it all fits: `docs/ARCHITECTURE.md`.
