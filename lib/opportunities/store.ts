import { buildVocabulary, correctQuery } from "./spellfix";
import { getSqlite } from "@/lib/db/client";
import { addDays, computeStatus, isRecentlySeen, todayInPakistan } from "./dates";
import { clockNow } from "./clock";
import { interpretQuery } from "./query";
import { expiryOf } from "./scrapers/merge";
import { authorityOf } from "./scrapers/sources";
import { bundledSnapshot } from "./bundled";
import { parseSnapshot } from "./snapshot";
import type {
  FacetCount,
  Opportunity,
  OpportunityKind,
  OpportunityQuery,
  OpportunitySearchResult,
  OpportunityView,
  Snapshot,
  SourceReport,
} from "./types";

type Row = Record<string, unknown>;

const DAY_MS = 86_400_000;

// ─── Meta helpers ─────────────────────────────────────────────────────────────

function getMeta(name: string): string | undefined {
  const row = getSqlite().prepare("SELECT value FROM opportunity_meta WHERE name = ?").get(name) as { value: string } | undefined;
  return row?.value;
}

function setMeta(name: string, value: string) {
  getSqlite().prepare("INSERT INTO opportunity_meta (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value").run(name, value);
}

// ─── Loading ──────────────────────────────────────────────────────────────────

const INSERT_COLUMNS = [
  "id", "kind", "scope", "title", "organization", "summary", "url", "apply_url", "source_id", "source_name", "source_url",
  "country", "location", "remote", "levels", "fields", "tags", "funding", "deadline", "deadline_text", "rolling", "posted_at",
  "starts_at", "first_seen", "last_seen", "open_to_pakistan", "eligibility_note", "languages", "extra", "also_on", "dedupe_key", "expires_at",
] as const;

const bool = (value: boolean | null | undefined) => (value === undefined || value === null ? null : value ? 1 : 0);
const json = (value: unknown) => (value === undefined ? null : JSON.stringify(value));

/** Replace the contents of the opportunity tables with `snapshot` (expired items are skipped). */
export function loadSnapshotIntoDb(snapshot: Snapshot, now: Date = clockNow()): { loaded: number } {
  const db = getSqlite();
  const insert = db.prepare(`INSERT INTO opportunities (${INSERT_COLUMNS.join(", ")}) VALUES (${INSERT_COLUMNS.map(() => "?").join(", ")})`);
  const insertSearch = db.prepare("INSERT INTO opportunity_search (id, title, organization, summary, tags, country) VALUES (?, ?, ?, ?, ?, ?)");
  let loaded = 0;

  db.transaction(() => {
    db.exec("DELETE FROM opportunities; DELETE FROM opportunity_search;");
    for (const item of snapshot.items) {
      const expires = expiryOf(item);
      if (expires <= now.getTime()) continue;
      insert.run(
        item.id, item.kind, item.scope, item.title, item.organization ?? null, item.summary ?? null, item.url, item.applyUrl ?? null,
        item.sourceId, item.sourceName, item.sourceUrl, item.country ?? null, item.location ?? null, bool(item.remote),
        JSON.stringify(item.levels), JSON.stringify(item.fields), JSON.stringify(item.tags), item.funding ?? null, item.deadline ?? null,
        item.deadlineText ?? null, bool(item.rolling), item.postedAt ?? null, item.startsAt ?? null, item.firstSeen, item.lastSeen,
        bool(item.openToPakistan), item.eligibilityNote ?? null, json(item.languages), json(item.extra), json(item.alsoOn), item.dedupeKey, expires,
      );
      insertSearch.run(item.id, item.title, item.organization ?? "", item.summary ?? "", item.tags.join(" "), item.country ?? "");
      loaded += 1;
    }
    setMeta("snapshot_generated_at", snapshot.generatedAt);
    setMeta("reports", JSON.stringify(snapshot.sources));
    setMeta("loaded_at", now.toISOString());
  })();

  return { loaded };
}

/**
 * Make sure the DB holds a snapshot at least as new as `snapshot` (the bundled one by default).
 * Cheap to call on every request: it only reloads when the snapshot is newer than what is loaded.
 */
export function ensureOpportunitiesReady(snapshot?: Snapshot, now: Date = clockNow()): void {
  const loadedAt = getMeta("snapshot_generated_at");
  // `OPPORTUNITIES_BUNDLED=off` (tests, offline experiments): once something is loaded, never swap in the bundled copy.
  if (!snapshot && loadedAt && process.env.OPPORTUNITIES_BUNDLED === "off") return;
  const candidate = snapshot ?? bundledSnapshot();
  if (!loadedAt || Date.parse(candidate.generatedAt) > Date.parse(loadedAt)) {
    loadSnapshotIntoDb(candidate, now);
  }
}


