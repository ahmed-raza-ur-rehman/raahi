import { randomUUID } from "node:crypto";

import type { CaseAction, CitizenCase } from "@/lib/types";
import { getSqlite } from "../client";

type CaseRow = { id: string; session_id: string; title: string; title_ur: string; domain: CitizenCase["domain"]; summary: string; status: CitizenCase["status"]; service_ids: string; created_at: string; updated_at: string };
type ActionRow = { id: string; label: string; label_ur: string; completed: number; service_id: string | null };

function hydrate(row: CaseRow): CitizenCase {
  const actions = getSqlite().prepare("SELECT id, label, label_ur, completed, service_id FROM case_actions WHERE case_id = ? ORDER BY rowid").all(row.id) as ActionRow[];
  return { id: row.id, sessionId: row.session_id, title: row.title, titleUr: row.title_ur, domain: row.domain, summary: row.summary, status: row.status, serviceIds: JSON.parse(row.service_ids) as string[], actions: actions.map((action): CaseAction => ({ id: action.id, label: action.label, labelUr: action.label_ur, completed: Boolean(action.completed), ...(action.service_id ? { serviceId: action.service_id } : {}) })), createdAt: row.created_at, updatedAt: row.updated_at };
}

export function listCases(sessionId?: string) {
  const database = getSqlite();
  if (sessionId) {
    const rows = database
      .prepare("SELECT * FROM cases WHERE session_id = ? ORDER BY updated_at DESC")
      .all(sessionId) as CaseRow[];
    if (rows.length > 0) return rows.map(hydrate);
  }
  return (
    database
      .prepare("SELECT * FROM cases ORDER BY updated_at DESC LIMIT 20")
      .all() as CaseRow[]
  ).map(hydrate);
}

export function findCase(id: string, sessionId?: string) {
  const database = getSqlite();
  if (sessionId) {
    const row = database
      .prepare("SELECT * FROM cases WHERE id = ? AND session_id = ?")
      .get(id, sessionId) as CaseRow | undefined;
    return row ? hydrate(row) : undefined;
  }
  const row = database
    .prepare("SELECT * FROM cases WHERE id = ?")
    .get(id) as CaseRow | undefined;
  return row ? hydrate(row) : undefined;
}



export function createCase(input: { sessionId: string; title: string; titleUr: string; domain: CitizenCase["domain"]; summary: string; serviceIds: string[]; actions: { label: string; labelUr: string; serviceId?: string }[] }) {
  const database = getSqlite();
  const id = randomUUID();
  const now = new Date().toISOString();
  database.transaction(() => {
    database.prepare("INSERT INTO cases (id, session_id, title, title_ur, domain, summary, status, service_ids, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)").run(id, input.sessionId, input.title, input.titleUr, input.domain, input.summary, JSON.stringify(input.serviceIds), now, now);
    const insert = database.prepare("INSERT INTO case_actions (id, case_id, label, label_ur, completed, service_id) VALUES (?, ?, ?, ?, 0, ?)");
    for (const action of input.actions) insert.run(randomUUID(), id, action.label, action.labelUr, action.serviceId ?? null);
  })();
  return findCase(id, input.sessionId)!;
}

export function updateCase(id: string, sessionId: string, input: { status?: CitizenCase["status"]; actionId?: string; completed?: boolean }) {
  const database = getSqlite();
  const existing = findCase(id, sessionId);
  if (!existing) return undefined;
  const now = new Date().toISOString();
  database.transaction(() => {
    if (input.actionId) database.prepare("UPDATE case_actions SET completed = ? WHERE id = ? AND case_id = ?").run(Number(input.completed), input.actionId, id);
    if (input.status) database.prepare("UPDATE cases SET status = ?, updated_at = ? WHERE id = ? AND session_id = ?").run(input.status, now, id, sessionId);
    else database.prepare("UPDATE cases SET updated_at = ? WHERE id = ? AND session_id = ?").run(now, id, sessionId);
  })();
  return findCase(id, sessionId);
}

export function addDocument(input: { caseId: string; sessionId: string; documentType: string; label: string; ocrData?: Record<string, string> }) {
  if (!findCase(input.caseId, input.sessionId)) return undefined;
  const id = randomUUID();
  getSqlite().prepare("INSERT INTO documents (id, case_id, document_type, label, ocr_data, verified, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)").run(id, input.caseId, input.documentType, input.label, input.ocrData ? JSON.stringify(input.ocrData) : null, new Date().toISOString());
  return { id, caseId: input.caseId, documentType: input.documentType, label: input.label, verified: false };
}