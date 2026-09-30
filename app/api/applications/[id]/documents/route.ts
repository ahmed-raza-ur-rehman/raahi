import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { getSessionId } from "@/lib/web/session";
import { getApplication, progressOf, setDocumentStatus } from "@/lib/applications/tracker";
import { analyzeDocument } from "@/lib/ai/vision";

const schema = z.object({
  documentType: z.string().min(1).max(60),
  status: z.enum(["missing", "have", "attested", "uploaded"]),
  /** Optional camera photo of the document, analysed before it is marked ready. */
  imageBase64: z.string().min(20).max(8_000_000).optional(),
  expectedType: z.string().max(60).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  ensureDatabaseSeeded();
  const sessionId = await getSessionId();
  const { id } = await context.params;
  const application = getApplication(id);
  if (!application || application.sessionId !== sessionId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "That document update could not be read." }, { status: 400 });

  let extraction: Record<string, string> | undefined;
  let vision: Awaited<ReturnType<typeof analyzeDocument>> | undefined;

  if (parsed.data.imageBase64) {
    vision = await analyzeDocument(parsed.data.imageBase64, parsed.data.expectedType ?? parsed.data.documentType);
    extraction = { ...vision.fields, checks: vision.checks.map((check) => `${check.severity}:${check.code}`).join(",") };
  }

  const updated = setDocumentStatus(id, parsed.data.documentType, parsed.data.status, extraction);
  if (!updated) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({
    application: updated,
    progress: progressOf(updated),
    ...(vision ? { vision } : {}),
  });
}
