import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { detectLanguage } from "@/lib/ai/language";
import { detectSafetySignals } from "@/lib/safety/detect";
import { getOrCreateConversation, runOrchestrator } from "@/lib/ai/orchestrator";
import type { Language } from "@/lib/types";

const schema = z.object({
  message: z.string().trim().min(1).max(3000),
  conversationId: z.string().optional(),
  sessionId: z.string().optional(),
  caseId: z.string().optional(),
  language: z.enum(["en", "ur", "ps", "hkp"]).optional(),
  profile: z.record(z.string(), z.unknown()).default({}),
  stream: z.boolean().default(true),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please describe what you need." }, { status: 400 });
  }

  ensureDatabaseSeeded();

  const {
    message,
    conversationId: providedConvId,
    sessionId: providedSessionId,
    caseId,
    language: requestedLanguage,
    stream,
  } = parsed.data;

  const sessionId = providedSessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const conversationId = providedConvId || getOrCreateConversation(sessionId, caseId);
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
              `data: ${JSON.stringify({ type: "meta", conversationId, sessionId, language })}\n\n`
            )
          );

          for await (const chunk of generator) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Internal streaming error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMsg })}\n\n`)
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
        "X-Session-Id": sessionId,
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
    sessionId,
    language,
    emergency: safety.emergency,
    medical: safety.medical,
    legal: safety.legal,
    message: content,
    results: searchResults,
    relevantServiceIds,
  });
}
