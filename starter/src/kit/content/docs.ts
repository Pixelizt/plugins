// Content documents owned by the starter. Modules declare theirs in module.ts → docs.
// The admin generates an editor for every schema registered here (D7).
import { z } from "zod";

const Link = z.object({ label: z.string().min(1), href: z.string().min(1) });
const Image = z.object({ src: z.string().min(1), alt: z.string() });

export const HeroDoc = z.object({
  eyebrow: z.string().default(""),
  headline: z.string().min(1),
  text: z.string().default(""),
  image: Image.optional(),
  primary: Link.optional(),
  secondary: Link.optional(),
});

export const AboutDoc = z.object({
  title: z.string().min(1),
  paragraphs: z.array(z.string().min(1)).min(1),
  image: Image.optional(),
});

export const CtaDoc = z.object({
  title: z.string().min(1),
  text: z.string().default(""),
  action: Link,
});

export const HighlightsDoc = z.object({
  title: z.string().default(""),
  items: z.array(z.object({ title: z.string().min(1), text: z.string(), sample: z.boolean().optional() })),
});

export const starterDocs = {
  hero: HeroDoc.meta({ label: "Hero" }),
  about: AboutDoc.meta({ label: "About" }),
  cta: CtaDoc.meta({ label: "Call to action" }),
  highlights: HighlightsDoc.meta({ label: "Highlights" }),
} as const;
