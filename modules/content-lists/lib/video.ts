// How a video is stored and checked (pure). Link parsing and the embed address live in the core
// (src/kit/lib/video-link.ts), shared with the admin. Only the platform and the video id are stored; the embed
// address is always rebuilt there, never taken from content.
import { INSTAGRAM_ORIGIN, YOUTUBE_ORIGIN, embedUrl as coreEmbedUrl } from "../../../kit/lib/video-link.ts";

export { INSTAGRAM_ORIGIN, YOUTUBE_ORIGIN };

export interface VideoLike {
  type: "file" | "youtube" | "instagram";
  src?: string;
  id?: string;
  poster?: string;
  vertical?: boolean;
  caption?: string;
}

/** The privacy-friendly iframe address (YouTube uses youtube-nocookie). "" when the video isn't an embed. */
export const embedUrl = (v: Pick<VideoLike, "type" | "id">): string => coreEmbedUrl(v) ?? "";

/** An uploaded file must be a site path or an https address (no javascript:, data: or protocol-relative). */
export const isFileUrl = (s: string): boolean => /^\/(?!\/)[\w./~%-]+$/.test(s) || /^https:\/\/[^\s"'<>]+$/.test(s);

/** Why a video can't be shown, or null when it is fine. Used by the schema, so the admin explains it too. */
export function videoProblem(v: VideoLike): string | null {
  if (v.type === "file") {
    if (!v.src || !isFileUrl(v.src)) return "a file video needs a link starting with / or https://";
    if (v.poster && !isFileUrl(v.poster)) return "the poster must start with / or https://";
    return null;
  }
  if (!embedUrl(v)) return `${v.type === "youtube" ? "YouTube" : "Instagram"} videos need a valid id (paste the link and let the editor extract it)`;
  return null;
}
