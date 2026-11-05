// Content documents (one per list) and this module's client.yaml block. Pure.
// Every list document is `{ title, intro, items: [...] }`. Items flagged `sample: true` are dropped from production builds.
// Field names are stable keys (rule 17): change labels freely, never rename a field once the client has content.
import { z } from "zod";
import { HM_24, isIsoDate } from "../../../kit/lib/time.ts";
import { videoProblem } from "./video.ts";

export const LISTS = ["events", "offers", "faqs", "reviews", "gallery", "posts"] as const;
export type ListName = (typeof LISTS)[number];

const day = z
  .string()
  .refine((v) => v === "" || isIsoDate(v), "use a real date")
  .default("")
  .meta({ widget: "date" });
const text = (label: string, widget?: "textarea") => z.string().default("").meta({ label, ...(widget ? { widget } : {}) });
const sample = z.boolean().optional().meta({ label: "Sample (hidden on the live site)" });

export const ImageRef = z
  .object({ src: z.string().min(1).meta({ label: "Image", widget: "image" }), alt: z.string().meta({ label: "Describe the image (for screen readers)" }) })
  .meta({ label: "Image" });

export const VideoDef = z
  .object({
    type: z.enum(["file", "youtube", "instagram"]).meta({ label: "Kind" }),
    src: text("File link (uploaded clip)"),
    id: text("YouTube or Instagram id"),
    poster: text("Poster image (optional)"),
    vertical: z.boolean().default(false).meta({ label: "Vertical (phone-shaped)" }),
    caption: text("Caption"),
  })
  .superRefine((v, ctx) => {
    const p = videoProblem(v);
    if (p) ctx.addIssue({ code: "custom", message: p });
  });

const orderCheck = (v: { start: string; end: string }, ctx: z.RefinementCtx) => {
  if (v.start && v.end && v.end < v.start) ctx.addIssue({ code: "custom", path: ["end"], message: "the end date is before the start date" });
};

// events: an end date needs a start date (an offer may have just an end: "until 31 Dec")
const rangeCheck = (v: { start: string; end: string }, ctx: z.RefinementCtx) => {
  if (v.end && !v.start) ctx.addIssue({ code: "custom", path: ["start"], message: "an end date needs a start date" });
  orderCheck(v, ctx);
};

const head = (title: string) => ({
  title: z.string().default(title).meta({ label: "Heading" }),
  intro: text("Intro text (optional)", "textarea"),
});

// ---------- events ----------
export const EventItem = z
  .object({
    title: z.string().min(1).meta({ label: "Title" }),
    type: text("Type (e.g. Music, Tasting)"),
    start: day.meta({ label: "First day", widget: "date" }),
    end: day.meta({ label: "Last day (leave empty for one day)", widget: "date" }),
    time: text("Time (e.g. 7:00 pm to 10:00 pm)"),
    end_time: z
      .union([z.literal(""), z.string().regex(HM_24, "use 24-hour HH:MM, e.g. 23:00")])
      .default("")
      .meta({ label: "Ends at (optional, 24h, e.g. 23:00)", help: "Leave empty and it shows until the end of its last day" }),
    price: text("Price or offer"),
    text: text("Short description", "textarea"),
    image: ImageRef.optional(),
    videos: z.array(VideoDef).default([]).meta({ label: "Videos", itemLabel: "caption" }),
    sample,
  })
  .superRefine(rangeCheck);

export const EventsDoc = z.object({
  ...head("Events"),
  past_title: z.string().default("Past events").meta({ label: "Past events heading" }),
  items: z.array(EventItem).default([]).meta({ label: "Events", itemLabel: "title" }),
});

// ---------- offers ----------
export const OfferItem = z
  .object({
    title: z.string().min(1).meta({ label: "Title" }),
    text: text("Description", "textarea"),
    price: text("Price"),
    start: day.meta({ label: "Starts (leave empty to show now)", widget: "date" }),
    end: day.meta({ label: "Last day (it disappears the day after)", widget: "date" }),
    terms: text("Terms"),
    image: ImageRef.optional(),
    sample,
  })
  .superRefine(orderCheck);

export const OffersDoc = z.object({ ...head("Offers"), items: z.array(OfferItem).default([]).meta({ label: "Offers", itemLabel: "title" }) });

