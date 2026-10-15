import { randomUUID } from "node:crypto";
import { getSqlite } from "../client";

/**
 * Conversation ownership. A conversation id alone grants nothing: history is only read or appended for the session
 * that created the conversation. Ids are unguessable (UUID v4), not timestamps.
 */
export const newConversationId = (): string => `conv-${randomUUID()}`;

const CONVERSATION_ID = /^conv-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ownsConversation(conversationId: string, sessionId: string): boolean {
  const row = getSqlite().prepare("SELECT session_id FROM conversations WHERE id = ?").get(conversationId) as { session_id: string } | undefined;
  return row?.session_id === sessionId;
}

/**
 * Make `conversationId` usable by `sessionId`: true when it already belongs to the session, or did not exist and has
 * now been created for it; false when it belongs to someone else (the caller must refuse).
 */
export function claimConversation(conversationId: string, sessionId: string, caseId?: string): boolean {
  const db = getSqlite();
  const now = new Date().toISOString();
  db.prepare("INSERT OR IGNORE INTO conversations (id, session_id, case_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(conversationId, sessionId, caseId ?? null, now, now);
  return ownsConversation(conversationId, sessionId);
}

/** The id the client asked to continue, if it is well formed and really theirs. */
export function ownedConversationId(candidate: string | undefined, sessionId: string): string | undefined {
  return candidate && CONVERSATION_ID.test(candidate) && ownsConversation(candidate, sessionId) ? candidate : undefined;
}
