import { NextResponse } from "next/server";
import { z } from "zod";

import { transcribeAudio } from "@/lib/ai/voice";

const schema = z.object({
  audioBase64: z.string().min(20).max(12_000_000),
  language: z.enum(["en", "ur", "ps", "hkp"]).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "No audio was received." }, { status: 400 });

  const buffer = Buffer.from(parsed.data.audioBase64, "base64");
  const result = await transcribeAudio(buffer, parsed.data.language ?? "ur");
  return NextResponse.json(result);
}
