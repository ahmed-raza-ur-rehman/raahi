import { randomUUID } from "node:crypto";

import { getSqlite } from "@/lib/db/client";
import { pick } from "@/lib/i18n";
import type {
  ApplicationDocumentState,
  ApplicationKind,
  ApplicationProgressEvent,
  ApplicationRecord,
  ApplicationStage,
  ApplicationStatus,
  Language,
  Localized,
} from "@/lib/types";

/**
 * Per-application progress tracking.
 *
 * Everything is scoped to a session id (an anonymous cookie), so a citizen owns
 * and manages their own applications: rename, reorder stages, add notes, upload
 * document photos, archive or delete — without an account.
 */

type Row = {
  id: string;
  session_id: string;
  kind: string;
  ref_id: string | null;
  title: string;
  status: string;
  stages: string;
  documents: string;
  notes: string;
  reminders: string;
  deadline: string | null;
  deadline_note: string | null;
  fee_note: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
};

function parse(row: Row): ApplicationRecord {
  const safeJson = <T>(value: string, fallback: T): T => {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  };

  return {
    id: row.id,
    sessionId: row.session_id,
    kind: row.kind as ApplicationKind,
    ...(row.ref_id ? { refId: row.ref_id } : {}),
    title: safeJson<Localized>(row.title, { en: row.title, ur: row.title }),
    status: row.status as ApplicationStatus,
    stages: safeJson<ApplicationStage[]>(row.stages, []),
    documents: safeJson<ApplicationDocumentState[]>(row.documents, []),
    notes: safeJson<ApplicationRecord["notes"]>(row.notes, []),
    reminders: safeJson<ApplicationRecord["reminders"]>(row.reminders, []),
    ...(row.deadline ? { deadline: row.deadline } : {}),
    ...(row.deadline_note ? { deadlineNote: row.deadline_note } : {}),
    ...(row.fee_note ? { feeNote: row.fee_note } : {}),
    archived: row.archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function logEvent(applicationId: string, kind: ApplicationProgressEvent["kind"], message: string) {
  const at = new Date().toISOString();
  getSqlite()
    .prepare("INSERT INTO application_events (id, application_id, at, kind, message) VALUES (?, ?, ?, ?, ?)")
    .run(`event-${randomUUID()}`, applicationId, at, kind, message);
}

export interface CreateApplicationInput {
  sessionId: string;
  kind: ApplicationKind;
  title: Localized;
  refId?: string;
  stages?: ApplicationStage[];
  documents?: ApplicationDocumentState[];
  deadline?: string;
  deadlineNote?: string;
  feeNote?: string;
  status?: ApplicationStatus;
}

export function createApplication(input: CreateApplicationInput): ApplicationRecord {
  const now = new Date().toISOString();
  const id = `app-${randomUUID().slice(0, 8)}`;
  const record: ApplicationRecord = {
    id,
    sessionId: input.sessionId,
    kind: input.kind,
    ...(input.refId ? { refId: input.refId } : {}),
    title: input.title,
    status: input.status ?? "planning",
    stages: input.stages ?? [],
    documents: input.documents ?? [],
    notes: [],
    reminders: [],
    ...(input.deadline ? { deadline: input.deadline } : {}),
    ...(input.deadlineNote ? { deadlineNote: input.deadlineNote } : {}),
    ...(input.feeNote ? { feeNote: input.feeNote } : {}),
    archived: false,
    createdAt: now,
    updatedAt: now,
  };

  getSqlite()
    .prepare(
      `INSERT INTO applications (
        id, session_id, kind, ref_id, title, status, stages, documents, notes, reminders,
        deadline, deadline_note, fee_note, archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    )
    .run(
      record.id,
      record.sessionId,
      record.kind,
      record.refId ?? null,
      JSON.stringify(record.title),
      record.status,
      JSON.stringify(record.stages),
      JSON.stringify(record.documents),
      JSON.stringify(record.notes),
      JSON.stringify(record.reminders),
      record.deadline ?? null,
      record.deadlineNote ?? null,
      record.feeNote ?? null,
      now,
      now,
    );

  logEvent(id, "created", `Started "${pick(record.title, "en")}"`);
  return record;
}

export function getApplication(id: string): ApplicationRecord | undefined {
  const row = getSqlite().prepare("SELECT * FROM applications WHERE id = ?").get(id) as Row | undefined;
  return row ? parse(row) : undefined;
}

export function listApplications(sessionId: string, includeArchived = false): ApplicationRecord[] {
  const rows = includeArchived
    ? (getSqlite().prepare("SELECT * FROM applications WHERE session_id = ? ORDER BY updated_at DESC").all(sessionId) as Row[])
    : (getSqlite().prepare("SELECT * FROM applications WHERE session_id = ? AND archived = 0 ORDER BY updated_at DESC").all(sessionId) as Row[]);
  return rows.map(parse);
}

function save(record: ApplicationRecord) {
  const now = new Date().toISOString();
  record.updatedAt = now;
  getSqlite()
    .prepare(
      `UPDATE applications SET
        kind = ?, ref_id = ?, title = ?, status = ?, stages = ?, documents = ?, notes = ?, reminders = ?,
        deadline = ?, deadline_note = ?, fee_note = ?, archived = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      record.kind,
      record.refId ?? null,
      JSON.stringify(record.title),
      record.status,
      JSON.stringify(record.stages),
      JSON.stringify(record.documents),
      JSON.stringify(record.notes),
      JSON.stringify(record.reminders),
      record.deadline ?? null,
      record.deadlineNote ?? null,
      record.feeNote ?? null,
      record.archived ? 1 : 0,
      now,
      record.id,
    );
  return record;
}

export interface UpdateApplicationInput {
  title?: Localized;
  status?: ApplicationStatus;
  stages?: ApplicationStage[];
  documents?: ApplicationDocumentState[];
  deadline?: string | null;
  deadlineNote?: string;
  feeNote?: string;
  archived?: boolean;
}

export function updateApplication(id: string, patch: UpdateApplicationInput): ApplicationRecord | undefined {
  const record = getApplication(id);
  if (!record) return undefined;

  if (patch.title) record.title = patch.title;
  if (patch.status) {
    record.status = patch.status;
    logEvent(id, "status", `Status changed to ${patch.status.replaceAll("_", " ")}`);
  }
  if (patch.stages) record.stages = patch.stages;
  if (patch.documents) record.documents = patch.documents;
  if (patch.deadline !== undefined) record.deadline = patch.deadline ?? undefined;
  if (patch.deadlineNote !== undefined) record.deadlineNote = patch.deadlineNote;
  if (patch.feeNote !== undefined) record.feeNote = patch.feeNote;
  if (patch.archived !== undefined) record.archived = patch.archived;

  return save(record);
}

export function markStage(
  id: string,
  stageId: string,
  status: ApplicationStage["status"],
): ApplicationRecord | undefined {
  const record = getApplication(id);
  if (!record) return undefined;
  const stage = record.stages.find((item) => item.id === stageId);
  if (!stage) return undefined;
  stage.status = status;
  logEvent(id, "stage", `Step "${pick(stage.title, "en")}" marked ${status.replaceAll("_", " ")}`);
  return save(record);
}

/** Reorder stages so the citizen can arrange the plan the way they think. */
export function reorderStages(id: string, stageIds: string[]): ApplicationRecord | undefined {
  const record = getApplication(id);
  if (!record) return undefined;
  const byId = new Map(record.stages.map((stage) => [stage.id, stage]));
  const reordered = stageIds.map((stageId) => byId.get(stageId)).filter((stage): stage is ApplicationStage => Boolean(stage));
  for (const stage of record.stages) {
    if (!stageIds.includes(stage.id)) reordered.push(stage);
  }
  record.stages = reordered;
  return save(record);
}

export function setDocumentStatus(
  id: string,
  documentType: string,
  status: ApplicationDocumentState["status"],
  extraction?: Record<string, string>,
): ApplicationRecord | undefined {
  const record = getApplication(id);
  if (!record) return undefined;

  const existing = record.documents.find((doc) => doc.documentType === documentType);
  const now = new Date().toISOString();
  if (existing) {
    existing.status = status;
    existing.updatedAt = now;
    if (extraction) existing.extraction = extraction;
  } else {
    record.documents.push({
      id: `doc-${randomUUID().slice(0, 6)}`,
      documentType,
      label: { en: documentType.replaceAll("_", " "), ur: documentType.replaceAll("_", " ") },
      status,
      ...(extraction ? { extraction } : {}),
      updatedAt: now,
    });
  }
  logEvent(id, "document", `${documentType.replaceAll("_", " ")} → ${status}`);
  return save(record);
}

export function addNote(id: string, text: string): ApplicationRecord | undefined {
  const record = getApplication(id);
  if (!record) return undefined;
  const at = new Date().toISOString();
  record.notes.push({ id: `note-${randomUUID().slice(0, 6)}`, at, text });
  logEvent(id, "note", text.slice(0, 120));
  return save(record);
}

export function deleteNote(id: string, noteId: string): ApplicationRecord | undefined {
  const record = getApplication(id);
  if (!record) return undefined;
  record.notes = record.notes.filter((note) => note.id !== noteId);
  return save(record);
}

export function deleteApplication(id: string): boolean {
  const database = getSqlite();
  const result = database.prepare("DELETE FROM applications WHERE id = ?").run(id);
  database.prepare("DELETE FROM application_events WHERE application_id = ?").run(id);
  return result.changes > 0;
}

export function applicationEvents(id: string): ApplicationProgressEvent[] {
  return (
    getSqlite()
      .prepare("SELECT * FROM application_events WHERE application_id = ? ORDER BY at ASC")
      .all(id) as { id: string; application_id: string; at: string; kind: string; message: string }[]
  ).map((row) => ({
    id: row.id,
    applicationId: row.application_id,
    at: row.at,
    kind: row.kind as ApplicationProgressEvent["kind"],
    message: row.message,
  }));
}

/* ────────────────────────────────────────────────────────────────
 * Derived progress
 * ──────────────────────────────────────────────────────────────── */

export interface ApplicationProgress {
  totalStages: number;
  doneStages: number;
  percent: number;
  totalDocuments: number;
  readyDocuments: number;
  nextStage?: ApplicationStage;
  daysToDeadline?: number;
  overdue: boolean;
}

export function progressOf(record: ApplicationRecord): ApplicationProgress {
  const totalStages = record.stages.length;
  const doneStages = record.stages.filter((stage) => stage.status === "done" || stage.status === "skipped").length;
  const percent = totalStages === 0 ? 0 : Math.round((doneStages / totalStages) * 100);
  const totalDocuments = record.documents.length;
  const readyDocuments = record.documents.filter((doc) => doc.status === "have" || doc.status === "attested" || doc.status === "uploaded").length;
  const nextStage = record.stages.find((stage) => stage.status !== "done" && stage.status !== "skipped");

  let daysToDeadline: number | undefined;
  let overdue = false;
  if (record.deadline) {
    const parsed = Date.parse(record.deadline);
    if (!Number.isNaN(parsed)) {
      daysToDeadline = Math.ceil((parsed - Date.now()) / 86_400_000);
      overdue = daysToDeadline < 0;
    }
  }

  return {
    totalStages,
    doneStages,
    percent,
    totalDocuments,
    readyDocuments,
    ...(nextStage ? { nextStage } : {}),
    ...(daysToDeadline !== undefined ? { daysToDeadline } : {}),
    overdue,
  };
}

/** Applications with a deadline inside the next `days` — for the reminder strip. */
export function upcomingDeadlines(sessionId: string, days = 30): ApplicationRecord[] {
  const horizon = Date.now() + days * 86_400_000;
  return listApplications(sessionId).filter((record) => {
    if (!record.deadline) return false;
    const parsed = Date.parse(record.deadline);
    return !Number.isNaN(parsed) && parsed <= horizon;
  });
}

export const STATUS_ORDER: ApplicationStatus[] = [
  "planning",
  "collecting_documents",
  "preparing",
  "ready_to_submit",
  "submitted",
  "awaiting_result",
  "accepted",
  "rejected",
  "abandoned",
];

export function statusLabel(status: ApplicationStatus, language: Language = "ur"): string {
  const labels: Record<ApplicationStatus, Localized> = {
    planning: { en: "Planning", ur: "منصوبہ بندی", ps: "پلان جوړونه" },
    collecting_documents: { en: "Collecting documents", ur: "دستاویزات جمع ہو رہے ہیں", ps: "اسناد راټولول" },
    preparing: { en: "Preparing", ur: "تیاری جاری ہے", ps: "چمتووالی" },
    ready_to_submit: { en: "Ready to submit", ur: "جمع کرانے کے لیے تیار", ps: "د سپارلو لپاره تیار" },
    submitted: { en: "Submitted", ur: "جمع کرا دیا", ps: "وسپارل شو" },
    awaiting_result: { en: "Awaiting result", ur: "نتیجے کا انتظار", ps: "د پایلې په تمه" },
    accepted: { en: "Accepted", ur: "منظور ہو گیا", ps: "ومنل شو" },
    rejected: { en: "Not selected", ur: "منتخب نہیں ہوا", ps: "ونه ټاکل شو" },
    abandoned: { en: "Paused", ur: "روک دیا", ps: "ودرول شو" },
  };
  return pick(labels[status], language);
}

export function kindLabel(kind: ApplicationKind, language: Language = "ur"): string {
  const labels: Record<ApplicationKind, Localized> = {
    scholarship: { en: "Scholarship", ur: "سکالرشپ" },
    job: { en: "Job", ur: "نوکری" },
    internship: { en: "Internship", ur: "انٹرنشپ" },
    admission: { en: "Admission", ur: "داخلہ" },
    training: { en: "Training", ur: "تربیت" },
    document: { en: "Document", ur: "دستاویز" },
    test: { en: "Test", ur: "ٹیسٹ" },
    aid: { en: "Aid", ur: "امداد" },
    relief: { en: "Relief", ur: "ریلیف" },
    legal: { en: "Legal", ur: "قانونی" },
  };
  return pick(labels[kind], language);
}
