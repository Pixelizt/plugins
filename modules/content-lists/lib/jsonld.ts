// JSON-LD builders (pure). FAQPage for the FAQ list, Article for blog posts.

export const absoluteUrl = (site: string, pathOrUrl: string): string =>
  /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : site.replace(/\/$/, "") + (pathOrUrl.startsWith("/") ? "" : "/") + pathOrUrl;

export function faqJsonLd(items: { q: string; a: string }[]) {
  if (!items.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

export interface ArticleInput {
  title: string;
  slug: string;
  date: string;
  excerpt: string;
  image?: string;
}

export function articleJsonLd(p: ArticleInput, site: { url: string; name: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: p.title,
    description: p.excerpt,
    datePublished: p.date,
    inLanguage: "en",
    ...(p.image ? { image: absoluteUrl(site.url, p.image) } : {}),
    author: { "@type": "Organization", name: site.name },
    publisher: { "@type": "Organization", name: site.name },
    mainEntityOfPage: absoluteUrl(site.url, `/blog/${p.slug}`),
  };
}
