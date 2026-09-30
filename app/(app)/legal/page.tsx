"use client";

import React, { useState } from "react";

import { useLanguage } from "@/components/shell/LanguageProvider";
import { Badge, CallButton, Card, Loader, Section, StepList } from "@/components/shell/Ui";
import { useApi } from "@/lib/client/useApi";
import type { LegalTopic } from "@/lib/types";

interface LegalPayload {
  results: LegalTopic[];
  helplines: { id: string; name: unknown; purpose: unknown; numbers: string[]; url?: string }[];
}

export default function LegalPage() {
  const { t, L, language } = useLanguage();
  const [open, setOpen] = useState<string | undefined>(undefined);
  const state = useApi<LegalPayload>("/api/legal");

  return (
    <div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
        <p className="text-[12px] leading-relaxed text-amber-900">
          {language === "en"
            ? "RAAHI explains procedure, not law. This is general guidance — for free legal help call the Legal Aid Society on 0800-70806."
            : "راہی طریقۂ کار بتاتا ہے، قانونی مشورہ نہیں دیتا۔ مفت قانونی مدد کے لیے لیگل ایڈ سوسائٹی 0800-70806 پر کال کریں۔"}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <CallButton number="0800-70806" label={language === "en" ? "Free legal aid" : "مفت قانونی امداد"} />
          <CallButton number="1043" label={language === "en" ? "Women helpline" : "خواتین"} />
          <CallButton number="1099" label={language === "en" ? "Child helpline" : "بچے"} />
        </div>
      </div>

      <Section
        title={t("tileLegal")}
        subtitle={language === "en" ? "Tap a topic to see the exact procedure and your rights" : "کسی عنوان پر ٹیپ کریں"}
        >
        {state.loading ? (
          <Loader />
        ) : (
          <div className="space-y-2.5">
            {(state.data?.results ?? []).map((topic) => (
              <Card key={topic.id} className="p-0">
                <button
                  type="button"
                  onClick={() => setOpen(open === topic.id ? undefined : topic.id)}
                  className="flex w-full items-start justify-between gap-2 p-4 text-start"
                >
                  <span>
                    <span className="block text-[13.5px] font-extrabold leading-tight">{L(topic.title)}</span>
                    <span className="mt-1 block text-[11.5px] leading-relaxed text-[var(--muted)]">{L(topic.summary)}</span>
                  </span>
                  <span className="mt-1 text-[var(--muted-light)]">{open === topic.id ? "⌃" : "⌄"}</span>
                </button>

                {open === topic.id ? (
                  <div className="space-y-3 border-t border-[var(--line)] p-4">
                    <div>
                      <p className="mb-2 text-[11.5px] font-black text-[var(--ink-soft)]">{t("steps")}</p>
                      <StepList
                        steps={topic.steps.map((step) => ({
                          title: { en: step.title, ur: step.titleUr },
                          detail: { en: step.description, ur: step.descriptionUr },
                        }))}
                      />
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
                      <p className="text-[11px] font-black text-emerald-900">
                        {language === "en" ? "Your rights" : "آپ کے حقوق"}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {topic.rights.map((right, index) => (
                          <li key={index} className="flex gap-2 text-[11.5px] leading-relaxed text-emerald-900">
                            <span aria-hidden>⚖️</span>
                            <span>{L(right)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {topic.documents.length > 0 ? (
                      <div>
                        <p className="mb-1 text-[11.5px] font-black text-[var(--ink-soft)]">{t("documents")}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {topic.documents.map((doc) => (
                            <Badge key={doc.type}>📎 {L(doc.label)}</Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {topic.authorities.length > 0 ? (
                      <div>
                        <p className="mb-1 text-[11.5px] font-black text-[var(--ink-soft)]">
                          {language === "en" ? "Where to go" : "کہاں جانا ہے"}
                        </p>
                        <div className="space-y-1">
                          {topic.authorities.map((authority) => (
                            <div key={authority.name.en} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-2">
                              <span className="text-[11.5px] font-bold">{L(authority.name)}</span>
                              {authority.contact.map((entry, index) =>
                                entry.phone ? <CallButton key={index} number={entry.phone} /> : null,
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <p className="text-[10.5px] text-[var(--muted-light)]">
                      {language === "en" ? "Typical timeline: " : "عمومی مدت: "}
                      {L(topic.timeline)}
                    </p>
                    <a href={topic.source.url} target="_blank" rel="noreferrer" className="inline-block text-[11px] font-bold text-[var(--forest)]">
                      {t("officialSource")} ↗
                    </a>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title={language === "en" ? "Helplines" : "ہیلپ لائنز"}>
        <div className="space-y-1.5">
          {(state.data?.helplines ?? []).map((entry) => (
            <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-white p-2.5">
              <div className="min-w-0">
                <p className="text-[12px] font-bold">{L(entry.name as never)}</p>
                <p className="text-[11px] text-[var(--muted)]">{L(entry.purpose as never)}</p>
              </div>
              {entry.numbers.map((number) => (
                <CallButton key={number} number={number} />
              ))}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
