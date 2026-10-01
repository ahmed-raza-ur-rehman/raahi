"use client";

import Link from "next/link";
import React, { useState } from "react";

import { useLanguage } from "@/components/shell/LanguageProvider";
import { Badge, Card, Empty, FilterPills, Loader, Section } from "@/components/shell/Ui";
import { useApi } from "@/lib/client/useApi";
import type { OpportunityRecord } from "@/lib/types";

const KINDS = ["all", "job", "internship", "training", "admission", "grant"] as const;
type Kind = (typeof KINDS)[number];

export default function OpportunitiesPage() {
  const { t, L, language } = useLanguage();
  const [kind, setKind] = useState<Kind>("all");
  const state = useApi<{ results: OpportunityRecord[] }>("/api/opportunities");

  const results = (state.data?.results ?? []).filter((record) => (kind === "all" ? record.kind !== "scholarship" : record.kind === kind));

  return (
    <div>
      <Section
        title={t("tileJobs")}
        subtitle={
          language === "en"
            ? "Where jobs, internships and training are announced — with the official portal for each."
            : "نوکریاں، انٹرنشپ اور تربیت کہاں شائع ہوتی ہیں — ہر ایک کا سرکاری پورٹل ساتھ۔"
        }
      >
        <FilterPills<Kind>
          options={KINDS.map((item) => ({ id: item, label: item }))}
          value={kind}
          onChange={setKind}
        />
      </Section>

      {state.loading ? (
        <Loader />
      ) : results.length === 0 ? (
        <Empty>{t("noResults")}</Empty>
      ) : (
        <div className="space-y-2.5">
          {results.map((record) => (
            <Card key={record.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-extrabold leading-tight">{L(record.title)}</p>
                  <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">{record.provider}</p>
                </div>
                <Badge tone="success">{record.kind}</Badge>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--ink-soft)]">{L(record.benefit)}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Link
                  href={`/scholarships/${record.id}`}
                  className="inline-flex items-center rounded-xl bg-[var(--forest)] px-3.5 py-2 text-[12.5px] font-black text-white"
                >
                  {language === "en" ? "How to apply" : "طریقہ"} ›
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
          ))}
        </div>
      )}
    </div>
  );
}
