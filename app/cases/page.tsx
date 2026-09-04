"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { CitizenCase } from "@/lib/types";

type Language = "en" | "ur" | "ps";

const domainIcons: Record<string, string> = {
  welfare: "💰",
  education: "🎓",
  health: "🏥",
  documentation: "📄",
  legal: "⚖️",
  employment: "💼",
  disaster: "🚨",
};

export default function CasesPage() {
  const [cases, setCases] = useState<CitizenCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<Language>("ur");
  const [filterDomain, setFilterDomain] = useState<string>("all");

  useEffect(() => {
    fetch("/api/cases")
      .then((res) => res.json())
      .then((data) => {
        setCases(data.results ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredCases = cases.filter(
    (c) => filterDomain === "all" || c.domain === filterDomain
  );

  return (
    <main
      className="app-shell min-h-screen px-4 sm:px-6 py-5 flex flex-col justify-between"
      dir={language === "en" ? "ltr" : "rtl"}
    >
      {/* Header */}
      <div>
        <header className="flex items-center justify-between border-b border-[var(--line)] pb-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--forest)] text-lg font-black text-white">
              ر
            </span>
            <span className="text-xl font-black text-[var(--forest)]">راہی</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/chat"
              className="rounded-xl bg-[var(--forest)] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[var(--forest-dark)] transition"
            >
              + {language === "en" ? "New Route" : "نیا راستہ تلاش کریں"}
            </Link>

            <div className="flex gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-0.5 text-xs">
              {(["ur", "ps", "en"] as Language[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`rounded px-2 py-0.5 font-bold ${
                    language === lang
                      ? "bg-[var(--forest)] text-white"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {lang === "ur" ? "اردو" : lang === "ps" ? "پښتو" : "EN"}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Title */}
        <section className="py-6">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--forest)]">
            RAAHI / CASES
          </span>
          <h1 className="mt-1 text-2xl font-black text-[var(--ink)]">
            {language === "en" ? "My Navigation Cases" : "میرے محفوظ شدہ کیسز"}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {language === "en"
              ? "Track your applications, required documents, and next steps."
              : "اپنی درخواستی پیش رفت، ضروری کاغذات اور اگلے مراحل پر نظر رکھیں۔"}
          </p>

          {/* Filter Pills */}
          <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
            {["all", "welfare", "education", "health", "documentation", "legal"].map(
              (dom) => (
                <button
                  key={dom}
                  type="button"
                  onClick={() => setFilterDomain(dom)}
                  className={`rounded-full px-3 py-1 font-semibold transition ${
                    filterDomain === dom
                      ? "bg-[var(--forest)] text-white"
                      : "border border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--forest)]"
                  }`}
                >
                  {dom === "all"
                    ? language === "en"
                      ? "All"
                      : "تمام"
                    : dom}
                </button>
              )
            )}
          </div>

          {/* Case List */}
          {loading ? (
            <div className="mt-8 space-y-4">
              <div className="skeleton h-24 w-full" />
              <div className="skeleton h-24 w-full" />
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="mt-8 rounded-2xl border-2 border-dashed border-[var(--line)] bg-[var(--surface-2)] p-8 text-center">
              <span className="text-3xl">📂</span>
              <h3 className="mt-2 text-base font-bold text-[var(--ink)]">
                {language === "en"
                  ? "No navigation cases saved yet"
                  : "ابھی تک کوئی کیس محفوظ نہیں کیا گیا"}
              </h3>
              <p className="mt-1 text-xs text-[var(--muted)] max-w-sm mx-auto">
                {language === "en"
                  ? "Search for assistance or programs in chat and click 'Save to Case' to track your progress here."
                  : "چیٹ میں اپنی ضرورت تلاش کریں اور 'کیس محفوظ کریں' پر کلک کریں تاکہ آپ کی پیش رفت یہاں محفوظ رہے۔"}
              </p>
              <Link
                href="/chat"
                className="mt-4 inline-block rounded-xl bg-[var(--forest)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--forest-dark)]"
              >
                {language === "en" ? "Start In Chat →" : "چیٹ میں جائیں →"}
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {filteredCases.map((c) => {
                const completedActions = c.actions.filter((a) => a.completed).length;
                const totalActions = c.actions.length;
                const percent =
                  totalActions > 0
                    ? Math.round((completedActions / totalActions) * 100)
                    : 0;

                const caseTitle =
                  language === "en" ? c.title : c.titleUr || c.title;

                return (
                  <Link
                    href={`/cases/${c.id}`}
                    key={c.id}
                    className="card block rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm transition hover:border-[var(--forest)] hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--forest-light)] text-base">
                          {domainIcons[c.domain] || "📁"}
                        </span>
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-[var(--forest)]">
                            {c.domain}
                          </span>
                          <h2 className="text-base font-black text-[var(--ink)]">
                            {caseTitle}
                          </h2>
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          c.status === "resolved"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-[var(--muted)] line-clamp-2">
                      {c.summary}
                    </p>

                    {/* Progress */}
                    <div className="mt-4 border-t border-[var(--line-soft)] pt-3">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-[var(--forest)]">
                          {completedActions} / {totalActions}{" "}
                          {language === "en" ? "Steps Complete" : "مراحل مکمل"}
                        </span>
                        <span className="font-mono text-[var(--muted)]">
                          {percent}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-[var(--forest)] transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <footer className="border-t border-[var(--line)] pt-4 pb-2 text-center">
        <Link
          href="/"
          className="text-xs font-bold text-[var(--forest)] hover:underline"
        >
          ← {language === "en" ? "Return to Homepage" : "مرکزی صفحہ پر واپس جائیں"}
        </Link>
      </footer>
    </main>
  );
}