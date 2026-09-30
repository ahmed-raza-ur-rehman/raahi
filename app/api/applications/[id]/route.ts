import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { getSessionId } from "@/lib/web/session";
import {
  addNote,
  applicationEvents,
  deleteApplication,
  deleteNote,
  getApplication,
  markStage,
  progressOf,
  reorderStages,
  updateApplication,
} from "@/lib/applications/tracker";

const patchSchema = z.object({
  action: z.enum(["update", "stage", "reorder", "note", "delete_note"]).default("update"),
  title: z.object({ en: z.string(), ur: z.string().optional() }).optional(),
  status: z
    .enum([
      "planning",
      "collecting_documents",
      "preparing",
      "ready_to_submit",
      "submitted",
      "awaiting_result",
      "accepted",
      "rejected",
      "abandoned",
    ])
    .optional(),
  deadline: z.string().max(30).nullable().optional(),
  deadlineNote: z.string().max(500).optional(),
  feeNote: z.string().max(500).optional(),
  archived: z.boolean().optional(),
  stageId: z.string().optional(),
  stageStatus: z.enum(["todo", "in_progress", "done", "blocked", "skipped"]).optional(),
  stageIds: z.array(z.string()).optional(),
  note: z.string().min(1).max(2000).optional(),
  noteId: z.string().optional(),
});

function owns(record: { sessionId: string } | undefined, sessionId: string) {
  return Boolean(record && record.sessionId === sessionId);
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  ensureDatabaseSeeded();
  const sessionId = await getSessionId();
  const { id } = await context.params;
  const application = getApplication(id);
  if (!application || !owns(application, sessionId)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({ application, progress: progressOf(application), events: applicationEvents(id) });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  ensureDatabaseSeeded();
  const sessionId = await getSessionId();
  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "That change could not be applied." }, { status: 400 });

  const existing = getApplication(id);
  if (!existing || !owns(existing, sessionId)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const data = parsed.data;
  let updated = existing;

  switch (data.action) {
    case "stage":
      if (!data.stageId || !data.stageStatus) return NextResponse.json({ error: "Missing step details." }, { status: 400 });
      updated = markStage(id, data.stageId, data.stageStatus) ?? existing;
      break;
    case "reorder":
      if (!data.stageIds) return NextResponse.json({ error: "Missing step order." }, { status: 400 });
      updated = reorderStages(id, data.stageIds) ?? existing;
      break;
    case "note":
      if (!data.note) return NextResponse.json({ error: "Write something first." }, { status: 400 });
      updated = addNote(id, data.note) ?? existing;
      break;
    case "delete_note":
      if (!data.noteId) return NextResponse.json({ error: "Missing note." }, { status: 400 });
      updated = deleteNote(id, data.noteId) ?? existing;
      break;
    default:
      updated =
        updateApplication(id, {
          ...(data.title ? { title: data.title } : {}),
          ...(data.status ? { status: data.status } : {}),
          ...(data.deadline !== undefined ? { deadline: data.deadline } : {}),
          ...(data.deadlineNote !== undefined ? { deadlineNote: data.deadlineNote } : {}),
          ...(data.feeNote !== undefined ? { feeNote: data.feeNote } : {}),
          ...(data.archived !== undefined ? { archived: data.archived } : {}),
        }) ?? existing;
  }

  return NextResponse.json({ application: updated, progress: progressOf(updated), events: applicationEvents(id) });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  ensureDatabaseSeeded();
  const sessionId = await getSessionId();
  const { id } = await context.params;
  const existing = getApplication(id);
  if (!existing || !owns(existing, sessionId)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  deleteApplication(id);
  return NextResponse.json({ deleted: true, id });
}
