"use client";

import React, { useState } from "react";

import { useLanguage } from "@/components/shell/LanguageProvider";
import { Badge, CallButton, Card, Empty, FilterPills, Loader, Section, StepList } from "@/components/shell/Ui";
import { useApi } from "@/lib/client/useApi";
import type { DiseaseSignal, MedicalCamp, MedicalProcedure } from "@/lib/types";

type Tab = "camps" | "diseases" | "care";

export default function HealthPage() {
  const { t, L, language } = useLanguage();
  const [tab, setTab] = useState<Tab>("camps");

  const camps = useApi<{ results: MedicalCamp[] }>("/api/camps");
  const diseases = useApi<{ results: DiseaseSignal[] }>("/api/diseases");
  const procedures = useApi<{ results: MedicalProcedure[] }>("/api/medical-procedures");

  return (
    <div>
      <Section
        title={t("tileHealth")}
        subtitle={
          language === "en"
            ? "Free medical camps, early warning signs, and the route to affordable treatment."
            : "مفت طبی کیمپ، بیماری کی ابتدائی علامات اور سستے علاج کا راستہ۔"
        }
      >
        <FilterPills<Tab>
          options={[
            { id: "camps", label: language === "en" ? "Free camps" : "مفت کیمپ" },
            { id: "diseases", label: language === "en" ? "Early warning" : "پہچان" },
            { id: "care", label: language === "en" ? "Treatment routes" : "علاج کا راستہ" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </Section>

      <div className="mb-3 flex flex-wrap gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3">
        <span className="text-[12px] font-black text-rose-700">
          {language === "en" ? "Urgent? Call now:" : "فوری؟ ابھی کال کریں:"}
        </span>
        <CallButton number="1122" label="Rescue" />
        <CallButton number="115" label="Edhi" />
        <CallButton number="1166" label={language === "en" ? "Immunisation" : "ٹیکہ جات"} />
      </div>

      {tab === "camps" ? (
        camps.loading ? (
          <Loader />
        ) : (camps.data?.results.length ?? 0) === 0 ? (
          <Empty>{t("noResults")}</Empty>
        ) : (
          <div className="space-y-2.5">
            {(camps.data?.results ?? []).map((camp) => (
              <Card key={camp.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[13.5px] font-extrabold leading-tight">{L(camp.name)}</p>
                    <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">{camp.provider}</p>
                  </div>
                  <Badge tone="success">{L(camp.cost)}</Badge>
                </div>
                <ul className="mt-2 space-y-1">
                  {camp.services.map((service, index) => (
                    <li key={index} className="flex gap-2 text-[12px] leading-relaxed text-[var(--ink-soft)]">
                      <span aria-hidden>✅</span>
                      <span>{L(service)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-[var(--muted)]">
                  {language === "en" ? "When: " : "وقت: "}
                  {L(camp.cadence)}
                </p>
                <details className="mt-2 text-[11px]">
                  <summary className="cursor-pointer font-bold text-[var(--forest)]">
                    {language === "en" ? "How to confirm the next camp" : "اگلا کیمپ کیسے معلوم کریں"}
                  </summary>
                  <div className="mt-2">
                    <StepList steps={camp.howToConfirm.map((step) => ({ title: { en: step.title, ur: step.titleUr }, detail: { en: step.description, ur: step.descriptionUr } }))} />
                  </div>
                </details>
                {camp.contact[0]?.url ? (
                  <a href={camp.contact[0].url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[11px] font-bold text-[var(--forest)]">
                    {language === "en" ? "Official page" : "سرکاری صفحہ"} ↗
                  </a>
                ) : null}
              </Card>
            ))}
          </div>
        )
      ) : null}

      {tab === "diseases" ? (
        diseases.loading ? (
          <Loader />
        ) : (
          <div className="space-y-2.5">
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11.5px] leading-relaxed text-amber-900">
              {language === "en"
                ? "These are early warning signs, not a diagnosis. If several people in one area fall ill with the same signs, report it to the nearest government health facility the same day."
                : "یہ ابتدائی علامات ہیں، تشخیص نہیں۔ اگر ایک علاقے میں کئی افراد ایک ہی علامات کے ساتھ بیمار ہوں تو اسی دن قریبی سرکاری صحت مرکز کو اطلاع دیں۔"}
            </p>
            {(diseases.data?.results ?? []).map((signal) => (
              <Card key={signal.id}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13.5px] font-extrabold">{L(signal.name)}</p>
                  <Badge tone={signal.severity === "emergency" ? "danger" : signal.severity === "urgent" ? "warn" : "neutral"}>
                    {signal.severity}
                  </Badge>
                </div>
                <p className="mt-1.5 text-[11px] font-bold text-[var(--muted)]">
                  {language === "en" ? "Signs to watch for" : "نظر رکھنے والی علامات"}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {signal.signs.map((sign, index) => (
                    <li key={index} className="flex gap-2 text-[12px] leading-relaxed text-[var(--ink-soft)]">
                      <span aria-hidden>• </span>
                      <span>{L(sign)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5">
                  <p className="text-[11px] font-black text-rose-800">{language === "en" ? "When to seek care" : "علاج کب کروائیں"}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-rose-900">{L(signal.whenToSeekCare)}</p>
                </div>
                <details className="mt-2 text-[11px]">
                  <summary className="cursor-pointer font-bold text-[var(--forest)]">{language === "en" ? "Prevention" : "بچاؤ"}</summary>
                  <ul className="mt-1.5 space-y-1">
                    {signal.prevention.map((item, index) => (
                      <li key={index} className="flex gap-2 text-[11.5px] leading-relaxed text-[var(--ink-soft)]">
                        <span aria-hidden>🛡️</span>
                        <span>{L(item)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
                <div className="mt-2 flex flex-wrap gap-2">
                  {signal.reportTo.filter((entry) => entry.phone).map((entry, index) => (
                    <CallButton key={index} number={entry.phone!} label={L(entry.label)} />
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : null}

      {tab === "care" ? (
        procedures.loading ? (
          <Loader />
        ) : (
          <div className="space-y-2.5">
            {(procedures.data?.results ?? []).map((procedure) => (
              <Card key={procedure.id}>
                <p className="text-[13.5px] font-extrabold">{L(procedure.condition)}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-soft)]">{L(procedure.summary)}</p>
                <div className="mt-2.5">
                  <StepList
                    steps={procedure.pathway.map((step) => ({
                      title: { en: step.title, ur: step.titleUr },
                      detail: { en: step.description, ur: step.descriptionUr },
                    }))}
                  />
                </div>
                {procedure.supportRoutes.length > 0 ? (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-[11px] font-bold text-[var(--muted)]">
                      {language === "en" ? "Financial support routes" : "مالی مدد کے راستے"}
                    </p>
                    {procedure.supportRoutes.map((route) => (
                      <a key={route.name.en} href={route.url} target="_blank" rel="noreferrer" className="block">
                        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-2.5">
                          <p className="text-[12px] font-bold">{L(route.name)}</p>
                          <p className="mt-0.5 text-[11px] text-[var(--muted)]">{L(route.detail)}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : null}
                {procedure.contact.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {procedure.contact.filter((entry) => entry.phone).map((entry, index) => (
                      <CallButton key={index} number={entry.phone!} label={L(entry.label)} />
                    ))}
                  </div>
                ) : null}
                {procedure.disclaimer ? (
                  <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--muted-light)]">{L(procedure.disclaimer)}</p>
                ) : null}
              </Card>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
