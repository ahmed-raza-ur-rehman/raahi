import { randomUUID } from "node:crypto";
import type {
  EligibilityRule,
  ProcedureStep,
  ServiceRecord,
} from "@/lib/types";

import { getSqlite } from "../client";

type ServiceRow = {
  id: string;
  organization_id: string;
  domain: ServiceRecord["domain"];
  name: string;
  name_ur: string;
  name_ps: string;
  description: string;
  description_ur: string;
  aliases: string;
  coverage: string;
  application_method: ServiceRecord["applicationMethod"];
  source_url: string;
  source_title: string;
  source_authority_tier: number;
  last_verified: string;
  active: number;
};

type RuleRow = {
  field: EligibilityRule["field"];
  operator: EligibilityRule["operator"];
  value: string;
  description: string;
  mandatory: number;
};

type RequirementRow = {
  type: string;
  label: string;
  label_ur: string;
  mandatory: number;
};

type ProcedureRow = {
  step_order: number;
  title: string;
  title_ur: string;
  description: string;
  description_ur: string;
  channel: ProcedureStep["channel"];
  url: string | null;
};

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function hydrateService(row: ServiceRow): ServiceRecord {
  const database = getSqlite();
  const rules = database
    .prepare("SELECT field, operator, value, description, mandatory FROM eligibility_rules WHERE service_id = ?")
    .all(row.id) as RuleRow[];
  const requiredDocuments = database
    .prepare("SELECT type, label, label_ur, mandatory FROM requirements WHERE service_id = ?")
    .all(row.id) as RequirementRow[];
  const procedure = database
    .prepare(`
      SELECT step_order, title, title_ur, description, description_ur, channel, url
      FROM procedure_steps WHERE service_id = ? ORDER BY step_order
    `)
    .all(row.id) as ProcedureRow[];

  return {
    id: row.id,
    organizationId: row.organization_id,
    domain: row.domain,
    name: row.name,
    nameUr: row.name_ur,
    namePs: row.name_ps,
    description: row.description,
    descriptionUr: row.description_ur,
    aliases: parseJson<string[]>(row.aliases),
    coverage: parseJson<string[]>(row.coverage),
    applicationMethod: row.application_method,
    sourceUrl: row.source_url,
    sourceTitle: row.source_title,
    sourceAuthorityTier: row.source_authority_tier,
    lastVerified: row.last_verified,
    active: Boolean(row.active),
    eligibilityRules: rules.map((rule) => ({
      field: rule.field,
      operator: rule.operator,
      value: parseJson<EligibilityRule["value"]>(rule.value),
      description: rule.description,
      mandatory: Boolean(rule.mandatory),
    })),
    requiredDocuments: requiredDocuments.map((requirement) => ({
      type: requirement.type,
      label: requirement.label,
      labelUr: requirement.label_ur,
      mandatory: Boolean(requirement.mandatory),
    })),
    procedure: procedure.map((step) => ({
      order: step.step_order,
      title: step.title,
      titleUr: step.title_ur,
      description: step.description,
      descriptionUr: step.description_ur,
      channel: step.channel,
      ...(step.url ? { url: step.url } : {}),
    })),
  };
}

export function listActiveServices(): ServiceRecord[] {
  const rows = getSqlite()
    .prepare("SELECT * FROM services WHERE active = 1 ORDER BY name")
    .all() as ServiceRow[];

  return rows.map(hydrateService);
}

export function findServiceById(id: string): ServiceRecord | undefined {
  const row = getSqlite()
    .prepare("SELECT * FROM services WHERE id = ? AND active = 1")
    .get(id) as ServiceRow | undefined;

  return row ? hydrateService(row) : undefined;
}

export function listOrganizations() {
  const rows = getSqlite()
    .prepare("SELECT id, name, name_ur, type, source_url, authority_tier FROM organizations ORDER BY name")
    .all() as { id: string; name: string; name_ur: string; type: string; source_url: string; authority_tier: number }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    nameUr: r.name_ur,
    type: r.type as "government" | "ngo" | "hospital",
    sourceUrl: r.source_url,
    authorityTier: r.authority_tier,
  }));
}

