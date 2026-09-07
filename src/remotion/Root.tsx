import React from "react";
import { Composition } from "remotion";
import { PitchReel, FPS, REEL_HEIGHT, REEL_WIDTH, reelDurationInFrames } from "./PitchReel";
import { sampleAnalysis, sampleLogline } from "./sample";

// Remotion root — used by `npx remotion studio` and by server-side rendering.
export const RemotionRoot: React.FC = () => (
  <Composition
    id="PitchReel"
    component={PitchReel}
    durationInFrames={reelDurationInFrames()}
    fps={FPS}
    width={REEL_WIDTH}
    height={REEL_HEIGHT}
    defaultProps={{ logline: sampleLogline, analysis: sampleAnalysis }}
  />
);
