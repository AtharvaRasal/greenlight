"use client";

import { Player } from "@remotion/player";
import { PitchReel, FPS, REEL_HEIGHT, REEL_WIDTH, reelDurationInFrames, type PitchReelProps } from "@/remotion/PitchReel";

export function ReelPlayer(props: PitchReelProps & { autoPlay?: boolean }) {
  const { autoPlay, ...inputProps } = props;
  return (
    <div className="rounded-2xl overflow-hidden border border-line bg-black shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
      <Player
        component={PitchReel}
        inputProps={inputProps}
        durationInFrames={reelDurationInFrames()}
        compositionWidth={REEL_WIDTH}
        compositionHeight={REEL_HEIGHT}
        fps={FPS}
        style={{ width: "100%", aspectRatio: "16 / 9" }}
        controls
        loop
        autoPlay={autoPlay}
        initiallyMuted
        acknowledgeRemotionLicense
      />
    </div>
  );
}
