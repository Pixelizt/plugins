# Gallery
Use for: a grid of the client's own photos. Don't use for: stock placeholders presented as the venue.
Vibe: any. Motion level: subtle (the lightbox fades; hover zoom is disabled under reduced motion).
Deps: registry/ui/lightbox. Origin: original, on top of the registry lightbox. License: agency-owned.
Props: `title?`, `intro?`, `images: { src, alt, caption? }[]`.
Photos without alt text are dropped. Without JS, each thumbnail is a link to the image file.
