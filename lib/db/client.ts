import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

import * as schema from "@/lib/db/schema";

let sqlite: Database.Database | undefined;

function databasePath() {
  const configuredPath = process.env.RAAHI_DB_PATH ?? "./data/raahi.db";
  return isAbsolute(configuredPath)
    ? configuredPath
    : resolve(process.cwd(), configuredPath);
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
    CREATE VIRTUAL TABLE IF NOT EXISTS service_search USING fts5(
      service_id UNINDEXED,
      content,
      tokenize='unicode61 remove_diacritics 2'
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
