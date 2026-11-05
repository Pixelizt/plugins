---
name: sharpen-brief
description: Turn a vague client brief into concrete client.yaml values plus a short list of questions for the client. Use for "/sharpen-brief", new-client intake, or fuzzy requests like "make it modern and fun".
argument-hint: <the brief, or a path to it>
---

**Interview mode** (no brief given, or the user isn't technical): ask a few short questions at a time, in plain words,
with examples and options where possible ("Pick a feel: warm & cosy / bright & modern / dark & premium"). Cover: name,
type, address, phone, email, opening hours, what they sell most, colours or logo (they can drop a file into
`clients/<slug>/assets/`), fonts or a feel, which features they want (contact form, menu, events, table booking,
private-event booking, meal plans), and which pages. Then write `clients/<slug>/client.yaml` from
`client.example.yaml` yourself and show a plain summary to confirm. Never make them edit YAML.

**With a written brief:**
1. **Pin down the business:** what they sell most, who their customers are, busy hours, how people book or order today.
2. **List what to collect instead of guessing:** menu file, logo files, their own photos, Google Business Profile,
   Instagram, two or three sites they like, booking rules, prices.
3. **Translate every fuzzy word into `client.yaml`:** "modern" or "fun" becomes concrete `brand.vibe`, colors, fonts,
   `motion.level`, modules and `pages`. Where it's a taste call, give 2–3 options instead of picking one.
4. **Say how we'll know it's right:** sign-off on a hero mockup, a test booking going through, a Lighthouse score.

Output a draft `client.yaml` (only values you're confident about) and **Questions for the client**: numbered, short,
easy to answer. Taste and business decisions stay open for the client.
