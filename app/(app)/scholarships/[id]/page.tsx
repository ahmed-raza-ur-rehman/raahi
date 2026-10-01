"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React from "react";

import { useLanguage } from "@/components/shell/LanguageProvider";
import { SpeakButton } from "@/components/shell/VoiceButton";
import { Button, CallButton, Card, Loader, Section, SourceChip, StepList } from "@/components/shell/Ui";
import { apiPost, useApi } from "@/lib/client/useApi";
import type { OpportunityRecord } from "@/lib/types";

interface DetailResponse {
  record: OpportunityRecord;
  documents: { id: string; title: string }[];
}

export default function ScholarshipDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t, L, language } = useLanguage();
  const state = useApi<DetailResponse>(params.id ? `/api/scholarships/${params.id}` : null);

  const record = state.data?.record;

  const start = async () => {
    if (!record) return;
    const result = await apiPost<{ application: { id: string } }>("/api/applications", {
      kind: record.kind,
      title: record.title,
      refId: record.id,
      stages: record.procedure.map((step) => ({
        id: `stage-${step.order}`,
        title: { en: step.title, ur: step.titleUr },
        detail: { en: step.description, ur: step.descriptionUr },
        status: "todo",
      })),
      documents: record.requiredDocuments.map((doc) => ({
        id: `doc-${doc.type}`,
        documentType: doc.type,
        label: { en: doc.label, ur: doc.labelUr },
        status: "missing",
      })),
      ...(record.deadline.date ? { deadline: record.deadline.date } : {}),
      deadlineNote: L(record.deadline.note),
      feeNote: L(record.applicationFee.note),
    });
    if (result.ok) router.push(`/track?focus=${result.data.application.id}`);
  };

  if (state.loading) return <Loader />;
  if (!record) {
    return (
      <Card>
        <p className="text-[13px]">{t("notFound")}</p>
        <div className="mt-3">
          <Button href="/scholarships">{language === "en" ? "Back to scholarships" : "وظائف پر واپس"}</Button>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[16px] font-black leading-tight text-[var(--ink)]">{L(record.title)}</p>
            <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">{record.provider}</p>
          </div>
          <SpeakButton text={L(record.benefit)} />
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-soft)]">{L(record.benefit)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void start()}>
            📂 {t("startApplication")}
          </Button>
          <a
            href={record.officialUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-xl border border-[var(--line)] px-3.5 py-2 text-[12px] font-bold text-[var(--muted)]"
          >
            {t("officialSource")} ↗
          </a>
          <Link
            href={`/kb?correct=${record.id}&type=opportunity`}
            className="inline-flex items-center rounded-xl border border-[var(--line)] px-3.5 py-2 text-[12px] font-bold text-[var(--muted)]"
          >
            ✏️ {language === "en" ? "Report a mistake" : "غلظی کی اطلاع"}
          </Link>
        </div>
      </Card>

      <Section title={t("eligibility")}>
        <ul className="space-y-1.5">
          {record.eligibility.map((criterion) => (
            <li key={criterion.id} className="flex gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-2.5 text-[12.5px]">
              <span aria-hidden>{criterion.mandatory ? "✅" : "➕"}</span>
              <span>{L(criterion.label)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title={t("documents")}
        subtitle={
          language === "en"
            ? "Tap a document to see where to get it and who attests it"
            : "کسی دستاویز پر ٹیپ کریں — کہاں بنے گی اور تصدیق کون کرے گا"
        }
      >
        <div className="grid gap-2">
          {record.requiredDocuments.map((item, index) => (
            <Link
              // Two rows can legitimately be the same document type - a
              // student's CNIC and a guardian's CNIC, for example - so the
              // position is part of the key.
              key={`${item.type}-${index}`}
              href={`/documents/${item.type}`}
              className="flex items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-white p-3 text-[12.5px] font-semibold hover:border-[var(--forest)]"
            >
              <span>{L(item.label)}</span>
              <span className="text-[10.5px] font-bold text-[var(--muted)]">
                {item.mandatory ? (language === "en" ? "Required" : "لازمی") : language === "en" ? "If asked" : "ضرورت پر"} ›
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title={t("fee")}>
        <Card className="bg-[var(--surface-2)]">
          <p className="text-[13px] font-bold">{record.applicationFee.amount === null ? (language === "en" ? "No fee — free to apply" : "کوئی فیس نہیں — مفت") : `${record.applicationFee.amount} ${record.applicationFee.currency}`}</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--muted)]">{L(record.applicationFee.note)}</p>
        </Card>
      </Section>

      <Section title={t("steps")}>
        <StepList
          steps={record.procedure.map((step) => ({
            title: { en: step.title, ur: step.titleUr },
            detail: { en: step.description, ur: step.descriptionUr },
          }))}
        />
      </Section>

      <Section title={t("deadline")}>
        <Card className="bg-[var(--surface-2)]">
          <p className="text-[12.5px] leading-relaxed">{L(record.deadline.note)}</p>
        </Card>
      </Section>

      {record.contact.length > 0 ? (
        <Section title={t("contacts")}>
          <div className="flex flex-wrap gap-2">
            {record.contact.map((contact, index) =>
              contact.phone ? (
                <CallButton key={index} number={contact.phone} label={L(contact.label)} />
              ) : (
                <a
                  key={index}
                  href={contact.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-xl border border-[var(--line)] px-3 py-2 text-[12px] font-bold"
                >
                  {L(contact.label)} ↗
                </a>
              ),
            )}
          </div>
        </Section>
      ) : null}

      <div className="mt-4">
        <SourceChip source={record.source} />
      </div>
    </div>
  );
}
