// Render a saved package (out/run-*.json) to an MP4 with Remotion.
//   npx tsx scripts/render.ts out/run-123.json [out/reel.mp4]
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { readFileSync } from "node:fs";
import path from "node:path";

async function main() {
  const [input, output = "out/pitch-reel.mp4"] = process.argv.slice(2);
  if (!input) throw new Error("usage: tsx scripts/render.ts <package.json> [out.mp4]");
  const pkg = JSON.parse(readFileSync(input, "utf8"));
  const inputProps = { logline: pkg.logline, analysis: pkg.analysis, posterDataUrl: pkg.posterDataUrl };

  console.log("bundling…");
  const serveUrl = await bundle({
    entryPoint: path.resolve("src/remotion/index.ts"),
    webpackOverride: (c) => ({
      ...c,
      resolve: { ...c.resolve, alias: { ...(c.resolve?.alias ?? {}), "@": path.resolve("src") } },
    }),
  });
  const composition = await selectComposition({ serveUrl, id: "PitchReel", inputProps });
  console.log(`rendering ${composition.durationInFrames} frames → ${output}`);
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: output,
    inputProps,
    onProgress: ({ progress }) => process.stdout.write(`\r${Math.round(progress * 100)}%`),
  });
  console.log("\ndone", output);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
