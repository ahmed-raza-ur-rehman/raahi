"use client";

import { useParams } from "next/navigation";
import React from "react";

import { useLanguage } from "@/components/shell/LanguageProvider";
import { SpeakButton } from "@/components/shell/VoiceButton";
import { Button, Card, Loader, Section, SourceChip, StepList } from "@/components/shell/Ui";
import { apiPost, useApi } from "@/lib/client/useApi";
import { useRouter } from "next/navigation";
import type { DocumentRecipe } from "@/lib/types";

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t, L, language } = useLanguage();
  const state = useApi<{ record: DocumentRecipe }>(params.id ? `/api/documents/${params.id}` : null);

  const record = state.data?.record;

  const start = async () => {
    if (!record) return;
    const result = await apiPost<{ application: { id: string } }>("/api/applications", {
      kind: "document",
      title: record.name,
      refId: record.id,
      stages: record.steps.map((step) => ({
        id: `stage-${step.order}`,
        title: { en: step.title, ur: step.titleUr },
        detail: { en: step.description, ur: step.descriptionUr },
        status: "todo",
      })),
      documents: [{ id: `doc-${record.type}`, documentType: record.type, label: record.name, status: "missing" }],
      feeNote: L(record.fee.note),
    });
    if (result.ok) router.push(`/track?focus=${result.data.application.id}`);
  };

  if (state.loading) return <Loader />;
  if (!record) return <Card className="text-[13px]">{t("notFound")}</Card>;

  return (
    <div>
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[16px] font-black leading-tight">{L(record.name)}</p>
            <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">{record.issuingAuthority}</p>
          </div>
          <SpeakButton text={L(record.purpose)} />
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-soft)]">{L(record.purpose)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void start()}>
            📂 {t("startApplication")}
          </Button>
          {record.onlineChannel ? (
            <a
              href={record.onlineChannel.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-xl border border-[var(--line)] px-3.5 py-2 text-[12px] font-bold text-[var(--muted)]"
            >
              {language === "en" ? "Online service" : "آن لائن سہولت"} ↗
            </a>
          ) : null}
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Card className="bg-[var(--surface-2)]">
          <p className="text-[10.5px] font-bold text-[var(--muted)]">{t("fee")}</p>
          <p className="mt-0.5 text-[12px] font-bold">
            {record.fee.amount === null ? (language === "en" ? "As notified" : "اعلان کے مطابق") : `${record.fee.amount} ${record.fee.currency}`}
          </p>
        </Card>
        <Card className="bg-[var(--surface-2)]">
          <p className="text-[10.5px] font-bold text-[var(--muted)]">{language === "en" ? "Time needed" : "کتنا وقت"}</p>
          <p className="mt-0.5 text-[12px] font-bold">{L(record.processingTime)}</p>
        </Card>
      </div>

      <Section title={t("steps")}>
        <StepList
          steps={record.steps.map((step) => ({
            title: { en: step.title, ur: step.titleUr },
            detail: { en: step.description, ur: step.descriptionUr },
          }))}
        />
      </Section>

      {record.attestation.levels.length > 0 || record.attestation.foreign.length > 0 ? (
        <Section title={t("attestation")} subtitle={L(record.attestation.summary)}>
          <div className="space-y-2">
            {record.attestation.levels.map((level) => (
              <Card key={level.authority} className="bg-[var(--surface-2)]">
                <p className="text-[13px] font-extrabold">{level.authority}</p>
                <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">
                  {L(level.who)} · {L(level.where)}
                </p>
                <p className="mt-1 text-[11.5px] font-semibold text-[var(--ink-soft)]">
                  {language === "en" ? "Fee: " : "فیس: "}
                  {L(level.fee)}
                </p>
                {level.note ? <p className="mt-1 text-[11px] text-[var(--muted)]">{L(level.note)}</p> : null}
              </Card>
            ))}
            {record.attestation.foreign.map((entry) => (
              <a key={entry.authority} href={entry.url} target="_blank" rel="noreferrer" className="block">
                <Card className="border-sky-200 bg-sky-50">
                  <p className="text-[13px] font-extrabold text-sky-900">{entry.authority}</p>
                  <p className="mt-0.5 text-[11.5px] text-sky-800">{L(entry.note)}</p>
                </Card>
              </a>
            ))}
          </div>
        </Section>
      ) : null}

      {record.commonMistakes.length > 0 ? (
        <Section title={language === "en" ? "Mistakes to avoid" : "یہ غلطیاں نہ کریں"}>
          <ul className="space-y-1.5">
            {record.commonMistakes.map((mistake, index) => (
              <li key={index} className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[12px]">
                <span aria-hidden>⚠️</span>
                <span>{L(mistake)}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {record.contact.length > 0 ? (
        <Section title={t("contacts")}>
          <div className="flex flex-wrap gap-2">
            {record.contact.map((contact, index) => (
              <a
                key={index}
                href={contact.phone ? `tel:${contact.phone}` : contact.url}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[12.5px] font-black text-white"
              >
                📞 {L(contact.label)}{contact.phone ? <span dir="ltr">· {contact.phone}</span> : null}
              </a>
            ))}
          </div>
        </Section>
      ) : null}

      <div className="mt-4">
        <SourceChip source={record.source} />
      </div>
    </div>
  );
}