// ─── Runtime refresh from a remote snapshot (keeps data fresh without redeploying) ─

export const DEFAULT_REMOTE_SNAPSHOT = "https://raw.githubusercontent.com/ahmed-raza-ur-rehman/raahi/master/data/opportunities/snapshot.json";

/** On Vercel, pull the latest committed snapshot by default; elsewhere only when configured. Set to `off` to disable. */
export function remoteSnapshotUrl(env: Record<string, string | undefined> = process.env): string | undefined {
  const configured = env.OPPORTUNITIES_SNAPSHOT_URL?.trim();
  if (configured && ["off", "false", "0", "none"].includes(configured.toLowerCase())) return undefined;
  if (configured) return configured;
  return env.VERCEL ? DEFAULT_REMOTE_SNAPSHOT : undefined;
}

let lastRemoteCheck = 0;

export interface RemoteRefreshOptions {
  url?: string;
  fetchImpl?: typeof fetch;
  ttlMs?: number;
  timeoutMs?: number;
  force?: boolean;
  now?: Date;
}

export async function refreshFromRemote(options: RemoteRefreshOptions = {}): Promise<"updated" | "unchanged" | "skipped" | "failed"> {
  const url = options.url ?? remoteSnapshotUrl();
  if (!url) return "skipped";
  const now = options.now ?? clockNow();
  const ttl = options.ttlMs ?? 10 * 60_000;
  if (!options.force && now.getTime() - lastRemoteCheck < ttl) return "skipped";
  lastRemoteCheck = now.getTime();

  try {
    const response = await (options.fetchImpl ?? fetch)(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(options.timeoutMs ?? 3_000),
      cache: "no-store",
    });
    if (!response.ok) return "failed";
    const { snapshot } = parseSnapshot(await response.json());
    if (snapshot.items.length === 0) return "failed"; // never replace good data with an empty or invalid file
    const loadedAt = getMeta("snapshot_generated_at");
    if (loadedAt && Date.parse(snapshot.generatedAt) <= Date.parse(loadedAt)) return "unchanged";
    loadSnapshotIntoDb(snapshot, now);
    return "updated";
  } catch {
    return "failed";
  }
}

/** Test hook. */
export function resetRemoteRefreshState() {
  lastRemoteCheck = 0;
}

/** Everything an API route or server page needs before reading. */
export async function prepareOpportunities(): Promise<void> {
  ensureOpportunitiesReady();
  await refreshFromRemote();
}

// ─── Row mapping ─────────────────────────────────────────────────────────────

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};
const nullable = <T>(value: unknown): T | undefined => (value === null || value === undefined ? undefined : (value as T));
const nullableBool = (value: unknown): boolean | undefined => (value === null || value === undefined ? undefined : value === 1);

function rowToOpportunity(row: Row): Opportunity {
  return {
    id: row.id as string,
    kind: row.kind as OpportunityKind,
    scope: row.scope as Opportunity["scope"],
    title: row.title as string,
    organization: nullable(row.organization),
    summary: nullable(row.summary),
    url: row.url as string,
    applyUrl: nullable(row.apply_url),
    sourceId: row.source_id as string,
    sourceName: row.source_name as string,
    sourceUrl: row.source_url as string,
    country: nullable(row.country),
    location: nullable(row.location),
    remote: nullableBool(row.remote),
    levels: parseJson(row.levels, []),
    fields: parseJson(row.fields, []),
    tags: parseJson(row.tags, []),
    funding: nullable(row.funding),
    deadline: nullable(row.deadline),
    deadlineText: nullable(row.deadline_text),
    rolling: nullableBool(row.rolling),
    postedAt: nullable(row.posted_at),
    startsAt: nullable(row.starts_at),
    firstSeen: row.first_seen as string,
    lastSeen: row.last_seen as string,
    openToPakistan: row.open_to_pakistan === null || row.open_to_pakistan === undefined ? undefined : row.open_to_pakistan === 1,
    eligibilityNote: nullable(row.eligibility_note),
    languages: parseJson<string[] | undefined>(row.languages, undefined),
    extra: parseJson<Opportunity["extra"]>(row.extra, undefined),
    alsoOn: parseJson<Opportunity["alsoOn"]>(row.also_on, undefined),
    dedupeKey: row.dedupe_key as string,
  };
}

export function toView(item: Opportunity, now: Date = clockNow()): OpportunityView {
  const { status, daysLeft } = computeStatus(item, now);
  return { ...item, status, daysLeft, isNew: isRecentlySeen(item.firstSeen, now) };
}