export function createOrganization(org: {
  id: string;
  name: string;
  nameUr: string;
  type: "government" | "ngo" | "hospital";
  sourceUrl: string;
  authorityTier: number;
}) {
  const db = getSqlite();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO organizations (id, name, name_ur, type, source_url, authority_tier, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(org.id, org.name, org.nameUr, org.type, org.sourceUrl, org.authorityTier, now, now);
  return org;
}

export function createService(service: ServiceRecord) {
  const db = getSqlite();
  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare(`
      INSERT OR REPLACE INTO services (id, organization_id, domain, name, name_ur, name_ps, description, description_ur, aliases, coverage, application_method, source_url, source_title, source_authority_tier, last_verified, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      service.id,
      service.organizationId,
      service.domain,
      service.name,
      service.nameUr,
      service.namePs || service.nameUr,
      service.description,
      service.descriptionUr,
      JSON.stringify(service.aliases || []),
      JSON.stringify(service.coverage || ["Pakistan"]),
      service.applicationMethod,
      service.sourceUrl,
      service.sourceTitle,
      service.sourceAuthorityTier,
      service.lastVerified,
      service.active ? 1 : 0,
      now,
      now
    );

    try {
      db.prepare(`
        INSERT OR REPLACE INTO knowledge_chunks (id, service_id, content, language, created_at, updated_at)
        VALUES (?, ?, ?, 'en', ?, ?)
      `).run(`chunk-${service.id}`, service.id, `${service.name} ${service.nameUr} ${service.description} ${service.descriptionUr}`, now, now);
    } catch {
      // Ignore
    }

    if (service.eligibilityRules?.length) {
      const insertRule = db.prepare(`
        INSERT OR REPLACE INTO eligibility_rules (id, service_id, field, operator, value, description, mandatory)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (let i = 0; i < service.eligibilityRules.length; i++) {
        const r = service.eligibilityRules[i];
        insertRule.run(`rule-${service.id}-${i}`, service.id, r.field, r.operator, JSON.stringify(r.value), r.description, r.mandatory ? 1 : 0);
      }
    }

    if (service.requiredDocuments?.length) {
      const insertReq = db.prepare(`
        INSERT OR REPLACE INTO requirements (id, service_id, type, label, label_ur, mandatory)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (let i = 0; i < service.requiredDocuments.length; i++) {
        const req = service.requiredDocuments[i];
        insertReq.run(`req-${service.id}-${i}`, service.id, req.type, req.label, req.labelUr, req.mandatory ? 1 : 0);
      }
    }

    if (service.procedure?.length) {
      const insertStep = db.prepare(`
        INSERT OR REPLACE INTO procedure_steps (id, service_id, step_order, title, title_ur, description, description_ur, channel, url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const step of service.procedure) {
        insertStep.run(`step-${service.id}-${step.order}`, service.id, step.order, step.title, step.titleUr, step.description, step.descriptionUr, step.channel, step.url || null);
      }
    }
  })();

  return findServiceById(service.id)!;
}

// ─── Partner submissions (moderated) ─────────────────────────────────────────

/**
 * Anyone may SUBMIT a service through the partner portal; nobody may publish one without review. A submission is
 * stored inactive, at the lowest authority tier, under a server-generated id (so it can never overwrite an existing
 * service), and only an administrator can approve it. See docs/security/threat-model.md (T-03).
 */
export const SUBMISSION_PREFIX = "submission-";
export const MAX_PENDING_SUBMISSIONS = 200;
export const UNVERIFIED_TIER = 5;

export function pendingSubmissionCount(): number {
  const row = getSqlite().prepare("SELECT COUNT(*) AS n FROM services WHERE active = 0 AND id LIKE ?").get(`${SUBMISSION_PREFIX}%`) as { n: number };
  return row.n;
}

/** Store a submission for review. Returns its id, or undefined when the review queue is full. */
export function submitService(input: Omit<ServiceRecord, "id" | "active" | "sourceAuthorityTier">): string | undefined {
  if (pendingSubmissionCount() >= MAX_PENDING_SUBMISSIONS) return undefined;
  const id = `${SUBMISSION_PREFIX}${randomUUID()}`;
  createService({ ...input, id, active: false, sourceAuthorityTier: UNVERIFIED_TIER } as ServiceRecord);
  return id;
}

export interface SubmissionSummary {
  id: string;
  name: string;
  nameUr: string;
  organizationId: string;
  domain: string;
  sourceUrl: string;
  sourceTitle: string;
  description: string;
  submittedAt: string;
}

export function listSubmissions(): SubmissionSummary[] {
  const rows = getSqlite()
    .prepare("SELECT id, name, name_ur, organization_id, domain, source_url, source_title, description, created_at FROM services WHERE active = 0 AND id LIKE ? ORDER BY created_at ASC")
    .all(`${SUBMISSION_PREFIX}%`) as Array<{ id: string; name: string; name_ur: string; organization_id: string; domain: string; source_url: string; source_title: string; description: string; created_at: string }>;
  return rows.map((row) => ({ id: row.id, name: row.name, nameUr: row.name_ur, organizationId: row.organization_id, domain: row.domain, sourceUrl: row.source_url, sourceTitle: row.source_title, description: row.description.slice(0, 400), submittedAt: row.created_at }));
}

/** Publish a pending submission at the authority tier the reviewer decides (1 = government ... 4). */
export function approveSubmission(id: string, authorityTier: number, today: string = new Date().toISOString().slice(0, 10)): boolean {
  const db = getSqlite();
  const now = new Date().toISOString();
  const result = db
    .prepare("UPDATE services SET active = 1, source_authority_tier = ?, last_verified = ?, updated_at = ? WHERE id = ? AND id LIKE ? AND active = 0")
    .run(Math.min(4, Math.max(1, Math.trunc(authorityTier))), today, now, id, `${SUBMISSION_PREFIX}%`);
  if (result.changes === 0) return false;
  try {
    const row = db.prepare("SELECT name, name_ur, description, description_ur FROM services WHERE id = ?").get(id) as { name: string; name_ur: string; description: string; description_ur: string };
    db.prepare("INSERT INTO service_search (service_id, content) VALUES (?, ?)").run(id, `${row.name} ${row.name_ur} ${row.description} ${row.description_ur}`);
  } catch {
    // Search indexing is best effort; the service is published either way.
  }
  return true;
}

/** Discard a pending submission and everything stored with it. */
export function rejectSubmission(id: string): boolean {
  const db = getSqlite();
  return db.transaction(() => {
    const exists = db.prepare("SELECT 1 FROM services WHERE id = ? AND id LIKE ? AND active = 0").get(id, `${SUBMISSION_PREFIX}%`);
    if (!exists) return false;
    for (const table of ["eligibility_rules", "requirements", "procedure_steps", "knowledge_chunks"]) db.prepare(`DELETE FROM ${table} WHERE service_id = ?`).run(id);
    db.prepare("DELETE FROM services WHERE id = ?").run(id);
    return true;
  })();
}
