// A tiny, safe markdown subset for blog posts (pure). Everything is HTML-escaped FIRST, then a few patterns are
// turned into tags, so content can never inject markup (rule 13). No raw HTML, no images, no scripts.
//   # / ## heading → h2, ### → h3, blank line = new paragraph, "- " or "* " bullets, "1. " numbers, "> " quote,
//   **bold**, *italic*, `code`, [text](https://…) (only https, http, mailto, /path and #anchor links survive)

import { esc } from "../../../kit/lib/text.ts";

const safeHref = (u: string) => /^(https?:\/\/|mailto:|#|\/(?!\/))/i.test(u);

/** Inline formatting on already-escaped text. */
function inline(escaped: string): string {
  return escaped
    .replace(/\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g, (_m, text: string, href: string) =>
      safeHref(href) ? `<a href="${href}" rel="noopener">${text}</a>` : text,
    )
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

export function renderMarkdown(src: string): string {
  const out: string[] = [];
  let para: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(esc(para.join(" ")))}</p>`);
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(esc(i))}</li>`).join("")}</${list.tag}>`);
    if (quote.length) out.push(`<blockquote><p>${inline(esc(quote.join(" ")))}</p></blockquote>`);
    para = [];
    list = null;
    quote = [];
  };
  for (const raw of src.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    let m: RegExpExecArray | null;
    if (!line) flush();
    else if ((m = /^(#{1,3})\s+(.+)$/.exec(line))) {
      flush();
      out.push(`<h${m[1]!.length === 3 ? 3 : 2}>${inline(esc(m[2]!))}</h${m[1]!.length === 3 ? 3 : 2}>`);
    } else if ((m = /^[-*]\s+(.+)$/.exec(line))) {
      if (!list || list.tag !== "ul") { flush(); list = { tag: "ul", items: [] }; }
      list.items.push(m[1]!);
    } else if ((m = /^\d+\.\s+(.+)$/.exec(line))) {
      if (!list || list.tag !== "ol") { flush(); list = { tag: "ol", items: [] }; }
      list.items.push(m[1]!);
    } else if ((m = /^>\s?(.*)$/.exec(line))) {
      if (!quote.length) flush();
      quote.push(m[1]!);
    } else {
      if (list || quote.length) flush();
      para.push(line);
    }
  }
  flush();
  return out.join("\n");
}
