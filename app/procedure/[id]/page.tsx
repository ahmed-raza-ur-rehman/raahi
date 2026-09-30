"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ProcedureWalkthrough,
  type ProcedureStepItem,
} from "@/components/procedure/ProcedureWalkthrough";

/** Shape returned by GET /api/procedures/[id]. */
interface ProcedurePayload {
  serviceId: string;
  name: string;
  nameUr: string;
  namePs?: string;
  domain: string;
  organizationId: string;
  description: string;
  descriptionUr: string;
  steps: ProcedureStepItem[];
  requiredDocuments: {
    type: string;
    label: string;
    labelUr?: string;
    mandatory: boolean;
  }[];
  source: {
    url: string;
    title: string;
    authorityTier?: number;
    lastVerified?: string;
  };
}

interface ProcedurePageProps {
  params: Promise<{ id: string }>;
}

export default function ProcedurePage({ params }: ProcedurePageProps) {
  const [data, setData] = useState<ProcedurePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<"en" | "ur" | "ps">("ur");

  useEffect(() => {
    params.then(({ id }) => {
      fetch(`/api/procedures/${id}`)
        .then((res) => {
          if (!res.ok) throw new Error("Procedure not found");
          return res.json();
        })
        .then((result: ProcedurePayload) => {
          setData(result);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    });
  }, [params]);

  if (loading) {
    return (
      <main className="app-shell min-h-screen p-6" dir="rtl">
        <div className="space-y-4 py-8">
          <div className="skeleton h-8 w-40" />
          <div className="skeleton h-32 w-full" />
          <div className="skeleton h-48 w-full" />
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="app-shell min-h-screen p-6 text-center py-12" dir="rtl">
        <span className="text-3xl">⚠️</span>
        <h1 className="mt-3 text-lg font-black text-[var(--ink)]">
          طریقہ کار نہیں مل سکا
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          درخواست کردہ سرکاری سروس یا طریقہ ڈیٹا بیس میں موجود نہیں ہے۔
        </p>
        <Link
          href="/chat"
          className="mt-4 inline-block rounded-xl bg-[var(--forest)] px-4 py-2 text-xs font-bold text-white"
        >
          چیٹ میں نیا راستہ تلاش کریں
        </Link>
      </main>
    );
  }

  return (
    <main
      className="app-shell min-h-screen px-4 sm:px-6 py-5"
      dir={language === "en" ? "ltr" : "rtl"}
    >
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-[var(--line)] pb-4 mb-6">
        <Link
          href="/chat"
          className="flex items-center gap-1 text-xs font-bold text-[var(--forest)] hover:underline"
        >
          ← {language === "en" ? "Back to Chat" : "چیٹ پر واپس جائیں"}
        </Link>

        <div className="flex gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-0.5 text-xs">
          {(["ur", "ps", "en"] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setLanguage(lang)}
              className={`rounded px-2.5 py-0.5 font-bold transition ${
                language === lang
                  ? "bg-[var(--forest)] text-white"
                  : "text-[var(--muted)]"
              }`}
            >
              {lang === "ur" ? "اردو" : lang === "ps" ? "پښتو" : "EN"}
            </button>
          ))}
        </div>
      </header>

      {/* Procedure Walkthrough */}
      <ProcedureWalkthrough
        serviceId={data.serviceId}
        serviceName={data.name}
        serviceNameUr={data.nameUr}
        domain={data.domain}
        organization={data.organizationId}
        sourceUrl={data.source?.url}
        sourceTitle={data.source?.title}
        authorityTier={data.source?.authorityTier}
        lastVerified={data.source?.lastVerified}
        steps={data.steps || []}
        requiredDocuments={data.requiredDocuments || []}
        language={language}
      />
    </main>
  );
}