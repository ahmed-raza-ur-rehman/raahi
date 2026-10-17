import { NextResponse } from "next/server";
import { z } from "zod";
import { addDocument, deleteDocument } from "@/lib/db/repositories/cases";
import { guardLegacy, type LegacyLimit } from "@/lib/platform/legacy";
import { getSessionId } from "@/lib/web/session";

type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  documentType: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(160),
  ocrData: z.record(z.string().max(60), z.string().max(500)).refine((value) => Object.keys(value).length <= 40, "too many fields").optional(),
  verified: z.boolean().optional(),
});
const ID = /^[A-Za-z0-9_-]{8,64}$/;
const limits: LegacyLimit[] = [
  { policy: "cases", by: "session" },
  { policy: "read", by: "ip" },
];

/** Documents carry OCR'd personal data, so both operations check that the case belongs to the calling session. */
export const POST = guardLegacy<Context>(
  async (request, { params }) => {
    const parsed = schema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) return NextResponse.json({ error: "Document details are required." }, { status: 400 });
    const { id } = await params;
    if (!ID.test(id)) return NextResponse.json({ error: "Case not found." }, { status: 404 });
    const document = addDocument({ ...parsed.data, caseId: id, sessionId: await getSessionId() });
    return document ? NextResponse.json({ document }, { status: 201 }) : NextResponse.json({ error: "Case not found." }, { status: 404 });
  },
  { name: "addCaseDocument", limits, maxBodyBytes: 32 * 1024 },
);

export const DELETE = guardLegacy<Context>(
  async (request, { params }) => {
    const documentId = new URL(request.url).searchParams.get("documentId");
    if (!documentId || !ID.test(documentId)) return NextResponse.json({ error: "documentId is required" }, { status: 400 });
    const { id } = await params;
    if (!ID.test(id)) return NextResponse.json({ error: "Case not found." }, { status: 404 });
    const result = deleteDocument(documentId, id, await getSessionId());
    return result.changes > 0 ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Document not found." }, { status: 404 });
  },
  { name: "deleteCaseDocument", limits },
);
