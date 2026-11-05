// Image helpers for uploads: WebP conversion in the browser, and the pure sizing, cropping and naming rules
// around it. Ported from the reference project's src/admin/admin.js (fitCanvas, squareCanvas, putImage).
// The pure functions run in Node and are tested; the browser functions only run when called.

import { slugify } from "../../../kit/lib/text.ts";

export interface Size {
  width: number;
  height: number;
}

/** The size that fits inside a square of maxEdge pixels, keeping the proportions. Never enlarges, never returns 0. */
export function fitWithin(width: number, height: number, maxEdge: number): Size {
  if (!(width > 0 && height > 0)) throw new RangeError(`image size must be positive, got ${width}x${height}`);
  if (!(maxEdge >= 1)) throw new RangeError(`maxEdge must be at least 1, got ${maxEdge}`);
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** The square cut from the middle of an image, for thumbnails: where to read it from, and the size to draw it at. */
export function squareCrop(width: number, height: number, size: number): { sx: number; sy: number; side: number; size: number } {
  if (!(width > 0 && height > 0)) throw new RangeError(`image size must be positive, got ${width}x${height}`);
  const side = Math.min(width, height);
  return {
    sx: Math.round((width - side) / 2),
    sy: Math.round((height - side) / 2),
    side,
    size: Math.min(size, side),
  };
}

/**
 * A storage-safe file name: the slugified stem, a timestamp so two uploads of "photo.jpg" never collide, and an
 * extension. The extension is `opts.ext` when given (pass the one the bytes really are, such as "webp"), otherwise
 * the original one. A name with no letters or digits becomes "file".
 */
export function safeFileName(name: string, opts: { ext?: string; now?: number } = {}): string {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const original = dot > 0 ? name.slice(dot + 1) : "";
  const ext = (opts.ext ?? original).toLowerCase().replace(/[^a-z0-9]/g, "");
  const base = slugify(stem) || "file";
  return `${base}-${opts.now ?? Date.now()}${ext ? "." + ext : ""}`;
}

const BUCKET = /^[a-z0-9][a-z0-9_-]*$/;
const FOLDER = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * The object path inside a Storage bucket, as used in /storage/v1/object/<path> (and /object/public/<path> for
 * the public URL). Throws on anything that is not a plain name, so a path can never leave the bucket.
 * storagePath("images", "menu/", "x.webp") is "images/menu/x.webp".
 */
export function storagePath(bucket: string, folder: string, name: string): string {
  if (!BUCKET.test(bucket)) throw new RangeError(`bad bucket name "${bucket}"`);
  const parts = [bucket];
  for (const seg of String(folder ?? "").split("/").filter(Boolean)) {
    if (!FOLDER.test(seg)) throw new RangeError(`bad folder name "${seg}"`);
    parts.push(seg);
  }
  if (!FILE.test(name)) throw new RangeError(`bad file name "${name}"`);
  parts.push(name);
  return parts.join("/");
}

// ---------- browser only ----------

/**
 * Encodes a canvas as WebP at the given quality. Safari has no WebP encoder and quietly returns a PNG, so the
 * result is then a JPEG instead. Check the returned blob's type, not what was asked for.
 */
export function encodeCanvas(canvas: HTMLCanvasElement, quality = 0.82): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob && blob.type === "image/webp") resolve(blob);
        else
          canvas.toBlob(
            (jpeg) => (jpeg ? resolve(jpeg) : reject(new Error("This browser could not encode the image."))),
            "image/jpeg",
            quality,
          );
      },
      "image/webp",
      quality,
    );
  });
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  close(): void;
}

async function decode(file: Blob): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    // some browsers cannot decode to a bitmap; an <img> can still show the file
    const url = URL.createObjectURL(file);
    const img = new Image();
    try {
      img.src = url;
      await img.decode();
    } catch {
      throw new Error("That file is not an image");
    } finally {
      URL.revokeObjectURL(url);
    }
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined };
  }
}

/**
 * Converts an image to WebP, scaled so its longest edge is at most maxEdge. Uses OffscreenCanvas where it can
 * encode WebP, and a plain canvas otherwise. The result is a JPEG where neither can encode WebP (see encodeCanvas).
 */
export async function toWebp(file: Blob, opts: { maxEdge?: number; quality?: number } = {}): Promise<Blob> {
  const maxEdge = opts.maxEdge ?? 2000;
  const quality = opts.quality ?? 0.82;
  const decoded = await decode(file);
  try {
    const { width, height } = fitWithin(decoded.width, decoded.height, maxEdge);

    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(decoded.source, 0, 0, width, height);
        const blob = await canvas.convertToBlob({ type: "image/webp", quality });
        if (blob.type === "image/webp") return blob;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot draw the image.");
    ctx.drawImage(decoded.source, 0, 0, width, height);
    return await encodeCanvas(canvas, quality);
  } finally {
    decoded.close();
  }
}
