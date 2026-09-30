import { getSqlite } from "./client";

import { contacts } from "@/data/contacts";
import { documentRecipes } from "@/data/documents";
import { scholarships } from "@/data/scholarships";
import { opportunities } from "@/data/opportunities";
import { tests } from "@/data/tests";
import { diseaseSignals, medicalCamps, medicalProcedures } from "@/data/health";
import { bloodBanks } from "@/data/blood";
import { disasterChannels, disasterGuides } from "@/data/disaster";
import { legalTopics } from "@/data/legal";
import { pick } from "@/lib/i18n";
import type { KnowledgeEntityType, Language, Localized } from "@/lib/types";

type Row = {
  id: string;
  entityType: KnowledgeEntityType;
  /** The full typed record, stored as JSON so the API can serve it back verbatim. */
  record: unknown;
  title: string;
  summary: string;
  text: string;
  sourceUrl: string;
  sourceTitle: string;
  tier: number;
  lastVerified: string;
  country?: string;
  province?: string;
  category?: string;
};

const ALL_LANGUAGES: Language[] = ["en", "ur", "ps", "hkp"];

/** Flatten a `Localized` value into every language it contains, for indexing. */
function localizedText(value: Localized | string | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return ALL_LANGUAGES.map((lang) => pick(value, lang)).join(" · ");
}

function many(values: (Localized | string | undefined)[] | undefined): string {
  return (values ?? []).map(localizedText).join(" · ");
}

function stepsText(steps: { title: string; titleUr: string; description: string; descriptionUr: string }[] | undefined): string {
  return (steps ?? []).map((s) => `${s.title} ${s.titleUr} ${s.description} ${s.descriptionUr}`).join(" · ");
}

/* ─────────────────── Row builders ─────────────────── */

function scholarshipRows(): Row[] {
  return [...scholarships, ...opportunities].map((record) => ({
    id: record.id,
    entityType: "opportunity" as const,
    record,
    title: localizedText(record.title),
    summary: localizedText(record.benefit),
    text: [
      localizedText(record.title),
      record.provider,
      record.providerLocal ?? "",
      record.kind,
      record.scope,
      record.country,
      record.levels.join(" "),
      record.fields.join(" "),
      localizedText(record.benefit),
      localizedText(record.applicationFee.note),
      many(record.eligibility.map((c) => c.label)),
      many(record.requiredDocuments.map((d) => `${d.label} ${d.labelUr}`)),
      stepsText(record.procedure),
      localizedText(record.deadline.note),
      record.tags.join(" "),
    ].join(" \n "),
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    tier: record.source.tier,
    lastVerified: record.source.lastVerified,
    country: record.country,
    category: record.kind,
  }));
}

function documentRows(): Row[] {
  return documentRecipes.map((record) => ({
    id: record.id,
    entityType: "document" as const,
    record,
    title: localizedText(record.name),
    summary: localizedText(record.purpose),
    text: [
      localizedText(record.name),
      record.type,
      localizedText(record.purpose),
      record.issuingAuthority,
      localizedText(record.fee.note),
      localizedText(record.processingTime),
      stepsText(record.steps),
      localizedText(record.attestation.summary),
      many(record.attestation.levels.map((l) => `${l.authority} ${localizedText(l.who)} ${localizedText(l.where)}`)),
      many(record.commonMistakes),
      record.tags.join(" "),
    ].join(" \n "),
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    tier: record.source.tier,
    lastVerified: record.source.lastVerified,
    category: record.type,
  }));
}

function testRows(): Row[] {
  return tests.map((record) => ({
    id: record.id,
    entityType: "test" as const,
    record,
    title: localizedText(record.name),
    summary: localizedText(record.purpose),
    text: [
      localizedText(record.name),
      record.shortName,
      record.conductingBody,
      record.category,
      localizedText(record.purpose),
      localizedText(record.format),
      localizedText(record.fee.note),
      many(record.eligibility),
      stepsText(record.registration),
      many(record.prep.plan.map((w) => `${localizedText(w.focus)} ${many(w.tasks)}`)),
      many(record.prep.resources.map((r) => localizedText(r.title))),
      record.tags.join(" "),
    ].join(" \n "),
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    tier: record.source.tier,
    lastVerified: record.source.lastVerified,
    category: record.category,
  }));
}

