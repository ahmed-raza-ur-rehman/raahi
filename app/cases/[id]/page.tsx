"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { CitizenCase } from "@/lib/types";

interface CaseDetailProps {
  params: Promise<{ id: string }>;
}

export default function CaseDetailPage({ params }: CaseDetailProps) {
  const [caseItem, setCaseItem] = useState<CitizenCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<"en" | "ur">("ur");
  const [caseId, setCaseId] = useState<string>("");

  useEffect(() => {
    params.then(({ id }) => {
      setCaseId(id);
      fetch(`/api/cases/${id}`)
        .then((res) => {
          if (!res.ok) throw new Error("Case not found");
          return res.json();
        })
        .then((data) => {
          setCaseItem(data.case);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    });
  }, [params]);

  const toggleAction = async (actionId: string, currentStatus: boolean) => {
    if (!caseItem) return;

    // Optimistic update
    setCaseItem({
      ...caseItem,
      actions: caseItem.actions.map((a) =>
        a.id === actionId ? { ...a, completed: !currentStatus } : a
      ),
    });

    try {
      await fetch(`/api/cases/${caseItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, completed: !currentStatus }),
      });
    } catch {
      // Revert on error
      setCaseItem(caseItem);
    }
  };

  const toggleStatus = async () => {
    if (!caseItem) return;
    const newStatus = caseItem.status === "active" ? "resolved" : "active";

    setCaseItem({ ...caseItem, status: newStatus });
    await fetch(`/api/cases/${caseItem.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  };

  if (loading) {
    return (
      <main className="app-shell min-h-screen p-6" dir="rtl">
        <div className="space-y-4 py-8">
          <div className="skeleton h-10 w-48" />
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-48 w-full" />
        </div>
      </main>
    );
  }

  if (error || !caseItem) {
    return (
      <main className="app-shell min-h-screen p-6 text-center py-12" dir="rtl">
        <span className="text-3xl">⚠️</span>
        <h1 className="mt-3 text-lg font-black text-[var(--ink)]">کیس نہیں مل سکا</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          ہو سکتا ہے یہ کیس حذف ہو چکا ہو یا دوسرا سیشن استعمال ہو رہا ہو۔
        </p>
        <Link
          href="/cases"
          className="mt-4 inline-block rounded-xl bg-[var(--forest)] px-4 py-2 text-xs font-bold text-white"
        >
          تمام کیسز دیکھیں
        </Link>
      </main>
    );
  }

  const completedCount = caseItem.actions.filter((a) => a.completed).length;
  const totalCount = caseItem.actions.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <main
      className="app-shell min-h-screen px-4 sm:px-6 py-5 flex flex-col justify-between"
      dir={language === "en" ? "ltr" : "rtl"}
    >
      <div>
        {/* Navigation Bar */}
        <header className="flex items-center justify-between border-b border-[var(--line)] pb-4">
          <Link
            href="/cases"
            className="flex items-center gap-1.5 text-xs font-bold text-[var(--forest)] hover:underline"
          >
            ← {language === "en" ? "All Cases" : "میرے تمام کیسز"}
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-slate-50"
            >
              🖨️ {language === "en" ? "Print" : "پرنٹ"}
            </button>

            <button
              type="button"
              onClick={() => setLanguage(language === "en" ? "ur" : "en")}
              className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-xs font-bold text-[var(--forest)]"
            >
              {language === "en" ? "اردو" : "English"}
            </button>
          </div>
        </header>

        {/* Case Header Card */}
        <section className="py-6">
          <div className="rounded-2xl border border-[var(--line)] bg-gradient-to-br from-[#f8fcf9] via-white to-[var(--surface-2)] p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="rounded-full bg-[var(--forest-light)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--forest)]">
                {caseItem.domain}
              </span>

              <button
                type="button"
                onClick={toggleStatus}
                className={`rounded-full px-3 py-1 text-xs font-bold border transition ${
                  caseItem.status === "resolved"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                }`}
              >
                {caseItem.status === "resolved"
                  ? language === "en"
                    ? "✓ Resolved"
                    : "✓ حل شدہ"
                  : language === "en"
                  ? "• Active (Click to close)"
                  : "• جاری ہے (مکمل نشان زد کریں)"}
              </button>
            </div>

            <h1 className="mt-3 text-2xl font-black text-[var(--ink)]">
              {language === "en" ? caseItem.title : caseItem.titleUr || caseItem.title}
            </h1>

            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              {caseItem.summary}
            </p>

            {/* Progress Bar */}
            <div className="mt-5 border-t border-[var(--line-soft)] pt-4">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[var(--forest)]">
                  {language === "en"
                    ? `Action Progress: ${completedCount} of ${totalCount} Done`
                    : `اقدامات: ${totalCount} میں سے ${completedCount} مکمل`}
                </span>
                <span className="font-mono text-[var(--muted)]">{percent}%</span>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-[var(--forest)] transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Action Items Checklist */}
        <section className="mt-2">
          <h2 className="text-base font-black text-[var(--ink)] flex items-center gap-2">
            <span>✅</span>
            <span>{language === "en" ? "Action Steps" : "ضروری اقدامات کی فہرست"}</span>
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {language === "en"
              ? "Mark each step as completed as you progress"
              : "جیسے جیسے مرحلہ مکمل ہوتا جائے، اس پر نشان لگاتے جائیں"}
          </p>

          <div className="mt-4 space-y-2.5">
            {caseItem.actions.map((action, idx) => (
              <label
                key={action.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                  action.completed
                    ? "border-emerald-200 bg-emerald-50/40"
                    : "border-[var(--line)] bg-white hover:border-[var(--forest)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={action.completed}
                  onChange={() => toggleAction(action.id, action.completed)}
                  className="mt-1 h-4 w-4 rounded text-[var(--forest)] focus:ring-[var(--forest)] cursor-pointer"
                />
                <div className="flex-1 text-sm">
                  <span
                    className={`font-semibold ${
                      action.completed ? "line-through opacity-70" : "text-[var(--ink)]"
                    }`}
                  >
                    <span className="me-2 text-xs opacity-60 font-mono">#{idx + 1}</span>
                    {language === "en" ? action.label : action.labelUr || action.label}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Associated Services & Procedures */}
        {caseItem.serviceIds && caseItem.serviceIds.length > 0 && (
          <section className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
            <h2 className="text-base font-black text-[var(--ink)] flex items-center gap-2">
              <span>🏛️</span>
              <span>
                {language === "en" ? "Linked Services & Guides" : "منسلک خدمات و طریقہ کار"}
              </span>
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {caseItem.serviceIds.map((sId) => (
                <Link
                  key={sId}
                  href={`/procedure/${sId}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--forest)] bg-[var(--forest-light)] px-3 py-1.5 text-xs font-bold text-[var(--forest)] hover:bg-[var(--forest)] hover:text-white transition"
                >
                  <span>📋 {language === "en" ? "Procedure Guide" : "رہنمائی گائیڈ"}:</span>
                  <span className="font-mono">{sId}</span>
                  <span>→</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Footer CTA */}
      <footer className="mt-10 border-t border-[var(--line)] pt-5 pb-3 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/chat?need=${encodeURIComponent(caseItem.title)}`}
          className="rounded-xl bg-[var(--forest)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--forest-dark)] transition"
        >
          💬 {language === "en" ? "Continue In Chat" : "چیٹ میں گفتگو جاری رکھیں"}
        </Link>

        <Link
          href="/cases"
          className="text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)]"
        >
          {language === "en" ? "← Back to list" : "← فہرست پر واپس جائیں"}
        </Link>
      </footer>
    </main>
  );
}