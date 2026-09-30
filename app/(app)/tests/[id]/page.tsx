"use client";

import { useParams, useRouter } from "next/navigation";
import React from "react";

import { useLanguage } from "@/components/shell/LanguageProvider";
import { SpeakButton } from "@/components/shell/VoiceButton";
import { Badge, Button, Card, Loader, Section, SourceChip, StepList } from "@/components/shell/Ui";
import { apiPost, useApi } from "@/lib/client/useApi";
import type { TestRecord } from "@/lib/types";

export default function TestDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t, L, language } = useLanguage();
  const state = useApi<{ record: TestRecord }>(params.id ? `/api/tests/${params.id}` : null);
  const record = state.data?.record;

  const start = async () => {
    if (!record) return;
    const result = await apiPost<{ application: { id: string } }>("/api/applications", {
      kind: "test",
      title: record.name,
      refId: record.id,
      stages: record.prep.plan.map((week) => ({
        id: `week-${week.week}`,
        title: { en: `Week ${week.week}: ${week.focus.en}`, ur: `ہفتہ ${week.week}: ${week.focus.ur}` },
        status: "todo",
      })),
      documents: [],
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
            <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">{record.conductingBody}</p>
          </div>
          <SpeakButton text={L(record.purpose)} />
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-soft)]">{L(record.purpose)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void start()}>
            📅 {language === "en" ? "Track my preparation" : "میری تیاری محفوظ کریں"}
          </Button>
          <a
            href={record.officialUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-xl border border-[var(--line)] px-3.5 py-2 text-[12px] font-bold text-[var(--muted)]"
          >
            {t("officialSource")} ↗
          </a>
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Card className="bg-[var(--surface-2)]">
          <p className="text-[10.5px] font-bold text-[var(--muted)]">{language === "en" ? "Format" : "ساخت"}</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed">{L(record.format)}</p>
        </Card>
        <Card className="bg-[var(--surface-2)]">
          <p className="text-[10.5px] font-bold text-[var(--muted)]">{language === "en" ? "Result valid for" : "نتیجہ کتنے عرصے"}</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed">{L(record.resultValidity)}</p>
        </Card>
      </div>

      <Section title={t("fee")}>
        <Card className="bg-[var(--surface-2)]">
          <p className="text-[12px] leading-relaxed">{L(record.fee.note)}</p>
        </Card>
      </Section>

      {record.dates.length > 0 ? (
        <Section title={t("tileDates")}>
          {record.dates.map((date) => (
            <Card key={date.id} className="bg-[var(--surface-2)]">
              <p className="text-[13px] font-bold">{L(date.title)}</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--muted)]">{L(date.note)}</p>
            </Card>
          ))}
        </Section>
      ) : null}

      <Section title={language === "en" ? "How to register" : "رجسٹریشن کا طریقہ"}>
        <StepList
          steps={record.registration.map((step) => ({
            title: { en: step.title, ur: step.titleUr },
            detail: { en: step.description, ur: step.descriptionUr },
          }))}
        />
      </Section>

      <Section
        title={language === "en" ? `Study plan (${record.prep.recommendedWeeks} weeks)` : `${record.prep.recommendedWeeks} ہفتوں کا منصوبہ`}
      >
        <div className="space-y-2">
          {record.prep.plan.map((week) => (
            <Card key={week.week} className="bg-[var(--surface-2)]">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--forest)] text-[11px] font-black text-white">
                  {week.week}
                </span>
                <p className="text-[13px] font-extrabold">{L(week.focus)}</p>
              </div>
              <ul className="mt-1.5 space-y-1">
                {week.tasks.map((task, index) => (
                  <li key={index} className="flex gap-2 text-[11.5px] leading-relaxed text-[var(--ink-soft)]">
                    <span aria-hidden>▸</span>
                    <span>{L(task)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Section>

      {record.prep.resources.length > 0 ? (
        <Section title={language === "en" ? "Free and official preparation material" : "مفت اور سرکاری تیاری کا مواد"}>
          {record.prep.resources.map((resource) => (
            <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer" className="mb-2 block">
              <Card className="border-sky-200 bg-sky-50">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12.5px] font-bold text-sky-900">{L(resource.title)}</p>
                  <Badge tone="info">{resource.kind}</Badge>
                </div>
              </Card>
            </a>
          ))}
        </Section>
      ) : null}

      <div className="mt-4">
        <SourceChip source={record.source} />
      </div>
    </div>
  );
}
