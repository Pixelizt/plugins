import { describe, expect, it } from "vitest";
import { AUDIO_BITS_PER_SECOND, MAX_EDGE, MP4_MIME_CANDIDATES, bitrateFor, pickMimeType, scaleTo } from "../lib/video.ts";

describe("pickMimeType", () => {
  it("picks the most specific MP4 type the browser can record, whatever order it lists them in", () => {
    expect(pickMimeType(["video/mp4", "video/mp4;codecs=avc1.42E01E,mp4a.40.2"])).toBe("video/mp4;codecs=avc1.42E01E,mp4a.40.2");
    expect(pickMimeType(["video/mp4;codecs=avc1"])).toBe("video/mp4;codecs=avc1");
    expect(pickMimeType(["video/mp4"])).toBe("video/mp4");
  });

  it("refuses a WebM-only browser, because older iPhones cannot play WebM", () => {
    expect(pickMimeType(["video/webm;codecs=vp9", "video/webm"])).toBeNull();
    expect(pickMimeType([])).toBeNull();
  });

  it("only ever returns one of its own MP4 candidates", () => {
    expect(MP4_MIME_CANDIDATES.every((m) => m.startsWith("video/mp4"))).toBe(true);
    expect(pickMimeType(["video/mp4; codecs=avc1"])).toBeNull();
  });
});

describe("scaleTo", () => {
  it("brings the longest edge down to the limit and keeps the proportions", () => {
    expect(scaleTo(3840, 2160, MAX_EDGE)).toEqual({ width: 1280, height: 720 });
    expect(scaleTo(1080, 1920, MAX_EDGE)).toEqual({ width: 720, height: 1280 });
  });

  it("never enlarges, and keeps both sides even", () => {
    expect(scaleTo(640, 480, MAX_EDGE)).toEqual({ width: 640, height: 480 });
    expect(scaleTo(1001, 563, 1000)).toEqual({ width: 1000, height: 562 });
    expect(scaleTo(1281, 720, 1281)).toEqual({ width: 1280, height: 720 });
  });

  it("never goes past the limit, even after rounding to even", () => {
    for (const [w, h, max] of [[1921, 1081, 1281], [3001, 2999, 1001], [999, 777, 333]] as const) {
      const s = scaleTo(w, h, max);
      expect(Math.max(s.width, s.height)).toBeLessThanOrEqual(max);
      expect(s.width % 2).toBe(0);
      expect(s.height % 2).toBe(0);
    }
  });

  it("refuses sizes that cannot be recorded", () => {
    expect(() => scaleTo(0, 720, MAX_EDGE)).toThrow(RangeError);
    expect(() => scaleTo(1280, 720, 1)).toThrow(RangeError);
  });
});

describe("bitrateFor", () => {
  it("gives 720p at 30 frames a second the full 2.5 Mbit/s, and a vertical 720p clip the same", () => {
    expect(bitrateFor(1280, 720)).toBe(2_500_000);
    expect(bitrateFor(720, 1280)).toBe(2_500_000);
  });

  it("never asks for more than 2.5 Mbit/s, however big the picture", () => {
    expect(bitrateFor(1920, 1080)).toBe(2_500_000);
  });

  it("gives a small clip less, but not less than 800 kbit/s", () => {
    expect(bitrateFor(640, 360)).toBe(800_000);
    expect(bitrateFor(320, 240, 15)).toBe(800_000);
    const mid = bitrateFor(960, 540);
    expect(mid).toBeGreaterThan(800_000);
    expect(mid).toBeLessThan(2_500_000);
  });

  it("keeps the audio at 128 kbit/s", () => {
    expect(AUDIO_BITS_PER_SECOND).toBe(128_000);
  });
});
