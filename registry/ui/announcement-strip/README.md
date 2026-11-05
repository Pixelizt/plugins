# Announcement strip

Use for: A slim message bar above the header: opening news, offers, closures. Optional link and dismiss.
Don't use for: Critical errors or cookie consent (it is not a modal and is easily dismissed).
Vibe: any  |  Motion level: subtle
Deps: none (tiny script for dismiss)
Origin: original (pattern ported from the reference project, agency-owned code)  |  License: agency-owned
Used by: reference-project (2026-11, pattern); registry seed

## Props
| Prop | Type | Default | Notes |
|---|---|---|---|
| `tone` | `primary \| inverse \| muted` | `primary` | |
| `href`, `linkLabel` | string | none, `Learn more` | |
| `dismissible` | boolean | false | button stays hidden until the script runs |
| `dismissKey` | string | none | remember dismissal in localStorage; change the key for a new message |
| `label` | string | `Announcement` | region name |

## Usage
```astro
<AnnouncementStrip href="/events" linkLabel="See events" dismissible dismissKey="summer-2026">Live music every Friday</AnnouncementStrip>
```

## Notes
A remembered dismissal is applied by the script after first paint, so a returning visitor can see a one-frame layout shift. Use `dismissKey` only when the message changes rarely. Open/closed-now logic from the reference project is not included: it belongs to the hours config, not a UI component.

## Rules
Shared conventions and how to install: [`docs/agents/component-registry.md`](../../../docs/agents/component-registry.md).
