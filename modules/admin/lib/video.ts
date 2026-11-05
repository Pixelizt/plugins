// Cutting an uploaded video down to its first seconds in the browser: the clip is played, drawn onto a canvas,
// recorded with MediaRecorder as MP4, and a poster frame is taken on the way. Only the recording is uploaded,
// never the original file. Ported from the reference project's src/admin/admin.js (recMime, trimVideo).
// The pure helpers run in Node and are tested; trimVideo only runs when called in a browser.

import { CLIP_SECONDS } from "./video-link.ts";
import { encodeCanvas } from "./image.ts";

/** MP4 only: it plays everywhere, iPhones included. The most specific codec string is preferred. */
export const MP4_MIME_CANDIDATES = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1", "video/mp4"] as const;

/** The longest edge of a recorded clip. A phone's 4K video is drawn down to this. */
export const MAX_EDGE = 1280;
export const FRAME_RATE = 30;
export const AUDIO_BITS_PER_SECOND = 128_000;
const VIDEO_BITS_PER_SECOND = 2_500_000;
const MIN_VIDEO_BITS_PER_SECOND = 800_000;

/** The first MP4 type from our list that the browser can record. Null when there is none (a WebM-only browser). */
export function pickMimeType(supported: readonly string[]): string | null {
  for (const candidate of MP4_MIME_CANDIDATES) if (supported.includes(candidate)) return candidate;
  return null;
}

/**
 * The size a clip is recorded at: the longest edge brought down to maxEdge, both sides even (the MP4 encoder needs
 * even sizes), and never larger than maxEdge. Rounded down to even, so the limit is never passed.
 */
export function scaleTo(width: number, height: number, maxEdge: number = MAX_EDGE): { width: number; height: number } {
  if (!(width > 0 && height > 0)) throw new RangeError(`video size must be positive, got ${width}x${height}`);
  if (!(maxEdge >= 2)) throw new RangeError(`maxEdge must be at least 2, got ${maxEdge}`);
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  // round to whole pixels first, so float error (1279.9999...) cannot knock an even size down by two
  const even = (n: number) => {
    const px = Math.round(n * scale);
    return Math.max(2, px - (px % 2));
  };
  return { width: even(width), height: even(height) };
}

/**
 * The video bitrate for a clip of this size, in bits per second. 720p at 30 frames a second gets the full
 * 2.5 Mbit/s, and a smaller clip gets proportionally less, down to 800 kbit/s. Larger clips do not go above 2.5 Mbit/s.
 */
export function bitrateFor(width: number, height: number, fps: number = FRAME_RATE): number {
  const reference = 1280 * 720 * FRAME_RATE;
  const scaled = Math.round(VIDEO_BITS_PER_SECOND * ((width * height * fps) / reference));
  return Math.min(VIDEO_BITS_PER_SECOND, Math.max(MIN_VIDEO_BITS_PER_SECOND, scaled));
}

// ---------- browser only ----------

export interface TrimmedClip {
  /** The recording, typed video/mp4. */
  video: Blob;
  /** A still from early in the clip, or null if none could be taken. */
  poster: Blob | null;
  /** True when the picture is taller than it is wide. */
  vertical: boolean;
}

export interface TrimOptions {
  seconds?: number;
  /** Called with 0 to 1 while the clip is being recorded. */
  onProgress?: (fraction: number) => void;
}

const NO_MP4 =
  "This browser cannot cut a video to 20 seconds as MP4, the format every phone plays. Use Chrome, Edge or Safari, or paste a reel link instead.";

/** The recordable MP4 types in this browser, from our list. */
export function supportedMp4Types(): string[] {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return [];
  return MP4_MIME_CANDIDATES.filter((m) => MediaRecorder.isTypeSupported(m));
}

/**
 * Plays the file, records its first `seconds` (picture and sound) and resolves with the recording. The sound goes
 * through Web Audio, so the editor does not hear the clip twice. If the browser will not give the sound, the clip
 * is recorded without it. The tab must stay open until it resolves.
 */
