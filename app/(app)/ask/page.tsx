"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";

import { useLanguage } from "@/components/shell/LanguageProvider";
import { SpeakButton, VoiceButton } from "@/components/shell/VoiceButton";
import { Badge, Button, CallButton, Card, Empty, Loader, SourceChip, StepList, inputClass } from "@/components/shell/Ui";
import { apiPost } from "@/lib/client/useApi";
import type { AgentResponse, ApplicationRecord, Localized } from "@/lib/types";

interface Message {
  id: string;
  role: "user" | "raahi";
  text: string;
  response?: AgentResponse;
}

function AskPageInner() {
  const { t, language } = useLanguage();
  const params = useSearchParams();
  const initial = params.get("q") ?? "";

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<ApplicationRecord | undefined>(undefined);
  const asked = React.useRef(false);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setMessages((previous) => [...previous, { id: `u-${Date.now()}`, role: "user", text: trimmed }]);
    setDraft("");
    setBusy(true);

    const result = await apiPost<AgentResponse>("/api/ask", { query: trimmed, language });
    setBusy(false);

    if (!result.ok) {
      setMessages((previous) => [
        ...previous,
        { id: `e-${Date.now()}`, role: "raahi", text: result.error },
      ]);
      return;
    }

    setMessages((previous) => [...previous, { id: `a-${Date.now()}`, role: "raahi", text: "", response: result.data }]);
  };

  useEffect(() => {
    if (initial && !asked.current) {
      asked.current = true;
      void send(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const startApplication = async (draftApplication: NonNullable<AgentResponse["draftApplication"]>) => {
    const result = await apiPost<{ application: ApplicationRecord }>("/api/applications", {
      kind: draftApplication.kind,
      title: draftApplication.title,
      ...(draftApplication.refId ? { refId: draftApplication.refId } : {}),
      stages: draftApplication.stages,
      documents: draftApplication.documents.map((doc) => ({
        id: doc.id,
        documentType: doc.documentType,
        label: doc.label,
        status: doc.status,
      })),
      ...(draftApplication.deadline ? { deadline: draftApplication.deadline } : {}),
      ...(draftApplication.deadlineNote ? { deadlineNote: draftApplication.deadlineNote } : {}),
      ...(draftApplication.feeNote ? { feeNote: draftApplication.feeNote } : {}),
    });
    if (result.ok) setCreated(result.data.application);
  };

  return (
    <div className="space-y-4">
      {/* Voice-first input */}
      <Card className="flex items-center gap-4 bg-gradient-to-br from-emerald-50 to-white">
        <VoiceButton size="md" onTranscript={(text) => void send(text)} label={t("speakNow")} />
        <div className="flex-1">
          <p className="text-[13px] font-extrabold text-[var(--ink)]">
            {language === "en" ? "Ask in your own words" : "اپنے الفاظ میں پوچھیں"}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--muted)]">
            {language === "en"
              ? "“I need a scholarship for my daughter”, “my CNIC is lost”, “we need blood in Abbottabad”"
              : "«میری بیٹی کے لیے سکالرشپ چاہیے»، «میرا شناختی کارڈ گم ہے»، «ہمیں ایبٹ آباد میں خون چاہیے»"}
          </p>
        </div>
      </Card>

      {messages.length === 0 ? (
        <Empty>
          <p className="text-[13px]">
            {language === "en" ? "Press the microphone or type below." : "مائیک دبائیں یا نیچے لکھیں۔"}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 text-[11.5px]">
            {[
              language === "en" ? "Scholarship for my daughter" : "میری بیٹی کے لیے سکالرشپ",
              language === "en" ? "How do I get a domicile certificate?" : "ڈومیسائل سرٹیفکیٹ کیسے بنے گا؟",
              language === "en" ? "We need blood urgently" : "ہمیں فوری خون چاہیے",
              language === "en" ? "Flood relief for our village" : "ہمارے گاؤں کے لیے سیلابی امداد",
            ].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => void send(example)}
                className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 font-semibold text-[var(--forest)] hover:bg-[var(--forest-light)]"
              >
                {example}
              </button>
            ))}
          </div>
        </Empty>
      ) : null}

      <div className="space-y-3">
        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="flex justify-end">
              <div className="bubble-user max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed">
                {message.text}
              </div>
            </div>
          ) : message.response ? (
            <AgentAnswer
              key={message.id}
              response={message.response}
              onStart={(draftApp) => void startApplication(draftApp)}
              created={created}
              rawText={message.text}
            />
          ) : (
            <div key={message.id} className="bubble-assistant rounded-2xl px-3.5 py-2.5 text-[13px]">
              {message.text}
            </div>
          ),
        )}
      </div>

      {busy ? <Loader /> : null}

      <form
        className="sticky bottom-20 flex gap-2 rounded-2xl border border-[var(--line)] bg-white p-2 shadow-md"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <input
          className={`${inputClass} flex-1 border-0`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("typeInstead")}
          aria-label={t("typeInstead")}
        />
        <button
          type="submit"
          disabled={busy || draft.trim().length === 0}
          className="rounded-xl bg-[var(--forest)] px-4 text-[13px] font-black text-white disabled:opacity-40"
        >
          {language === "en" ? "Send" : "بھیجیں"}
        </button>
      </form>
    </div>
  );
}

