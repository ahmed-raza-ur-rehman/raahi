import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

import * as schema from "@/lib/db/schema";

let sqlite: Database.Database | undefined;

function databasePath() {
  if (process.env.RAAHI_DB_PATH) {
    return isAbsolute(process.env.RAAHI_DB_PATH)
      ? process.env.RAAHI_DB_PATH
      : resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.RAAHI_DB_PATH);
  }
  if (process.env.VERCEL) {
    return "/tmp/raahi.db";
  }
  return resolve(/*turbopackIgnore: true*/ process.cwd(), "data", "raahi.db");
}

export function initializeDatabase(database: Database.Database) {
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_ur TEXT NOT NULL,
      type TEXT NOT NULL,
      source_url TEXT NOT NULL,
      authority_tier INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      authority_tier INTEGER NOT NULL,
      last_verified TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      domain TEXT NOT NULL,
      name TEXT NOT NULL,
      name_ur TEXT NOT NULL,
      name_ps TEXT NOT NULL,
      description TEXT NOT NULL,
      description_ur TEXT NOT NULL,
      aliases TEXT NOT NULL,
      coverage TEXT NOT NULL,
      application_method TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_title TEXT NOT NULL,
      source_authority_tier INTEGER NOT NULL,
      last_verified TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS eligibility_rules (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      field TEXT NOT NULL,
      operator TEXT NOT NULL,
      value TEXT NOT NULL,
      description TEXT NOT NULL,
      mandatory INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS requirements (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      label_ur TEXT NOT NULL,
      mandatory INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS procedure_steps (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      step_order INTEGER NOT NULL,
      title TEXT NOT NULL,
      title_ur TEXT NOT NULL,
      description TEXT NOT NULL,
      description_ur TEXT NOT NULL,
      channel TEXT NOT NULL,
      url TEXT
    );
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT,
      language TEXT NOT NULL DEFAULT 'en',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_profiles (
      session_id TEXT PRIMARY KEY,
      language TEXT NOT NULL DEFAULT 'ur',
      profile TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      title TEXT NOT NULL,
      title_ur TEXT NOT NULL,
      domain TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL,
      service_ids TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS case_actions (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      label TEXT NOT NULL,
      label_ur TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      service_id TEXT
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      document_type TEXT NOT NULL,
      label TEXT NOT NULL,
      ocr_data TEXT,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      case_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS services_domain_idx ON services(domain);
    CREATE INDEX IF NOT EXISTS services_organization_idx ON services(organization_id);
    CREATE INDEX IF NOT EXISTS services_active_idx ON services(active);
    CREATE INDEX IF NOT EXISTS eligibility_rules_service_idx ON eligibility_rules(service_id);
    CREATE INDEX IF NOT EXISTS requirements_service_idx ON requirements(service_id);
    CREATE INDEX IF NOT EXISTS procedure_steps_service_idx ON procedure_steps(service_id);
    CREATE INDEX IF NOT EXISTS knowledge_chunks_service_idx ON knowledge_chunks(service_id);
    CREATE INDEX IF NOT EXISTS cases_session_idx ON cases(session_id);
    CREATE INDEX IF NOT EXISTS case_actions_case_idx ON case_actions(case_id);
    CREATE INDEX IF NOT EXISTS documents_case_idx ON documents(case_id);
    CREATE INDEX IF NOT EXISTS conversations_session_idx ON conversations(session_id);
    CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id);
    CREATE VIRTUAL TABLE IF NOT EXISTS service_search USING fts5(
      service_id UNINDEXED,
      content,
      tokenize='unicode61 remove_diacritics 2'
    );

    /* ──────────────────────────────────────────────────────────────────────
     * Phase 2 — unified knowledge store
     *
     * Every curated record (opportunity, document recipe, test, camp,
     * disease signal, medical procedure, blood bank, disaster channel,
     * disaster guide, legal topic, contact) is stored once as JSON with a
     * flattened searchable index. This keeps the catalogue extensible without
     * a migration per entity type.
     * ────────────────────────────────────────────────────────────────────── */
    CREATE TABLE IF NOT EXISTS knowledge_entities (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      payload TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_title TEXT NOT NULL,
      authority_tier INTEGER NOT NULL,
      last_verified TEXT NOT NULL,
      country TEXT,
      province TEXT,
      category TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS knowledge_entities_type_idx ON knowledge_entities(entity_type);
    CREATE INDEX IF NOT EXISTS knowledge_entities_category_idx ON knowledge_entities(category);
    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_search USING fts5(
      entity_id UNINDEXED,
      entity_type UNINDEXED,
      content,
      tokenize='unicode61 remove_diacritics 2'
    );

    /* ── Application tracker ── */
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      ref_id TEXT,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      stages TEXT NOT NULL,
      documents TEXT NOT NULL,
      notes TEXT NOT NULL,
      reminders TEXT NOT NULL,
      deadline TEXT,
      deadline_note TEXT,
      fee_note TEXT,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS applications_session_idx ON applications(session_id);
    CREATE INDEX IF NOT EXISTS applications_status_idx ON applications(status);
    CREATE TABLE IF NOT EXISTS application_events (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      at TEXT NOT NULL,
      kind TEXT NOT NULL,
      message TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS application_events_app_idx ON application_events(application_id);

    /* ── Community services ── */
    CREATE TABLE IF NOT EXISTS blood_requests (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      blood_group TEXT NOT NULL,
      units INTEGER NOT NULL,
      city TEXT NOT NULL,
      hospital TEXT NOT NULL,
      needed_by TEXT NOT NULL,
      contact_number TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS blood_requests_status_idx ON blood_requests(status);
    CREATE TABLE IF NOT EXISTS donor_registrations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      full_name TEXT NOT NULL,
      blood_group TEXT NOT NULL,
      city TEXT NOT NULL,
      phone TEXT NOT NULL,
      last_donation TEXT,
      available INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS donor_registrations_group_idx ON donor_registrations(blood_group);
    CREATE TABLE IF NOT EXISTS relief_requests (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      hazard TEXT NOT NULL,
      district TEXT NOT NULL,
      families INTEGER NOT NULL,
      needs TEXT NOT NULL,
      location_note TEXT,
      contact_number TEXT NOT NULL,
      status TEXT NOT NULL,
      routed_to TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS relief_requests_status_idx ON relief_requests(status);

    /* ── Knowledge quality ── */
    CREATE TABLE IF NOT EXISTS corrections (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      field TEXT NOT NULL,
      reported_value TEXT,
      suggested_value TEXT NOT NULL,
      reason TEXT,
      evidence_url TEXT,
      reporter_contact TEXT,
      status TEXT NOT NULL,
      reviewer_note TEXT,
      votes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS corrections_entity_idx ON corrections(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS corrections_status_idx ON corrections(status);

    /* ── Web search / scraping governance (rate limiting, caching, robots) ── */
    CREATE TABLE IF NOT EXISTS web_cache (
      url TEXT PRIMARY KEY,
      status INTEGER NOT NULL,
      title TEXT NOT NULL,
      text TEXT NOT NULL,
      etag TEXT,
      fetched_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS web_search_cache (
      query_hash TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      results TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS web_host_state (
      host TEXT PRIMARY KEY,
      tokens REAL NOT NULL,
      last_at INTEGER NOT NULL,
      blocked_until INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS web_robots (
      host TEXT PRIMARY KEY,
      rules TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);
}

export function getSqlite() {
  if (!sqlite) {
    const path = databasePath();
    mkdirSync(dirname(path), { recursive: true });
    sqlite = new Database(path);
    initializeDatabase(sqlite);
  }

  return sqlite;
}

export function getDb() {
  return drizzle(getSqlite(), { schema });
}