export function trimVideo(file: Blob, options: TrimOptions = {}): Promise<TrimmedClip> {
  const seconds = options.seconds ?? CLIP_SECONDS;
  const progress = options.onProgress ?? (() => undefined);
  const mimeType = pickMimeType(supportedMp4Types());
  if (!mimeType) return Promise.reject(new Error(NO_MP4));

  return new Promise<TrimmedClip>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    const AudioCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    let ac: AudioContext | null = null;
    try {
      // made now, inside the click that started this, so the browser lets it run
      if (AudioCtor) ac = new AudioCtor();
    } catch {
      ac = null;
    }
    let done = false;
    let rec: MediaRecorder | null = null;
    let posterAt: Promise<Blob | null> | null = null;

    v.setAttribute("playsinline", "");
    v.playsInline = true;
    v.preload = "auto";
    v.style.cssText = "position:fixed;inset-block-start:0;inset-inline-start:0;width:2px;height:2px;opacity:0;pointer-events:none";

    const cleanup = () => {
      v.pause();
      v.removeAttribute("src");
      v.load();
      v.remove();
      URL.revokeObjectURL(url);
      if (ac && ac.state !== "closed") ac.close().catch(() => undefined);
    };
    const fail = (message: string) => {
      if (done) return;
      done = true;
      if (rec && rec.state !== "inactive") rec.stop();
      cleanup();
      reject(new Error(message));
    };

    v.onerror = () => fail("This browser cannot open that video file. Try Chrome or Safari, or paste a reel link instead.");
    v.onloadedmetadata = () => {
      const w = v.videoWidth;
      const h = v.videoHeight;
      if (!w || !h) return fail("That file has no picture this browser can read.");
      const limit = Math.min(seconds, Number.isFinite(v.duration) && v.duration > 0 ? v.duration : seconds);
      const size = scaleTo(w, h, MAX_EDGE);
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return fail("This browser cannot draw the video.");
      const stream = canvas.captureStream(FRAME_RATE);

      let sound = false;
      if (ac) {
        try {
          const dest = ac.createMediaStreamDestination();
          ac.createMediaElementSource(v).connect(dest);
          dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
          if (ac.state === "suspended") ac.resume().catch(() => undefined);
          sound = true;
        } catch {
          sound = false;
        }
      }
      v.muted = !sound;

      const chunks: Blob[] = [];
      try {
        rec = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: bitrateFor(size.width, size.height),
          audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
        });
      } catch {
        return fail("This browser could not start recording the video. Try Chrome or Safari, or paste a reel link instead.");
      }
      const recorder = rec;
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      recorder.onerror = () => fail("Recording the video failed. Try again, or paste a reel link instead.");
      recorder.onstop = () => {
        if (done) return;
        done = true;
        const poster = posterAt ?? encodeCanvas(canvas).catch(() => null);
        poster.then((still) => {
          cleanup();
          const blob = new Blob(chunks, { type: "video/mp4" });
          if (!blob.size) {
            reject(new Error("The recording came out empty. Try again, or paste a reel link instead."));
            return;
          }
          resolve({ video: blob, poster: still, vertical: h > w });
        });
      };

      const stop = () => {
        if (recorder.state !== "inactive") recorder.stop();
        v.pause();
      };
      const draw = () => {
        if (done || recorder.state === "inactive") return;
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        if (!posterAt && v.currentTime > 0.5) posterAt = snapshot(canvas);
        progress(Math.min(v.currentTime / limit, 1));
        if (v.currentTime >= limit || v.ended) {
          stop();
          return;
        }
        requestAnimationFrame(draw);
      };
      const go = () => {
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        recorder.start(1000);
        draw();
      };
      v.onended = stop;

      const played = v.play();
      if (played) {
        played.then(go, () => {
          // the browser would not play it with sound, so it is recorded without
          v.muted = true;
          v.play().then(go, () => fail("The video would not play in this browser. Try Chrome or Safari, or paste a reel link instead."));
        });
      } else go();
    };

    document.body.appendChild(v);
    v.src = url;
  });
}

/** A copy of the canvas, encoded now, since the canvas keeps changing while the recording runs. */
async function snapshot(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const still = document.createElement("canvas");
  still.width = canvas.width;
  still.height = canvas.height;
  still.getContext("2d")?.drawImage(canvas, 0, 0);
  return encodeCanvas(still).catch(() => null);
}
