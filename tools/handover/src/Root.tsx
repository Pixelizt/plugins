import type { FC } from "react";
import { Composition } from "remotion";
import { defaultProps } from "./types";
import { Walkthrough, walkthroughLength } from "./Walkthrough";

export const RemotionRoot: FC = () => (
  <Composition
    id="Walkthrough"
    component={Walkthrough}
    durationInFrames={walkthroughLength(defaultProps.frames.length)}
    fps={30}
    width={1440}
    height={810}
    defaultProps={defaultProps}
    calculateMetadata={({ props }) => ({ durationInFrames: walkthroughLength(props.frames.length) })}
  />
);
