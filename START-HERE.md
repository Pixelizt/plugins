# Start here

This kit builds websites for restaurants, cafés and food businesses: menu, contact forms, events, table and
private-event booking, meal plans, and an easy dashboard where staff change the content themselves.
An AI assistant does most of the work. You describe what you want in plain words.

## The easiest way (no technical knowledge needed)

1. **Install Claude Code**: https://claude.com/claude-code (it's the AI assistant that runs the kit).
2. **Download this kit**: on https://github.com/Pixelizt/plugins press **Code → Download ZIP** and unzip it,
   or ask Claude Code: *"download https://github.com/Pixelizt/plugins for me"*.
3. **Open the folder in Claude Code** and type:

   ```
   /setup-guide
   ```

That's it. It checks your computer, asks you about the business (name, colours, opening hours, which features),
builds the site, and then walks you through putting it online, one small step at a time. It tells you exactly
where to click and checks each step before moving on. You can stop any time; it saves your progress.

**What it will ask you to sign up for** (all have free plans to start):

| Service | What it's for |
|---|---|
| Supabase | Stores the menu, enquiries and bookings, and the staff logins |
| Resend | Sends the confirmation emails |
| Vercel | Puts the website on the internet |
| A domain name (e.g. from your existing provider) | Your web address, like `yourcafe.com` |

## After the site is live

- **Change content:** go to `yourcafe.com/admin`, sign in, edit, press **Save**, then **Publish**.
  The site updates in a few minutes.
- **Ask for changes:** open the site's folder in Claude Code and say what you want, starting with `/setup`.
  For example: `/setup make the menu page feel more premium` or `/setup add our new opening hours`.
- **Not sure what to type?** `/help-me`.

## Use the skills in other AI assistants

The skills are plain `SKILL.md` folders, so most AI coding assistants that support "agent skills" can use them.

- **Claude Code:** `/plugin install kit --marketplace Pixelizt/plugins`
  (older versions: `/plugin marketplace add Pixelizt/plugins`, then `/plugin install kit@pixelizt`).
- **Any other assistant (Cursor and others):** say to it:

  > Install the skills from https://github.com/Pixelizt/plugins: copy every folder inside `skills/` into this
  > project's skills folder for your tool (for example `.cursor/skills/`, `.agents/skills/` or `.claude/skills/`).
  > Then read `skills/help-me/SKILL.md` and tell me what I can do.

- **The rules file** `AGENTS.md` is read automatically by most coding assistants when you open this folder.

Some steps use Claude Code features (like starting helper agents). In other assistants those steps run in a
simpler way.

## Stuck?
Type `/help-me`, or open an issue on GitHub with what you typed and what you saw.
