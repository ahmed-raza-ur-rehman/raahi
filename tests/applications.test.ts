import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

process.env.RAAHI_DB_PATH = join(process.cwd(), "data", "raahi.applications.test.db");

import { seedDatabase } from "@/lib/db/seed";
import {
  addNote,
  applicationEvents,
  createApplication,
  deleteApplication,
  deleteNote,
  getApplication,
  listApplications,
  markStage,
  progressOf,
  setDocumentStatus,
  upcomingDeadlines,
} from "@/lib/applications/tracker";
import type { ApplicationStage } from "@/lib/types";

seedDatabase();

const SESSION = "test-session-applications";
const OTHER_SESSION = "test-session-someone-else";

const stages: ApplicationStage[] = [
  { id: "s1", title: { en: "Collect documents", ur: "دستاویزات جمع کریں" }, status: "todo" },
  { id: "s2", title: { en: "Fill the form", ur: "فارم بھریں" }, status: "todo" },
  { id: "s3", title: { en: "Submit", ur: "جمع کروائیں" }, status: "todo" },
];

function newApplication(deadline?: string) {
  return createApplication({
    sessionId: SESSION,
    kind: "scholarship",
    title: { en: "Ehsaas Undergraduate", ur: "احساس انڈر گریجویٹ" },
    ...(deadline ? { deadline } : {}),
    stages: stages.map((stage) => ({ ...stage })),
    documents: [
      { id: "d1", documentType: "cnic", label: { en: "CNIC", ur: "شناختی کارڈ" }, status: "missing", updatedAt: new Date().toISOString() },
    ],
  });
}

test("creating an application persists it and logs the event", () => {
  const created = newApplication();

  assert.ok(created.id.startsWith("app-"));
  assert.equal(created.status, "planning");
  assert.equal(created.stages.length, 3);
  assert.equal(created.notes.length, 0);

  const fetched = getApplication(created.id);
  assert.ok(fetched, "the application must be readable back");
  assert.equal(fetched?.title.en, "Ehsaas Undergraduate");

  const events = applicationEvents(created.id);
  assert.ok(events.length > 0, "creation must be recorded in the timeline");
  assert.equal(events[0].kind, "created", "the timeline should start with creation");

  // The timeline is shown oldest-first, so the order must be chronological.
  const times = events.map((event) => Date.parse(event.at));
  assert.deepEqual(times, [...times].sort((a, b) => a - b), "events must be in order");
});

test("applications are private to the session that created them", () => {
  const mine = newApplication();
  const listed = listApplications(SESSION).map((item) => item.id);

  assert.ok(listed.includes(mine.id), "my application must appear in my list");
  assert.equal(
    listApplications(OTHER_SESSION).some((item) => item.id === mine.id),
    false,
    "another session must never see it",
  );
});

test("completing stages advances progress and points at the next step", () => {
  const created = newApplication();
  assert.equal(progressOf(created).percent, 0);

  const oneDone = markStage(created.id, "s1", "done");
  assert.ok(oneDone);
  const progress = progressOf(oneDone as NonNullable<typeof oneDone>);
  assert.equal(progress.doneStages, 1);
  assert.equal(progress.totalStages, 3);
  assert.equal(progress.percent, 33);
  assert.equal(progress.nextStage?.id, "s2", "the next outstanding step should be s2");

  const twoDone = markStage(created.id, "s2", "done");
  assert.equal(progressOf(twoDone as NonNullable<typeof twoDone>).nextStage?.id, "s3");
});

test("a skipped stage counts as progress, a blocked one does not", () => {
  const created = newApplication();

  const skipped = markStage(created.id, "s1", "skipped");
  assert.equal(progressOf(skipped as NonNullable<typeof skipped>).doneStages, 1);

  const blocked = markStage(created.id, "s2", "blocked");
  assert.equal(progressOf(blocked as NonNullable<typeof blocked>).doneStages, 1);
});

test("document readiness is tracked separately from stage progress", () => {
  const created = newApplication();
  assert.equal(progressOf(created).readyDocuments, 0);

  const have = setDocumentStatus(created.id, "d1", "have");
  assert.equal(progressOf(have as NonNullable<typeof have>).readyDocuments, 1);

  const attested = setDocumentStatus(created.id, "d1", "attested");
  assert.equal(progressOf(attested as NonNullable<typeof attested>).readyDocuments, 1);
});

test("notes can be added and removed", () => {
  const created = newApplication();

  const withNote = addNote(created.id, "Called the helpline");
  assert.ok(withNote);
  assert.equal(withNote?.notes.length, 1);

  const noteId = (withNote as NonNullable<typeof withNote>).notes[0].id;
  const without = deleteNote(created.id, noteId);
  assert.equal(without?.notes.length, 0);
});

test("deadlines are counted down and flagged when overdue", () => {
  const future = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  const upcoming = newApplication(future);
  const progress = progressOf(upcoming);

  assert.ok(progress.daysToDeadline !== undefined, "a dated application must report a countdown");
  assert.ok((progress.daysToDeadline as number) > 0);
  assert.equal(progress.overdue, false);

  const past = newApplication("2020-01-01");
  const pastProgress = progressOf(past);
  assert.equal(pastProgress.overdue, true);
});

test("upcoming deadlines surface only what is due soon", () => {
  const soon = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  const farOff = new Date(Date.now() + 400 * 86_400_000).toISOString().slice(0, 10);

  const near = newApplication(soon);
  const distant = newApplication(farOff);

  const dueSoon = upcomingDeadlines(SESSION, 30).map((item) => item.id);
  assert.ok(dueSoon.includes(near.id), "an application due in 5 days must be surfaced");
  assert.equal(dueSoon.includes(distant.id), false, "one due in 400 days must not");
});

test("deleting an application removes it for good", () => {
  const created = newApplication();
  assert.equal(deleteApplication(created.id), true);
  assert.equal(getApplication(created.id), undefined);
  assert.equal(deleteApplication(created.id), false);
});

test("unknown ids are handled without throwing", () => {
  assert.equal(getApplication("app-does-not-exist"), undefined);
  assert.equal(markStage("app-does-not-exist", "s1", "done"), undefined);
  assert.equal(addNote("app-does-not-exist", "hello"), undefined);
});
