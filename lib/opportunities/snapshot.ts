import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { opportunitySchema, type Opportunity, type Snapshot, type SourceReport } from "./types";

/**
 * The snapshot is the single source of truth for scraped data: `data/opportunities/snapshot.json`.
 * It is written one item per line so a refresh produces small, reviewable git diffs.
 */

export const SNAPSHOT_PATH = "data/opportunities/snapshot.json";

export function emptySnapshot(now: Date = new Date()): Snapshot {
  return { version: 1, generatedAt: now.toISOString(), sources: [], items: [] };
}

/** Validate untrusted JSON (a file on disk or a remote snapshot) and drop malformed items. */
export function parseSnapshot(input: unknown): { snapshot: Snapshot; dropped: number } {
  if (!input || typeof input !== "object") return { snapshot: emptySnapshot(new Date(0)), dropped: 0 };
  const record = input as { generatedAt?: unknown; sources?: unknown; items?: unknown };
  const generatedAt = typeof record.generatedAt === "string" && !Number.isNaN(Date.parse(record.generatedAt)) ? record.generatedAt : new Date(0).toISOString();

  const items: Opportunity[] = [];
  let dropped = 0;
  for (const raw of Array.isArray(record.items) ? record.items : []) {
    const parsed = opportunitySchema.safeParse(raw);
    if (parsed.success) items.push(parsed.data);
    else dropped += 1;
  }
  const sources = (Array.isArray(record.sources) ? record.sources : []).filter(
    (entry): entry is SourceReport => Boolean(entry) && typeof entry === "object" && typeof (entry as SourceReport).sourceId === "string",
  );
  return { snapshot: { version: 1, generatedAt, sources, items }, dropped };
}

export function serializeSnapshot(snapshot: Snapshot): string {
  const lines = snapshot.items.map((item) => `    ${JSON.stringify(item)}`);
  const sources = snapshot.sources.map((source) => `    ${JSON.stringify(source)}`);
  return [
    "{",
    `  "version": 1,`,
    `  "generatedAt": ${JSON.stringify(snapshot.generatedAt)},`,
    `  "sources": [`,
    sources.join(",\n"),
    `  ],`,
    `  "items": [`,
    lines.join(",\n"),
    `  ]`,
    "}",
    "",
  ].join("\n");
}

export function readSnapshotFile(path: string = SNAPSHOT_PATH): Snapshot {
  if (!existsSync(path)) return emptySnapshot(new Date(0));
  try {
    return parseSnapshot(JSON.parse(readFileSync(path, "utf8"))).snapshot;
  } catch {
    return emptySnapshot(new Date(0));
  }
}

/** Atomic write (temp file + rename) so a crash never leaves half a snapshot behind. */
export function writeSnapshotFile(snapshot: Snapshot, path: string = SNAPSHOT_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  writeFileSync(temp, serializeSnapshot(snapshot), "utf8");
  renameSync(temp, path);
}
