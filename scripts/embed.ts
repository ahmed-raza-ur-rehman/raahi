import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { populateMissingEmbeddings } from "../lib/db/embeddings";

// Load .env.local if present
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function main() {
  const summary = await populateMissingEmbeddings();
  console.log(`Generated ${summary.generated} embeddings; skipped ${summary.skipped}.`);
}

main().catch((err) => {
  console.error("Embedding generation failed:", err);
  process.exit(1);
});


