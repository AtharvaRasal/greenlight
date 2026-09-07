import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Analysis, Comp } from "@/lib/types";

export const FPS = 30;
const SCENE = 4 * FPS; // 4s per scene
export const REEL_WIDTH = 1920;
export const REEL_HEIGHT = 1080;

export type PitchReelProps = {
  logline: string;
  analysis: Analysis;
  posterDataUrl?: string;
};

export const reelDurationInFrames = () => SCENE * 7 + FPS; // 7 scenes + 1s tail

const font = `"Geist", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

const palette = {
  bg: "#07070b",
  panel: "#12121a",
  ink: "#f4f1ea",
  muted: "#9a978f",
  gold: "#e8b04b",
  green: "#3ddc84",
  amber: "#f5b942",
  red: "#ff5c5c",
};

/* ---------- primitives ---------- */

const Grain: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse at 30% 20%, rgba(232,176,75,0.10), transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(61,220,132,0.06), transparent 50%)",
      pointerEvents: "none",
    }}
  />
);

const FadeIn: React.FC<{ delay?: number; children: React.ReactNode; y?: number }> = ({
  delay = 0,
  children,
  y = 40,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 200, stiffness: 120 } });
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * y}px)` }}>{children}</div>
  );
};

const SceneShell: React.FC<{ kicker: string; children: React.ReactNode }> = ({ kicker, children }) => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [SCENE - 12, SCENE], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ background: palette.bg, fontFamily: font, color: palette.ink, opacity: out }}>
      <Grain />
      <div style={{ position: "absolute", left: 120, top: 90, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 14, height: 14, borderRadius: 999, background: palette.gold }} />
        <div style={{ letterSpacing: 6, fontSize: 24, color: palette.muted, textTransform: "uppercase" }}>{kicker}</div>
      </div>
      <div style={{ position: "absolute", right: 120, top: 84, fontSize: 24, color: palette.muted, letterSpacing: 2 }}>
        GREENLIGHT · PITCH REEL
      </div>
      <div style={{ position: "absolute", inset: "180px 120px 120px 120px" }}>{children}</div>
    </AbsoluteFill>
  );
};

const fmtM = (n: number | null) => (n == null ? "—" : n >= 1000 ? `$${(n / 1000).toFixed(1)}B` : `$${Math.round(n)}M`);

/* ---------- scenes ---------- */

const TitleScene: React.FC<PitchReelProps> = ({ analysis, posterDataUrl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoom = interpolate(frame, [0, SCENE], [1.05, 1.15]);
  const p = spring({ frame, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: palette.bg, fontFamily: font, color: palette.ink }}>
      {posterDataUrl ? (
        <AbsoluteFill style={{ transform: `scale(${zoom})`, opacity: 0.55 }}>
          <Img src={posterDataUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      ) : (
        <Grain />
      )}
      <AbsoluteFill
        style={{ background: "linear-gradient(180deg, rgba(7,7,11,0.1) 0%, rgba(7,7,11,0.85) 70%, #07070b 100%)" }}
      />
      <div style={{ position: "absolute", left: 120, bottom: 140, right: 120 }}>
        <div style={{ letterSpacing: 8, fontSize: 26, color: palette.gold, textTransform: "uppercase", opacity: p }}>
          {analysis.genre}
        </div>
        <div
          style={{
            fontSize: 132,
            fontWeight: 800,
            lineHeight: 1.0,
            marginTop: 18,
            letterSpacing: -3,
            opacity: p,
            transform: `translateY(${(1 - p) * 60}px)`,
          }}
        >
          {analysis.title}
        </div>
        <FadeIn delay={14}>
          <div style={{ fontSize: 40, color: palette.muted, marginTop: 22, fontStyle: "italic" }}>{analysis.tagline}</div>
        </FadeIn>
      </div>
    </AbsoluteFill>
  );
};

const LoglineScene: React.FC<PitchReelProps> = ({ logline }) => (
  <SceneShell kicker="The pitch">
    <FadeIn>
      <div style={{ fontSize: 64, lineHeight: 1.25, fontWeight: 500, maxWidth: 1500, marginTop: 120 }}>
        <span style={{ color: palette.gold, fontSize: 120, lineHeight: 0, verticalAlign: "-40px", marginRight: 12 }}>“</span>
        {logline}
      </div>
    </FadeIn>
  </SceneShell>
);

const Bar: React.FC<{ comp: Comp; max: number; i: number }> = ({ comp, max, i }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 8 - i * 5, fps, config: { damping: 200, stiffness: 90 } });
  const gross = comp.worldwideGrossUsdM ?? 0;
  const budget = comp.budgetUsdM ?? 0;
  const w = (n: number) => Math.max(6, (n / max) * 1100 * p);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", alignItems: "center", gap: 30, height: 96 }}>
      <div>
        <div style={{ fontSize: 34, fontWeight: 600 }}>
          {comp.title} <span style={{ color: palette.muted, fontWeight: 400 }}>({comp.year})</span>
        </div>
        <div style={{ fontSize: 22, color: palette.muted, marginTop: 4 }}>{comp.platform}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: w(gross), height: 28, background: palette.gold, borderRadius: 6 }} />
          <div style={{ fontSize: 26, opacity: p }}>{fmtM(comp.worldwideGrossUsdM)} gross</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: w(budget), height: 16, background: "#3b3b4a", borderRadius: 6 }} />
          <div style={{ fontSize: 22, color: palette.muted, opacity: p }}>{fmtM(comp.budgetUsdM)} budget</div>
        </div>
      </div>
    </div>
  );
};

