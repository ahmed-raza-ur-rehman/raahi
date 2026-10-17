/**
 * Refresh the opportunities snapshot from the live sources.
 *
 *   npm run scrape                     # all sources whose minimum interval has elapsed
 *   npm run scrape -- --force          # ignore minimum intervals
 *   npm run scrape -- --only njp,remotive
 *   npm run scrape -- --dry            # fetch and report, do not write the snapshot
 *   npm run scrape:pk                  # from a connection inside Pakistan: NJP and BE&OE (they refuse GitHub's servers)
 *
 * Exit code is non-zero only when *every* attempted source failed (a single broken site must not
 * block the others). In GitHub Actions, failing sources are surfaced as workflow annotations.
 */
import { runScrapers } from "../lib/opportunities/scrapers/run";
import { SNAPSHOT_PATH, readSnapshotFile, writeSnapshotFile } from "../lib/opportunities/snapshot";

function parseArgs(argv: string[]) {
  const args = { force: false, dry: false, only: undefined as string[] | undefined, region: undefined as string | undefined, out: SNAPSHOT_PATH };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--force") args.force = true;
    else if (arg === "--dry") args.dry = true;
    else if (arg === "--only") args.only = (argv[(index += 1)] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg === "--region") args.region = argv[(index += 1)];
    else if (arg === "--out") args.out = argv[(index += 1)] ?? args.out;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const previous = readSnapshotFile(args.out);
  console.log(`Previous snapshot: ${previous.items.length} items (generated ${previous.generatedAt})`);

  const snapshot = await runScrapers({
    previous,
    only: args.only,
    region: args.region,
    force: args.force,
    onProgress: (line) => console.log(line),
  });

  console.log("\nSource                        Status   Items  Time    Notes");
  console.log("─".repeat(96));
  for (const report of snapshot.sources) {
    const detail = report.error ?? report.note ?? "";
    console.log(`${report.sourceId.padEnd(29)} ${report.status.padEnd(8)} ${String(report.items).padStart(5)}  ${`${(report.durationMs / 1000).toFixed(1)}s`.padEnd(7)} ${detail.slice(0, 80)}`);
    if (process.env.GITHUB_ACTIONS && (report.status === "error" || report.status === "empty")) {
      console.log(`::warning title=Source ${report.sourceId} ${report.status}::${(detail || "no details").replace(/\r?\n/g, " ")}`);
    }
  }

  const byKind = new Map<string, number>();
  for (const item of snapshot.items) byKind.set(item.kind, (byKind.get(item.kind) ?? 0) + 1);
  console.log(`\nSnapshot: ${snapshot.items.length} items — ${[...byKind].map(([k, n]) => `${k} ${n}`).join(", ")}`);

  const attempted = snapshot.sources.filter((r) => r.status !== "skipped");
  const failed = attempted.filter((r) => r.status === "error" || r.status === "empty");

  if (args.dry) {
    console.log("Dry run: snapshot not written.");
  } else {
    writeSnapshotFile(snapshot, args.out);
    console.log(`Wrote ${args.out}`);
  }

  if (attempted.length > 0 && failed.length === attempted.length) {
    console.error("Every attempted source failed.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