function campRows(): Row[] {
  return medicalCamps.map((record) => ({
    id: record.id,
    entityType: "camp" as const,
    record,
    title: localizedText(record.name),
    summary: many(record.services),
    text: [
      localizedText(record.name),
      record.provider,
      record.providerLocal ?? "",
      record.campTypes.join(" "),
      many(record.services),
      record.districts.join(" "),
      localizedText(record.cadence),
      localizedText(record.cost),
      record.tags.join(" "),
    ].join(" \n "),
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    tier: record.source.tier,
    lastVerified: record.source.lastVerified,
    province: record.districts.includes("Pakistan") ? undefined : record.districts[0],
    category: record.campTypes[0],
  }));
}

function diseaseRows(): Row[] {
  return diseaseSignals.map((record) => ({
    id: record.id,
    entityType: "disease" as const,
    record,
    title: localizedText(record.name),
    summary: localizedText(record.whenToSeekCare),
    text: [
      localizedText(record.name),
      record.severity,
      many(record.signs),
      localizedText(record.whenToSeekCare),
      many(record.prevention),
      record.tags.join(" "),
    ].join(" \n "),
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    tier: record.source.tier,
    lastVerified: record.source.lastVerified,
    category: record.severity,
  }));
}

function procedureRows(): Row[] {
  return medicalProcedures.map((record) => ({
    id: record.id,
    entityType: "medical_procedure" as const,
    record,
    title: localizedText(record.condition),
    summary: localizedText(record.summary),
    text: [
      localizedText(record.condition),
      localizedText(record.summary),
      stepsText(record.pathway),
      many(record.supportRoutes.map((r) => `${localizedText(r.name)} ${localizedText(r.detail)}`)),
      record.tags.join(" "),
    ].join(" \n "),
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    tier: record.source.tier,
    lastVerified: record.source.lastVerified,
  }));
}

function bloodRows(): Row[] {
  return bloodBanks.map((record) => ({
    id: record.id,
    entityType: "blood_bank" as const,
    record,
    title: localizedText(record.name),
    summary: many(record.services),
    text: [
      localizedText(record.name),
      record.city,
      record.province,
      record.type,
      many(record.services),
      record.components.join(" "),
      record.hours,
      record.tags.join(" "),
    ].join(" \n "),
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    tier: record.source.tier,
    lastVerified: record.source.lastVerified,
    province: record.province,
    category: record.type,
  }));
}

function disasterChannelRows(): Row[] {
  return disasterChannels.map((record) => ({
    id: record.id,
    entityType: "disaster_channel" as const,
    record,
    title: localizedText(record.name),
    summary: localizedText(record.whatTheyDo),
    text: [
      localizedText(record.name),
      record.authority,
      record.scope.join(" "),
      record.numbers.join(" "),
      localizedText(record.whatTheyDo),
      stepsText(record.howToRequest),
    ].join(" \n "),
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    tier: record.source.tier,
    lastVerified: record.source.lastVerified,
    province: record.scope.includes("Pakistan") ? undefined : record.scope[0],
  }));
}

function disasterGuideRows(): Row[] {
  return disasterGuides.map((record) => ({
    id: record.id,
    entityType: "disaster_guide" as const,
    record,
    title: localizedText(record.title),
    summary: many(record.kit),
    text: [
      localizedText(record.title),
      record.phase,
      record.hazard,
      stepsText(record.steps),
      many(record.kit),
      many(record.trainings.map((t) => `${localizedText(t.name)} ${t.provider} ${localizedText(t.note)}`)),
    ].join(" \n "),
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    tier: record.source.tier,
    lastVerified: record.source.lastVerified,
    category: record.hazard,
  }));
}

