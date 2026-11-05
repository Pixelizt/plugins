import { describe, expect, it } from "vitest";
import {
  CLIP_SECONDS,
  embedUrl,
  isAllowedUpload,
  isOwnStorageUrl,
  isValidVideo,
  isVideoSource,
  pageUrl,
  parseVideoLink,
  uploadExtension,
  videoKey,
} from "../lib/video-link.ts";

const SUPABASE = "https://abcd.supabase.co";
const STORE = SUPABASE + "/storage/v1/object/public/videos/";

function linkOf(text: string) {
  const r = parseVideoLink(text);
  return r.ok ? r.link : null;
}

describe("parseVideoLink", () => {
  it("reads YouTube watch, youtu.be, Shorts, embed and live links to a platform and an id", () => {
    const yt = { type: "youtube", id: "dQw4w9WgXcQ" };
    expect(linkOf("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual(yt);
    expect(linkOf("https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=30")).toEqual(yt);
    expect(linkOf("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual(yt);
    expect(linkOf("https://music.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual(yt);
    expect(linkOf("https://youtu.be/dQw4w9WgXcQ?si=abc")).toEqual(yt);
    expect(linkOf("youtu.be/dQw4w9WgXcQ")).toEqual(yt);
    expect(linkOf("https://www.youtube.com/embed/dQw4w9WgXcQ")).toEqual(yt);
    expect(linkOf("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toEqual(yt);
    expect(linkOf("https://www.youtube.com/live/dQw4w9WgXcQ")).toEqual(yt);
  });

  it("marks a Shorts link as vertical, and leaves other YouTube links without the flag", () => {
    expect(linkOf(" https://www.youtube.com/shorts/aBcDeFgHi_- ")).toEqual({ type: "youtube", id: "aBcDeFgHi_-", vertical: true });
    expect(linkOf("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).not.toHaveProperty("vertical");
  });

  it("reads Instagram reels and posts, including a reel under a profile", () => {
    const ig = { type: "instagram", id: "C8xYz12AbCd", vertical: true };
    expect(linkOf("https://www.instagram.com/reel/C8xYz12AbCd/?igsh=MWQ1")).toEqual(ig);
    expect(linkOf("https://instagram.com/reels/C8xYz12AbCd/")).toEqual(ig);
    expect(linkOf("https://www.instagram.com/p/C8xYz12AbCd/")).toEqual(ig);
    expect(linkOf("https://www.instagram.com/example.cafe/reel/C8xYz12AbCd/")).toEqual(ig);
  });

  it("refuses everything else, with the message to show the editor", () => {
    for (const bad of [
      "",
      null,
      undefined,
      "not a link",
      "https://vimeo.com/123456",
      "https://www.youtube.com/watch?v=short",
      "https://www.youtube.com/channel/UC123",
      "https://www.youtube.com/",
      "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
      "https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ",
      "javascript:alert(1)",
      "ftp://youtu.be/dQw4w9WgXcQ",
      'https://youtu.be/dQw4w9WgXcQ"onload="x',
      "https://www.instagram.com/example.cafe/",
      "https://www.instagram.com/reel/",
      'https://www.instagram.com/reel/a"b/',
      "https://www.tiktok.com/@x/video/123",
    ]) {
      const r = parseVideoLink(bad as string);
      expect(r.ok, String(bad)).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/not a YouTube, YouTube Shorts or Instagram reel link/);
    }
  });
});

describe("embedUrl", () => {
  it("builds the privacy-friendly YouTube address, which stops at the clip length and loops", () => {
    const yt = embedUrl({ type: "youtube", id: "dQw4w9WgXcQ" });
    expect(yt).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/);
    expect(yt).toMatch(new RegExp(`[?&]end=${CLIP_SECONDS}(&|$)`));
    expect(yt).toMatch(/[?&]mute=1/);
    expect(yt).toMatch(/[?&]loop=1&playlist=dQw4w9WgXcQ/);
    expect(CLIP_SECONDS).toBe(20);
  });

  it("builds the Instagram embed address", () => {
    expect(embedUrl({ type: "instagram", id: "C8xYz12AbCd" })).toBe("https://www.instagram.com/p/C8xYz12AbCd/embed/");
  });

  it("builds nothing from a stored id that is not an id, or from a foreign type", () => {
    expect(embedUrl({ type: "youtube", id: '"><script>' })).toBeNull();
    expect(embedUrl({ type: "youtube", id: 12345678901 as unknown as string })).toBeNull();
    expect(embedUrl({ type: "instagram", id: undefined as unknown as string })).toBeNull();
    expect(embedUrl({ type: "file", src: STORE + "run.mp4" })).toBeNull();
  });

  it("gives the page to open for checking, and the file's own URL for an upload", () => {
    expect(pageUrl({ type: "youtube", id: "dQw4w9WgXcQ" })).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(pageUrl({ type: "youtube", id: "aBcDeFgHi_-", vertical: true })).toBe("https://www.youtube.com/shorts/aBcDeFgHi_-");
    expect(pageUrl({ type: "instagram", id: "C8xYz12AbCd" })).toBe("https://www.instagram.com/p/C8xYz12AbCd/");
    expect(pageUrl({ type: "file", src: STORE + "run-1.mp4" })).toBe(STORE + "run-1.mp4");
  });

  it("tells one video from another, so the same one cannot be listed twice", () => {
    expect(videoKey({ type: "youtube", id: "dQw4w9WgXcQ" })).toBe(videoKey({ type: "youtube", id: "dQw4w9WgXcQ", vertical: true }));
    expect(videoKey({ type: "youtube", id: "dQw4w9WgXcQ" })).not.toBe(videoKey({ type: "instagram", id: "dQw4w9WgXcQ" }));
    expect(videoKey({ type: "file", src: STORE + "a.mp4" })).not.toBe(videoKey({ type: "file", src: STORE + "b.mp4" }));
  });
});

describe("uploads from our own bucket", () => {
  it("accepts a clip and a poster in the project's videos bucket, and refuses anything else", () => {
    expect(isValidVideo({ type: "file", src: STORE + "run-1.mp4", poster: STORE + "run-1.webp" }, SUPABASE)).toBe(true);
    expect(isValidVideo({ type: "file", src: "https://elsewhere.example/run.mp4" }, SUPABASE)).toBe(false);
    expect(isValidVideo({ type: "file", src: STORE + "run.mp4", poster: "https://elsewhere.example/p.webp" }, SUPABASE)).toBe(false);
    expect(isValidVideo({ type: "file", src: STORE + 'a"b.mp4' }, SUPABASE)).toBe(false);
    expect(isValidVideo({ type: "file", src: STORE + "../images/x.mp4" }, SUPABASE)).toBe(false);
    expect(isValidVideo({ type: "file", src: STORE + "run.mp4" }, "")).toBe(false);
    expect(isValidVideo({ type: "youtube", id: "bad" }, SUPABASE)).toBe(false);
    expect(isValidVideo({ type: "youtube", id: "dQw4w9WgXcQ" }, SUPABASE)).toBe(true);
    expect(isValidVideo(null, SUPABASE)).toBe(false);
  });

  it("checks a storage URL against the bucket, not just the origin", () => {
    expect(isOwnStorageUrl(SUPABASE + "/storage/v1/object/public/images/x.webp", SUPABASE)).toBe(false);
    expect(isOwnStorageUrl(STORE + "x.mp4", SUPABASE + "/")).toBe(true);
    expect(isOwnStorageUrl(42, SUPABASE)).toBe(false);
  });

  it("accepts MP4, WebP and JPEG uploads and gives each its extension", () => {
    expect(uploadExtension("video/mp4")).toBe("mp4");
    expect(uploadExtension("video/mp4; codecs=avc1")).toBe("mp4");
    expect(uploadExtension("image/webp")).toBe("webp");
    expect(uploadExtension("image/jpeg")).toBe("jpg");
    expect(uploadExtension("video/webm")).toBeNull();
    expect(uploadExtension("image/png")).toBeNull();
    expect(isAllowedUpload("IMAGE/JPEG")).toBe(true);
    expect(isAllowedUpload("application/pdf")).toBe(false);
  });

  it("recognises a video file the admin can cut, by type or by name", () => {
    expect(isVideoSource({ type: "video/quicktime", name: "a.mov" })).toBe(true);
    expect(isVideoSource({ type: "", name: "Party.MP4" })).toBe(true);
    expect(isVideoSource({ type: "", name: "clip.webm" })).toBe(true);
    expect(isVideoSource({ type: "image/jpeg", name: "photo.jpg" })).toBe(false);
  });
});
