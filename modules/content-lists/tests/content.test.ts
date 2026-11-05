import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EventsDoc, FaqsDoc, GalleryDoc, ListsConfig, LISTS, OffersDoc, PostsDoc, ReviewsDoc, listSchemas } from "../lib/schema.ts";
import { absoluteUrl, articleJsonLd, faqJsonLd } from "../lib/jsonld.ts";
import { renderMarkdown } from "../lib/markdown.ts";
import events from "../seed/events.json";
import offers from "../seed/offers.json";
import faqs from "../seed/faqs.json";
import reviews from "../seed/reviews.json";
import gallery from "../seed/gallery.json";
import posts from "../seed/posts.json";

describe("seed content", () => {
  const seeds = { events, offers, faqs, reviews, gallery, posts };
  it.each(Object.entries(seeds))("%s validates and every item is a sample", (key, raw) => {
    const doc = listSchemas[key as keyof typeof listSchemas].parse(raw) as { items: { sample?: boolean }[] };
    expect(doc.items.length).toBeGreaterThan(0);
    expect(doc.items.every((i) => i.sample === true)).toBe(true);
  });
  it("has one seed per list", () => expect(Object.keys(seeds).sort()).toEqual([...LISTS].sort()));
  it("carries nothing from the first client's data", () => {
    expect(JSON.stringify(seeds).toLowerCase()).not.toMatch(/lorem|ipsum|todo|tbc/);
  });
});

describe("schema refinements", () => {
  const ev = (o: object) => EventsDoc.safeParse({ items: [{ title: "T", ...o }] });
  it("rejects bad or inverted event dates", () => {
    expect(ev({ start: "2026-13-01" }).success).toBe(false);
    expect(ev({ start: "2026-11-10", end: "2026-11-09" }).success).toBe(false);
    expect(ev({ end: "2026-11-09" }).success).toBe(false); // an end needs a start
    expect(ev({ start: "2026-11-10", end: "2026-11-10" }).success).toBe(true);
    expect(ev({}).success).toBe(true);
  });
  it("validates videos inside events", () => {
    expect(ev({ videos: [{ type: "youtube", id: "dQw4w9WgXcQ" }] }).success).toBe(true);
    expect(ev({ videos: [{ type: "youtube", id: "nope" }] }).success).toBe(false);
    expect(ev({ videos: [{ type: "file", src: "javascript:alert(1)" }] }).success).toBe(false);
    expect(ev({ videos: [{ type: "file", src: "/v/a.mp4", poster: "/v/a.jpg", vertical: true }] }).success).toBe(true);
  });
  it("offers: an end date alone is fine, an inverted range is not", () => {
    expect(OffersDoc.safeParse({ items: [{ title: "x", end: "2026-12-01" }] }).success).toBe(true);
    expect(OffersDoc.safeParse({ items: [{ title: "x", start: "2026-12-01", end: "2026-11-01" }] }).success).toBe(false);
  });
  it("reviews need 1 to 5 whole stars", () => {
    const r = (stars: number) => ReviewsDoc.safeParse({ items: [{ name: "A", stars, text: "t" }] }).success;
    expect([0, 1, 5, 6, 4.5].map(r)).toEqual([false, true, true, false, false]);
  });
  it("gallery photos need alt text", () => {
    expect(GalleryDoc.safeParse({ items: [{ src: "/a.jpg", alt: "" }] }).success).toBe(false);
  });
  it("faqs need a question and an answer", () => {
    expect(FaqsDoc.safeParse({ items: [{ q: "q", a: "" }] }).success).toBe(false);
  });
  it("posts need a clean slug, a real date and unique slugs", () => {
    const p = (o: object) => ({ title: "T", slug: "a-post", date: "2026-10-01", excerpt: "e", body: "b", ...o });
    expect(PostsDoc.safeParse({ items: [p({})] }).success).toBe(true);
    expect(PostsDoc.safeParse({ items: [p({ slug: "Bad Slug" })] }).success).toBe(false);
    expect(PostsDoc.safeParse({ items: [p({ slug: "a/b" })] }).success).toBe(false);
    expect(PostsDoc.safeParse({ items: [p({ date: "yesterday" })] }).success).toBe(false);
    const dup = PostsDoc.safeParse({ items: [p({}), p({ title: "Other" })] });
    expect(dup.success).toBe(false);
    if (!dup.success) expect(z.prettifyError(dup.error)).toContain("duplicate slug");
  });
});

