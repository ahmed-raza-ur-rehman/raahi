import { NextResponse } from "next/server";
import { z } from "zod";

import { processDocument } from "@/lib/ai/ocr";

/**
 * Accepts either shape on purpose: the chat screen sends `imageBase64`, the
 * case-portal uploader sends `image`. Rejecting one of them is what pushed the
 * portal down its "pretend it worked" path.
 */
const schema = z.object({
  imageBase64: z.string().min(20).max(8_000_000).optional(),
  image: z.string().min(20).max(8_000_000).optional(),
  documentType: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) {
    return NextResponse.json({ error: "A document image is required." }, { status: 400 });
  }

  // A data URL prefix is fine for both callers.
  const raw = parsed.data.imageBase64 ?? parsed.data.image;
  if (!raw) {
    return NextResponse.json({ error: "A document image is required." }, { status: 400 });
  }

  const result = await processDocument(raw.replace(/^data:image\/\w+;base64,/, ""));

  // "Could not read it" is a normal outcome, not a server error — it must not
  // arrive as a 422 the client mistakes for "try again with a better photo"
  // when the real answer is "automatic reading is off".
  return NextResponse.json({ result });
}
