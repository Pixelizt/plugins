# Copy-paste prompts

Plain prompts for Claude Code. Each one works as written; swap the parts in <angle brackets>.
Not sure which to use? Type `/help-me`, or just start with `/setup` and describe what you want.

## Starting a client
- `/sharpen-brief <paste the client's email or notes>`
- `/new-client <slug>` (after `clients/<slug>/client.yaml` is filled in)

## Design
- `/setup the hero feels generic. Give me 3 directions that fit "<vibe>", screenshots of each, then wait for my pick.`
- `/setup move reviews above the menu preview on the home page and make the menu preview a horizontal scroll on mobile.`
- `/setup make the site feel more premium without slowing it down. Propose the changes first.`
- `/add-motion <slug> subtle reveal on scroll for every section, nothing on the booking form.`

## Content
- `/setup the client sent their menu as <file>. Import it, keep their dish names exactly, list anything missing.`
- `/setup add these 4 events: <paste>. Hide each one the day after it ends.`
- `/unslop src/content/about.json` (keeps the client's own words, fixes the rest)

## Fixes and feedback
- `/setup bug: <what happens>, on <page>, on <phone/desktop>. Reproduce first, then fix.`
- `/setup client feedback round: <paste list>. Make a checklist, ask about anything unclear, then do it.`

## Launch and after
- `/setup launch checklist for <slug>. Don't deploy; tell me what's left.`
- `/catch-up`
- `/harvest src/sections/<name>.astro`, then `/retro <slug>`

## Kit maintenance (in the kit repo)
- `/setup port <feature> from <reference> into a module. Generic only, demo data marked sample.`
- `/retro` (after every client)
