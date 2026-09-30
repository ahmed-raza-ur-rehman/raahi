import { getSqlite } from "@/lib/db/client";
import type {
  BloodBank,
  ContactRecord,
  DiseaseSignal,
  DisasterChannel,
  DisasterGuide,
  DocumentRecipe,
  ImportantDate,
  KnowledgeEntityType,
  KnowledgeHit,
  LegalTopic,
  MedicalCamp,
  MedicalProcedure,
  OpportunityRecord,
  SourceRef,
  TestRecord,
} from "@/lib/types";

export type KnowledgeRow = {
  id: string;
  entity_type: string;
  title: string;
  summary: string;
  payload: string;
  source_url: string;
  source_title: string;
  authority_tier: number;
  last_verified: string;
  country: string | null;
  province: string | null;
  category: string | null;
};

export interface KnowledgeSearchOptions {
  query: string;
  types?: KnowledgeEntityType[];
  province?: string;
  category?: string;
  limit?: number;
}

export interface EntityFilter {
  province?: string;
  category?: string;
  country?: string;
}

/* ────────────────────────────────────────────────────────────────
 * Low level access
 * ──────────────────────────────────────────────────────────────── */

function rowToHit(row: KnowledgeRow, score: number, reasons: string[]): KnowledgeHit {
  let record: unknown = {};
  try {
    record = JSON.parse(row.payload) as unknown;
  } catch {
    record = {};
  }
  const source: SourceRef = {
    url: row.source_url,
    title: row.source_title,
    tier: row.authority_tier,
    lastVerified: row.last_verified,
  };
  return {
    entityType: row.entity_type as KnowledgeEntityType,
    entityId: row.id,
    score,
    reasons,
    title: row.title,
    summary: row.summary,
    source,
    record,
  };
}

export function getRow(id: string): KnowledgeRow | undefined {
  return getSqlite()
    .prepare("SELECT * FROM knowledge_entities WHERE id = ?")
    .get(id) as KnowledgeRow | undefined;
}

export function getEntity<T>(id: string): T | undefined {
  const row = getRow(id);
  if (!row) return undefined;
  try {
    return JSON.parse(row.payload) as T;
  } catch {
    return undefined;
  }
}

export function listRows(type: KnowledgeEntityType, filter: EntityFilter = {}): KnowledgeRow[] {
  const clauses: string[] = ["entity_type = ?"];
  const params: unknown[] = [type];

  if (filter.category) {
    clauses.push("category = ?");
    params.push(filter.category);
  }
  if (filter.province) {
    clauses.push("(province IS NULL OR province = ? OR province = 'Pakistan')");
    params.push(filter.province);
  }
  if (filter.country) {
    clauses.push("(country IS NULL OR country = ?)");
    params.push(filter.country);
  }

  return getSqlite()
    .prepare(`SELECT * FROM knowledge_entities WHERE ${clauses.join(" AND ")} ORDER BY authority_tier ASC, title ASC`)
    .all(...params) as KnowledgeRow[];
}

function list<T>(type: KnowledgeEntityType, filter: EntityFilter = {}): T[] {
  return listRows(type, filter).map((row) => {
    try {
      return JSON.parse(row.payload) as T;
    } catch {
      return undefined;
    }
  }).filter((value): value is T => Boolean(value));
}

/* ────────────────────────────────────────────────────────────────
 * Typed collections
 * ──────────────────────────────────────────────────────────────── */

export function listOpportunities(filter: EntityFilter & { kind?: string; scope?: string } = {}): OpportunityRecord[] {
  let items = list<OpportunityRecord>("opportunity", filter.category ? { category: filter.category } : {});
  if (filter.kind) items = items.filter((item) => item.kind === filter.kind);
  if (filter.scope) items = items.filter((item) => item.scope === filter.scope);
  if (filter.country) items = items.filter((item) => item.country === filter.country || item.scope === "national");
  if (filter.province) items = items.filter((item) => item.scope !== "provincial" || item.country === filter.province);
  return items.filter((item) => item.active);
}

export function listScholarships(filter: { scope?: "national" | "international"; level?: string } = {}): OpportunityRecord[] {
  let items = list<OpportunityRecord>("opportunity", { category: "scholarship" }).filter((item) => item.active);
  if (filter.scope) items = items.filter((item) => item.scope === filter.scope);
  if (filter.level) items = items.filter((item) => item.levels.includes(filter.level as string) || item.levels.includes("any"));
  return items;
}

export function listDocuments(): DocumentRecipe[] {
  return list<DocumentRecipe>("document");
}

export function listTests(filter: { category?: string } = {}): TestRecord[] {
  return list<TestRecord>("test", filter.category ? { category: filter.category } : {});
}

export function listCamps(province?: string): MedicalCamp[] {
  const camps = list<MedicalCamp>("camp");
  if (!province) return camps;
  return camps.filter((camp) => camp.districts.includes("Pakistan") || camp.districts.includes(province));
}

export function listDiseaseSignals(severity?: string): DiseaseSignal[] {
  const signals = list<DiseaseSignal>("disease");
  return severity ? signals.filter((signal) => signal.severity === severity) : signals;
}

export function listMedicalProcedures(): MedicalProcedure[] {
  return list<MedicalProcedure>("medical_procedure");
}

export function listBloodBanks(province?: string): BloodBank[] {
  return list<BloodBank>("blood_bank", province ? { province } : {});
}

export function listDisasterChannels(): DisasterChannel[] {
  return list<DisasterChannel>("disaster_channel").sort((a, b) => a.priority - b.priority);
}

