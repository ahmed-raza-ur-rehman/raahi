"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";

import { useLanguage } from "@/components/shell/LanguageProvider";
import { Badge, Button, Card, Empty, FilterPills, Loader, Section, inputClass } from "@/components/shell/Ui";
import { useApi } from "@/lib/client/useApi";
import type { Language, OpportunityRecord } from "@/lib/types";

type ScopeFilter = "all" | "national" | "international";

export default function ScholarshipsPage() {
  const { t, L, language } = useLanguage();
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [query, setQuery] = useState("");

  const url = useMemo(
    () => `/api/scholarships?language=${language}${scope === "all" ? "" : `&scope=${scope}`}`,
    [scope, language],
  );
  const state = useApi<{ results: OpportunityRecord[]; scope: { national: number; international: number } }>(url);

  const results = (state.data?.results ?? []).filter((record) => {
    if (!query.trim()) return true;
    const haystack = [L(record.title), record.provider, record.tags.join(" "), L(record.benefit)].join(" ").toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div>
      <Section
        title={t("tileScholarship")}
        subtitle={
          language === "en"
            ? "National and international scholarships — eligibility, fee, documents and deadlines."
            : "قومی اور بین الاقوامی وظائف — اہلیت، فیس، دستاویزات اور آخری تاریخیں۔"
        }
      >
        <input
          className={inputClass}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={language === "en" ? "Search scholarships" : "وظائف تلاش کریں"}
          aria-label={t("search")}
        />
        <div className="mt-2.5">
          <FilterPills<ScopeFilter>
            options={[
              { id: "all" as ScopeFilter, label: language === "en" ? "All" : "سب" },
              { id: "national", label: language === "en" ? "Pakistan" : "پاکستان" },
              { id: "international", label: language === "en" ? "Abroad" : "بیرونِ ملک" },
            ]}
            value={scope}
            onChange={setScope}
          />
        </div>
      </Section>

      {state.loading ? (
        <Loader />
      ) : results.length === 0 ? (
        <Empty>{t("noResults")}</Empty>
      ) : (
        <div className="mt-3 space-y-2.5">
          {results.map((record) => (
            <ScholarshipCard key={record.id} record={record} language={language} />
          ))}
        </div>
      )}

      <p className="mt-5 text-center text-[10.5px] text-[var(--muted-light)]">{t("confirmWithSource")}</p>
    </div>
  );
}

function ScholarshipCard({ record, language }: { record: OpportunityRecord; language: Language }) {
  const { t, L } = useLanguage();
  const feeLabel =
    record.applicationFee.amount === null
      ? language === "en"
        ? "Free to apply"
        : "درخواست مفت"
      : `${record.applicationFee.amount} ${record.applicationFee.currency}`;

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-extrabold leading-tight text-[var(--ink)]">{L(record.title)}</p>
          <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">{record.provider}</p>
        </div>
        <Badge tone={record.scope === "international" ? "info" : "success"}>
          {record.scope === "international"
            ? language === "en"
              ? "Abroad"
              : "بیرونِ ملک"
            : language === "en"
            ? "Pakistan"
            : "پاکستان"}
        </Badge>
      </div>

      <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{L(record.benefit)}</p>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Badge tone={record.applicationFee.amount === null ? "success" : "warn"}>💰 {feeLabel}</Badge>
        {record.requiredDocuments.slice(0, 2).map((item) => (
          <Badge key={item.type}>📎 {L(item.label)}</Badge>
        ))}
        {record.tags.includes("english_test") ? <Badge tone="info">🗣️ {t("englishTest")}</Badge> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/scholarships/${record.id}`}
          className="inline-flex items-center rounded-xl bg-[var(--forest)] px-3.5 py-2 text-[12.5px] font-black text-white"
        >
          {language === "en" ? "How to apply" : "طریقہ دیکھیں"} ›
        </Link>
        <a
          href={record.officialUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-xl border border-[var(--line)] px-3 py-2 text-[12px] font-bold text-[var(--muted)]"
        >
          {t("officialSource")} ↗
        </a>
      </div>
    </Card>
  );
}
