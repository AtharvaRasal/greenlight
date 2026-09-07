// Quick check that poster generation works with the current env (API key or Vertex/ADC).
//   npx tsx scripts/poster-test.ts
import { config } from "dotenv";
config({ path: ".env.local" });
import { writeFileSync, mkdirSync } from "node:fs";
import { generatePoster } from "../src/lib/poster";

async function main() {
  const t0 = Date.now();
  const { result, error } = await generatePoster(
    "A rain-soaked Mumbai rooftop at night; a lone stunt performer silhouetted against neon hoardings, a distant helicopter searchlight sweeping the skyline; amber and teal palette, moody, wide.",
  );
  if (!result) {
    console.error("FAILED:", error);
    process.exit(1);
  }
  mkdirSync("out", { recursive: true });
  const b64 = result.dataUrl.split(",")[1];
  writeFileSync("out/poster-test.png", Buffer.from(b64, "base64"));
  console.log("OK", result.model, `${Math.round(b64.length * 0.75 / 1024)} KB`, `${Date.now() - t0}ms`, "→ out/poster-test.png");
}
main();
