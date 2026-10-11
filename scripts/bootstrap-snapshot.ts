/**
 * Builds the initial `data/opportunities/snapshot.json` from recorded fixtures (real responses captured on
 * 2026-10-11) so a fresh clone has realistic content before the first scheduled scrape runs.
 *
 *   npm run bootstrap-snapshot
 *
 * Deliberately excluded: anything labelled "(fixture)" (synthetic test records), sources whose fixture
 * contains values that were not observed live (Codeforces, Jobicy), and coupons (they expire within a day).
 * Source reports are marked "skipped" without `lastSuccessAt`, so the first real run is never rate-limited.
 */
import { createFixtureHttp, allSourceRoutes } from "../tests/helpers/fixture-http";
import { runScrapers } from "../lib/opportunities/scrapers/run";
import { SNAPSHOT_PATH, writeSnapshotFile } from "../lib/opportunities/snapshot";

const SEED_TIME = new Date("2026-10-11T06:00:00Z");
const EXCLUDED_SOURCES = new Set(["codeforces", "jobicy", "realdiscount"]);

async function main() {
  const snapshot = await runScrapers({ http: createFixtureHttp(allSourceRoutes()), now: SEED_TIME, force: true });
  snapshot.items = snapshot.items.filter(
    (item) => !EXCLUDED_SOURCES.has(item.sourceId) && !/\(fixture\)/i.test(item.title) && !/\(fixture\)/i.test(item.alsoOn?.map((a) => a.sourceName).join(" ") ?? ""),
  );
  snapshot.sources = snapshot.sources.map((report) => ({
    sourceId: report.sourceId,
    name: report.name,
    status: "skipped" as const,
    items: snapshot.items.filter((item) => item.sourceId === report.sourceId).length,
    durationMs: 0,
    startedAt: SEED_TIME.toISOString(),
    experimental: report.experimental,
    note: "Seed data recorded from the live site on 2026-10-11. The first scheduled scrape replaces it.",
  }));
  writeSnapshotFile(snapshot, SNAPSHOT_PATH);
  const byKind = new Map<string, number>();
  for (const item of snapshot.items) byKind.set(item.kind, (byKind.get(item.kind) ?? 0) + 1);
  console.log(`Wrote ${SNAPSHOT_PATH}: ${snapshot.items.length} items — ${[...byKind].map(([k, n]) => `${k} ${n}`).join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
