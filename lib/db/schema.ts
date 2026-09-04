import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const organizations = sqliteTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    nameUr: text("name_ur").notNull(),
    type: text("type").notNull(),
    sourceUrl: text("source_url").notNull(),
    authorityTier: integer("authority_tier").notNull(),
    ...timestamps,
  },
  (table) => [index("organizations_authority_tier_idx").on(table.authorityTier)],
);

export const sources = sqliteTable(
  "sources",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    authorityTier: integer("authority_tier").notNull(),
    lastVerified: text("last_verified").notNull(),
  },
  (table) => [uniqueIndex("sources_url_idx").on(table.url)],
);

export const services = sqliteTable(
  "services",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    domain: text("domain").notNull(),
    name: text("name").notNull(),
    nameUr: text("name_ur").notNull(),
    namePs: text("name_ps").notNull(),
    description: text("description").notNull(),
    descriptionUr: text("description_ur").notNull(),
    aliases: text("aliases", { mode: "json" }).$type<string[]>().notNull(),
    coverage: text("coverage", { mode: "json" }).$type<string[]>().notNull(),
    applicationMethod: text("application_method").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceTitle: text("source_title").notNull(),
    sourceAuthorityTier: integer("source_authority_tier").notNull(),
    lastVerified: text("last_verified").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("services_domain_idx").on(table.domain),
    index("services_organization_idx").on(table.organizationId),
    index("services_active_idx").on(table.active),
  ],
);

export const eligibilityRules = sqliteTable(
  "eligibility_rules",
  {
    id: text("id").primaryKey(),
    serviceId: text("service_id").notNull(),
    field: text("field").notNull(),
    operator: text("operator").notNull(),
    value: text("value", { mode: "json" }).notNull(),
    description: text("description").notNull(),
    mandatory: integer("mandatory", { mode: "boolean" }).notNull(),
  },
  (table) => [index("eligibility_rules_service_idx").on(table.serviceId)],
);

export const requirements = sqliteTable(
  "requirements",
  {
    id: text("id").primaryKey(),
    serviceId: text("service_id").notNull(),
    type: text("type").notNull(),
    label: text("label").notNull(),
    labelUr: text("label_ur").notNull(),
    mandatory: integer("mandatory", { mode: "boolean" }).notNull(),
  },
  (table) => [index("requirements_service_idx").on(table.serviceId)],
);

export const procedureSteps = sqliteTable(
  "procedure_steps",
  {
    id: text("id").primaryKey(),
    serviceId: text("service_id").notNull(),
    stepOrder: integer("step_order").notNull(),
    title: text("title").notNull(),
    titleUr: text("title_ur").notNull(),
    description: text("description").notNull(),
    descriptionUr: text("description_ur").notNull(),
    channel: text("channel").notNull(),
    url: text("url"),
  },
  (table) => [index("procedure_steps_service_idx").on(table.serviceId)],
);

export const knowledgeChunks = sqliteTable(
  "knowledge_chunks",
  {
    id: text("id").primaryKey(),
    serviceId: text("service_id").notNull(),
    content: text("content").notNull(),
    embedding: text("embedding", { mode: "json" }).$type<number[]>(),
    language: text("language").notNull().default("en"),
    ...timestamps,
  },
  (table) => [index("knowledge_chunks_service_idx").on(table.serviceId)],
);

export const userProfiles = sqliteTable("user_profiles", {
  sessionId: text("session_id").primaryKey(),
  language: text("language").notNull().default("ur"),
  profile: text("profile", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  ...timestamps,
});

export const cases = sqliteTable(
  "cases",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    title: text("title").notNull(),
    titleUr: text("title_ur").notNull(),
    domain: text("domain").notNull(),
    summary: text("summary").notNull(),
    status: text("status").notNull(),
    serviceIds: text("service_ids", { mode: "json" }).$type<string[]>().notNull(),
    ...timestamps,
  },
  (table) => [index("cases_session_idx").on(table.sessionId)],
);

export const caseActions = sqliteTable(
  "case_actions",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id").notNull(),
    label: text("label").notNull(),
    labelUr: text("label_ur").notNull(),
    completed: integer("completed", { mode: "boolean" }).notNull().default(false),
    serviceId: text("service_id"),
  },
  (table) => [index("case_actions_case_idx").on(table.caseId)],
);

export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id").notNull(),
    documentType: text("document_type").notNull(),
    label: text("label").notNull(),
    ocrData: text("ocr_data", { mode: "json" }).$type<Record<string, string>>(),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("documents_case_idx").on(table.caseId)],
);

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    caseId: text("case_id"),
    ...timestamps,
  },
  (table) => [index("conversations_session_idx").on(table.sessionId)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    toolCalls: text("tool_calls", { mode: "json" }).$type<unknown[]>(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("messages_conversation_idx").on(table.conversationId)],
);

