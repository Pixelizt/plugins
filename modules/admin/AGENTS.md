## Module: admin (0.2.0)

The client's dashboard at `/admin`: a client-only React app, plain and fast (no animation). It is **generated**:
every CMS document declared by the starter (`src/kit/content/docs.ts`) or a module (`module.ts → docs`) gets an
editor built from its zod schema (D7), and every `module.ts → tables` entry gets a list view with CSV export.

**What staff get**: sign in (Supabase Auth, email + password) · role-aware UI (admin / editor / demo, D16) ·
generated forms (text, long text, number, select, toggle, image upload → WebP, tags, key-value, nested lists with
reorder) · validation with the same schema the build uses · Save with conflict detection · History + Restore ·
CSV download/import with a change preview for any list · Publish (admin) · enquiry/booking tables.

**Rules**
- Never write editor UI for a content shape. Add `.meta({ label, help, widget, itemLabel })` to the schema instead.
  Widgets: `textarea`, `image`, `date`, `datetime`, `color`, `url`, `email`, `tel`.
- Cross-field checks (`superRefine`) don't survive the trip to the browser; the build still enforces them on publish.
- Nothing secret reaches `/admin`: only `PUBLIC_*` values, content schemas and seed content. RLS is the boundary.
- Users and roles are created by the agency in Supabase (`app_metadata.role`). Public sign-ups stay off.
- Custom views (a booking calendar) are allowed only where a generated view truly can't work. How (0.2.0):
  list it in the module's `module.ts → adminViews: [{ id, label, minRole }]` and ship `admin/<id>.tsx` (default
  export, props `AdminViewProps` from `app/views.ts`: `api {url, anon, token}`, `session {email, role}`). It shows
  under "Tools" at `#/view/<id>` for roles ≥ `minRole`, loads on first open, and must call server endpoints (Bearer
  token) for anything that writes. Never import `virtual:kit/config` in a view.
- Browser-only helpers (`lib/image.ts toWebp`, `lib/video.ts trimVideo`) need a manual test in Chrome and Safari.