const CompsScene: React.FC<PitchReelProps> = ({ analysis }) => {
  const comps = analysis.comps.slice(0, 5);
  const max = Math.max(1, ...comps.map((c) => Math.max(c.worldwideGrossUsdM ?? 0, c.budgetUsdM ?? 0)));
  return (
    <SceneShell kicker="Comparable titles">
      <FadeIn>
        <div style={{ fontSize: 56, fontWeight: 700, marginBottom: 40 }}>The comps say…</div>
      </FadeIn>
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        {comps.map((c, i) => (
          <Bar key={c.title} comp={c} max={max} i={i} />
        ))}
      </div>
    </SceneShell>
  );
};

const MarketScene: React.FC<PitchReelProps> = ({ analysis }) => (
  <SceneShell kicker="Market & audience">
    <FadeIn>
      <div style={{ fontSize: 56, fontWeight: 700, maxWidth: 1500 }}>{analysis.market.trend}</div>
    </FadeIn>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 30, marginTop: 70 }}>
      {analysis.market.keyStats.slice(0, 3).map((s, i) => (
        <FadeIn key={s.label} delay={10 + i * 6}>
          <div style={{ background: palette.panel, borderRadius: 24, padding: "40px 44px", border: "1px solid #232331" }}>
            <div style={{ fontSize: 60, fontWeight: 800, color: palette.gold, letterSpacing: -1 }}>{s.value}</div>
            <div style={{ fontSize: 26, color: palette.muted, marginTop: 10 }}>{s.label}</div>
          </div>
        </FadeIn>
      ))}
    </div>
    <FadeIn delay={30}>
      <div style={{ fontSize: 32, color: palette.muted, marginTop: 60, maxWidth: 1500 }}>
        <span style={{ color: palette.ink }}>Audience: </span>
        {analysis.market.audience}
      </div>
    </FadeIn>
  </SceneShell>
);

const sevColor = (s: Risk["severity"]) => (s === "high" ? palette.red : s === "medium" ? palette.amber : palette.green);
type Risk = Analysis["risks"][number];

const RiskScene: React.FC<PitchReelProps> = ({ analysis }) => (
  <SceneShell kicker="Risk register">
    <FadeIn>
      <div style={{ fontSize: 56, fontWeight: 700, marginBottom: 44 }}>What could go wrong</div>
    </FadeIn>
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {analysis.risks.slice(0, 3).map((r, i) => (
        <FadeIn key={r.risk} delay={8 + i * 7}>
          <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 30, alignItems: "start" }}>
            <div
              style={{
                fontSize: 22,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: sevColor(r.severity),
                border: `2px solid ${sevColor(r.severity)}`,
                borderRadius: 999,
                padding: "8px 0",
                textAlign: "center",
                marginTop: 6,
              }}
            >
              {r.severity}
            </div>
            <div>
              <div style={{ fontSize: 36, fontWeight: 600 }}>{r.risk}</div>
              <div style={{ fontSize: 26, color: palette.muted, marginTop: 6 }}>Mitigation: {r.mitigation}</div>
            </div>
          </div>
        </FadeIn>
      ))}
    </div>
  </SceneShell>
);

