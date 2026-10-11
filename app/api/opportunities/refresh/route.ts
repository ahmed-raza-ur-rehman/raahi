import { timingSafeEqual } from "node:crypto";
import { errorResponse, jsonResponse } from "@/lib/opportunities/api";
import { runScrapers } from "@/lib/opportunities/scrapers/run";
import { SNAPSHOT_PATH, readSnapshotFile, writeSnapshotFile } from "@/lib/opportunities/snapshot";
import { bundledSnapshot } from "@/lib/opportunities/bundled";
import { loadSnapshotIntoDb } from "@/lib/opportunities/store";

export const maxDuration = 60;

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.headers.get("x-refresh-secret") ?? "";
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Optional on-demand refresh for self-hosted deployments (cron job or Vercel Cron with CRON_SECRET).
 * The primary refresh path is the scheduled GitHub Action, which commits data/opportunities/snapshot.json.
 * Disabled (404) unless CRON_SECRET is configured.
 */
async function handle(request: Request) {
  if (!process.env.CRON_SECRET) return errorResponse("Not enabled.", 404);
  if (!authorised(request)) return errorResponse("Unauthorized.", 401);

  const previousFile = readSnapshotFile();
  const previous = previousFile.items.length > 0 ? previousFile : bundledSnapshot();
  const force = new URL(request.url).searchParams.get("force") === "1";
  const snapshot = await runScrapers({ previous, force });
  loadSnapshotIntoDb(snapshot);

  let persisted = false;
  try {
    writeSnapshotFile(snapshot, SNAPSHOT_PATH);
    persisted = true;
  } catch {
    // Read-only filesystem (serverless): the in-process database is updated, the file is not.
  }
  return jsonResponse({ generatedAt: snapshot.generatedAt, items: snapshot.items.length, persisted, sources: snapshot.sources.map((s) => ({ id: s.sourceId, status: s.status, items: s.items, error: s.error })) }, { cors: false });
}

export const GET = handle;
export const POST = handle;
