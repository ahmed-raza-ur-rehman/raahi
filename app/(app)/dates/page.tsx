"use client";

import React, { useState } from "react";

import { useLanguage } from "@/components/shell/LanguageProvider";
import { Badge, Card, Empty, FilterPills, Loader, Section } from "@/components/shell/Ui";
import { useApi } from "@/lib/client/useApi";
import type { ImportantDate } from "@/lib/types";

const CATEGORIES = ["all", "test", "scholarship", "job", "internship", "admission", "training"] as const;
type Category = (typeof CATEGORIES)[number];

export default function DatesPage() {
  const { t, L, language } = useLanguage();
  const [category, setCategory] = useState<Category>("all");
  const state = useApi<{ results: ImportantDate[] }>("/api/dates");

  const results = (state.data?.results ?? []).filter((date) => category === "all" || date.category === category);

  return (
    <div>
      <Section
        title={t("tileDates")}
        subtitle={
          language === "en"
            ? "Exam, scholarship, job and admission dates. RAAHI never invents a date it cannot verify."
            : "امتحان، وظائف، نوکری اور داخلے کی تاریخیں۔ راہی کبھی غیر تصدیق شدہ تاریخ نہیں بتاتا۔"
        }
      >
        <FilterPills<Category>
          options={CATEGORIES.map((item) => ({ id: item, label: item }))}
          value={category}
          onChange={setCategory}
        />
      </Section>

      {state.loading ? (
        <Loader />
      ) : results.length === 0 ? (
        <Empty>{t("noResults")}</Empty>
      ) : (
        <div className="space-y-2.5">
          {results.map((date) => (
            <Card key={date.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-extrabold leading-tight">{L(date.title)}</p>
                  <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">
                    {date.kind === "rolling"
                      ? language === "en"
                        ? "Open all year"
                        : "سال بھر کھلا"
                      : date.kind === "recurring"
                      ? language === "en"
                        ? "Repeats every year"
                        : "ہر سال دہرایا جاتا ہے"
                      : date.date ?? ""}
                  </p>
                </div>
                <Badge tone={date.category === "test" ? "info" : date.category === "job" ? "success" : "warn"}>{date.category}</Badge>
              </div>
              {date.note ? <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--muted)]">{L(date.note)}</p> : null}
              <a href={date.source.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[11px] font-bold text-[var(--forest)]">
                {t("officialSource")} ↗
              </a>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
