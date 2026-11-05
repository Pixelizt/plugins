import { describe, expect, it } from "vitest";
import { fitWithin, safeFileName, squareCrop, storagePath } from "../lib/image.ts";

describe("fitWithin", () => {
  it("brings the longest edge down to the limit and keeps the proportions", () => {
    expect(fitWithin(4000, 3000, 1000)).toEqual({ width: 1000, height: 750 });
    expect(fitWithin(3000, 1000, 1000)).toEqual({ width: 1000, height: 333 });
    expect(fitWithin(3000, 4000, 1000)).toEqual({ width: 750, height: 1000 });
  });

  it("never enlarges a picture that is already small enough", () => {
    expect(fitWithin(800, 600, 1000)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1000, 1000, 1000)).toEqual({ width: 1000, height: 1000 });
  });

  it("keeps at least one pixel on each side, however thin the picture", () => {
    expect(fitWithin(10000, 1, 1000)).toEqual({ width: 1000, height: 1 });
  });

  it("refuses sizes that cannot be drawn", () => {
    expect(() => fitWithin(0, 100, 1000)).toThrow(RangeError);
    expect(() => fitWithin(100, Number.NaN, 1000)).toThrow(RangeError);
    expect(() => fitWithin(100, 100, 0)).toThrow(RangeError);
  });
});

describe("squareCrop", () => {
  it("cuts the square from the middle of a landscape picture", () => {
    expect(squareCrop(400, 300, 240)).toEqual({ sx: 50, sy: 0, side: 300, size: 240 });
  });

  it("cuts the square from the middle of a portrait picture", () => {
    expect(squareCrop(300, 500, 240)).toEqual({ sx: 0, sy: 100, side: 300, size: 240 });
  });

  it("does not draw bigger than the picture it cuts from", () => {
    expect(squareCrop(100, 80, 240).size).toBe(80);
  });
});

describe("safeFileName", () => {
  it("adds a timestamp and the extension, so two uploads of the same file do not collide", () => {
    expect(safeFileName("Smoothie Shot.JPG", { now: 1700000000000 })).toBe("smoothie-shot-1700000000000.jpg");
    expect(safeFileName("Smoothie Shot.JPG", { ext: "webp", now: 5 })).toBe("smoothie-shot-5.webp");
    expect(safeFileName("run", { now: 7 })).toBe("run-7");
  });

  it("falls back to file when nothing usable is left of the name", () => {
    expect(safeFileName("جري.mp4", { now: 1 })).toBe("file-1.mp4");
    expect(safeFileName(".hidden", { now: 2, ext: "webp" })).toBe("hidden-2.webp");
  });

  it("gives a name it can use today when no time is passed", () => {
    expect(safeFileName("a.webp")).toMatch(/^a-\d+\.webp$/);
  });
});

describe("storagePath", () => {
  it("joins the bucket, folder and file name", () => {
    expect(storagePath("images", "menu/", "x.webp")).toBe("images/menu/x.webp");
    expect(storagePath("images", "", "x.webp")).toBe("images/x.webp");
    expect(storagePath("videos", "party/2026", "clip-1.mp4")).toBe("videos/party/2026/clip-1.mp4");
  });

  it("refuses anything that could leave the bucket or the folder", () => {
    expect(() => storagePath("images", "../secrets", "x.webp")).toThrow(RangeError);
    expect(() => storagePath("images", "", "../x.webp")).toThrow(RangeError);
    expect(() => storagePath("images", "", "a/b.webp")).toThrow(RangeError);
    expect(() => storagePath("Images/../../", "", "x.webp")).toThrow(RangeError);
    expect(() => storagePath("images", "", ".env")).toThrow(RangeError);
    expect(() => storagePath("images", "", 'x"y.webp')).toThrow(RangeError);
  });
});