// ─── Search ──────────────────────────────────────────────────────────────────

function ftsMatch(terms: string[], mode: "AND" | "OR"): string | undefined {
  const parts = terms
    .map((term) => term.replace(/[^\p{L}\p{N}]+/gu, " ").trim())
    .flatMap((term) => term.split(/\s+/))
    .filter(Boolean)
    .map((token) => (token.length >= 3 ? `"${token}"*` : `"${token}"`));
  return parts.length > 0 ? parts.join(` ${mode} `) : undefined;
}

function ftsScores(match: string): Map<string, number> {
  try {
    const rows = getSqlite()
      .prepare("SELECT id, bm25(opportunity_search, 0, 10, 4, 1, 3, 1) AS score FROM opportunity_search WHERE opportunity_search MATCH ?")
      .all(match) as Array<{ id: string; score: number }>;
    return new Map(rows.map((row) => [row.id, -row.score]));
  } catch {
    return new Map();
  }
}

/** How many of the query terms appear (as word prefixes) in the item's searchable text. */
function termCoverage(row: Row, terms: string[]): number {
  const text = `${row.title ?? ""} ${row.organization ?? ""} ${row.summary ?? ""} ${row.tags ?? ""} ${row.country ?? ""}`.toLowerCase();
  const words = new Set(text.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  let covered = 0;
  for (const term of terms) {
    const lower = term.toLowerCase();
    if (words.has(lower) || (lower.length >= 3 && [...words].some((word) => word.startsWith(lower)))) covered += 1;
  }
  return covered;
}

/**
 * Browsing (no search words) should show a mix, not 9 jobs from one portal. Greedy re-rank of the head of
 * the list: each pick makes further picks of the same kind or source slightly less attractive.
 */
function diversify<T extends { item: OpportunityView; score: number }>(entries: T[], head = 60): T[] {
  const pool = entries.slice(0, head);
  const tail = entries.slice(head);
  const picked: T[] = [];
  const perKind = new Map<string, number>();
  const perSource = new Map<string, number>();
  while (pool.length > 0) {
    let best = 0;
    let bestScore = -Infinity;
    pool.forEach((entry, index) => {
      const adjusted = entry.score - 0.45 * (perKind.get(entry.item.kind) ?? 0) - 0.25 * (perSource.get(entry.item.sourceId) ?? 0);
      if (adjusted > bestScore) {
        bestScore = adjusted;
        best = index;
      }
    });
    const [chosen] = pool.splice(best, 1);
    picked.push(chosen);
    perKind.set(chosen.item.kind, (perKind.get(chosen.item.kind) ?? 0) + 1);
    perSource.set(chosen.item.sourceId, (perSource.get(chosen.item.sourceId) ?? 0) + 1);
  }
  return [...picked, ...tail];
}

function bump(map: Map<string, number>, key: string | undefined) {
  if (key) map.set(key, (map.get(key) ?? 0) + 1);
}

function toFacet(map: Map<string, number>, limit = 20): FacetCount[] {
  return [...map].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)).slice(0, limit);
}

function rank(item: OpportunityView, base: number, now: Date): number {
  const reference = Date.parse(item.postedAt ?? item.firstSeen);
  const ageDays = Math.max(0, (now.getTime() - reference) / DAY_MS);
  let score = base + Math.exp(-ageDays / 30);
  if (item.daysLeft !== null && item.daysLeft >= 0 && item.daysLeft <= 14) score += 0.6 * (1 - item.daysLeft / 14);
  if (item.openToPakistan === true) score += 0.4;
  else if (item.openToPakistan === false) score -= 1;
  if (item.scope === "pakistan") score += 0.2;
  const authority = authorityOf(item.sourceId);
  score += authority === 1 ? 0.3 : authority === 2 ? 0.2 : authority === 3 ? 0.1 : 0;
  return score;
}

