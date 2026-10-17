import { NextResponse } from "next/server";
import { z } from "zod";
import { processDocument } from "@/lib/ai/ocr";
import { guardLegacy, type LegacyLimit } from "@/lib/platform/legacy";

// ~6 MB of image as base64. The request body is capped while streaming, before this schema ever runs.
const schema = z.object({ imageBase64: z.string().min(20).max(8_000_000) });

const limits: LegacyLimit[] = [
  { policy: "ocr", by: "session" },
  { policy: "ocr", by: "ip" },
];

/** Reads a document photo with a vision model: strictly capped and rate limited because it costs money per call. */
export const POST = guardLegacy(
  async (request) => {
    const parsed = schema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) return NextResponse.json({ error: "A document image is required." }, { status: 400 });
    try {
      return NextResponse.json({ result: await processDocument(parsed.data.imageBase64) });
    } catch {
      return NextResponse.json({ error: "The document could not be read. Please try a clearer image." }, { status: 422 });
    }
  },
  { name: "ocr", limits, maxBodyBytes: 8_600_000 },
);
