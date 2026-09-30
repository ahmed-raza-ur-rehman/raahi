import { getDashScopeClient, isDashScopeConfigured } from "./client";
import { withProvider } from "./resilience";

export interface VisionCheck {
  ok: boolean;
  severity: "ok" | "warn" | "error";
  code: string;
  message: string;
}

export interface VisionResult {
  documentType: string;
  confidence: number;
  fields: Record<string, string>;
  checks: VisionCheck[];
  quality: { width: number; height: number; byteSize: number; readable: boolean };
  simulated: boolean;
  /** True when a CNIC-like number was found and masked before storage. */
  piiMasked: boolean;
}

const CNIC_PATTERN = /\b(\d{5})[-\s]?(\d{7})[-\s]?(\d{1})\b/;

function maskCnic(value: string) {
  return value.replace(CNIC_PATTERN, (_match, a: string, _b: string, c: string) => `${a}-XXXXXXX-${c}`);
}

/** Read width/height straight from the image header — no native dependency needed. */
function imageSize(buffer: Buffer): { width: number; height: number } {
  try {
    if (buffer.length > 24 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    // JPEG: scan segments for SOF0/SOF2
    if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset < buffer.length - 9) {
        if (buffer[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = buffer[offset + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        }
        offset += 2 + buffer.readUInt16BE(offset + 2);
      }
    }
  } catch {
    // ignore malformed headers
  }
  return { width: 0, height: 0 };
}

function qualityChecks(width: number, height: number, byteSize: number): VisionCheck[] {
  const checks: VisionCheck[] = [];
  if (width === 0 || height === 0) {
    checks.push({ ok: false, severity: "error", code: "unreadable", message: "The image could not be read. Please upload a JPG or PNG photo." });
    return checks;
  }
  if (Math.min(width, height) < 480) {
    checks.push({ ok: false, severity: "warn", code: "low_resolution", message: "The photo is small. Hold the camera closer or use a higher resolution so the text stays readable." });
  }
  if (Math.max(width, height) > 6000) {
    checks.push({ ok: true, severity: "warn", code: "very_large", message: "The photo is very large; a normal-size photo uploads faster." });
  }
  if (byteSize < 12_000) {
    checks.push({ ok: false, severity: "warn", code: "too_small_file", message: "The file is very small — details may be lost. Take the photo in good light." });
  }
  if (byteSize > 8_000_000) {
    checks.push({ ok: false, severity: "error", code: "file_too_large", message: "The file is larger than 8 MB. Please take a new photo." });
  }
  return checks;
}

const STRUCTURED_PROMPT = `You are a document-reading assistant for Pakistani citizen services.
Analyse the image and return STRICT JSON only, with this shape:
{"documentType": string, "confidence": number, "fields": {string: string}, "issues": string[]}
Rules:
- documentType must be one of: cnic, b_form, domicile, income_certificate, degree, marksheet, passport, medical_report, utility_bill, bank_statement, photograph, other.
- Mask any CNIC number so only the first five digits and the last digit remain (e.g. 12345-XXXXXXX-7).
- Report issues such as blur, cut edges, glare, missing stamp or expired document.
- Never invent a value you cannot read; use an empty string instead.`;

function parseJson(content: string): { documentType?: string; confidence?: number; fields?: Record<string, string>; issues?: string[] } | undefined {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return undefined;
  try {
    return JSON.parse(match[0]) as { documentType?: string; confidence?: number; fields?: Record<string, string>; issues?: string[] };
  } catch {
    return undefined;
  }
}

/**
 * Vision / OCR module.
 *
 * Uses Qwen-VL when a DashScope key is configured. Without a key it still
 * performs a real, useful job: decoding the image header, checking photo
 * quality, and telling the citizen exactly what to fix before they travel to an
 * office. It never pretends to have read text it has not read.
 */
export async function analyzeDocument(imageBase64: string, expectedType?: string): Promise<VisionResult> {
  const clean = imageBase64.includes(",") ? imageBase64.split(",").pop() ?? "" : imageBase64;
  const buffer = Buffer.from(clean, "base64");
  const { width, height } = imageSize(buffer);
  const checks = qualityChecks(width, height, buffer.length);
  const quality = {
    width,
    height,
    byteSize: buffer.length,
    readable: width > 0 && height > 0 && !checks.some((check) => check.severity === "error"),
  };

  if (!isDashScopeConfigured()) {
    return {
      documentType: expectedType ?? "unknown",
      confidence: 0,
      fields: {
        note: "Automatic text reading is switched off on this deployment. The checks below still tell you whether the photo is clear enough to submit.",
      },
      checks: [
        ...checks,
        {
          ok: true,
          severity: "warn",
          code: "vision_offline",
          message: "Switch on a DashScope key to enable automatic text reading. Until then, review the photo yourself against the checklist.",
        },
      ],
      quality,
      simulated: true,
      piiMasked: false,
    };
  }

  // Plan B: the offline result, which still gives the citizen a real answer
  // (whether their photo is usable) even with no model at all.
  const offline = (note: string, failed = false): VisionResult => ({
    documentType: expectedType ?? "unknown",
    confidence: 0,
    fields: { note },
    checks: [
      ...checks,
      failed
        ? { ok: false, severity: "error" as const, code: "analysis_failed", message: "The document could not be analysed. Please take a clearer photo." }
        : { ok: true, severity: "warn" as const, code: "vision_offline", message: "Automatic text reading is unavailable right now. The photo checks below are still valid." },
    ],
    quality,
    simulated: true,
    piiMasked: false,
  });

  const analysed = await withProvider<VisionResult | undefined>("dashscope-vision", {
    timeoutMs: 12_000,
    label: "vision",
    call: async () => {
      const client = getDashScopeClient();
      const response = await client?.chat.completions.create({
        model: "qwen-vl-max",
        temperature: 0,
        max_tokens: 700,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: STRUCTURED_PROMPT },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${clean}` } },
            ] as never,
          },
        ],
      });
      const content = response?.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") return undefined;
      const parsed = parseJson(content);
      if (!parsed) return undefined;

      const fields: Record<string, string> = {};
      let piiMasked = false;
      for (const [key, value] of Object.entries(parsed.fields ?? {})) {
        const text = String(value ?? "");
        const masked = maskCnic(text);
        if (masked !== text) piiMasked = true;
        fields[key] = masked;
      }
      const issues = (parsed.issues ?? []).map((issue) => ({
        ok: false,
        severity: "warn" as const,
        code: "vision_issue",
        message: String(issue),
      }));
      return {
        documentType: parsed.documentType ?? expectedType ?? "other",
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.6,
        fields,
        checks: [...checks, ...issues],
        quality,
        simulated: false,
        piiMasked,
      };
    },
    fallback: () => undefined,
  });

  if (analysed) return analysed;

  // Nothing read the document. Say so, and still hand back the photo checks —
  // knowing your photo is too dark is useful even without text extraction.
  return offline(
    "The document could not be read automatically. The photo checks below still tell you whether it is clear enough to submit.",
    true,
  );
}

/** Checklist shown next to the camera so the first photo is usable. */
// Re-exported so existing imports keep working. The definition lives in
// ./photo-checklist so the browser can use it without the model SDK.
export { PHOTO_CHECKLIST } from "./photo-checklist";
