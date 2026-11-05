import { describe, expect, it } from "vitest";
import { embedUrl, isFileUrl, videoProblem } from "../lib/video.ts";
import { cspProblems, entryAllows, videoRefs } from "../lib/csp.ts";

const YT = "dQw4w9WgXcQ";

describe("embedUrl", () => {
  it("uses the no-cookie YouTube host", () => {
    const u = embedUrl({ type: "youtube", id: YT });
    expect(u.startsWith(`https://www.youtube-nocookie.com/embed/${YT}?`)).toBe(true);
    expect(u).toContain("mute=1");
    expect(u).not.toContain("autoplay"); // the page adds it, and only when motion is allowed
  });
  it("builds the Instagram embed and refuses bad ids", () => {
    expect(embedUrl({ type: "instagram", id: "C1a2B3c4D5e" })).toBe("https://www.instagram.com/p/C1a2B3c4D5e/embed/");
    expect(embedUrl({ type: "youtube", id: "x\"><script>" })).toBe("");
    expect(embedUrl({ type: "file", id: YT })).toBe("");
  });
});

describe("videoProblem", () => {
  it("accepts site paths and https files, rejects the rest", () => {
    expect(videoProblem({ type: "file", src: "/videos/a.mp4" })).toBeNull();
    expect(videoProblem({ type: "file", src: "https://cdn.example.com/a.mp4", poster: "/p.jpg" })).toBeNull();
    for (const src of ["", "javascript:alert(1)", "//evil.com/a.mp4", "http://example.com/a.mp4", "data:video/mp4;base64,AAAA", "/a b.mp4"]) {
      expect(videoProblem({ type: "file", src }), src).not.toBeNull();
    }
    expect(videoProblem({ type: "file", src: "/a.mp4", poster: "javascript:x" })).not.toBeNull();
  });
  it("needs a valid id for embeds", () => {
    expect(videoProblem({ type: "youtube", id: YT })).toBeNull();
    expect(videoProblem({ type: "youtube", id: "" })).toMatch(/YouTube/);
    expect(videoProblem({ type: "instagram", id: "!" })).toMatch(/Instagram/);
  });
  it("isFileUrl", () => {
    expect(isFileUrl("/a/b.mp4")).toBe(true);
    expect(isFileUrl("//x.com/a")).toBe(false);
  });
});

describe("CSP checks", () => {
  const none = { img_src: [], media_src: [], frame_src: [] };
  it("matches exact hosts, wildcards and scheme-only entries", () => {
    const u = new URL("https://www.youtube-nocookie.com/embed/x");
    expect(entryAllows("https://www.youtube-nocookie.com", u)).toBe(true);
    expect(entryAllows("www.youtube-nocookie.com", u)).toBe(true);
    expect(entryAllows("https://*.youtube-nocookie.com", u)).toBe(true);
    expect(entryAllows("https://youtube-nocookie.com", u)).toBe(false);
    expect(entryAllows("https:", u)).toBe(true);
    expect(entryAllows("http://www.youtube-nocookie.com", u)).toBe(false);
    expect(entryAllows("'self'", u)).toBe(false);
  });
  it("asks for the frame host a YouTube or Instagram video needs", () => {
    const refs = videoRefs([{ type: "youtube", id: YT }, { type: "instagram", id: "C1a2B3c4D5e" }]);
    const p = cspProblems(refs, none);
    expect(p).toHaveLength(2);
    expect(p[0]).toContain("csp.frame_src must include https://www.youtube-nocookie.com");
    expect(cspProblems(refs, { ...none, frame_src: ["https://www.youtube-nocookie.com", "https://www.instagram.com"] })).toEqual([]);
  });
  it("ignores site paths and data: images, and allows Supabase implicitly for media and images", () => {
    expect(cspProblems([{ kind: "img", url: "/a.jpg" }, { kind: "img", url: "data:image/svg+xml,x" }], none)).toEqual([]);
    const refs = videoRefs([{ type: "file", src: "https://abc.supabase.co/storage/v1/object/public/videos/a.mp4", poster: "https://abc.supabase.co/p.jpg" }]);
    expect(cspProblems(refs, none)).toHaveLength(2);
    expect(cspProblems(refs, none, ["https://abc.supabase.co"])).toEqual([]);
  });
});
