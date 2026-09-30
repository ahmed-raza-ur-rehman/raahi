"use client";

import { useSearchParams } from "next/navigation";
import React, { Suspense, useState } from "react";

import { useLanguage } from "@/components/shell/LanguageProvider";
import { Badge, Button, Card, Empty, Field, Loader, ProgressBar, Section, inputClass } from "@/components/shell/Ui";
import { apiPost, useApi } from "@/lib/client/useApi";
import { PhotoCapture } from "@/components/shell/PhotoCapture";
import type { ApplicationKind, ApplicationRecord, ApplicationStage, DocumentStateValue } from "@/lib/types";

interface ApplicationsPayload {
  applications: ApplicationRecord[];
  progress: { id: string; percent: number; doneStages: number; totalStages: number; daysToDeadline?: number; overdue: boolean }[];
}

const KINDS: ApplicationKind[] = ["scholarship", "job", "internship", "admission", "training", "document", "test", "aid"];

function TrackPageInner() {
  const { t, L, language } = useLanguage();
  const params = useSearchParams();
  const focus = params.get("focus");
  const state = useApi<ApplicationsPayload>("/api/applications");
  // `null` = follow the deep-linked ?focus id; a string/undefined = the user has
  // explicitly opened or collapsed one. Derived rather than synced in an effect.
  const [override, setOverride] = useState<string | undefined | null>(null);
  const [creating, setCreating] = useState(false);
  const selected = override === null ? (focus ?? undefined) : override;

  const applications = state.data?.applications ?? [];
  const progressFor = (id: string) => state.data?.progress.find((entry) => entry.id === id);

  return (
    <div>
      <Section
        title={t("myApplications")}
        subtitle={language === "en" ? "Everything you are working on, saved on this phone" : "آپ جس پر کام کر رہے ہیں، سب اس فون پر محفوظ"}
        action={
          <Button size="sm" variant="secondary" onClick={() => setCreating(!creating)}>
            {creating ? (language === "en" ? "Close" : "بند") : `➕ ${t("addApplication")}`}
          </Button>
        }
      >
        {creating ? (
          <CreateForm
            onCreated={(id) => {
              setCreating(false);
              setOverride(id);
              state.reload();
            }}
          />
        ) : null}
      </Section>

      {state.loading ? (
        <Loader />
      ) : applications.length === 0 ? (
        <Empty>
          <p>{t("noApplications")}</p>
          <p className="mt-1 text-[11px]">
            {language === "en"
              ? "Open a scholarship or document and press “Start application”."
              : "کوئی سکالرشپ یا دستاویز کھولیں اور «درخواست شروع کریں» دبائیں۔"}
          </p>
        </Empty>
      ) : (
        <div className="space-y-2.5">
          {applications.map((application) => {
            const progress = progressFor(application.id);;
            return (
              <Card key={application.id} className={selected === application.id ? "border-[var(--forest)]" : ""}>
                <button type="button" className="w-full text-start" onClick={() => setOverride(selected === application.id ? undefined : application.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-extrabold leading-tight">{L(application.title)}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                        {application.kind} · {L({ en: application.status.replaceAll("_", " "), ur: application.status.replaceAll("_", " ") })}
                      </p>
                    </div>
                    <Badge tone={progress?.overdue ? "danger" : (progress?.percent ?? 0) === 100 ? "success" : "info"}>
                      {progress?.percent ?? 0}%
                    </Badge>
                  </div>
                  <div className="mt-2">
                    <ProgressBar percent={progress?.percent ?? 0} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10.5px] text-[var(--muted)]">
                    <span>
                      ✅ {progress?.doneStages ?? 0}/{progress?.totalStages ?? 0} {language === "en" ? "steps" : "مراحل"}
                    </span>
                    <span>
                      📎 {application.documents.filter((doc) => doc.status !== "missing").length}/{application.documents.length}
                    </span>
                    {progress?.daysToDeadline !== undefined ? (
                      <span className={progress.overdue ? "font-bold text-rose-700" : ""}>
                        ⏳ {progress.overdue ? (language === "en" ? "Deadline passed" : "آخری تاریخ گزر گئی") : `${progress.daysToDeadline} ${language === "en" ? "days left" : "دن باقی"}`}
                      </span>
                    ) : null}
                  </div>
                </button>

                {selected === application.id ? (
                  <ApplicationDetail
                    application={application}
                    onChange={() => state.reload()}
                  />
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-5 text-center text-[10.5px] text-[var(--muted-light)]">
        {language === "en"
          ? "Your applications are stored against an anonymous code in this browser. Nothing is shared publicly."
          : "آپ کی درخواستیں اسی براؤزر میں ایک گمنام کوڈ کے ساتھ محفوظ ہیں۔ کچھ بھی عام نہیں کیا جاتا۔"}
      </p>
    </div>
  );
}

function CreateForm({ onCreated }: { onCreated: (id: string) => void }) {
  const { language } = useLanguage();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ApplicationKind>("scholarship");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    const result = await apiPost<{ application: { id: string } }>("/api/applications", {
      kind,
      title: { en: title.trim(), ur: title.trim() },
      ...(deadline ? { deadline } : {}),
    });
    setBusy(false);
    if (result.ok) onCreated(result.data.application.id);
  };

  return (
    <Card className="bg-[var(--surface-2)]">
      <div className="space-y-2.5">
        <Field label={language === "en" ? "What is this application for?" : "یہ درخواست کس لیے ہے؟"}>
          <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={language === "en" ? "e.g. HEC scholarship" : "مثلاً ایچ ای سی سکالرشپ"} />
        </Field>
        <Field label={language === "en" ? "Type" : "قسم"}>
          <select className={inputClass} value={kind} onChange={(event) => setKind(event.target.value as ApplicationKind)}>
            {KINDS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <Field label={language === "en" ? "Deadline (optional)" : "آخری تاریخ (اختیاری)"}>
          <input type="date" className={inputClass} value={deadline} onChange={(event) => setDeadline(event.target.value)} />
        </Field>
      </div>
      <div className="mt-3">
        <Button size="sm" onClick={() => void submit()} disabled={busy || !title.trim()}>
          {language === "en" ? "Create" : "بنائیں"}
        </Button>
      </div>
    </Card>
  );
}

function ApplicationDetail({ application, onChange }: { application: ApplicationRecord; onChange: () => void }) {
  const { t, L, language } = useLanguage();
  const [note, setNote] = useState("");
  const [photoFor, setPhotoFor] = useState<string | undefined>(undefined);

  const patch = async (body: Record<string, unknown>) => {
    await fetch(`/api/applications/${application.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    onChange();
  };

  const nextStatus = (status: ApplicationStage["status"]): ApplicationStage["status"] => {
    const order: ApplicationStage["status"][] = ["todo", "in_progress", "done", "blocked"];
    return order[(order.indexOf(status) + 1) % order.length];
  };

  const docStatuses: DocumentStateValue[] = ["missing", "have", "attested", "uploaded"];

  return (
    <div className="mt-3 space-y-3 border-t border-[var(--line)] pt-3">
      {application.deadline ? (
        <p className="text-[11px] text-[var(--muted)]">
          ⏳ {language === "en" ? "Deadline:" : "آخری تاریخ:"} <span dir="ltr">{application.deadline}</span>
          {application.deadlineNote ? ` · ${application.deadlineNote}` : ""}
        </p>
      ) : null}
      {application.feeNote ? (
        <p className="rounded-xl bg-[var(--surface-2)] p-2.5 text-[11px] leading-relaxed text-[var(--muted)]">
          💰 {application.feeNote}
        </p>
      ) : null}

      {/* Stages */}
      {application.stages.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[11.5px] font-black text-[var(--ink-soft)]">{t("steps")}</p>
          <div className="space-y-1.5">
            {application.stages.map((stage) => (
              <button
                key={stage.id}
                type="button"
                onClick={() => void patch({ action: "stage", stageId: stage.id, stageStatus: nextStatus(stage.status) })}
                className="flex w-full items-center gap-2 rounded-xl border border-[var(--line)] bg-white p-2.5 text-start hover:border-[var(--forest)]"
              >
                <span className="text-[15px]">{stage.status === "done" ? "✅" : stage.status === "in_progress" ? "🔵" : stage.status === "blocked" ? "⛔" : "⚪"}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[12.5px] font-bold ${stage.status === "done" ? "text-[var(--muted)] line-through" : "text-[var(--ink)]"}`}>
                    {L(stage.title)}
                  </span>
                  {stage.detail ? <span className="block text-[11px] text-[var(--muted)]">{L(stage.detail)}</span> : null}
                </span>
                <span className="text-[10px] font-bold text-[var(--muted-light)]">
                  {language === "en" ? "tap to change" : "تبدیل کریں"}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Documents */}
      {application.documents.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[11.5px] font-black text-[var(--ink-soft)]">{t("documents")}</p>
          <div className="space-y-1.5">
            {application.documents.map((doc) => (
              <div key={doc.id} className="rounded-xl border border-[var(--line)] bg-white p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 text-[12.5px] font-bold">{L(doc.label)}</p>
                  <button
                    type="button"
                    onClick={() =>
                      void patch({
                        action: "update",
                      }).then(() =>
                        fetch(`/api/applications/${application.id}/documents`, {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            documentType: doc.documentType,
                            status: docStatuses[(docStatuses.indexOf(doc.status) + 1) % docStatuses.length],
                          }),
                        }).then(() => onChange()),
                      )
                    }
                    className={`rounded-full border px-2.5 py-1 text-[10.5px] font-black ${
                      doc.status === "missing"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : doc.status === "have"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {doc.status}
                  </button>
                </div>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setPhotoFor(photoFor === doc.documentType ? undefined : doc.documentType)}
                    className="text-[11px] font-bold text-[var(--forest)]"
                  >
                    📷 {language === "en" ? "Add a photo" : "تصویر شامل کریں"}
                  </button>
                </div>
                {photoFor === doc.documentType ? (
                  <div className="mt-2">
                    <PhotoCapture
                      documentType={doc.documentType}
                      applicationId={application.id}
                      onDone={() => {
                        setPhotoFor(undefined);
                        onChange();
                      }}
                    />
                  </div>
                ) : null}
                {doc.extraction && Object.keys(doc.extraction).length > 0 ? (
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--surface-2)] p-2 text-[10px]" dir="ltr">
                    {JSON.stringify(doc.extraction, null, 1)}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Notes */}
      <div>
        <p className="mb-1.5 text-[11.5px] font-black text-[var(--ink-soft)]">{t("notes")}</p>
        {application.notes.length > 0 ? (
          <ul className="mb-2 space-y-1">
            {application.notes.map((item) => (
              <li key={item.id} className="rounded-lg bg-[var(--surface-2)] p-2 text-[11.5px] leading-relaxed">
                {item.text}
                <button
                  type="button"
                  className="ms-2 text-[10px] font-bold text-rose-600"
                  onClick={() => void patch({ action: "delete_note", noteId: item.id })}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex gap-2">
          <input className={`${inputClass} flex-1`} value={note} onChange={(event) => setNote(event.target.value)} placeholder={language === "en" ? "Write a note" : "نوٹ لکھیں"} />
          <Button
            size="sm"
            onClick={() => {
              if (!note.trim()) return;
              void patch({ action: "note", note }).then(() => setNote(""));
            }}
          >
            {language === "en" ? "Add" : "شامل"}
          </Button>
        </div>
      </div>

      {/* Status */}
      <div>
        <p className="mb-1.5 text-[11.5px] font-black text-[var(--ink-soft)]">
          {language === "en" ? "Status" : "حالت"}
        </p>
        <select
          className={inputClass}
          value={application.status}
          onChange={(event) => void patch({ action: "update", status: event.target.value })}
        >
          {["planning", "collecting_documents", "preparing", "ready_to_submit", "submitted", "awaiting_result", "accepted", "rejected", "abandoned"].map(
            (status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ),
          )}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => void patch({ action: "update", archived: !application.archived })}>
          {application.archived ? (language === "en" ? "Unarchive" : "واپس لائیں") : t("archive")}
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={async () => {
            await fetch(`/api/applications/${application.id}`, { method: "DELETE" });
            onChange();
          }}
        >
          {t("delete")}
        </Button>
      </div>
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={null}>
      <TrackPageInner />
    </Suspense>
  );
}
