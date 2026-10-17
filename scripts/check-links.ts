/**
 * Check every URL in the curated directory and record the result in data/opportunities/link-health.json.
 *
 *   npm run check-links
 *
 * "blocked" (403/429…) means the site refused our bot and "unreachable" means it did not answer our servers at
 * all (common for .gov.pk sites reached from abroad) — neither is evidence the link is dead. Exit code is 1
 * only when links are truly broken (404/410/5xx), so a scheduled run can open an issue for them.
 */
import { writeFileSync } from "node:fs";
import { resources } from "../data/opportunities/resources";
import { checkResources } from "../lib/opportunities/linkcheck";

async function main() {
  const started = Date.now();
  const results = await checkResources(resources);
  const entries = Object.entries(results);
  const broken = entries.filter(([, entry]) => entry.verdict === "broken");
  const blocked = entries.filter(([, entry]) => entry.verdict === "blocked");
  const unreachable = entries.filter(([, entry]) => entry.verdict === "unreachable");

  writeFileSync("data/opportunities/link-health.json", `${JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 1)}\n`);

  console.log(`Checked ${entries.length} links in ${((Date.now() - started) / 1000).toFixed(0)}s: ${entries.length - broken.length - blocked.length - unreachable.length} ok, ${blocked.length} blocked, ${unreachable.length} unreachable, ${broken.length} broken.`);
  for (const [id, entry] of broken) {
    const resource = resources.find((r) => r.id === id);
    console.log(`BROKEN  ${id.padEnd(28)} HTTP ${entry.status || "—"}  ${resource?.url}`);
    if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Broken link ${id}::HTTP ${entry.status || "unreachable"} for ${resource?.url}`);
  }
  for (const [id, entry] of blocked) console.log(`blocked ${id.padEnd(28)} HTTP ${entry.status}`);
  for (const [id] of unreachable) console.log(`unreachable ${id}`);
  if (broken.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
