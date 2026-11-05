// Small text helpers shared by modules (pure). Kit code: do not edit in a client project.

/** Lower case, accents removed, every run of other characters becomes one dash. Empty when nothing is left (Arabic names). */
export function slugify(text: string): string {
  return String(text ?? "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** One line, whitespace collapsed, cut to `n` characters: safe for logs and short error messages. */
export const oneLine = (s: unknown, n = 200) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

const ENT: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Escape text for HTML (element content and quoted attributes). */
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ENT[c]!);
