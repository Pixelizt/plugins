export {}; // makes this a module, so its names stay local
// Event videos. Uploaded clips play muted and looping only while on screen; embeds load their iframe as they come near.
// Visitors who asked for reduced motion get nothing that starts by itself: the player's controls are there to press play.
const $$ = <T extends Element = HTMLElement>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
const clips = $$<HTMLVideoElement>("video[data-autoplay]");
const frames = $$<HTMLIFrameElement & { ready?: boolean }>("iframe[data-src]");

if (clips.length || frames.length) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const YT = "https://www.youtube-nocookie.com";
  // the player only listens once its page has loaded; a message sent earlier would be refused
  const yt = (f: HTMLIFrameElement & { ready?: boolean }, cmd: string) => {
    if (f.ready) f.contentWindow?.postMessage(JSON.stringify({ event: "command", func: cmd, args: [] }), YT);
  };
  const load = (f: HTMLIFrameElement & { ready?: boolean }) => {
    if (f.src) return;
    let u = f.dataset.src!;
    f.addEventListener("load", () => (f.ready = true));
    if (f.dataset.platform === "youtube" && !reduce) u += "&autoplay=1";
    f.src = u;
  };
  clips.forEach((v) => (v.muted = true));
  if (!("IntersectionObserver" in window)) frames.forEach(load);
  else {
    const near = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          load(e.target as HTMLIFrameElement);
          near.unobserve(e.target);
        }
      }),
      { rootMargin: "300px 0px" },
    );
    frames.forEach((f) => near.observe(f));
    if (!reduce) {
      const seen = new IntersectionObserver(
        (entries) => entries.forEach((e) => {
          const el = e.target as HTMLElement;
          if (el instanceof HTMLVideoElement) {
            if (e.isIntersecting) void el.play().catch(() => {});
            else el.pause();
          } else if ((el as HTMLIFrameElement).src && el.dataset.platform === "youtube") yt(el as HTMLIFrameElement, e.isIntersecting ? "playVideo" : "pauseVideo");
        }),
        { threshold: 0.25 },
      );
      [...clips, ...frames].forEach((el) => seen.observe(el));
    }
  }
}
