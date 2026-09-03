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
