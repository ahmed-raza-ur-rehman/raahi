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


/* ────────────────────────────────────────────────────────────────
 * Phase 2 tables
 * ──────────────────────────────────────────────────────────────── */

export const knowledgeEntities = sqliteTable(
  "knowledge_entities",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    payload: text("payload").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceTitle: text("source_title").notNull(),
    authorityTier: integer("authority_tier").notNull(),
    lastVerified: text("last_verified").notNull(),
    country: text("country"),
    province: text("province"),
    category: text("category"),
    ...timestamps,
  },
  (table) => [
    index("knowledge_entities_type_idx").on(table.entityType),
    index("knowledge_entities_category_idx").on(table.category),
  ],
);

export const applications = sqliteTable(
  "applications",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    kind: text("kind").notNull(),
    refId: text("ref_id"),
    title: text("title").notNull(),
    status: text("status").notNull(),
    stages: text("stages", { mode: "json" }).$type<unknown[]>().notNull(),
    documents: text("documents", { mode: "json" }).$type<unknown[]>().notNull(),
    notes: text("notes", { mode: "json" }).$type<{ id: string; at: string; text: string }[]>().notNull(),
    reminders: text("reminders", { mode: "json" }).$type<unknown[]>().notNull(),
    deadline: text("deadline"),
    deadlineNote: text("deadline_note"),
    feeNote: text("fee_note"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("applications_session_idx").on(table.sessionId),
    index("applications_status_idx").on(table.status),
  ],
);

export const applicationEvents = sqliteTable(
  "application_events",
  {
    id: text("id").primaryKey(),
    applicationId: text("application_id").notNull(),
    at: text("at").notNull(),
    kind: text("kind").notNull(),
    message: text("message").notNull(),
  },
  (table) => [index("application_events_app_idx").on(table.applicationId)],
);

export const bloodRequests = sqliteTable(
  "blood_requests",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    patientName: text("patient_name").notNull(),
    bloodGroup: text("blood_group").notNull(),
    units: integer("units").notNull(),
    city: text("city").notNull(),
    hospital: text("hospital").notNull(),
    neededBy: text("needed_by").notNull(),
    contactNumber: text("contact_number").notNull(),
    notes: text("notes"),
    status: text("status").notNull(),
    ...timestamps,
  },
  (table) => [index("blood_requests_status_idx").on(table.status)],
);

export const donorRegistrations = sqliteTable(
  "donor_registrations",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    fullName: text("full_name").notNull(),
    bloodGroup: text("blood_group").notNull(),
    city: text("city").notNull(),
    phone: text("phone").notNull(),
    lastDonation: text("last_donation"),
    available: integer("available", { mode: "boolean" }).notNull().default(true),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [index("donor_registrations_group_idx").on(table.bloodGroup)],
);

export const reliefRequests = sqliteTable(
  "relief_requests",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    hazard: text("hazard").notNull(),
    district: text("district").notNull(),
    families: integer("families").notNull(),
    needs: text("needs").notNull(),
    locationNote: text("location_note"),
    contactNumber: text("contact_number").notNull(),
    status: text("status").notNull(),
    routedTo: text("routed_to").notNull(),
    ...timestamps,
  },
  (table) => [index("relief_requests_status_idx").on(table.status)],
);

export const corrections = sqliteTable(
  "corrections",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    field: text("field").notNull(),
    reportedValue: text("reported_value"),
    suggestedValue: text("suggested_value").notNull(),
    reason: text("reason"),
    evidenceUrl: text("evidence_url"),
    reporterContact: text("reporter_contact"),
    status: text("status").notNull(),
    reviewerNote: text("reviewer_note"),
    votes: integer("votes").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("corrections_entity_idx").on(table.entityType, table.entityId),
    index("corrections_status_idx").on(table.status),
  ],
);

export const webCache = sqliteTable("web_cache", {
  url: text("url").primaryKey(),
  status: integer("status").notNull(),
  title: text("title").notNull(),
  text: text("text").notNull(),
  etag: text("etag"),
  fetchedAt: text("fetched_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const webSearchCache = sqliteTable("web_search_cache", {
  queryHash: text("query_hash").primaryKey(),
  query: text("query").notNull(),
  results: text("results").notNull(),
  fetchedAt: text("fetched_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const webHostState = sqliteTable("web_host_state", {
  host: text("host").primaryKey(),
  tokens: text("tokens").notNull(),
  lastAt: integer("last_at").notNull(),
  blockedUntil: integer("blocked_until").notNull().default(0),
});

export const webRobots = sqliteTable("web_robots", {
  host: text("host").primaryKey(),
  rules: text("rules").notNull(),
  fetchedAt: text("fetched_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});