function searchCore(query: OpportunityQuery, now: Date): OpportunitySearchResult {
  const db = getSqlite();
  const interpreted = interpretQuery(query.q ?? "");

  // Explicit filters win over anything inferred from the sentence.
  const kinds = query.kinds && query.kinds.length > 0 ? query.kinds : interpreted.kinds;
  const country = query.country ?? interpreted.country;
  const level = query.level ?? interpreted.level;
  const funding = query.funding ?? interpreted.funding;
  const scope = query.scope ?? interpreted.scope;
  const deadlineWithinDays = query.deadlineWithinDays ?? interpreted.deadlineWithinDays;
  const remote = query.remote ?? interpreted.remote;

  const today = todayInPakistan(now);
  const where: string[] = ["expires_at > ?"];
  const params: unknown[] = [now.getTime()];

  if (kinds && kinds.length > 0) {
    where.push(`kind IN (${kinds.map(() => "?").join(",")})`);
    params.push(...kinds);
  } else {
    where.push("kind != 'notice'"); // regulator notices are alerts, not opportunities — ask for them explicitly
  }
  if (scope) {
    where.push("scope = ?");
    params.push(scope);
  }
  if (country) {
    where.push("country = ? COLLATE NOCASE");
    params.push(country);
  }
  if (level) {
    where.push("levels LIKE ?");
    params.push(`%"${level}"%`);
  }
  if (funding) {
    where.push("funding = ?");
    params.push(funding);
  }
  if (query.openToPakistan) where.push("(open_to_pakistan IS NULL OR open_to_pakistan = 1)");
  if (remote) where.push("(remote = 1 OR location = 'Online')");
  if (!query.includeClosed) {
    where.push("(deadline IS NULL OR deadline >= ?)");
    params.push(today);
  }
  if (deadlineWithinDays !== undefined) {
    where.push("deadline IS NOT NULL AND deadline >= ? AND deadline <= ?");
    params.push(today, addDays(today, deadlineWithinDays));
  }
  if (query.since) {
    where.push("first_seen > ?");
    params.push(query.since);
  }
  if (query.newWithinDays !== undefined) {
    where.push("first_seen >= ?");
    params.push(new Date(now.getTime() - query.newWithinDays * DAY_MS).toISOString());
  }
  if (query.sourceId) {
    where.push("source_id = ?");
    params.push(query.sourceId);
  }
  if (query.tag) {
    where.push("tags LIKE ?");
    params.push(`%"${query.tag.toLowerCase()}"%`);
  }
  if (query.language) {
    where.push("languages LIKE ?");
    params.push(`%"${query.language}"%`);
  }

  const rows = db.prepare(`SELECT * FROM opportunities WHERE ${where.join(" AND ")}`).all(...params) as Row[];

  // Free-text relevance: AND first for precision, widen to OR if that finds too little — but a widened
  // match must still cover at least half of the words, so filler words alone never produce results.
  let scores: Map<string, number> | undefined;
  const loose = new Set<string>();
  const terms = interpreted.terms;
  if (terms.length > 0) {
    const strict = ftsMatch(terms, "AND");
    scores = strict ? ftsScores(strict) : new Map();
    if (scores.size < 3 && terms.length > 1) {
      const widened = ftsMatch(terms, "OR");
      if (widened) {
        for (const [id, score] of ftsScores(widened)) {
          if (!scores.has(id)) {
            scores.set(id, score * 0.6);
            loose.add(id);
          }
        }
      }
    }
  }
  const needed = Math.ceil(terms.length / 2);

  const scored = rows
    .filter((row) => {
      if (!scores) return true;
      const id = row.id as string;
      if (!scores.has(id)) return false;
      return !loose.has(id) || termCoverage(row, terms) >= needed;
    })
    .map((row) => {
      const item = toView(rowToOpportunity(row), now);
      return { item, score: rank(item, scores ? (scores.get(row.id as string) as number) : 0, now) };
    });

  const sort = query.sort ?? "relevance";
  scored.sort((a, b) => {
    if (sort === "newest") return Date.parse(b.item.postedAt ?? b.item.firstSeen) - Date.parse(a.item.postedAt ?? a.item.firstSeen);
    if (sort === "deadline") {
      if (!a.item.deadline && !b.item.deadline) return b.score - a.score;
      if (!a.item.deadline) return 1;
      if (!b.item.deadline) return -1;
      return a.item.deadline.localeCompare(b.item.deadline);
    }
    return b.score - a.score;
  });
  const ordered = sort === "relevance" && terms.length === 0 ? diversify(scored) : scored;

  const facets = { kind: new Map<string, number>(), scope: new Map<string, number>(), country: new Map<string, number>(), level: new Map<string, number>(), funding: new Map<string, number>(), source: new Map<string, number>() };
  for (const { item } of ordered) {
    bump(facets.kind, item.kind);
    bump(facets.scope, item.scope);
    bump(facets.country, item.country);
    for (const lvl of item.levels) bump(facets.level, lvl);
    bump(facets.funding, item.funding);
    bump(facets.source, item.sourceName);
  }

  const limit = Math.min(Math.max(query.limit ?? 24, 1), 100);
  const offset = Math.max(query.offset ?? 0, 0);
  return {
    total: ordered.length,
    items: ordered.slice(offset, offset + limit).map((entry) => entry.item),
    facets: {
      kind: toFacet(facets.kind),
      scope: toFacet(facets.scope),
      country: toFacet(facets.country, 15),
      level: toFacet(facets.level),
      funding: toFacet(facets.funding),
      source: toFacet(facets.source),
    },
    interpreted: { terms, kinds, country, level, funding, scope, deadlineWithinDays, remote },
  };
}

