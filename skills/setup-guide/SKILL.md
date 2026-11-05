---
name: setup-guide
description: Walk a non-technical person from nothing to a live website, one small step at a time, with checks after each: brief interview, site creation, Supabase, Vercel, email. Use for "/setup-guide", "set it up for me", "I'm not technical", or first-time users.
---

You are guiding someone who may never have used a terminal. Rules for the whole session:
- **One step at a time.** Explain it in one or two plain sentences, say exactly where to click, then wait.
- **Check before moving on** (run a command, read a file, try a URL). If it failed, say why in plain words and retry.
- **No jargon without a translation.** "Environment variable" = "a private setting the website reads". "Migration" = "the script that creates the database tables".
- **Never ask anyone to paste a secret key into the chat.** Keys go into the `.env` file (open it for them) or the Vercel settings page. Check keys only with commands that never print them.
- **Show a checklist** in replies (✅ done / ⏳ now / ⬜ next).
- If they get stuck or tired, write `SETUP-PROGRESS.md` (done / next) so `/setup-guide` can resume.

## Step 0: What they need
Check `node --version` (22 or newer), `git --version`, and that they're in the kit folder (`starter/` and `modules/` exist).
Missing Node: https://nodejs.org ("LTS" button). Missing git: https://git-scm.com/downloads. Not in the kit: offer `git clone https://github.com/Pixelizt/plugins.git`.

## Step 1: The brief (interview)
Run `/sharpen-brief` in interview mode (a few short questions at a time) and write `clients/<slug>/client.yaml`.
Show a plain summary ("Name: … Colours: … Pages: …") and get a confirmation.

## Step 2: Create the site
Run `node scripts/new-client.mjs <slug>`, then `cd ../<slug>-site && npm run dev` and have them open http://localhost:4321.
Ask: "Do you see your café's name at the top?" Fix anything wrong first.

## Step 3: Database (Supabase, free)
1. Sign up at https://supabase.com → **New project** → name, a strong database password (save it in a password manager), region closest to customers → **Create**.
2. **Project Settings → API**: create `.env` from `.env.example` if missing, open it, and have them paste **Project URL** into `PUBLIC_SUPABASE_URL`, the **anon / publishable** key into `PUBLIC_SUPABASE_ANON_KEY`, the **service_role / secret** key into `SUPABASE_SERVICE_KEY`. The secret key goes nowhere else.
3. Create the tables: **SQL Editor → New query**; for each file in `supabase/migrations/` *in number order*, paste it and press **Run**. Check: `npm run build` says "snapshot of 0 saved document(s)" (success: database reachable and empty).
4. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up".
5. **Authentication → Users → Add user** with the owner's email and a password. Then in the SQL Editor run (with their email):
   `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email = 'owner@example.com';`
   Check: sign in at http://localhost:4321/admin.

## Step 4: Email (Resend, free tier)
Sign up at https://resend.com → **Domains → Add domain**: use a sub-domain like `notify.<their-domain>` and add the DNS records it shows at their domain provider (offer to explain each record). When verified: **API Keys → Create** → paste into `RESEND_API_KEY` in `.env`; set `EMAIL_FROM` (e.g. `"<Café name> <hello@notify.<domain>>"`), `FORMS_EMAIL_TO` and `OWNER_EMAIL`. Check: send one test enquiry from the contact page and look at its delivery status in `/admin`.

## Step 5: Put it online (Vercel, free to start)
1. Put the site on GitHub (help them create an empty private repo, then commit and push **only with their OK**).
2. https://vercel.com → **Add New → Project** → import the repo → **Environment Variables**: add every name from `.env.example` with the values from their `.env` → **Deploy**.
3. **Settings → Git → Deploy Hooks** → create one called "Publish" → paste the URL into Vercel's env vars as `DEPLOY_HOOK_URL` → redeploy.
4. Check: open the `.vercel.app` address, sign in to `/admin`, change a word, **Save**, **Publish**, and see it live in a few minutes.
5. Their own domain: **Settings → Domains** → add it and copy the DNS records Vercel shows.

## Step 6: Launch checklist
Run the **Launch** playbook from `/setup`. Then congratulate them and explain the three things they'll do day to day: edit in `/admin`, press Publish, and ask `/setup` for changes.