const BudgetScene: React.FC<PitchReelProps> = ({ analysis }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const b = analysis.budget;
  const p = spring({ frame: frame - 10, fps, config: { damping: 200, stiffness: 80 } });
  const span = Math.max(1, b.highUsdM - b.lowUsdM);
  const recPct = ((b.recommendedUsdM - b.lowUsdM) / span) * 100;
  return (
    <SceneShell kicker="Budget band">
      <FadeIn>
        <div style={{ fontSize: 56, fontWeight: 700 }}>Recommended budget</div>
      </FadeIn>
      <div style={{ fontSize: 200, fontWeight: 800, color: palette.gold, letterSpacing: -6, marginTop: 20, opacity: p }}>
        {fmtM(Math.round(b.lowUsdM + (b.recommendedUsdM - b.lowUsdM) * p))}
      </div>
      <div style={{ position: "relative", height: 20, background: "#23232f", borderRadius: 999, marginTop: 30, width: 1400 }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${Math.min(100, Math.max(4, recPct * p))}%`,
            background: `linear-gradient(90deg, #6b5a2c, ${palette.gold})`,
            borderRadius: 999,
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", width: 1400, marginTop: 16, fontSize: 28, color: palette.muted }}>
        <span>Floor {fmtM(b.lowUsdM)}</span>
        <span>Ceiling {fmtM(b.highUsdM)}</span>
      </div>
      <FadeIn delay={28}>
        <div style={{ fontSize: 30, color: palette.muted, marginTop: 40, maxWidth: 1500 }}>{b.rationale}</div>
      </FadeIn>
    </SceneShell>
  );
};

const VerdictScene: React.FC<PitchReelProps> = ({ analysis }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const v = analysis.verdict;
  const color = v.decision === "GREENLIGHT" ? palette.green : v.decision === "DEVELOP" ? palette.amber : palette.red;
  const stamp = spring({ frame: frame - 12, fps, config: { damping: 12, stiffness: 200, mass: 0.8 } });
  const conf = Math.round(v.confidence * Math.min(1, frame / (SCENE * 0.6)));
  return (
    <AbsoluteFill style={{ background: palette.bg, fontFamily: font, color: palette.ink }}>
      <Grain />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ letterSpacing: 8, fontSize: 28, color: palette.muted, textTransform: "uppercase" }}>Studio verdict</div>
        <div
          style={{
            marginTop: 30,
            fontSize: 190,
            fontWeight: 900,
            letterSpacing: 4,
            color,
            border: `10px solid ${color}`,
            borderRadius: 32,
            padding: "10px 70px",
            transform: `scale(${0.6 + 0.4 * stamp}) rotate(${-4 + 4 * stamp}deg)`,
            opacity: stamp,
            boxShadow: `0 0 120px ${color}55`,
          }}
        >
          {v.decision}
        </div>
        <FadeIn delay={26}>
          <div style={{ fontSize: 44, marginTop: 50, maxWidth: 1400, textAlign: "center", fontWeight: 500 }}>{v.headline}</div>
        </FadeIn>
        <FadeIn delay={40}>
          <div style={{ fontSize: 30, color: palette.muted, marginTop: 24 }}>Confidence {conf}%</div>
        </FadeIn>
      </div>
      <div style={{ position: "absolute", bottom: 70, left: 0, right: 0, textAlign: "center", fontSize: 24, color: palette.muted, letterSpacing: 4 }}>
        GENERATED BY GREENLIGHT · GEMINI × PARALLEL · RENDERED WITH REMOTION
      </div>
    </AbsoluteFill>
  );
};

/* ---------- composition ---------- */

export const PitchReel: React.FC<PitchReelProps> = (props) => {
  const scenes: React.FC<PitchReelProps>[] = [
    TitleScene,
    LoglineScene,
    CompsScene,
    MarketScene,
    RiskScene,
    BudgetScene,
    VerdictScene,
  ];
  return (
    <AbsoluteFill style={{ background: palette.bg }}>
      {scenes.map((S, i) => (
        <Sequence key={i} from={i * SCENE} durationInFrames={i === scenes.length - 1 ? SCENE + FPS : SCENE}>
          <S {...props} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
