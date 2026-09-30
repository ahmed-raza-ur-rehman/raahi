import { randomUUID } from "node:crypto";

import { getSqlite } from "@/lib/db/client";
import type { CorrectionRecord, CorrectionStatus } from "@/lib/types";

/**
 * Knowledge base corrections and review.
 *
 * Any citizen can flag a wrong fee, date, number or requirement. Reports are
 * queued with the evidence link and reviewed before the catalogue is changed —
 * RAAHI never edits verified content automatically from user input.
 */

type Row = {
  id: string;
  session_id: string;
  entity_type: string;
  entity_id: string;
  field: string;
  reported_value: string | null;
  suggested_value: string;
  reason: string | null;
  evidence_url: string | null;
  reporter_contact: string | null;
  status: string;
  reviewer_note: string | null;
  votes: number;
  created_at: string;
  updated_at: string;
};

function parse(row: Row): CorrectionRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    field: row.field,
    suggestedValue: row.suggested_value,
    status: row.status as CorrectionStatus,
    votes: row.votes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.reported_value ? { reportedValue: row.reported_value } : {}),
    ...(row.reason ? { reason: row.reason } : {}),
    ...(row.evidence_url ? { evidenceUrl: row.evidence_url } : {}),
    ...(row.reporter_contact ? { reporterContact: row.reporter_contact } : {}),
    ...(row.reviewer_note ? { reviewerNote: row.reviewer_note } : {}),
  };
}

export interface SubmitCorrectionInput {
  sessionId: string;
  entityType: string;
  entityId: string;
  field: string;
  suggestedValue: string;
  reportedValue?: string;
  reason?: string;
  evidenceUrl?: string;
  reporterContact?: string;
}

/** Reject obvious junk while keeping the barrier low for a real correction. */
export function validateCorrection(input: SubmitCorrectionInput): string | undefined {
  if (!input.entityType || !input.entityId) return "Select what the correction is about.";
  if (!input.field?.trim()) return "Tell us which part is wrong.";
  if (!input.suggestedValue?.trim() || input.suggestedValue.trim().length < 2) return "Write what it should say.";
  if (input.suggestedValue.length > 1000) return "That is too long — keep it under 1000 characters.";
  if (input.evidenceUrl && !/^https?:\/\//i.test(input.evidenceUrl)) return "The evidence link must start with http:// or https://";
  if (input.reporterContact && !/^[\d+()\-\s]{6,20}$/.test(input.reporterContact)) return "That contact number does not look right.";
  return undefined;
}

export function submitCorrection(input: SubmitCorrectionInput): CorrectionRecord {
  const now = new Date().toISOString();
  const id = `corr-${randomUUID().slice(0, 8)}`;

  getSqlite()
    .prepare(
      `INSERT INTO corrections (
        id, session_id, entity_type, entity_id, field, reported_value, suggested_value,
        reason, evidence_url, reporter_contact, status, reviewer_note, votes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, 0, ?, ?)`,
    )
    .run(
      id,
      input.sessionId,
      input.entityType,
      input.entityId,
      input.field.trim(),
      input.reportedValue ?? null,
      input.suggestedValue.trim(),
      input.reason ?? null,
      input.evidenceUrl ?? null,
      input.reporterContact ?? null,
      now,
      now,
    );

  return getCorrection(id)!;
}

export function getCorrection(id: string): CorrectionRecord | undefined {
  const row = getSqlite().prepare("SELECT * FROM corrections WHERE id = ?").get(id) as Row | undefined;
  return row ? parse(row) : undefined;
}

export function listCorrections(filter: { status?: CorrectionStatus; entityType?: string; entityId?: string } = {}): CorrectionRecord[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.status) {
    clauses.push("status = ?");
    params.push(filter.status);
  }
  if (filter.entityType) {
    clauses.push("entity_type = ?");
    params.push(filter.entityType);
  }
  if (filter.entityId) {
    clauses.push("entity_id = ?");
    params.push(filter.entityId);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = getSqlite()
    .prepare(`SELECT * FROM corrections ${where} ORDER BY created_at DESC LIMIT 200`)
    .all(...params) as Row[];
  return rows.map(parse);
}

/** Up-vote a correction — a strong signal for the review queue. */
export function voteCorrection(id: string): CorrectionRecord | undefined {
  const database = getSqlite();
  database.prepare("UPDATE corrections SET votes = votes + 1, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  return getCorrection(id);
}

export function reviewCorrection(
  id: string,
  status: Extract<CorrectionStatus, "in_review" | "accepted" | "rejected">,
  reviewerNote?: string,
): CorrectionRecord | undefined {
  const database = getSqlite();
  database
    .prepare("UPDATE corrections SET status = ?, reviewer_note = ?, updated_at = ? WHERE id = ?")
    .run(status, reviewerNote ?? null, new Date().toISOString(), id);
  return getCorrection(id);
}

export interface CorrectionStats {
  total: number;
  pending: number;
  inReview: number;
  accepted: number;
  rejected: number;
  byEntityType: Record<string, number>;
}

export function correctionStats(): CorrectionStats {
  const database = getSqlite();
  const rows = database.prepare("SELECT status, COUNT(*) AS count FROM corrections GROUP BY status").all() as {
    status: string;
    count: number;
  }[];
  const byType = database.prepare("SELECT entity_type, COUNT(*) AS count FROM corrections GROUP BY entity_type").all() as {
    entity_type: string;
    count: number;
  }[];

  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = row.count;

  return {
    total: Object.values(counts).reduce((sum, value) => sum + value, 0),
    pending: counts.pending ?? 0,
    inReview: counts.in_review ?? 0,
    accepted: counts.accepted ?? 0,
    rejected: counts.rejected ?? 0,
    byEntityType: Object.fromEntries(byType.map((row) => [row.entity_type, row.count])),
  };
}
