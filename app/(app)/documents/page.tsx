"use client";

import Link from "next/link";
import React, { useState } from "react";

import { useLanguage } from "@/components/shell/LanguageProvider";
import { Badge, Card, Empty, Loader, Section, inputClass } from "@/components/shell/Ui";
import { useApi } from "@/lib/client/useApi";
import type { DocumentRecipe } from "@/lib/types";

export default function DocumentsPage() {
  const { t, L, language } = useLanguage();
  const [query, setQuery] = useState("");
  const state = useApi<{ results: DocumentRecipe[] }>("/api/documents");

  const results = (state.data?.results ?? []).filter((record) => {
    if (!query.trim()) return true;
    return [L(record.name), record.issuingAuthority, record.tags.join(" ")].join(" ").toLowerCase().includes(query.trim().toLowerCase());
  });

  return (
    <div>
      <Section
        title={t("tileDocuments")}
        subtitle={
          language === "en"
            ? "How to get each document, what it costs, and who attests it."
            : "ہر دستاویز کیسے بنتی ہے، کیا لاگت ہے اور تصدیق کون کرتا ہے۔"
        }
      >
        <input
          className={inputClass}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={language === "en" ? "Search documents" : "دستاویز تلاش کریں"}
          aria-label={t("search")}
        />
      </Section>

      {state.loading ? (
        <Loader />
      ) : results.length === 0 ? (
        <Empty>{t("noResults")}</Empty>
      ) : (
        <div className="grid gap-2.5">
          {results.map((record) => (
            <Link key={record.id} href={`/documents/${record.type}`} className="block">
              <Card className="transition hover:border-[var(--forest)]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-extrabold leading-tight">{L(record.name)}</p>
                    <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">{record.issuingAuthority}</p>
                  </div>
                  <Badge tone="info">{record.steps.length} {language === "en" ? "steps" : "مراحل"}</Badge>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-[var(--ink-soft)]">{L(record.purpose)}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
