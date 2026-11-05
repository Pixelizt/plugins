# Menu tabs
Use for: a menu split into categories the visitor can switch. Don't use for: the searchable full menu (that's the `menu` module).
Vibe: any. Motion level: any.
Deps: none. Origin: original. License: agency-owned.
Props: `title?`, `categories: { id, label, items: { name, description?, price?, meta? }[] }[]`, `label?` (tablist name).
Empty categories are dropped. With JS off, every category is on the page. Arrow keys, Home and End move the selected tab.
