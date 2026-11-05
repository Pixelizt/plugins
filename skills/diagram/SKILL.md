---
name: diagram
description: Draw Mermaid diagrams that render on GitHub and in chat: status flows, user journeys, site maps, module connections, database tables, timelines. Use for "/diagram", "draw", "visualise", "show me the flow", or when a picture beats text.
argument-hint: <what to draw, or a file/module to diagram>
---

Goal: one diagram that a client or a new developer understands in ten seconds.

## 1. Pick the right kind
| Explaining… | Mermaid type | Example |
|---|---|---|
| Statuses something moves through (a booking, an order, a request) | `stateDiagram-v2` | pending → confirmed / declined / expired, confirmed → cancelled |
| Steps a person takes, or a process with choices | `flowchart LR` (or `TD` for long ones) | visitor picks a date → sees free times → submits → email |
| Who calls whom, in order (browser, server, database, email) | `sequenceDiagram` | form submit → validate → save → send emails → write delivery status |
| Pages and how they link | `flowchart TD` | site map from `client.yaml → pages` |
| Database tables and their links | `erDiagram` | `bookings`, `booking_resources`, `booking_blocks` |
| Dates and phases | `timeline` or `gantt` | launch plan |

## 2. Read the real source first, never draw from memory
- Statuses: find the enum/`status` union, SQL `check` constraint and the functions that set it. Every arrow must exist in code, labelled with its trigger.
- Flows: follow the actual handler or component. Site maps: `client.yaml → pages`. Tables: the migrations.
If ambiguous, draw what the code does and list the question under the diagram.

## 3. Draw it
- Plain words on boxes and arrows ("staff approves", "hold expires"), not function names, unless the reader is a developer.
- At most ~15 nodes; otherwise an overview plus one diagram per part.
- One direction of flow, no avoidable crossings; group with `subgraph`.
- Mark start (`[*]`) and end states. Show error/timeout paths, not just the happy path.
- No colours or styling unless meaningful; it must read in light and dark mode.

## 4. Deliver
- Use a fenced ```` ```mermaid ```` block. If it documents code, save it in that module's `AGENTS.md` or a `docs/` file beside the text it explains, and keep it in sync.
- Check syntax: with Node, `npx -y @mermaid-js/mermaid-cli -i diagram.mmd -o /tmp/diagram.svg` must succeed; otherwise re-read against Mermaid syntax for that type.
- Under it: two or three lines on how to read it, plus open questions.