// ---------- faqs ----------
export const FaqItem = z.object({
  q: z.string().min(1).meta({ label: "Question" }),
  a: z.string().min(1).meta({ label: "Answer (plain text)", widget: "textarea" }),
  sample,
});
export const FaqsDoc = z.object({ ...head("Questions and answers"), items: z.array(FaqItem).default([]).meta({ label: "Questions", itemLabel: "q" }) });

// ---------- reviews ----------
export const ReviewItem = z.object({
  name: z.string().min(1).meta({ label: "Name" }),
  stars: z.number().int().min(1).max(5).meta({ label: "Stars (1 to 5)" }),
  date: day.meta({ label: "Date", widget: "date" }),
  text: z.string().min(1).meta({ label: "Review", widget: "textarea" }),
  source: text("Where it was posted (e.g. Google)"),
  sample,
});
export const ReviewsDoc = z.object({ ...head("What guests say"), items: z.array(ReviewItem).default([]).meta({ label: "Reviews", itemLabel: "name" }) });

// ---------- gallery ----------
export const GalleryItem = z.object({
  src: z.string().min(1).meta({ label: "Image", widget: "image" }),
  alt: z.string().min(1).meta({ label: "Describe the image (for screen readers)" }),
  caption: text("Caption (optional)"),
  sample,
});
export const GalleryDoc = z.object({ ...head("Gallery"), items: z.array(GalleryItem).default([]).meta({ label: "Photos", itemLabel: "alt" }) });

// ---------- posts ----------
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const PostItem = z.object({
  title: z.string().min(1).meta({ label: "Title" }),
  slug: z.string().regex(SLUG, "lowercase letters, digits and dashes").meta({ label: "Web address ending (slug)", help: "Part of the post's link. Changing it breaks old links." }),
  date: z.string().refine(isIsoDate, "use a real date").meta({ label: "Date", widget: "date" }),
  image: ImageRef.optional(),
  excerpt: z.string().min(1).meta({ label: "Summary (shown in lists and search results)", widget: "textarea" }),
  body: z.string().min(1).meta({ label: "Post", widget: "textarea", help: "## Heading, - bullet, **bold**, *italic*, [link text](https://example.com). Blank line between paragraphs." }),
  sample,
});
export const PostsDoc = z
  .object({ ...head("From the blog"), items: z.array(PostItem).default([]).meta({ label: "Posts", itemLabel: "title" }) })
  .superRefine((d, ctx) => {
    const seen = new Set<string>();
    d.items.forEach((p, i) => {
      if (seen.has(p.slug)) ctx.addIssue({ code: "custom", path: ["items", i, "slug"], message: `duplicate slug "${p.slug}"` });
      seen.add(p.slug);
    });
  });

export const listSchemas = { events: EventsDoc, offers: OffersDoc, faqs: FaqsDoc, reviews: ReviewsDoc, gallery: GalleryDoc, posts: PostsDoc } as const;

// ---------- client.yaml → modules.content-lists ----------
const limit = z.number().int().min(1).max(200).optional();
export const ListsConfig = z
  .strictObject({
    /** Which lists are live. A list that isn't enabled can't be used on a page (the build says so). */
    enabled: z.array(z.enum(LISTS)).default([]), // none by default: each client turns on what it uses
    events: z
      .strictObject({
        past_max: z.number().int().min(0).max(50).default(6), // how many finished events stay on the page
        show_past: z.boolean().default(true), // false: finished events just disappear
      })
      .prefault({}),
    reviews: z.strictObject({ limit }).prefault({}),
    gallery: z.strictObject({ lightbox: z.boolean().default(true), limit }).prefault({}),
    posts: z.strictObject({ limit }).prefault({}),
  })
  .prefault({});

export type ListsConfig = z.infer<typeof ListsConfig>;
export type EventsDoc = z.infer<typeof EventsDoc>;
export type EventItem = z.infer<typeof EventItem>;
export type OffersDoc = z.infer<typeof OffersDoc>;
export type FaqsDoc = z.infer<typeof FaqsDoc>;
export type ReviewsDoc = z.infer<typeof ReviewsDoc>;
export type GalleryDoc = z.infer<typeof GalleryDoc>;
export type PostsDoc = z.infer<typeof PostsDoc>;
export type PostItem = z.infer<typeof PostItem>;
