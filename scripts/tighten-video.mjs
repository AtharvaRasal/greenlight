// Tighten a screen recording: shorten silent pauses, then speed up slightly if still over the target.
// node scripts/tighten-video.mjs <in.mp4> <out.mp4> [targetSeconds=178]
// Works with Remotion's minimal ffmpeg build (no video setpts): segments are encoded separately and
// joined with the concat demuxer; speed-up re-times a raw H.264 stream with -r instead of setpts.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const FF = path.resolve("node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe");
const [input, output, targetArg] = process.argv.slice(2);
const TARGET = Number(targetArg || 178);
const KEEP_GAP = 0.4; // seconds of pause kept for a normal breath
const LONG_KEEP = 3.0; // seconds kept when the pause is a deliberate "watch the screen" moment (>5s)
const work = path.resolve("out/tighten");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

const probe = (f) => {
  const r = spawnSync(FF, ["-hide_banner", "-i", f], { encoding: "utf8" });
  const m = (r.stderr || "").match(/Duration: (\d+):(\d+):([\d.]+)/);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : NaN;
};
const fpsOf = (f) => {
  const r = spawnSync(FF, ["-hide_banner", "-i", f], { encoding: "utf8" });
  const m = (r.stderr || "").match(/([\d.]+) fps/);
  return m ? +m[1] : 30;
};
const duration = probe(input);
const fps = fpsOf(input);

// 1. detect silences
const det = spawnSync(FF, ["-hide_banner", "-vn", "-i", input, "-af", "silencedetect=noise=-30dB:d=1.0", "-f", "null", "NUL"], { encoding: "utf8" });
const starts = [...det.stderr.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
const ends = [...det.stderr.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
const silences = starts.map((s, i) => [s, ends[i] ?? duration]).filter(([s, e]) => e > s);

// 2. keep-segments
const keep = [];
let cursor = 0;
for (const [s, e] of silences) {
  const len = e - s;
  const keepLen = len > 5 ? LONG_KEEP : KEEP_GAP;
  if (len <= keepLen) continue;
  keep.push([cursor, s + keepLen / 2]);
  cursor = e - keepLen / 2;
}
keep.push([cursor, duration]);
const kept = keep.reduce((a, [s, e]) => a + (e - s), 0);
console.log(`input ${duration.toFixed(1)}s @ ${fps}fps · ${silences.length} silences · after tightening ${kept.toFixed(1)}s · ${keep.length} segments`);

// 3. encode each kept segment (timestamps restart at 0 per file), then concat-demux
const CONST_FPS = 30;
const list = [];
keep.forEach(([s, e], i) => {
  const seg = path.join(work, `seg${String(i).padStart(3, "0")}.mp4`);
  execFileSync(FF, ["-y", "-hide_banner", "-loglevel", "error", "-ss", s.toFixed(3), "-t", (e - s).toFixed(3), "-i", input,
    "-r", String(CONST_FPS), "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-g", "60",
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", seg], { stdio: "inherit" });
  list.push(`file '${seg.replace(/\\/g, "/")}'`);
  process.stdout.write(`\rsegments ${i + 1}/${keep.length}`);
});
console.log();
const listFile = path.join(work, "list.txt");
writeFileSync(listFile, list.join("\n") + "\n");
const cut = path.join(work, "cut.mp4");
execFileSync(FF, ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", "-movflags", "+faststart", cut], { stdio: "inherit" });
const cutLen = probe(cut);
console.log(`cut: ${cutLen.toFixed(1)}s`);

// 4. speed up only if needed: re-time raw H.264 with -r, stretch audio with atempo
const tempo = Math.min(1.25, Math.max(1, cutLen / TARGET));
if (tempo <= 1.005) {
  execFileSync(FF, ["-y", "-hide_banner", "-loglevel", "error", "-i", cut, "-c", "copy", output], { stdio: "inherit" });
} else {
  console.log(`speeding up ${tempo.toFixed(3)}x…`);
  const raw = path.join(work, "video.h264");
  execFileSync(FF, ["-y", "-hide_banner", "-loglevel", "error", "-i", cut, "-an", "-c:v", "copy", "-bsf:v", "h264_mp4toannexb", "-f", "h264", raw], { stdio: "inherit" });
  const aud = path.join(work, "audio.mp4");
  execFileSync(FF, ["-y", "-hide_banner", "-loglevel", "error", "-i", cut, "-vn", "-af", `atempo=${tempo.toFixed(4)}`, "-c:a", "aac", "-b:a", "160k", aud], { stdio: "inherit" });
  execFileSync(FF, ["-y", "-hide_banner", "-loglevel", "error", "-r", (CONST_FPS * tempo).toFixed(4), "-i", raw, "-i", aud, "-map", "0:v", "-map", "1:a",
    "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "copy", "-movflags", "+faststart", "-shortest", output], { stdio: "inherit" });
}
console.log(`output ${output}: ${probe(output).toFixed(1)}s`);
if (existsSync(work)) rmSync(work, { recursive: true, force: true });
