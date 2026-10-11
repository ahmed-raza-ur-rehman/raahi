import { z } from "zod";
import { errorResponse, jsonResponse } from "@/lib/opportunities/api";
import { ANSWER_KEYS, analyzeOffer, type AnswerKey } from "@/lib/opportunities/scam";

const bodySchema = z.object({
  text: z.string().max(6000).optional(),
  answers: z.object(Object.fromEntries(ANSWER_KEYS.map((key) => [key, z.boolean().optional()])) as Record<AnswerKey, z.ZodOptional<z.ZodBoolean>>).optional(),
});

/**
 * POST { text?, answers? } → red-flag analysis. The text is analysed in memory and never stored or logged,
 * because messages from agents often contain phone numbers and CNIC details.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Send JSON with the offer text and/or checklist answers.");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return errorResponse("The request is not valid.");
  const { text, answers } = parsed.data;
  if (!text?.trim() && !(answers && Object.values(answers).some(Boolean))) return errorResponse("Paste the offer text or tick at least one checklist item.");
  return jsonResponse(analyzeOffer({ text, answers }));
}
