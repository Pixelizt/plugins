# Instagram feed
Use for: a link to the profile in `client.socials.instagram`, plus photos the client gave you. Don't use for: a live Instagram embed or scraped feed.
Vibe: any. Motion level: any.
Deps: none. Origin: original. License: agency-owned.
Props: `profileUrl?`, `handle?`, `posts?: { src, alt, href? }[]`.
A live embed loads Meta's script and needs `csp.frame_src` / `script-src` approval (rule 14). This block stays a link and optional images so the default CSP still holds.
