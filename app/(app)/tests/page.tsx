"use client";

import Link from "next/link";
import React, { useState } from "react";

import { useLanguage } from "@/components/shell/LanguageProvider";
import { Badge, Card, Empty, FilterPills, Loader, Section } from "@/components/shell/Ui";
import { useApi } from "@/lib/client/useApi";
import type { TestRecord } from "@/lib/types";

const CATEGORIES = ["all", "english", "admission", "aptitude", "competitive", "professional"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, { ur: string; en: string }> = {
  all: { ur: "سب", en: "All" },
  english: { ur: "انگریزی", en: "English" },
  admission: { ur: "داخلہ", en: "Admission" },
  aptitude: { ur: "اہلیت", en: "Aptitude" },
  competitive: { ur: "مقابلہ", en: "Competitive" },
  professional: { ur: "پیشہ ورانہ", en: "Professional" },
};

export default function TestsPage() {
  const { t, L, language } = useLanguage();
  const [category, setCategory] = useState<Category>("all");
  const state = useApi<{ results: TestRecord[] }>("/api/tests");

  const results = (state.data?.results ?? []).filter((record) => category === "all" || record.category === category);

  return (
    <div>
      <Section
        title={t("tileTests")}
        subtitle={
          language === "en"
            ? "Every test: what it is, when it happens, and a week-by-week plan to prepare."
            : "ہر ٹیسٹ: کیا ہے، کب ہوتا ہے اور تیاری کا ہفتہ وار منصوبہ۔"
        }
      >
        <FilterPills<Category>
          options={CATEGORIES.map((item) => ({ id: item, label: language === "en" ? CATEGORY_LABELS[item].en : CATEGORY_LABELS[item].ur }))}
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
          {results.map((record) => (
            <Link key={record.id} href={`/tests/${record.shortName}`} className="block">
              <Card className="transition hover:border-[var(--forest)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-extrabold leading-tight">{L(record.name)}</p>
                    <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">{record.conductingBody}</p>
                  </div>
                  <Badge tone={record.category === "english" ? "info" : "success"}>
                    {language === "en" ? CATEGORY_LABELS[record.category as Category]?.en : CATEGORY_LABELS[record.category as Category]?.ur}
                  </Badge>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-[var(--ink-soft)]">{L(record.purpose)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge>⏱ {L(record.duration)}</Badge>
                  <Badge tone="warn">📅 {record.prep.recommendedWeeks} {language === "en" ? "weeks prep" : "ہفتے تیاری"}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
