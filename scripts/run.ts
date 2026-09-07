// CLI smoke test: npx tsx scripts/run.ts "<logline>" [--no-poster]
import "dotenv/config";
import { config } from "dotenv";
import { writeFileSync, mkdirSync } from "node:fs";
config({ path: ".env.local" });

import { runGreenlight } from "../src/lib/pipeline";

const args = process.argv.slice(2);
const noPoster = args.includes("--no-poster");
const logline =
  args.filter((a) => !a.startsWith("--")).join(" ") ||
  "A washed-up Bollywood stunt double is hired to fake a billionaire's death for an insurance scam — and discovers the man is already dead.";

async function main() {
let scoutText = "";
const pkg = await runGreenlight(
  logline,
  (e) => {
    if (e.type === "text") {
      scoutText += e.delta;
      return;
    }
    if (e.type === "result") return;
    console.log(JSON.stringify(e));
  },
  { poster: !noPoster },
);

mkdirSync("out", { recursive: true });
const file = `out/run-${Date.now()}.json`;
writeFileSync(file, JSON.stringify(pkg, null, 2));
console.log("\n=== VERDICT ===", pkg.analysis.verdict.decision, pkg.analysis.verdict.confidence + "%");
console.log(pkg.analysis.title, "—", pkg.analysis.tagline);
console.log("comps:", pkg.analysis.comps.map((c) => `${c.title} (${c.year}) $${c.budgetUsdM}M→$${c.worldwideGrossUsdM}M`).join(" | "));
console.log("tool calls:", pkg.toolCalls.length, "sources:", pkg.sources.length, "poster:", pkg.posterDataUrl ? pkg.models.image : "none");
console.log("timings:", pkg.timingsMs);
console.log("saved", file, "| scout streamed chars:", scoutText.length);
}
main().catch((e) => { console.error(e); process.exit(1); });
