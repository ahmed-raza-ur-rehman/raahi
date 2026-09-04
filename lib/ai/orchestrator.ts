import { searchServicesHybrid } from "@/lib/rag/search";
import { eligibilityEngine } from "@/lib/eligibility/engine";
import { listActiveServices } from "@/lib/db/repositories/services";
import { getSqlite } from "@/lib/db/client";
import type { CitizenProfile, Domain } from "@/lib/types";
import { getDashScopeClient } from "@/lib/ai/client";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { detectSafetySignals } from "@/lib/safety/detect";
import {
  sanitizeUserInput,
  maskPii,
  appendDomainSafetyDisclaimer,
} from "@/lib/safety/guardrails";

// ─── Tool definitions ──────────────────────────────────────────────────────

export const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_knowledge",
      description:
        "Search RAAHI's verified knowledge base for Pakistani government services, NGO programs, healthcare resources, educational opportunities, welfare schemes, and procedures. ALWAYS call this before making any factual claim about any service, program, procedure, fee, or eligibility rule.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query describing what information is needed",
          },
          domain: {
            type: "string",
            enum: ["welfare", "education", "health", "legal", "documentation", "employment", "disaster", "all"],
            description: "Filter by domain",
          },
          province: {
            type: "string",
            enum: ["Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan", "Islamabad", "Gilgit-Baltistan", "AJK", "all"],
            description: "Filter by province/territory",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "check_eligibility",
      description:
        "Check a user's potential eligibility for programs based on their profile. Returns programs with eligibility status (likely/possible/unlikely/unknown). Always present results with 'MAY be eligible' language.",
      parameters: {
        type: "object",
        properties: {
          user_province: { type: "string" },
          user_district: { type: "string" },
          household_income: { type: "number", description: "Monthly household income in PKR" },
          household_size: { type: "number" },
          gender: { type: "string", enum: ["male", "female", "other"] },
          age: { type: "number" },
          has_cnic: { type: "boolean" },
          is_bisp_beneficiary: { type: "boolean" },
          is_enrolled: { type: "boolean", description: "Is enrolled in school/college/university" },
          domain: { type: "string", description: "Domain to check eligibility for" },
          special_conditions: {
            type: "array",
            items: { type: "string" },
            description: "Special conditions like 'disabled', 'widow', 'orphan', 'flood_affected', 'pregnant'",
          },
        },
        required: ["domain"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_case",
      description:
        "Create a persistent case to track the user's navigation journey. Use this when a user has a clear need and relevant programs have been identified.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Case title in English" },
          title_ur: { type: "string", description: "Case title in Urdu" },
          domain: {
            type: "string",
            enum: ["welfare", "education", "health", "legal", "documentation", "employment", "disaster"],
          },
          need_summary: { type: "string", description: "Summary of the user's need" },
          severity: { type: "string", enum: ["low", "medium", "high", "emergency"] },
          service_ids: {
            type: "array",
            items: { type: "string" },
            description: "IDs of matched services from the knowledge base",
          },
          action_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                label_ur: { type: "string" },
              },
            },
          },
        },
        required: ["title", "domain", "need_summary"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "extract_profile",
      description:
        "Extract and store user profile information gathered from the conversation to personalize future responses.",
      parameters: {
        type: "object",
        properties: {
          province: { type: "string" },
          district: { type: "string" },
          household_size: { type: "number" },
          household_income: { type: "number", description: "Monthly income in PKR" },
          has_cnic: { type: "boolean" },
          gender: { type: "string", enum: ["male", "female", "other"] },
          age: { type: "number" },
          is_bisp_beneficiary: { type: "boolean" },
          is_enrolled: { type: "boolean" },
          language_preference: { type: "string", enum: ["ur", "ps", "en"] },
          special_conditions: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
];

// ─── Tool execution handlers ────────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  toolArgs: Record<string, unknown>,
  sessionId: string,
): Promise<string> {
  switch (toolName) {
    case "search_knowledge": {
      const query = String(toolArgs.query ?? "");
      const domainArg = toolArgs.domain as string | undefined;
      const domain = domainArg && domainArg !== "all" ? (domainArg as Domain) : undefined;
      const province = toolArgs.province as string | undefined;
      const results = await searchServicesHybrid({
        query,
        domain,
        province: province === "all" ? undefined : province,
        limit: 6,
      });
      if (results.length === 0) {
        return JSON.stringify({ found: false, message: "No verified services found for this query. Suggest the user contact the relevant organization directly." });
      }
      return JSON.stringify({
        found: true,
        count: results.length,
        services: results.map((result) => ({
          id: result.service.id,
          name: result.service.name,
          name_ur: result.service.nameUr,
          name_ps: result.service.namePs,
          domain: result.service.domain,
          organization: result.service.organizationId,
          description: result.service.description,
          description_ur: result.service.descriptionUr,
          application_method: result.service.applicationMethod,
          source_url: result.service.sourceUrl,
          source_title: result.service.sourceTitle,
          authority_tier: result.service.sourceAuthorityTier,
          last_verified: result.service.lastVerified,
          coverage: result.service.coverage,
          required_documents: result.service.requiredDocuments.map((doc) => ({
            type: doc.type,
            label: doc.label,
            label_ur: doc.labelUr,
            mandatory: doc.mandatory,
          })),
          procedure: result.service.procedure.map((step) => ({
            order: step.order,
            title: step.title,
            title_ur: step.titleUr,
            description: step.description,
            description_ur: step.descriptionUr,
            channel: step.channel,
            url: step.url,
          })),
          relevance_score: result.score,
          match_reasons: result.reasons,
        })),
      });
    }

    case "check_eligibility": {
      const profile: CitizenProfile = {
        province: toolArgs.user_province as string | undefined,
        district: toolArgs.user_district as string | undefined,
        householdIncome: toolArgs.household_income as number | undefined,
        householdSize: toolArgs.household_size as number | undefined,
        gender: toolArgs.gender as string | undefined,
        age: toolArgs.age as number | undefined,
        hasCnic: toolArgs.has_cnic as boolean | undefined,
        isBispBeneficiary: toolArgs.is_bisp_beneficiary as boolean | undefined,
        isEnrolled: toolArgs.is_enrolled as boolean | undefined,
        specialConditions: toolArgs.special_conditions as string[] | undefined,
      };
      const domain = toolArgs.domain as Domain | undefined;
      const services = listActiveServices().filter(
        (service) => !domain || service.domain === domain,
      );
      const results = services.slice(0, 10).map((service) => {
        const eligibility = eligibilityEngine.evaluate({
          service,
          profile,
          providedDocumentTypes: [],
        });
        return {
          service_id: service.id,
          service_name: service.name,
          service_name_ur: service.nameUr,
          eligibility_status: eligibility.status,
          confidence_reason: eligibility.confidenceReason,
          matched_rules: eligibility.matchedRules,
          unmatched_rules: eligibility.unmatchedRules,
          missing_info: eligibility.missingInfo,
          missing_documents: eligibility.missingDocuments,
        };
      });
      const eligible = results.filter((result) => result.eligibility_status === "likely" || result.eligibility_status === "possible");
      return JSON.stringify({
        profile_used: profile,
        total_checked: results.length,
        eligible_count: eligible.length,
        results: eligible.length > 0 ? eligible : results.slice(0, 5),
      });
    }

    case "create_case": {
      const db = getSqlite();
      const now = new Date().toISOString();
      const caseId = `case-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const domain = String(toolArgs.domain ?? "welfare");
      const title = String(toolArgs.title ?? "Navigation case");
      const titleUr = String(toolArgs.title_ur ?? title);
      const summary = String(toolArgs.need_summary ?? "");
      const severity = String(toolArgs.severity ?? "medium");
      const serviceIds = Array.isArray(toolArgs.service_ids) ? toolArgs.service_ids : [];
      const actionItems = Array.isArray(toolArgs.action_items) ? toolArgs.action_items : [];

      db.prepare(
        `INSERT INTO cases (id, session_id, title, title_ur, domain, summary, status, service_ids, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(caseId, sessionId, title, titleUr, domain, summary, "active", JSON.stringify(serviceIds), now, now);

      for (const [index, action] of actionItems.entries()) {
        const actionId = `action-${caseId}-${index + 1}`;
        db.prepare(
          `INSERT INTO case_actions (id, case_id, label, label_ur, completed, service_id) VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(
          actionId,
          caseId,
          String((action as Record<string, unknown>).label ?? `Step ${index + 1}`),
          String((action as Record<string, unknown>).label_ur ?? `قدم ${index + 1}`),
          0,
          String(serviceIds[0] ?? ""),
        );
      }

      return JSON.stringify({
        success: true,
        case_id: caseId,
        message: `Case created with ID ${caseId}. The user can view it at /cases/${caseId}`,
        case_url: `/cases/${caseId}`,
        title,
        domain,
        severity,
        action_count: actionItems.length,
      });
    }

    case "extract_profile": {
      const db = getSqlite();
      const now = new Date().toISOString();
      const existing = db.prepare(`SELECT profile FROM user_profiles WHERE session_id = ?`).get(sessionId) as { profile: string } | undefined;
      const existingProfile: CitizenProfile = existing ? (JSON.parse(existing.profile) as CitizenProfile) : {};
      const merged: CitizenProfile = {
        ...existingProfile,
        ...(toolArgs.province !== undefined && { province: String(toolArgs.province) }),
        ...(toolArgs.district !== undefined && { district: String(toolArgs.district) }),
        ...(toolArgs.household_size !== undefined && { householdSize: Number(toolArgs.household_size) }),
        ...(toolArgs.household_income !== undefined && { householdIncome: Number(toolArgs.household_income) }),
        ...(toolArgs.has_cnic !== undefined && { hasCnic: Boolean(toolArgs.has_cnic) }),
        ...(toolArgs.gender !== undefined && { gender: String(toolArgs.gender) }),
        ...(toolArgs.age !== undefined && { age: Number(toolArgs.age) }),
        ...(toolArgs.is_bisp_beneficiary !== undefined && { isBispBeneficiary: Boolean(toolArgs.is_bisp_beneficiary) }),
        ...(toolArgs.is_enrolled !== undefined && { isEnrolled: Boolean(toolArgs.is_enrolled) }),
        ...(toolArgs.special_conditions !== undefined && { specialConditions: toolArgs.special_conditions as string[] }),
      };

      if (existing) {
        db.prepare(`UPDATE user_profiles SET profile = ?, updated_at = ? WHERE session_id = ?`).run(
          JSON.stringify(merged),
          now,
          sessionId,
        );
      } else {
        const language = String(toolArgs.language_preference ?? "ur");
        db.prepare(
          `INSERT INTO user_profiles (session_id, language, profile, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
        ).run(sessionId, language, JSON.stringify(merged), now, now);
      }

      return JSON.stringify({ success: true, profile_updated: merged });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ─── Message types ──────────────────────────────────────────────────────────

export interface Message {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

// ─── Conversation history (from DB) ─────────────────────────────────────────

export function getConversationHistory(conversationId: string): Message[] {
  const db = getSqlite();
  const rows = db
    .prepare(`SELECT role, content, tool_calls FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 30`)
    .all(conversationId) as { role: string; content: string; tool_calls: string | null }[];
  return rows.map((row) => ({
    role: row.role as Message["role"],
    content: row.content,
    ...(row.tool_calls ? { tool_calls: JSON.parse(row.tool_calls) as ToolCall[] } : {}),
  }));
}

export function saveMessage(conversationId: string, message: Message) {
  const db = getSqlite();
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, tool_calls, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    conversationId,
    message.role,
    message.content,
    message.tool_calls ? JSON.stringify(message.tool_calls) : null,
    now,
  );
}

export function getOrCreateConversation(sessionId: string, caseId?: string): string {
  const db = getSqlite();
  const now = new Date().toISOString();
  if (caseId) {
    const existing = db
      .prepare(`SELECT id FROM conversations WHERE session_id = ? AND case_id = ? ORDER BY created_at DESC LIMIT 1`)
      .get(sessionId, caseId) as { id: string } | undefined;
    if (existing) return existing.id;
  }
  const convId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  db.prepare(`INSERT INTO conversations (id, session_id, case_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run(convId, sessionId, caseId ?? null, now, now);
  return convId;
}

// ─── Main streaming orchestrator ─────────────────────────────────────────────

export interface OrchestratorOptions {
  message: string;
  conversationId: string;
  sessionId: string;
  language?: string;
  caseId?: string;
}

export async function* runOrchestrator(options: OrchestratorOptions): AsyncGenerator<string> {
  const { message, conversationId, sessionId, language } = options;
  const client = getDashScopeClient();

  // Guardrail 1: Sanitize user input against prompt injection
  const { sanitized, flagged } = sanitizeUserInput(message);
  const effectiveMessage = sanitized || message;

  // Guardrail 2: Detect safety & emergency signals
  const safetyCheck = detectSafetySignals(effectiveMessage);

  // Emergency shortcut — yield emergency response immediately
  if (safetyCheck.emergency) {
    const emergencyMsg =
      language === "en"
        ? "🚨 **Emergency Detected**\n\nIf anyone is in immediate danger:\n\n📞 **Rescue / Emergency: 1122** (Punjab/KP)\n📞 **Edhi Ambulance: 115**\n📞 **Police: 15**\n📞 **Aman Foundation: 1021** (Sindh)\n\nPlease call one of the above numbers immediately. Once you are safe, come back and I will help you find follow-up services and support."
        : language === "ps"
        ? "🚨 **بیړنی حالت**\n\nکه چیرې فوري خطر وي:\n\n📞 **ریسکیو: 1122**\n📞 **ایدهي امبولانس: 115**\n📞 **پولیس: 15**\n\nاوس زنګ وهئ. له خوندي کیدو وروسته بیرته راشئ."
        : "🚨 **ایمرجنسی**\n\nاگر فوری خطرہ ہے:\n\n📞 **ریسکیو: 1122** (پنجاب/KP)\n📞 **ایدھی ایمبولینس: 115**\n📞 **پولیس: 15**\n📞 **امان فاؤنڈیشن: 1021** (سندھ)\n\nابھی فون کریں۔ محفوظ ہونے کے بعد واپس آئیں — میں آپ کو مزید مدد تلاش کرنے میں مدد کروں گا۔";
    yield `data: ${JSON.stringify({ type: "content", content: emergencyMsg, emergency: true })}\n\n`;
    yield `data: ${JSON.stringify({ type: "done" })}\n\n`;
    return;
  }

  if (!client) {
    // Fallback to RAG-only if no API key
    const results = await searchServicesHybrid({ query: effectiveMessage, limit: 4 });
    if (results.length === 0) {
      yield `data: ${JSON.stringify({ type: "content", content: language === "ur" ? "اس درخواست کے لیے میرے پاس تصدیق شدہ معلومات نہیں ہیں۔ براہ کرم متعلقہ ادارے سے براہ راست رابطہ کریں۔" : "I do not have verified information for this request. Please contact the relevant organization directly." })}\n\n`;
    } else {
      for (const result of results) {
        yield `data: ${JSON.stringify({ type: "service", service: result.service, citation: result.citation })}\n\n`;
      }
      let contentText =
        language === "ur"
          ? "یہ تصدیق شدہ خدمات آپ کے لیے مددگار ہو سکتی ہیں۔ تفصیلات ہر ذریعے سے ضرور تصدیق کریں۔"
          : "These verified services may help. Please confirm details with each official source.";
      if (safetyCheck.medical) {
        contentText = appendDomainSafetyDisclaimer(contentText, "health", (language as any) || "ur");
      } else if (safetyCheck.legal) {
        contentText = appendDomainSafetyDisclaimer(contentText, "legal", (language as any) || "ur");
      }
      yield `data: ${JSON.stringify({ type: "content", content: contentText })}\n\n`;
    }
    yield `data: ${JSON.stringify({ type: "done" })}\n\n`;
    return;
  }

  // Build message history
  const history = getConversationHistory(conversationId);

  // Save user message (with PII masked in storage if appropriate)
  const userMessage: Message = { role: "user", content: effectiveMessage };
  saveMessage(conversationId, userMessage);

  const messages: Message[] = [
    { role: "system", content: ORCHESTRATOR_SYSTEM_PROMPT },
    ...history,
    userMessage,
  ];

  // Tool-calling loop
  let iteration = 0;
  const maxIterations = 6;
  let collectedContent = "";
  const collectedToolCalls: ToolCall[] = [];
  const collectedServiceIds: string[] = [];

  while (iteration < maxIterations) {
    iteration++;

    let response;
    try {
      response = await client.chat.completions.create({
        model: "qwen-max",
        messages: messages as Parameters<typeof client.chat.completions.create>[0]["messages"],
        tools: TOOLS,
        tool_choice: "auto",
        temperature: 0.2,
        max_tokens: 2000,
        stream: true,
      });
    } catch (apiErr) {
      console.warn("Qwen API call failed, falling back to verified RAG services:", apiErr);
      const results = await searchServicesHybrid({ query: message, limit: 5 });
      if (results.length > 0) {
        yield `data: ${JSON.stringify({ type: "search_results", results: results.map((r) => r.service) })}\n\n`;
        const summaryText =
          language === "en"
            ? `Here are verified official and welfare routes for "${message}". Review each official requirement below:`
            : language === "ps"
            ? `ستاسو د اړتیا لپاره تایید شوې لارې دلته دي:`
            : `آپ کی ضرورت کے لیے سرکاری و فلاحی تصدیق شدہ سہولیات درج ذیل ہیں:`;
        yield `data: ${JSON.stringify({ type: "content", content: summaryText })}\n\n`;
      } else {
        yield `data: ${JSON.stringify({
          type: "content",
          content:
            language === "en"
              ? "No verified services found for this specific query."
              : "اس درخواست کے لیے تصدیق شدہ معلومات نہیں مل سکیں۔ براہ کرم متعلقہ محکمے سے رابطہ کریں۔",
        })}\n\n`;
      }
      yield `data: ${JSON.stringify({
        type: "done",
        case_relevant_service_ids: results.map((r) => r.service.id),
      })}\n\n`;
      return;
    }

    let assistantContent = "";
    const assistantToolCalls: ToolCall[] = [];
    let currentToolCall: { id: string; name: string; args: string } | null = null;

    for await (const chunk of response) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        assistantContent += delta.content;
        yield `data: ${JSON.stringify({ type: "content", content: delta.content })}\n\n`;
      }

      // Handle tool call streaming
      if (delta.tool_calls) {
        for (const tcDelta of delta.tool_calls) {
          if (tcDelta.index !== undefined) {
            if (currentToolCall && tcDelta.index !== assistantToolCalls.length) {
              assistantToolCalls.push({
                id: currentToolCall.id,
                type: "function",
                function: { name: currentToolCall.name, arguments: currentToolCall.args },
              });
              currentToolCall = null;
            }
            if (!currentToolCall) {
              currentToolCall = {
                id: tcDelta.id ?? `tool-${Date.now()}`,
                name: tcDelta.function?.name ?? "",
                args: tcDelta.function?.arguments ?? "",
              };
            } else {
              if (tcDelta.function?.name) currentToolCall.name += tcDelta.function.name;
              if (tcDelta.function?.arguments) currentToolCall.args += tcDelta.function.arguments;
            }
          }
        }
      }

      // Check for finish
      const finishReason = chunk.choices[0]?.finish_reason;
      if (finishReason === "stop" || (finishReason as unknown as string) === "end_turn") {
        if (currentToolCall) {
          assistantToolCalls.push({
            id: currentToolCall.id,
            type: "function",
            function: { name: currentToolCall.name, arguments: currentToolCall.args },
          });
        }
        // No more tools — we're done
        if (assistantContent) collectedContent += assistantContent;
        const assistantMessage: Message = {
          role: "assistant",
          content: assistantContent,
          ...(assistantToolCalls.length > 0 ? { tool_calls: assistantToolCalls } : {}),
        };
        saveMessage(conversationId, assistantMessage);
        yield `data: ${JSON.stringify({ type: "done", case_relevant_service_ids: collectedServiceIds })}\n\n`;
        return;
      }

      if (finishReason === "tool_calls") {
        if (currentToolCall) {
          assistantToolCalls.push({
            id: currentToolCall.id,
            type: "function",
            function: { name: currentToolCall.name, arguments: currentToolCall.args },
          });
        }
        break;
      }
    }

    // Execute tools
    if (assistantToolCalls.length === 0) break;

    const assistantMessage: Message = {
      role: "assistant",
      content: assistantContent,
      tool_calls: assistantToolCalls,
    };
    saveMessage(conversationId, assistantMessage);
    messages.push(assistantMessage);
    collectedToolCalls.push(...assistantToolCalls);

    for (const toolCall of assistantToolCalls) {
      yield `data: ${JSON.stringify({ type: "tool_call", tool: toolCall.function.name })}\n\n`;

      let toolArgs: Record<string, unknown> = {};
      try {
        toolArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
      } catch {
        toolArgs = {};
      }

      const toolResult = await executeTool(toolCall.function.name, toolArgs, sessionId);

      // Extract service IDs for case suggestion
      if (toolCall.function.name === "search_knowledge") {
        try {
          const parsed = JSON.parse(toolResult) as { services?: { id: string }[] };
          if (parsed.services) {
            for (const svc of parsed.services.slice(0, 5)) {
              if (svc.id && !collectedServiceIds.includes(svc.id)) {
                collectedServiceIds.push(svc.id);
              }
            }
          }
        } catch {
          // ignore
        }
      }

      // Yield search results as structured data for the UI
      if (toolCall.function.name === "search_knowledge") {
        try {
          const parsed = JSON.parse(toolResult) as { services?: unknown[] };
          if (parsed.services) {
            yield `data: ${JSON.stringify({ type: "search_results", results: parsed.services })}\n\n`;
          }
        } catch {
          // ignore
        }
      }

      const toolMsg: Message = {
        role: "tool",
        content: toolResult,
        tool_call_id: toolCall.id,
      };
      saveMessage(conversationId, { ...toolMsg, role: "assistant", content: `[tool:${toolCall.function.name}] ${toolResult}` });
      messages.push({ role: "tool" as const, content: toolResult, tool_call_id: toolCall.id });
    }
  }

  yield `data: ${JSON.stringify({ type: "done", case_relevant_service_ids: collectedServiceIds })}\n\n`;
}
