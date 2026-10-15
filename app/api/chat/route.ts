import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { detectLanguage } from "@/lib/ai/language";
import { detectSafetySignals } from "@/lib/safety/detect";
import { getOrCreateConversation, runOrchestrator } from "@/lib/ai/orchestrator";
import { findCase } from "@/lib/db/repositories/cases";
import { ownedConversationId } from "@/lib/db/repositories/conversations";
import { guardLegacy, type LegacyLimit } from "@/lib/platform/legacy";
import { getLogger } from "@/lib/platform/log";
import type { Language } from "@/lib/types";
import { getSessionId } from "@/lib/web/session";

const schema = z.object({
  message: z.string().trim().min(1).max(3000),
  // Accepted for compatibility with older clients, but never trusted: see `handle`.
  conversationId: z.string().max(80).optional(),
  sessionId: z.string().max(120).optional(),
  caseId: z.string().max(80).optional(),
  language: z.enum(["en", "ur", "ps"]).optional(),
  profile: z.record(z.string().max(60), z.unknown()).default({}),
  stream: z.boolean().default(true),
});

const limits: LegacyLimit[] = [
  { policy: "chatSession", by: "session" },
  { policy: "chat", by: "ip" },
];

/**
 * The assistant. It calls a paid model, so it is rate limited per session and per address and capped in size.
 * The session cookie is the only identity: a session id, conversation id or case id in the body is honoured only
 * if it already belongs to the cookie's session, otherwise a fresh conversation is started. That closes the
 * hole where a guessable id let one visitor read or write another visitor's conversation or case.
 */
async function handle(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please describe what you need." }, { status: 400 });
  }

  ensureDatabaseSeeded();

  const {
    message,
    conversationId: requestedConversationId,
    caseId: requestedCaseId,
    language: requestedLanguage,
    stream,
  } = parsed.data;

  const sessionId = await getSessionId();
  const caseId = requestedCaseId && findCase(requestedCaseId, sessionId) ? requestedCaseId : undefined;
  const conversationId = ownedConversationId(requestedConversationId, sessionId) ?? getOrCreateConversation(sessionId, caseId);
  const detected = detectLanguage(message, requestedLanguage);
  const language: Language = requestedLanguage ?? detected;

  const wantsStream = stream || request.headers.get("accept")?.includes("text/event-stream");

  if (wantsStream) {
    const generator = runOrchestrator({
      message,
      conversationId,
      sessionId,
      language,
      caseId,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send metadata first
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "meta", conversationId, language })}\n\n`
            )
          );

          for await (const chunk of generator) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (err) {
          // The cause stays in the server log; the client only learns that this answer failed.
          getLogger().error("assistant stream failed", { error: err });
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: "Something went wrong while answering. Please try again." })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Conversation-Id": conversationId,
      },
    });
  }

  // Non-streaming fallback
  const safety = detectSafetySignals(message);
  let content = "";
  const searchResults: unknown[] = [];
  const relevantServiceIds: string[] = [];

  const generator = runOrchestrator({
    message,
    conversationId,
    sessionId,
    language,
    caseId,
  });

  for await (const rawChunk of generator) {
    const lines = rawChunk.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const parsedData = JSON.parse(line.slice(6));
          if (parsedData.type === "content") {
            content += parsedData.content;
          } else if (parsedData.type === "search_results") {
            searchResults.push(...(parsedData.results || []));
          } else if (parsedData.type === "done" && parsedData.case_relevant_service_ids) {
            relevantServiceIds.push(...parsedData.case_relevant_service_ids);
          }
        } catch {
          // skip
        }
      }
    }
  }

  return NextResponse.json({
    conversationId,
    language,
    emergency: safety.emergency,
    medical: safety.medical,
    legal: safety.legal,
    message: content,
    results: searchResults,
    relevantServiceIds,
  });
}

export const POST = guardLegacy(handle, { name: "chat", limits, maxBodyBytes: 16 * 1024 });