export function listDisasterGuides(hazard?: string): DisasterGuide[] {
  return list<DisasterGuide>("disaster_guide", hazard ? { category: hazard } : {});
}

export function listLegalTopics(category?: string): LegalTopic[] {
  return list<LegalTopic>("legal_topic", category ? { category } : {});
}

export function listContacts(category?: string): ContactRecord[] {
  return list<ContactRecord>("contact", category ? { category } : {});
}

/** Every important date gathered from the test and opportunity libraries. */
export function importantDates(category?: string): ImportantDate[] {
  const tests = listTests();
  const opportunities = list<OpportunityRecord>("opportunity");

  const dates: ImportantDate[] = [
    ...tests.flatMap((record) => record.dates),
    ...opportunities
      .filter((record) => record.deadline.kind !== "unknown")
      .map<ImportantDate>((record) => ({
        id: `${record.id}-deadline`,
        category: (record.kind === "admission" ? "admission" : record.kind === "job" ? "job" : record.kind === "internship" ? "internship" : record.kind === "training" ? "training" : "scholarship") as ImportantDate["category"],
        title: record.title,
        refType: "opportunity" as const,
        refId: record.id,
        kind: record.deadline.kind,
        ...(record.deadline.date ? { date: record.deadline.date } : {}),
        ...(record.deadline.window ? { window: record.deadline.window } : {}),
        ...(record.deadline.recurringMonths ? { recurringMonths: record.deadline.recurringMonths } : {}),
        note: record.deadline.note,
        source: record.source,
      })),
  ];

  const filtered = category ? dates.filter((date) => date.category === category) : dates;

  const rank = (date: ImportantDate) => {
    if (date.date) return Date.parse(date.date);
    if (date.window) return Date.parse(date.window[0]);
    if (date.recurringMonths) return date.recurringMonths[0] * 10_000_000;
    return Number.MAX_SAFE_INTEGER;
  };

  return filtered.sort((a, b) => rank(a) - rank(b));
}

/* ────────────────────────────────────────────────────────────────
 * Unified hybrid search
 * ──────────────────────────────────────────────────────────────── */

function queryTokens(value: string): string[] {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function ftsScores(query: string): Map<string, number> {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return new Map();
  const ftsQuery = tokens.map((token) => `"${token.replaceAll('"', "")}"`).join(" OR ");
  try {
    const rows = getSqlite()
      .prepare(
        `SELECT entity_id, -bm25(knowledge_search) AS score
         FROM knowledge_search
         WHERE knowledge_search MATCH ?
         ORDER BY bm25(knowledge_search)
         LIMIT 200`,
      )
      .all(ftsQuery) as { entity_id: string; score: number }[];
    return new Map(rows.map((row) => [row.entity_id, row.score]));
  } catch {
    return new Map();
  }
}

function matchRatio(text: string, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const normalized = text.toLocaleLowerCase();
  return tokens.filter((token) => normalized.includes(token)).length / tokens.length;
}

function freshnessScore(lastVerified: string): number {
  const verifiedAt = Date.parse(lastVerified);
  if (Number.isNaN(verifiedAt)) return 0;
  return Math.max(0, 1 - Math.max(0, (Date.now() - verifiedAt) / 86_400_000) / 365);
}

/** Deterministic hybrid search over every curated entity type. */
export function searchKnowledge(options: KnowledgeSearchOptions): KnowledgeHit[] {
  const { query, types, province, category, limit = 8 } = options;
  const tokens = queryTokens(query);
  const fts = ftsScores(query);

  const rows = getSqlite()
    .prepare("SELECT * FROM knowledge_entities")
    .all() as KnowledgeRow[];

  const scored = rows
    .filter((row) => !types || types.length === 0 || types.includes(row.entity_type as KnowledgeEntityType))
    .filter((row) => !category || row.category === category)
    .map((row) => {
      const reasons: string[] = [];
      const titleMatch = matchRatio(row.title, tokens);
      const summaryMatch = matchRatio(row.summary, tokens) * 0.6;
      const ftsScore = fts.get(row.id) ?? 0;
      const normalizedFts = ftsScore === 0 ? 0 : Math.min(1, ftsScore / 10);
      const keyword = titleMatch * 0.4 + summaryMatch * 0.25 + normalizedFts * 0.35;
      const authority = (6 - row.authority_tier) / 5;
      const freshness = freshnessScore(row.last_verified);
      const locationOk = !province || !row.province || row.province === "Pakistan" || row.province === province;

      if (titleMatch > 0) reasons.push("matched the title");
      if (ftsScore > 0) reasons.push("matched the knowledge index");
      if (row.authority_tier <= 2) reasons.push("uses an official source");
      if (locationOk && province) reasons.push(`relevant to ${province}`);

      const score = keyword + authority * 0.15 + freshness * 0.08 + (locationOk ? 0.05 : -0.15);
      return { row, score, reasons, hasRelevance: keyword > 0 };
    })
    .filter((entry) => entry.hasRelevance && entry.score > 0.08)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, Math.min(limit, 25)));

  return scored.map((entry) => rowToHit(entry.row, entry.score, entry.reasons));
}

/** Search a single entity type — used by the per-page endpoints. */
export function searchType<T>(type: KnowledgeEntityType, query: string, limit = 8): T[] {
  return searchKnowledge({ query, types: [type], limit }).map((hit) => hit.record as T);
}

export const knowledgeIndex = {
  search: searchKnowledge,
  get: getEntity,
  list,
};