/** Words that appear in live listings: titles, organisations, tags and countries. Built only when a search finds nothing. */
function liveVocabulary(now: Date): Map<string, number> {
  const rows = getSqlite()
    .prepare("SELECT title, organization, tags, country FROM opportunities WHERE expires_at > ?")
    .all(now.getTime()) as Array<{ title: string | null; organization: string | null; tags: string | null; country: string | null }>;
  return buildVocabulary(rows.flatMap((row) => [row.title, row.organization, row.tags, row.country]).filter((value): value is string => Boolean(value)));
}

/**
 * Search the listings. When nothing matches as typed, unknown words are checked against the live vocabulary and the
 * search is retried with the closest spellings; `interpreted.corrected` says what was changed.
 */
export function searchOpportunities(query: OpportunityQuery = {}, now: Date = clockNow()): OpportunitySearchResult {
  const result = searchCore(query, now);
  if (result.total > 0 || result.interpreted.terms.length === 0 || !query.q) return result;
  const fix = correctQuery(query.q, result.interpreted.terms, liveVocabulary(now));
  if (!fix) return result;
  const retry = searchCore({ ...query, q: fix.q }, now);
  if (retry.total === 0) return result;
  return { ...retry, interpreted: { ...retry.interpreted, corrected: { from: query.q, to: fix.q, changes: fix.changes } } };
}

export function getOpportunity(id: string, now: Date = clockNow()): OpportunityView | undefined {
  const row = getSqlite().prepare("SELECT * FROM opportunities WHERE id = ? AND expires_at > ?").get(id, now.getTime()) as Row | undefined;
  return row ? toView(rowToOpportunity(row), now) : undefined;
}

/** Other items a reader of `item` may want: same kind family, shared tags/country, still open. */
export function relatedOpportunities(item: Opportunity, limit = 4, now: Date = clockNow()): OpportunityView[] {
  const today = todayInPakistan(now);
  const rows = getSqlite()
    .prepare("SELECT * FROM opportunities WHERE id != ? AND kind = ? AND expires_at > ? AND (deadline IS NULL OR deadline >= ?) LIMIT 200")
    .all(item.id, item.kind, now.getTime(), today) as Row[];
  const mine = new Set(item.tags);
  return rows
    .map((row) => rowToOpportunity(row))
    .map((candidate) => {
      const shared = candidate.tags.filter((tag) => mine.has(tag)).length;
      const score = shared * 2 + (candidate.country && candidate.country === item.country ? 2 : 0) + (candidate.scope === item.scope ? 1 : 0);
      return { candidate, score };
    })
    .filter((entry) => entry.score > 1)
    .sort((a, b) => b.score - a.score || Date.parse(b.candidate.firstSeen) - Date.parse(a.candidate.firstSeen))
    .slice(0, limit)
    .map((entry) => toView(entry.candidate, now));
}

// ─── Status ──────────────────────────────────────────────────────────────────

export interface OpportunityStatusReport {
  generatedAt?: string;
  loadedAt?: string;
  ageHours: number | null;
  stale: boolean;
  total: number;
  byKind: FacetCount[];
  byScope: FacetCount[];
  sources: SourceReport[];
  remoteRefresh: boolean;
}

export function getStatus(now: Date = clockNow()): OpportunityStatusReport {
  const db = getSqlite();
  const generatedAt = getMeta("snapshot_generated_at");
  const byKind = db.prepare("SELECT kind AS value, COUNT(*) AS count FROM opportunities WHERE expires_at > ? GROUP BY kind ORDER BY count DESC").all(now.getTime()) as FacetCount[];
  const byScope = db.prepare("SELECT scope AS value, COUNT(*) AS count FROM opportunities WHERE expires_at > ? AND kind != 'notice' GROUP BY scope ORDER BY count DESC").all(now.getTime()) as FacetCount[];
  const ageHours = generatedAt ? Math.max(0, (now.getTime() - Date.parse(generatedAt)) / 3_600_000) : null;
  return {
    generatedAt,
    loadedAt: getMeta("loaded_at"),
    ageHours,
    stale: ageHours === null || ageHours > 36,
    total: byKind.reduce((sum, row) => sum + row.count, 0),
    byKind,
    byScope,
    sources: parseJson<SourceReport[]>(getMeta("reports"), []),
    remoteRefresh: remoteSnapshotUrl() !== undefined,
  };
}
