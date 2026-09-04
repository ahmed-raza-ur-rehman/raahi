import { assertCatalogIntegrity, organizations, services } from "@/data/catalog";

import { getSqlite } from "./client";

export interface SeedSummary {
  organizations: number;
  sources: number;
  services: number;
  eligibilityRules: number;
  requirements: number;
  procedureSteps: number;
  knowledgeChunks: number;
}

function sourceId(index: number) {
  return `source-${String(index).padStart(3, "0")}`;
}

export function seedDatabase(): SeedSummary {
  assertCatalogIntegrity();

  const database = getSqlite();
  const now = new Date().toISOString();
  const sourceRecords = Array.from(
    new Map(
      services.map((service) => [
        service.sourceUrl,
        {
          organizationId: service.organizationId,
          title: service.sourceTitle,
          url: service.sourceUrl,
          authorityTier: service.sourceAuthorityTier,
          lastVerified: service.lastVerified,
        },
      ]),
    ).values(),
  );

  const insertOrganization = database.prepare(`
    INSERT INTO organizations (
      id, name, name_ur, type, source_url, authority_tier, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSource = database.prepare(`
    INSERT INTO sources (id, organization_id, title, url, authority_tier, last_verified)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertService = database.prepare(`
    INSERT INTO services (
      id, organization_id, domain, name, name_ur, name_ps, description, description_ur,
      aliases, coverage, application_method, source_url, source_title,
      source_authority_tier, last_verified, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRule = database.prepare(`
    INSERT INTO eligibility_rules (id, service_id, field, operator, value, description, mandatory)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRequirement = database.prepare(`
    INSERT INTO requirements (id, service_id, type, label, label_ur, mandatory)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertProcedureStep = database.prepare(`
    INSERT INTO procedure_steps (
      id, service_id, step_order, title, title_ur, description, description_ur, channel, url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertChunk = database.prepare(`
    INSERT INTO knowledge_chunks (id, service_id, content, embedding, language, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSearchDocument = database.prepare(
    "INSERT INTO service_search (service_id, content) VALUES (?, ?)",
  );

  database.transaction(() => {
    database.exec(`
      DELETE FROM service_search;
      DELETE FROM knowledge_chunks;
      DELETE FROM procedure_steps;
      DELETE FROM requirements;
      DELETE FROM eligibility_rules;
      DELETE FROM services;
      DELETE FROM sources;
      DELETE FROM organizations;
    `);

    for (const organization of organizations) {
      insertOrganization.run(
        organization.id,
        organization.name,
        organization.nameUr,
        organization.type,
        organization.sourceUrl,
        organization.authorityTier,
        now,
        now,
      );
    }

    sourceRecords.forEach((source, index) => {
      insertSource.run(
        sourceId(index + 1),
        source.organizationId,
        source.title,
        source.url,
        source.authorityTier,
        source.lastVerified,
      );
    });

    for (const service of services) {
      insertService.run(
        service.id,
        service.organizationId,
        service.domain,
        service.name,
        service.nameUr,
        service.namePs,
        service.description,
        service.descriptionUr,
        JSON.stringify(service.aliases),
        JSON.stringify(service.coverage),
        service.applicationMethod,
        service.sourceUrl,
        service.sourceTitle,
        service.sourceAuthorityTier,
        service.lastVerified,
        Number(service.active),
        now,
        now,
      );

      for (const [index, rule] of service.eligibilityRules.entries()) {
        insertRule.run(
          `${service.id}-rule-${index + 1}`,
          service.id,
          rule.field,
          rule.operator,
          JSON.stringify(rule.value),
          rule.description,
          Number(rule.mandatory),
        );
      }

      for (const [index, requirement] of service.requiredDocuments.entries()) {
        insertRequirement.run(
          `${service.id}-requirement-${index + 1}`,
          service.id,
          requirement.type,
          requirement.label,
          requirement.labelUr,
          Number(requirement.mandatory),
        );
      }

      for (const step of service.procedure) {
        insertProcedureStep.run(
          `${service.id}-step-${step.order}`,
          service.id,
          step.order,
          step.title,
          step.titleUr,
          step.description,
          step.descriptionUr,
          step.channel,
          step.url ?? null,
        );
      }

      const content = [
        service.name,
        service.nameUr,
        service.namePs,
        ...service.aliases,
        service.description,
        service.descriptionUr,
        ...service.procedure.flatMap((step) => [step.title, step.titleUr, step.description, step.descriptionUr]),
      ].join("\n");
      insertChunk.run(`chunk-${service.id}`, service.id, content, null, "mixed", now, now);
      insertSearchDocument.run(service.id, content);
    }
  })();

  return {
    organizations: organizations.length,
    sources: sourceRecords.length,
    services: services.length,
    eligibilityRules: services.reduce((total, service) => total + service.eligibilityRules.length, 0),
    requirements: services.reduce((total, service) => total + service.requiredDocuments.length, 0),
    procedureSteps: services.reduce((total, service) => total + service.procedure.length, 0),
    knowledgeChunks: services.length,
  };
}

export function ensureDatabaseSeeded(): SeedSummary | undefined {
  const database = getSqlite();
  const row = database.prepare("SELECT COUNT(*) AS count FROM services").get() as { count: number };
  return row.count > 0 ? undefined : seedDatabase();
}
