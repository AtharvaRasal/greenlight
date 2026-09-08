// Prebuilds the Remotion bundle into ./remotion-build so /api/render can render without webpack at runtime.
import { bundle } from "@remotion/bundler";
import path from "node:path";

async function main() {
  const outDir = path.resolve("remotion-build");
  await bundle({
    entryPoint: path.resolve("src/remotion/index.ts"),
    outDir,
    webpackOverride: (c) => ({
      ...c,
      resolve: { ...c.resolve, alias: { ...(c.resolve?.alias ?? {}), "@": path.resolve("src") } },
    }),
  });
  console.log("Remotion bundle written to", outDir);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
