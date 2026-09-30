import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { getSessionId } from "@/lib/web/session";
import { createApplication, listApplications, progressOf, upcomingDeadlines } from "@/lib/applications/tracker";
import type { ApplicationKind, Language, Localized } from "@/lib/types";

const createSchema = z.object({
  kind: z.enum(["scholarship", "job", "internship", "admission", "training", "document", "test", "aid", "relief", "legal"]),
  title: z.object({ en: z.string().min(1), ur: z.string().optional(), ps: z.string().optional(), hkp: z.string().optional() }),
  refId: z.string().max(80).optional(),
  stages: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        title: z.object({ en: z.string().min(1), ur: z.string().optional() }),
        detail: z.object({ en: z.string().optional(), ur: z.string().optional() }).optional(),
        status: z.enum(["todo", "in_progress", "done", "blocked", "skipped"]).optional(),
        requiresDocuments: z.array(z.string()).optional(),
        dueDate: z.string().optional(),
        refType: z.enum(["opportunity", "document", "test", "service", "contact"]).optional(),
        refId: z.string().optional(),
      }),
    )
    .default([]),
  documents: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        documentType: z.string().min(1).max(60),
        label: z.object({ en: z.string().min(1), ur: z.string().optional() }),
        status: z.enum(["missing", "have", "attested", "uploaded"]).optional(),
      }),
    )
    .default([]),
  deadline: z.string().max(30).optional(),
  deadlineNote: z.string().max(500).optional(),
  feeNote: z.string().max(500).optional(),
});

export async function GET() {
  ensureDatabaseSeeded();
  const sessionId = await getSessionId();
  const language = "ur" as Language;
  const applications = listApplications(sessionId);

  return NextResponse.json({
    applications,
    progress: applications.map((application) => ({ id: application.id, ...progressOf(application) })),
    upcoming: upcomingDeadlines(sessionId).map((application) => ({
      id: application.id,
      title: application.title,
      deadline: application.deadline,
    })),
    language,
  });
}

export async function POST(request: Request) {
  ensureDatabaseSeeded();
  const parsed = createSchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "That application could not be created." }, { status: 400 });

  const sessionId = await getSessionId();
  const created = createApplication({
    sessionId,
    kind: parsed.data.kind as ApplicationKind,
    title: parsed.data.title as Localized,
    ...(parsed.data.refId ? { refId: parsed.data.refId } : {}),
    stages: parsed.data.stages.map((stage) => ({ ...stage, status: stage.status ?? "todo" })) as never,
    documents: parsed.data.documents.map((doc) => ({ ...doc, status: doc.status ?? "missing", updatedAt: new Date().toISOString() })) as never,
    ...(parsed.data.deadline ? { deadline: parsed.data.deadline } : {}),
    ...(parsed.data.deadlineNote ? { deadlineNote: parsed.data.deadlineNote } : {}),
    ...(parsed.data.feeNote ? { feeNote: parsed.data.feeNote } : {}),
  });

  return NextResponse.json({ application: created, progress: progressOf(created) }, { status: 201 });
}
