import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/kit/config/load.ts";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { factFaqs, factLines } from "../src/kit/seo/facts.ts";
import { businessJsonLd, faqJsonLd } from "../src/kit/seo/jsonld.ts";
import { AI_CRAWLERS, llmsFullTxt, llmsTxt, robotsTxt } from "../src/kit/seo/public-text.ts";
import type { ClientConfig } from "../src/kit/config/schema.ts";

const cfg = () => validateConfig(parse(readFileSync("client.yaml", "utf8")), { allowTodo: true });

const filled = (base: ClientConfig): ClientConfig => ({
  ...base,
  highlights: {
    awards: [{ name: "Best coffee", year: 2024, by: "City guide" }],
    specialties: ["single-origin filter"],
    dietary: ["oat milk"],
    ambience: ["quiet room"],
    parking: "One free bay on the street",
    other: [{ label: "Step-free", text: "Step-free from the pavement" }],
  },
});

describe("factual highlights", () => {
  it("ships nothing when the client left highlights empty", () => {
    const c = cfg();
    expect(factLines(c.highlights)).toEqual([]);
    expect(factFaqs(c.highlights)).toEqual([]);
    const ld = businessJsonLd(c, "https://demo-cafe.example.com");
    expect(ld).not.toHaveProperty("award");
    expect(ld).not.toHaveProperty("aggregateRating");
    expect(ld).not.toHaveProperty("review");
    expect(llmsTxt(c, "https://demo-cafe.example.com")).not.toMatch(/Award|parking|Best coffee/i);
  });

  it("uses only the facts the client wrote, in schema, FAQ and llms.txt", () => {
    const c = filled(cfg());
    expect(factLines(c.highlights).map((l) => l.label)).toEqual(["Award", "Known for", "Dietary options", "Ambience", "Parking", "Step-free"]);
    const faqs = factFaqs(c.highlights);
    expect(faqs.map((f) => f.q)).toContain("Is there parking?");
    expect(faqJsonLd([])).toBeNull();
    expect(faqJsonLd(faqs)?.mainEntity).toHaveLength(faqs.length);
    const ld = businessJsonLd(c, "https://demo-cafe.example.com");
    expect(ld.award).toEqual(["Best coffee, 2024, City guide"]);
    expect(ld.knowsAbout).toEqual(["single-origin filter"]);
    expect(JSON.stringify(ld)).not.toContain("aggregateRating");
    const text = llmsFullTxt(c, "https://demo-cafe.example.com");
    expect(text).toContain("One free bay on the street");
    expect(text).not.toContain("None supplied.");
  });
});

describe("robots and crawlers", () => {
  it("allows AI crawlers onto the public site and still hides admin", () => {
    const body = robotsTxt("https://demo-cafe.example.com", "allow");
    for (const bot of AI_CRAWLERS) expect(body).toContain(`User-agent: ${bot}`);
    expect(body).toContain("Disallow: /admin");
    expect(body).toContain("Sitemap: https://demo-cafe.example.com/sitemap-index.xml");
    expect(body).not.toMatch(/User-agent: GPTBot\nDisallow: \/\n/);
  });

  it("blocks AI crawlers without blocking ordinary search", () => {
    const body = robotsTxt("https://demo-cafe.example.com", "block");
    expect(body).toMatch(/User-agent: \*\nDisallow: \/admin/);
    expect(body).toMatch(/User-agent: GPTBot\nDisallow: \/\n/);
    expect(body).not.toMatch(/User-agent: \*\nDisallow: \/\n/);
  });
});