function AgentAnswer({
  response,
  rawText,
  onStart,
  created,
}: {
  response: AgentResponse;
  rawText: string;
  onStart: (draft: NonNullable<AgentResponse["draftApplication"]>) => void;
  created?: ApplicationRecord;
}) {
  const { L, t, language } = useLanguage();
  const answer = L(response.answer) || rawText;

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[14px] font-bold leading-relaxed text-[var(--ink)]">{answer}</p>
        <SpeakButton text={answer} />
      </div>

      {response.emergency ? (
        <div className="flex flex-wrap gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5">
          <CallButton number="1122" label="Rescue" />
          <CallButton number="115" label="Edhi" />
          <CallButton number="15" label="Police" />
        </div>
      ) : null}

      {response.steps.length > 0 ? (
        <div>
          <p className="mb-2 text-[12px] font-black text-[var(--ink-soft)]">{t("steps")}</p>
          <StepList steps={response.steps.map((step) => ({ title: step as Localized }))} />
        </div>
      ) : null}

      {response.contacts.length > 0 ? (
        <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-2.5">
          {response.contacts
            .filter((contact) => contact.phone)
            .map((contact, index) => (
              <CallButton key={`${contact.phone}-${index}`} number={contact.phone!} label={L(contact.label)} />
            ))}
        </div>
      ) : null}

      {response.hits.length > 0 ? (
        <div>
          <p className="mb-2 text-[12px] font-black text-[var(--ink-soft)]">
            {language === "en" ? "Verified sources behind this answer" : "اس جواب کی تصدیق شدہ بنیاد"}
          </p>
          <div className="space-y-2">
            {response.hits.slice(0, 4).map((hit) => (
              <div key={`${hit.entityType}-${hit.entityId}`} className="rounded-xl border border-[var(--line)] p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[12.5px] font-bold">{hit.title.split(" · ")[0]}</p>
                  <Badge tone={hit.source.tier <= 2 ? "success" : "neutral"}>T{hit.source.tier}</Badge>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-[var(--muted)]">{hit.summary.split(" · ")[0]}</p>
                <SourceChip source={hit.source} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {response.draftApplication ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[12.5px] font-black text-emerald-900">
            {language === "en" ? "Save this as a tracked application" : "اسے اپنی درخواست کے طور پر محفوظ کریں"}
          </p>
          <p className="mt-0.5 text-[11.5px] text-emerald-800">
            {language === "en"
              ? `${response.draftApplication.stages.length} steps · ${response.draftApplication.documents.length} documents`
              : `${response.draftApplication.stages.length} مراحل · ${response.draftApplication.documents.length} دستاویزات`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onStart(response.draftApplication!)}>
              {t("startApplication")}
            </Button>
            {created ? (
              <Link
                href="/track"
                className="inline-flex items-center rounded-xl border border-emerald-300 bg-white px-3 py-2 text-[12px] font-bold text-emerald-800"
              >
                📂 {t("myApplications")}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {response.disclaimer ? (
        <p className="text-[10.5px] leading-relaxed text-[var(--muted-light)]">{L(response.disclaimer)}</p>
      ) : null}

      <details className="text-[10.5px] text-[var(--muted-light)]">
        <summary className="cursor-pointer font-bold">
          {language === "en" ? "How this answer was produced" : "یہ جواب کیسے بنا"}
        </summary>
        <ul className="mt-1 space-y-0.5">
          {response.trace.map((step, index) => (
            <li key={index} dir="ltr" className="text-left">
              {step.agent} → {step.action}: {step.detail}
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

export default function AskPage() {
  return (
    <Suspense fallback={null}>
      <AskPageInner />
    </Suspense>
  );
}