describe("module config", () => {
  it("defaults to every list on, six past events", () => {
    const c = ListsConfig.parse({});
    expect(c.enabled).toEqual([]);
    expect(c.events).toEqual({ past_max: 6, show_past: true });
    expect(c.gallery.lightbox).toBe(true);
  });
  it("takes a subset and per-list options", () => {
    const c = ListsConfig.parse({ enabled: ["events", "faqs"], events: { past_max: 3 }, reviews: { limit: 3 } });
    expect(c.enabled).toEqual(["events", "faqs"]);
    expect(c.events.past_max).toBe(3);
    expect(c.reviews.limit).toBe(3);
  });
  it("rejects unknown lists, options and out-of-range numbers", () => {
    expect(ListsConfig.safeParse({ enabled: ["menu"] }).success).toBe(false);
    expect(ListsConfig.safeParse({ events: { past_mx: 3 } }).success).toBe(false);
    expect(ListsConfig.safeParse({ events: { past_max: -1 } }).success).toBe(false);
  });
});

describe("JSON-LD", () => {
  it("builds FAQPage, and nothing for an empty list", () => {
    expect(faqJsonLd([])).toBeNull();
    expect(faqJsonLd([{ q: "Open?", a: "Yes." }])).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [{ "@type": "Question", name: "Open?", acceptedAnswer: { "@type": "Answer", text: "Yes." } }],
    });
  });
  it("builds Article with absolute urls", () => {
    const a = articleJsonLd({ title: "T", slug: "t", date: "2026-10-01", excerpt: "E", image: "/img/a.jpg" }, { url: "https://x.com/", name: "X Cafe" });
    expect(a["@type"]).toBe("Article");
    expect(a.mainEntityOfPage).toBe("https://x.com/blog/t");
    expect(a.image).toBe("https://x.com/img/a.jpg");
    expect(a.datePublished).toBe("2026-10-01");
    expect(articleJsonLd({ title: "T", slug: "t", date: "2026-10-01", excerpt: "E" }, { url: "https://x.com", name: "X" })).not.toHaveProperty("image");
  });
  it("absoluteUrl keeps full urls", () => {
    expect(absoluteUrl("https://x.com", "https://cdn.com/a.jpg")).toBe("https://cdn.com/a.jpg");
    expect(absoluteUrl("https://x.com/", "a.jpg")).toBe("https://x.com/a.jpg");
  });
});

describe("renderMarkdown", () => {
  it("renders the basics", () => {
    const html = renderMarkdown("# Title\n\nHello **bold** and *it* and `code`.\n\n- a\n- b\n\n1. one\n2. two\n\n> quoted\n\n### Small");
    expect(html).toContain("<h2>Title</h2>");
    expect(html).toContain("<p>Hello <strong>bold</strong> and <em>it</em> and <code>code</code>.</p>");
    expect(html).toContain("<ul><li>a</li><li>b</li></ul>");
    expect(html).toContain("<ol><li>one</li><li>two</li></ol>");
    expect(html).toContain("<blockquote><p>quoted</p></blockquote>");
    expect(html).toContain("<h3>Small</h3>");
  });
  it("joins wrapped lines into one paragraph and splits on blank lines", () => {
    expect(renderMarkdown("one\ntwo\n\nthree")).toBe("<p>one two</p>\n<p>three</p>");
  });
  it("escapes raw HTML (rule 13)", () => {
    const html = renderMarkdown('<script>alert(1)</script> <img src=x onerror="alert(1)"> & "q"');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });
  it("keeps safe links and drops dangerous ones", () => {
    expect(renderMarkdown("[ok](https://example.com/a?b=1&c=2)")).toContain('<a href="https://example.com/a?b=1&amp;c=2" rel="noopener">ok</a>');
    expect(renderMarkdown("[home](/menu)")).toContain('href="/menu"');
    expect(renderMarkdown("[x](javascript:alert(1))")).toBe("<p>x</p>");
    expect(renderMarkdown("[x](//evil.com)")).toBe("<p>x</p>");
    expect(renderMarkdown("[x](data:text/html;base64,AAAA)")).toBe("<p>x</p>");
    expect(renderMarkdown('[x](https://a.com/"onmouseover="y)')).not.toContain('onmouseover="');
  });
  it("is empty for empty input", () => {
    expect(renderMarkdown("")).toBe("");
    expect(renderMarkdown("\n\n  \n")).toBe("");
  });
});
