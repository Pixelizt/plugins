// Video links and the embed addresses built from them, plus the rules for which uploaded files are accepted.
// Ported from the reference project's src/admin/video-link.js. Pure: runs in Node and in the browser.
// Only the platform and the video id are stored; the embed address is always rebuilt from them here, so a
// stored value can never carry a foreign address into the page. Parsing and the embed address live in the core
// (src/kit/lib/video-link.ts), shared with the content-lists module; this file adds the admin's own rules.
import { embedUrl as coreEmbedUrl, parseVideoLink as parseLink, type VideoLink } from "../../../kit/lib/video-link.ts";

export type { VideoLink };

/** Uploaded clips are cut to this many seconds, and YouTube embeds stop here. */
export const CLIP_SECONDS = 20;

export interface YouTubeRef {
  type: "youtube";
  id: string;
  /** true for a Shorts link: the page draws it tall. */
  vertical?: boolean;
}
export interface InstagramRef {
  type: "instagram";
  id: string;
  /** Reels and posts are drawn tall. */
  vertical?: boolean;
}
export interface FileRef {
  type: "file";
  /** A URL in the project's public videos bucket (see isOwnStorageUrl). */
  src: string;
  poster?: string;
  vertical?: boolean;
}
export type VideoRef = YouTubeRef | InstagramRef | FileRef;

export type ParsedLink = { ok: true; link: VideoLink } | { ok: false; error: string };

export const NOT_A_LINK = "That is not a YouTube, YouTube Shorts or Instagram reel link. Copy the link from the Share button and paste it here.";

/**
 * Reads a pasted link: YouTube (watch, youtu.be, Shorts, embed, live) or an Instagram reel or post.
 * A link without https:// is accepted. Anything else is refused with the message to show the editor.
 */
export function parseVideoLink(text: string | null | undefined): ParsedLink {
  const link = parseLink(text);
  return link ? { ok: true, link } : { ok: false, error: NOT_A_LINK };
}

/** The privacy-friendly embed address, or null when the stored id is not a valid id. YouTube stops at CLIP_SECONDS and loops. */
export function embedUrl(v: VideoRef): string | null {
  return v.type === "file" ? null : coreEmbedUrl(v, { endSeconds: CLIP_SECONDS });
}

/** The page the editor opens to check the video is the right one. For an uploaded file, its own URL. */
export function pageUrl(v: VideoRef): string {
  if (v.type === "youtube") return (v.vertical ? "https://www.youtube.com/shorts/" : "https://www.youtube.com/watch?v=") + v.id;
  if (v.type === "instagram") return "https://www.instagram.com/p/" + v.id + "/";
  return v.src;
}

/** Identifies a video in a list, so the same one cannot be added twice. */
export function videoKey(v: VideoRef): string {
  return v.type + ":" + (v.type === "file" ? v.src : v.id);
}

/**
 * True when the URL is an object in the project's public videos bucket with plain path characters. That is the
 * only media origin the content security policy allows, so anything else would be blocked on the page anyway.
 */
export function isOwnStorageUrl(url: unknown, supabaseUrl: string, bucket = "videos"): url is string {
  if (typeof url !== "string" || !supabaseUrl) return false;
  const base = supabaseUrl.replace(/\/$/, "") + "/storage/v1/object/public/" + bucket + "/";
  if (url.indexOf(base) !== 0) return false;
  const rest = url.slice(base.length);
  return /^[\w.\/-]+$/.test(rest) && !rest.split("/").some((seg) => seg === "..");
}

/** A stored video that the page can show: a file in our bucket, or a link that builds an embed address. */
export function isValidVideo(v: unknown, supabaseUrl: string): v is VideoRef {
  if (!v || typeof v !== "object") return false;
  const ref = v as Partial<FileRef> & { type?: unknown; id?: unknown };
  if (ref.type === "file") {
    return isOwnStorageUrl(ref.src, supabaseUrl) && (ref.poster === undefined || isOwnStorageUrl(ref.poster, supabaseUrl));
  }
  return embedUrl(ref as VideoRef) !== null;
}

// ---------- uploads ----------

/** The files the admin may upload, with the extension each is stored under. Clips are always MP4. */
export const UPLOAD_EXTENSIONS = {
  "video/mp4": "mp4",
  "image/webp": "webp",
  "image/jpeg": "jpg",
} as const;
export type UploadType = keyof typeof UPLOAD_EXTENSIONS;

/** The MIME type without parameters: "video/mp4; codecs=avc1" is "video/mp4". */
export function baseMime(mime: string): string {
  return String(mime ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

export function isAllowedUpload(mime: string): mime is UploadType {
  return Object.prototype.hasOwnProperty.call(UPLOAD_EXTENSIONS, baseMime(mime));
}

/** The extension an allowed upload is stored under, or null if the type is not allowed. */
export function uploadExtension(mime: string): string | null {
  return isAllowedUpload(mime) ? UPLOAD_EXTENSIONS[baseMime(mime) as UploadType] : null;
}

/** A file the admin may pick to cut into a clip: any video type a browser can read, by MIME or by extension. */
export function isVideoSource(file: { type?: string; name?: string }): boolean {
  return /^video\//.test(file.type ?? "") || /\.(mp4|m4v|mov|webm|3gp)$/i.test(file.name ?? "");
}
