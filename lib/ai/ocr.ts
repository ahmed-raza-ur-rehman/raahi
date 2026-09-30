import { maskPii } from "@/lib/safety/guardrails";

import { getDashScopeClient } from "./client";
import { withProvider } from "./resilience";

export interface OcrResult {
  documentType: string;
  confidence: number;
  fields: Record<string, string>;
  /**
   * True when a real model read the document. False when automatic reading is
   * unavailable — in which case `fields` is intentionally EMPTY.
   *
   * Raahi must never invent a field value. A blank the visitor fills in
   * themselves is honest; a plausible-looking "XXXXX-XXXXXXX-X" printed as if
   * it came off their CNIC is not.
   */
  available: boolean;
  /** Why automatic reading was unavailable, when it was. */
  note?: string;
}

const UNAVAILABLE_NOTE =
  "Automatic document reading is not switched on right now. Please type the details yourself, and check them against the document.";

function unavailable(note: string = UNAVAILABLE_NOTE): OcrResult {
  return { documentType: "unknown", confidence: 0, fields: {}, available: false, note };
}

/**
 * Mask CNICs and phone numbers in whatever the model returned.
 *
 * The prompt already asks the model to mask, but a prompt is a request and
 * this is a guarantee: IDs are masked before they are stored or shown.
 */
function maskFields(fields: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    masked[key] = typeof value === "string" ? maskPii(value) : String(value);
  }
  return masked;
}

export async function processDocument(imageBase64: string): Promise<OcrResult> {
  const client = getDashScopeClient();
  if (!client) return unavailable();

  const content = await withProvider<string | undefined>("dashscope-vision", {
    timeoutMs: 12_000,
    label: "ocr",
    call: async () => {
      const response = await client.chat.completions.create({
        model: "qwen-vl-max",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this Pakistani document. Return JSON only with documentType, confidence, and fields. Mask any CNIC number except the first five and last digit.",
              },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
      });
      return response.choices[0]?.message.content ?? undefined;
    },
    // Any provider error, timeout or malformed response: say so, never guess.
    fallback: () => undefined,
  });

  if (!content || typeof content !== "string") {
    return unavailable("The document could not be read automatically. Please type the details yourself.");
  }

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const rawJson = jsonMatch ? jsonMatch[0] : content.replace(/^```(?:json)?\s*|```$/g, "");
    const parsed = JSON.parse(rawJson) as Partial<OcrResult>;

    const fields = parsed.fields ?? {};
    if (Object.keys(fields).length === 0) {
      return unavailable("No details could be read from that image. Please type them yourself.");
    }

    return {
      documentType: parsed.documentType ?? "identity_document",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.6,
      fields: maskFields(fields),
      available: true,
    };
  } catch {
    return unavailable("The document could not be read automatically. Please type the details yourself.");
  }
}
