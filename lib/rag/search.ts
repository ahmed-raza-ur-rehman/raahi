import type { Citation, Domain, ServiceRecord } from "@/lib/types";

import { getSqlite } from "@/lib/db/client";
import { listActiveServices } from "@/lib/db/repositories/services";

import { createDashScopeEmbedding, cosineSimilarity } from "./embeddings";

export interface SearchOptions {
  query: string;
  domain?: Domain;
  province?: string;
  limit?: number;
}

export interface SearchResult {
  service: ServiceRecord;
  citation: Citation;
  score: number;
  reasons: string[];
}

type FtsRow = { service_id: string; score: number };
type EmbeddingRow = { service_id: string; embedding: string };
type RankedResult = SearchResult & { hasRelevance: boolean };

function queryTokens(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function ftsScores(query: string) {
  const tokens = queryTokens(query);
  if (tokens.length === 0) {
    return new Map<string, number>();
  }

  const ftsQuery = tokens.map((token) => `"${token.replaceAll('"', "")}"`).join(" OR ");
  try {
    const rows = getSqlite()
      .prepare(`
        SELECT service_id, -bm25(service_search) AS score
        FROM service_search
        WHERE service_search MATCH ?
        ORDER BY bm25(service_search)
        LIMIT 100
      `)
      .all(ftsQuery) as FtsRow[];
    return new Map(rows.map((row) => [row.service_id, row.score]));
  } catch {
    return new Map<string, number>();
  }
}

function freshnessScore(lastVerified: string) {
  const verifiedAt = Date.parse(lastVerified);
  if (Number.isNaN(verifiedAt)) {
    return 0;
  }

  const ageInDays = Math.max(0, (Date.now() - verifiedAt) / 86_400_000);
  return Math.max(0, 1 - ageInDays / 365);
}

function matchScore(value: string, tokens: string[]) {
  const normalized = value.toLocaleLowerCase();
  const matched = tokens.filter((token) => normalized.includes(token));
  return tokens.length === 0 ? 0 : matched.length / tokens.length;
}

function lexicalScore(service: ServiceRecord, tokens: string[]) {
  return matchScore(
    [
      service.name,
      service.nameUr,
      service.namePs,
      service.description,
      service.descriptionUr,
      ...service.aliases,
    ].join(" "),
    tokens,
  );
}

function titleScore(service: ServiceRecord, tokens: string[]) {
  return matchScore([service.name, service.nameUr, service.namePs, ...service.aliases].join(" "), tokens);
}

function storedVectorScores(queryEmbedding: number[]) {
  const rows = getSqlite()
    .prepare("SELECT service_id, embedding FROM knowledge_chunks WHERE embedding IS NOT NULL")
    .all() as EmbeddingRow[];
  const scores = new Map<string, number>();

  for (const row of rows) {
    try {
      const embedding = JSON.parse(row.embedding) as unknown;
      if (!Array.isArray(embedding) || !embedding.every((value) => typeof value === "number" && Number.isFinite(value))) {
        continue;
      }

      const score = cosineSimilarity(queryEmbedding, embedding);
      const existingScore = scores.get(row.service_id) ?? -1;
      if (score > existingScore) {
        scores.set(row.service_id, score);
      }
    } catch {
      continue;
    }
  }

  return scores;
}

function rankServices(
  { query, domain, province, limit = 5 }: SearchOptions,
  vectorScores = new Map<string, number>(),
): SearchResult[] {
  const tokens = queryTokens(query);
  const fullTextScores = ftsScores(query);

  return listActiveServices()
    .filter((service) => !domain || service.domain === domain)
    .map((service): RankedResult => {
      const reasons: string[] = [];
      const lexical = lexicalScore(service, tokens);
      const title = titleScore(service, tokens);
      const fts = fullTextScores.get(service.id) ?? 0;
      const normalizedFts = fts === 0 ? 0 : Math.min(1, fts / 10);
      const keywordScore = title * 0.35 + lexical * 0.35 + normalizedFts * 0.3;
      const vectorScore = vectorScores.get(service.id);
      const hasTextMatch = lexical > 0 || fts > 0;
      const hasVectorMatch = vectorScore !== undefined && vectorScore >= 0.35;
      const relevance = vectorScore === undefined ? keywordScore : vectorScore * 0.7 + keywordScore * 0.3;
      const locationMatch = !province || service.coverage.includes("Pakistan") || service.coverage.includes(province);
      const authority = (6 - service.sourceAuthorityTier) / 5;
      const freshness = freshnessScore(service.lastVerified);

      if (lexical > 0) reasons.push("matched your words");
      if (fts > 0) reasons.push("matched the verified knowledge index");
      if (hasVectorMatch) reasons.push("matched the verified knowledge index semantically");
      if (province && locationMatch) reasons.push(`covers ${province}`);
      if (service.sourceAuthorityTier <= 2) reasons.push("uses an official or institutional source");

      return {
        service,
        citation: {
          sourceUrl: service.sourceUrl,
          sourceTitle: service.sourceTitle,
          authorityTier: service.sourceAuthorityTier,
          lastVerified: service.lastVerified,
        },
        score: relevance + (locationMatch ? 0.1 : -0.1) + authority * 0.12 + freshness * 0.08,
        reasons,
        hasRelevance: hasTextMatch || hasVectorMatch,
      };
    })
    .filter((result) => result.score > 0.1 && (tokens.length === 0 || result.hasRelevance))
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, Math.min(limit, 10)))
    .map(({ service, citation, score, reasons }) => ({ service, citation, score, reasons }));
}

export function searchServices(options: SearchOptions): SearchResult[] {
  return rankServices(options);
}

export async function searchServicesHybrid(options: SearchOptions): Promise<SearchResult[]> {
  if (options.query.trim().length === 0) {
    return searchServices(options);
  }

  const queryEmbedding = await createDashScopeEmbedding(options.query);
  if (!queryEmbedding) {
    return searchServices(options);
  }

  const vectorScores = storedVectorScores(queryEmbedding);
  return vectorScores.size === 0 ? searchServices(options) : rankServices(options, vectorScores);
}
