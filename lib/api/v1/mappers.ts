import { createHash } from "node:crypto";
import { ApiError } from "@/lib/platform/errors";
import { b64url } from "@/lib/platform/ids";
import type { Opportunity, OpportunityView } from "@/lib/opportunities/types";
import type { OpportunityV1 } from "./schemas";

/**
 * Anti-corruption layer between RAAHI's internal opportunity model and the public v1 contract: internal fields
 * (`dedupeKey`, `extra`) never leave the building, and the public shape can evolve independently of storage.
 */

/**
 * The content revision of a listing. It covers everything a client displays or stores and deliberately EXCLUDES the
 * values that change without the listing changing: `lastSeen` (touched by every scrape) and the computed
 * `status` / `daysLeft` / `isNew` (they move with the calendar). That is what makes manifest-based sync cheap: a
 * listing's revision is stable until its content really changes. 12 hex chars = 48 bits, ample for ~10^4 items.
 */
export function revisionOf(item: Opportunity): string {
  const material = JSON.stringify([
    item.id, item.kind, item.scope, item.title, item.organization, item.summary, item.url, item.applyUrl, item.sourceId, item.sourceName,
    item.sourceUrl, item.country, item.location, item.remote, item.levels, item.fields, item.tags, item.funding, item.deadline,
    item.deadlineText, item.rolling, item.postedAt, item.startsAt, item.firstSeen, item.openToPakistan, item.eligibilityNote,
    item.languages, item.alsoOn,
  ].map((value) => (value === undefined ? null : value)));
  return createHash("sha256").update(material).digest("hex").slice(0, 12);
}

export function toOpportunityV1(view: OpportunityView): OpportunityV1 {
  return {
    id: view.id,
    rev: revisionOf(view),
    kind: view.kind,
    scope: view.scope,
    title: view.title,
    organization: view.organization,
    summary: view.summary,
    url: view.url,
    applyUrl: view.applyUrl,
    source: { id: view.sourceId, name: view.sourceName, url: view.sourceUrl },
    country: view.country,
    location: view.location,
    remote: view.remote,
    levels: view.levels,
    fields: view.fields,
    tags: view.tags,
    funding: view.funding,
    deadline: view.deadline,
    deadlineText: view.deadlineText,
    rolling: view.rolling,
    postedAt: view.postedAt,
    startsAt: view.startsAt,
    firstSeen: view.firstSeen,
    lastSeen: view.lastSeen,
    openToPakistan: view.openToPakistan,
    eligibilityNote: view.eligibilityNote,
    languages: view.languages,
    alsoOn: view.alsoOn,
    status: view.status,
    daysLeft: view.daysLeft,
    isNew: view.isNew,
  };
}

/** A short opaque token that changes whenever the data set changes (see `dataStamp`). */
export function dataVersionOf(stamp: { generatedAt?: string; loadedAt?: string; live: number }): string {
  return createHash("sha256").update(`${stamp.generatedAt ?? ""}|${stamp.loadedAt ?? ""}|${stamp.live}`).digest("hex").slice(0, 12);
}

// ─── Pagination cursors ───────────────────────────────────────────────────────

/**
 * Cursors are opaque to clients (they must not parse them) so the pagination strategy can change without breaking
 * anyone. Internally: the offset plus a fingerprint of the filters it belongs to, so a cursor cannot be replayed
 * against a different query.
 */
export function fingerprintOf(parts: Record<string, unknown>): string {
  const stable = Object.keys(parts).sort().map((key) => [key, parts[key]]);
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex").slice(0, 8);
}

export function encodeCursor(offset: number, fingerprint: string): string {
  return b64url.encode(JSON.stringify({ o: offset, f: fingerprint }));
}

export function decodeCursor(cursor: string, fingerprint: string): number {
  let parsed: unknown;
  try {
    parsed = JSON.parse(b64url.decode(cursor).toString("utf8"));
  } catch {
    throw new ApiError("invalid_cursor");
  }
  const { o, f } = (parsed ?? {}) as { o?: unknown; f?: unknown };
  if (typeof o !== "number" || !Number.isInteger(o) || o < 0 || o > 10_000 || f !== fingerprint) {
    throw new ApiError("invalid_cursor", "The cursor does not belong to this query.");
  }
  return o;
}
