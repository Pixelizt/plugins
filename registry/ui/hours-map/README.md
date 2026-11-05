# Hours and map
Use for: address, phone, opening hours and a directions link. Don't use for: an embedded map iframe.
Vibe: any. Motion level: any.
Deps: none. Origin: original. License: agency-owned.
Props: `title?`, `address?`, `hours?` (day or range → `"HH:MM-HH:MM"`), `mapUrl?`, `phone?`, `email?`.
Renders nothing when every fact is empty. The map is a link, so no extra CSP host is required.
