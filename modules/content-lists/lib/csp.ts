// The site's CSP only allows hosts listed in client.yaml → csp (rule 14). A video or photo from an unlisted host
// is silently blocked in the browser, so the build checks every external address and fails with the fix. Pure.
import { INSTAGRAM_ORIGIN, YOUTUBE_ORIGIN, embedUrl, type VideoLike } from "./video.ts";

export type CspKind = "img" | "media" | "frame";
export interface CspRef { kind: CspKind; url: string }
export interface CspLists { img_src: string[]; media_src: string[]; frame_src: string[] }

const parse = (s: string): URL | null => {
  try {
    return new URL(s);
  } catch {
    return null;
  }
};

/** Does one CSP source entry ("https://x.com", "https://*.x.com", "x.com", "https:") allow this URL? */
export function entryAllows(entry: string, url: URL): boolean {
  const e = entry.trim();
  if (!e || e.startsWith("'")) return false;
  if (/^[a-z][a-z0-9+.-]*:$/i.test(e)) return url.protocol === e.toLowerCase();
  const m = /^(?:([a-z][a-z0-9+.-]*):\/\/)?([^/:]+)(?::(\d+|\*))?(?:\/.*)?$/i.exec(e);
  if (!m) return false;
  if (m[1] && url.protocol !== `${m[1].toLowerCase()}:`) return false;
  const host = m[2]!.toLowerCase();
  if (host.startsWith("*.")) return url.hostname.endsWith(host.slice(1));
  return url.hostname === host;
}

const KEY = { img: "img_src", media: "media_src", frame: "frame_src" } as const;

/** Messages for every external address the CSP doesn't allow. `implicit` = origins always allowed for img/media (e.g. Supabase). */
export function cspProblems(refs: CspRef[], csp: CspLists, implicit: string[] = []): string[] {
  const out = new Set<string>();
  for (const r of refs) {
    const u = parse(r.url);
    if (!u || (u.protocol !== "https:" && u.protocol !== "http:")) continue; // site paths and data: URIs need nothing
    const entries = [...csp[KEY[r.kind]], ...(r.kind === "frame" ? [] : implicit)];
    if (!entries.some((en) => entryAllows(en, u))) out.add(`client.yaml → csp.${KEY[r.kind]} must include ${u.origin} (used by ${r.url})`);
  }
  return [...out];
}

/** The CSP references a list of videos creates. */
export function videoRefs(videos: VideoLike[]): CspRef[] {
  return videos.flatMap((v): CspRef[] => {
    if (v.type === "file") return [{ kind: "media", url: v.src ?? "" }, ...(v.poster ? [{ kind: "img" as const, url: v.poster }] : [])];
    if (!embedUrl(v)) return [];
    return [{ kind: "frame", url: v.type === "youtube" ? YOUTUBE_ORIGIN : INSTAGRAM_ORIGIN }];
  });
}