function legalRows(): Row[] {
  return legalTopics.map((record) => ({
    id: record.id,
    entityType: "legal_topic" as const,
    record,
    title: localizedText(record.title),
    summary: localizedText(record.summary),
    text: [
      localizedText(record.title),
      record.category,
      localizedText(record.summary),
      stepsText(record.steps),
      many(record.rights),
      many(record.documents.map((d) => `${d.label} ${d.labelUr}`)),
      many(record.authorities.map((a) => `${localizedText(a.name)} ${localizedText(a.role)}`)),
      record.tags.join(" "),
    ].join(" \n "),
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    tier: record.source.tier,
    lastVerified: record.source.lastVerified,
    category: record.category,
  }));
}

function contactRows(): Row[] {
  return contacts.map((record) => ({
    id: record.id,
    entityType: "contact" as const,
    record,
    title: localizedText(record.name),
    summary: localizedText(record.purpose),
    text: [
      localizedText(record.name),
      record.authority,
      record.category,
      record.numbers.join(" "),
      record.sms ?? "",
      record.coverage.join(" "),
      localizedText(record.purpose),
      localizedText(record.note),
    ].join(" \n "),
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    tier: record.tier,
    lastVerified: record.source.lastVerified,
    province: record.coverage.includes("Pakistan") ? undefined : record.coverage[0],
    category: record.category,
  }));
}

function allRows(): Row[] {
  return [
    ...scholarshipRows(),
    ...documentRows(),
    ...testRows(),
    ...campRows(),
    ...diseaseRows(),
    ...procedureRows(),
    ...bloodRows(),
    ...disasterChannelRows(),
    ...disasterGuideRows(),
    ...legalRows(),
    ...contactRows(),
  ];
}

export interface KnowledgeSeedSummary {
  entities: number;
  byType: Record<string, number>;
}

export function seedKnowledge(): KnowledgeSeedSummary {
  const database = getSqlite();
  const now = new Date().toISOString();
  const rows = allRows();

  const insertEntity = database.prepare(`
    INSERT INTO knowledge_entities (
      id, entity_type, title, summary, payload, source_url, source_title,
      authority_tier, last_verified, country, province, category, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSearch = database.prepare(
    "INSERT INTO knowledge_search (entity_id, entity_type, content) VALUES (?, ?, ?)",
  );

  database.transaction(() => {
    database.exec(`
      DELETE FROM knowledge_search;
      DELETE FROM knowledge_entities;
    `);

    for (const row of rows) {
      insertEntity.run(
        row.id,
        row.entityType,
        row.title,
        row.summary,
        JSON.stringify(row.record),
        row.sourceUrl,
        row.sourceTitle,
        row.tier,
        row.lastVerified,
        row.country ?? null,
        row.province ?? null,
        row.category ?? null,
        now,
        now,
      );
      insertSearch.run(row.id, row.entityType, row.text);
    }
  })();

  const byType: Record<string, number> = {};
  for (const row of rows) {
    byType[row.entityType] = (byType[row.entityType] ?? 0) + 1;
  }

  return { entities: rows.length, byType };
}

/** Seeds the unified knowledge index only when it is empty. */
export function ensureKnowledgeSeeded(): KnowledgeSeedSummary | undefined {
  const database = getSqlite();
  const row = database.prepare("SELECT COUNT(*) AS count FROM knowledge_entities").get() as { count: number };
  return row.count > 0 ? undefined : seedKnowledge();
}

/** Rebuild the search index from the stored entities (used after corrections). */
export function refreshKnowledgeIndex(): number {
  const database = getSqlite();
  const rows = database.prepare("SELECT id, entity_type FROM knowledge_entities").all() as {
    id: string;
    entity_type: string;
  }[];
  const insertSearch = database.prepare(
    "INSERT INTO knowledge_search (entity_id, entity_type, content) VALUES (?, ?, ?)",
  );
  const lookup = new Map(allRows().map((row) => [row.id, row]));

  database.transaction(() => {
    database.exec("DELETE FROM knowledge_search");
    for (const row of rows) {
      const source = lookup.get(row.id);
      if (source) insertSearch.run(row.id, row.entity_type, source.text);
    }
  })();

  return rows.length;
}
