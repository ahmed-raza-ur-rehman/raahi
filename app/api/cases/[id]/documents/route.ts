import { NextResponse } from "next/server";
import { z } from "zod";
import { addDocument, deleteDocument } from "@/lib/db/repositories/cases";
import { getSessionId } from "@/lib/web/session";

const schema = z.object({
  documentType: z.string().min(1).max(80),
  label: z.string().min(1).max(160),
  ocrData: z.record(z.string(), z.string()).optional(),
  verified: z.boolean().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "Document details are required." }, { status: 400 });
  const { id } = await params;
  const sessionId = await getSessionId();
  const document = addDocument({
    ...parsed.data,
    caseId: id,
    sessionId,
  });
  return document
    ? NextResponse.json({ document }, { status: 201 })
    : NextResponse.json({ error: "Case not found." }, { status: 404 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("documentId");
  if (!documentId) return NextResponse.json({ error: "documentId is required" }, { status: 400 });
  const { id } = await params;
  deleteDocument(documentId, id);
  return NextResponse.json({ success: true });
}