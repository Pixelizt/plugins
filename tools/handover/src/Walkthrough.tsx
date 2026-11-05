import type { FC } from "react";
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Shot, WalkthroughProps } from "./types";

const TITLE = 75;
const SHOT = 105;
const FADE = 12;

function Title({ clientName, background, foreground, primary }: WalkthroughProps) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12, TITLE - 12, TITLE], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background, color: foreground, opacity, justifyContent: "center", padding: 80 }}>
      <div style={{ fontSize: 22, letterSpacing: 4, textTransform: "uppercase", color: primary }}>Staff walkthrough</div>
      <div style={{ fontSize: 84, lineHeight: 1.05, marginTop: 16, maxWidth: 900 }}>{clientName}</div>
      <div style={{ fontSize: 28, marginTop: 24, maxWidth: 760 }}>How the dashboard and the public pages fit together.</div>
    </AbsoluteFill>
  );
}

function FrameCard({ shot, background, foreground, primary }: { shot: Shot; background: string; foreground: string; primary: string }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(frame, [0, FADE, durationInFrames - FADE, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.045], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#14120f", opacity }}>
      <AbsoluteFill style={{ transform: `scale(${scale})`, padding: "56px 56px 180px" }}>
        <div style={{ height: "100%", overflow: "hidden", borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,.35)" }}>
          <Img src={shot.src.startsWith("http") ? shot.src : staticFile(shot.src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 56, right: 56, bottom: 40, background, color: foreground, borderRadius: 18, padding: "22px 28px" }}>
        <div style={{ color: primary, fontSize: 14, letterSpacing: 3, textTransform: "uppercase" }}>{shot.title}</div>
        <div style={{ fontSize: 30, marginTop: 6, lineHeight: 1.25 }}>{shot.caption}</div>
      </div>
    </AbsoluteFill>
  );
}

export const Walkthrough: FC<WalkthroughProps> = (props) => {
  const frames = props.frames.length ? props.frames : [{ title: "No screenshots yet", caption: "Run scripts/handover-capture.mjs before rendering.", src: "" }];
  return (
    <AbsoluteFill style={{ background: "#14120f", fontFamily: "Georgia, serif" }}>
      <Sequence durationInFrames={TITLE}>
        <Title {...props} />
      </Sequence>
      {frames.map((shot, i) => (
        <Sequence key={shot.title + i} from={TITLE + i * SHOT} durationInFrames={SHOT}>
          {shot.src ? <FrameCard shot={shot} background={props.background} foreground={props.foreground} primary={props.primary} /> : <Title {...props} />}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const walkthroughLength = (count: number) => TITLE + Math.max(count, 1) * SHOT;
