import { describe, expect, it } from "vitest";
import { embedUrl, parseVideoLink } from "../src/kit/lib/video-link.ts";

const YT = "dQw4w9WgXcQ";

describe("parseVideoLink", () => {
  it("reads every YouTube form", () => {
    for (const u of [`https://www.youtube.com/watch?v=${YT}`, `youtu.be/${YT}`, `https://m.youtube.com/watch?v=${YT}&t=3`, `https://www.youtube.com/embed/${YT}`, `https://www.youtube.com/live/${YT}`, `https://music.youtube.com/watch?v=${YT}`]) {
      expect(parseVideoLink(u), u).toEqual({ type: "youtube", id: YT });
    }
  });
  it("marks Shorts and Instagram reels vertical", () => {
    expect(parseVideoLink(`https://youtube.com/shorts/${YT}`)).toEqual({ type: "youtube", id: YT, vertical: true });
    expect(parseVideoLink("https://www.instagram.com/reel/C1a2B3c4D5e/?igsh=x")).toEqual({ type: "instagram", id: "C1a2B3c4D5e", vertical: true });
    expect(parseVideoLink("https://instagram.com/someone/reel/C1a2B3c4D5e/")).toEqual({ type: "instagram", id: "C1a2B3c4D5e", vertical: true });
  });
  it("rejects other sites, bad ids and junk", () => {
    for (const u of ["", "   ", "https://vimeo.com/123", "https://youtube.com/watch?v=short", "https://instagram.com/someone/", "javascript:alert(1)", "not a url at all", `https://evil.com/watch?v=${YT}`]) {
      expect(parseVideoLink(u), u).toBeNull();
    }
  });
});

describe("embedUrl", () => {
  it("stops a YouTube embed after endSeconds when asked, and never builds from a bad id", () => {
    expect(embedUrl({ type: "youtube", id: YT })).not.toContain("end=");
    expect(embedUrl({ type: "youtube", id: YT }, { endSeconds: 20 })).toContain(`playlist=${YT}&end=20&playsinline=1`);
    expect(embedUrl({ type: "youtube", id: 12345678901 })).toBeNull();
    expect(embedUrl({ type: "file", id: YT })).toBeNull();
    expect(embedUrl({ type: "instagram", id: "C1a2B3c4D5e" })).toBe("https://www.instagram.com/p/C1a2B3c4D5e/embed/");
  });
});
