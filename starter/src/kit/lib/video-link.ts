// Video links and the embed addresses built from them (pure). Only the platform and the video id are stored;
// the embed address is always rebuilt here, so a stored value can never carry a foreign address into the page.
// Shared by the admin (paste a link) and the content-lists module (draw the video). Kit code: do not edit in a client project.
export const YT_ID = /^[A-Za-z0-9_-]{11}$/;
export const IG_ID = /^[A-Za-z0-9_-]{5,40}$/;

export const YOUTUBE_ORIGIN = "https://www.youtube-nocookie.com";
export const INSTAGRAM_ORIGIN = "https://www.instagram.com";

export interface VideoLink {
  type: "youtube" | "instagram";
  id: string;
  /** true for a YouTube Short, an Instagram reel or post: the page draws it tall. */
  vertical?: true;
}

const hostOf = (u: URL) => u.hostname.toLowerCase().replace(/^(www|m|music)\./, "");

function youtube(id: string): VideoLink | null {
  return YT_ID.test(id) ? { type: "youtube", id } : null;
}

/**
 * Reads a pasted link: YouTube (watch, youtu.be, Shorts, embed, live) or an Instagram reel or post.
 * A link without https:// is accepted. null when it is neither.
 */
export function parseVideoLink(text: string | null | undefined): VideoLink | null {
  let s = String(text ?? "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = hostOf(u);
  const bits = u.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") return youtube(bits[0] ?? "");
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const first = bits[0];
    let id = "";
    if (first === "watch") id = u.searchParams.get("v") ?? "";
    else if (first === "shorts" || first === "embed" || first === "live") id = bits[1] ?? "";
    if (first === "shorts" && YT_ID.test(id)) return { type: "youtube", id, vertical: true };
    return youtube(id);
  }
  if (host === "instagram.com") {
    // a profile link (instagram.com/name/reel/ID) works too, so the kind is looked for anywhere in the path
    for (let i = 0; i < bits.length - 1; i++) {
      const kind = bits[i];
      if (kind === "reel" || kind === "reels" || kind === "p" || kind === "tv") {
        const id = bits[i + 1] ?? "";
        return IG_ID.test(id) ? { type: "instagram", id, vertical: true } : null;
      }
    }
  }
  return null;
}

/**
 * The privacy-friendly embed address, or null when the stored id is not a valid id (so nothing is built from it).
 * `endSeconds` makes a YouTube embed stop (and loop) after that many seconds; enablejsapi lets the page pause it
 * off screen. Instagram has no start or end setting.
 */
export function embedUrl(v: { type: string; id?: unknown }, opts: { endSeconds?: number } = {}): string | null {
  // the id comes from stored data, so it is checked as a string first (RegExp.test would accept a number)
  const id = typeof v.id === "string" ? v.id : "";
  if (v.type === "youtube" && YT_ID.test(id)) {
    const end = opts.endSeconds ? `&end=${opts.endSeconds}` : "";
    return `${YOUTUBE_ORIGIN}/embed/${id}?mute=1&loop=1&playlist=${id}${end}&playsinline=1&rel=0&enablejsapi=1`;
  }
  if (v.type === "instagram" && IG_ID.test(id)) return `${INSTAGRAM_ORIGIN}/p/${id}/embed/`;
  return null;
}
