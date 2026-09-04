"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { CitationChip } from "@/components/chat/CitationChip";

export interface ProcedureStepItem {
  order: number;
  title: string;
  titleUr?: string;
  titlePs?: string;
  description: string;
  descriptionUr?: string;
  descriptionPs?: string;
  channel: string;
  url?: string;
  fee?: string;
  timeline?: string;
}

export interface ProcedureWalkthroughProps {
  serviceId: string;
  serviceName: string;
  serviceNameUr?: string;
  domain: string;
  organization: string;
  sourceUrl: string;
  sourceTitle: string;
  authorityTier?: number;
  lastVerified?: string;
  steps: ProcedureStepItem[];
  requiredDocuments?: {
    type: string;
    label: string;
    labelUr?: string;
    mandatory: boolean;
  }[];
  language?: "en" | "ur" | "ps";
}

export function ProcedureWalkthrough({
  serviceId,
  serviceName,
  serviceNameUr,
  domain,
  organization,
  sourceUrl,
  sourceTitle,
  authorityTier = 1,
  lastVerified,
  steps,
  requiredDocuments = [],
  language = "ur",
}: ProcedureWalkthroughProps) {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [activeStep, setActiveStep] = useState<number>(1);

  const storageKey = `raahi_proc_${serviceId}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setCompletedSteps(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  const toggleStep = (stepNumber: number) => {
    let next: number[];
    if (completedSteps.includes(stepNumber)) {
      next = completedSteps.filter((s) => s !== stepNumber);
    } else {
      next = [...completedSteps, stepNumber];
    }
    setCompletedSteps(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const progressPercent =
    steps.length > 0
      ? Math.round((completedSteps.length / steps.length) * 100)
      : 0;

  const title =
    language === "en" ? serviceName : serviceNameUr || serviceName;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-[var(--line)] bg-gradient-to-br from-emerald-50 via-white to-[var(--surface-2)] p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[var(--forest-light)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--forest)]">
              {domain}
            </span>
            <span className="text-xs text-[var(--muted)]">
              {organization}
            </span>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--ink)] shadow-sm hover:bg-slate-50"
          >
            🖨️ {language === "en" ? "Print Guide" : "رہنمائی پرنٹ کریں"}
          </button>
        </div>

        <h1 className="mt-3 text-2xl font-black text-[var(--ink)]">
          {title}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <CitationChip
            sourceUrl={sourceUrl}
            sourceTitle={sourceTitle}
            authorityTier={authorityTier}
            lastVerified={lastVerified}
          />
        </div>

        {/* Progress Bar */}
        <div className="mt-5 border-t border-[var(--line-soft)] pt-4">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-[var(--forest)]">
              {language === "en"
                ? `Progress: ${completedSteps.length} of ${steps.length} Steps Completed`
                : `پیش رفت: ${steps.length} میں سے ${completedSteps.length} مراحل مکمل`}
            </span>
            <span className="font-mono text-[var(--muted)]">
              {progressPercent}%
            </span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-[var(--forest)] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Required Documents Section */}
      {requiredDocuments.length > 0 && (
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
          <h2 className="text-base font-black text-[var(--ink)] flex items-center gap-2">
            <span>📑</span>
            <span>
              {language === "en"
                ? "Checklist: Documents to Prepare"
                : "ضروری دستاویزات کی فہرست"}
            </span>
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {language === "en"
              ? "Ensure you have these ready before starting the procedure"
              : "مراحل شروع کرنے سے پہلے یہ کاغذات اپنے پاس تیار رکھیں"}
          </p>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {requiredDocuments.map((doc, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-2)] p-2.5 text-xs"
              >
                <span className="text-sm">
                  {doc.mandatory ? "✅" : "📄"}
                </span>
                <span className="font-semibold text-[var(--ink)] flex-1">
                  {language === "en" ? doc.label : doc.labelUr || doc.label}
                </span>
                {doc.mandatory && (
                  <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                    {language === "en" ? "Mandatory" : "لازمی"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step-by-Step Timeline */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-[var(--ink)] flex items-center gap-2">
          <span>🚶</span>
          <span>
            {language === "en"
              ? "Official Step-by-Step Procedure"
              : "قدم بہ قدم مکمل طریقہ کار"}
          </span>
        </h2>

        {steps.map((step) => {
          const isDone = completedSteps.includes(step.order);
          const isActive = activeStep === step.order;

          const stepTitle =
            language === "en" ? step.title : step.titleUr || step.title;
          const stepDesc =
            language === "en"
              ? step.description
              : step.descriptionUr || step.description;

          return (
            <div
              key={step.order}
              className={`rounded-2xl border p-5 transition-all duration-200 ${
                isDone
                  ? "border-emerald-200 bg-emerald-50/30"
                  : isActive
                  ? "border-[var(--forest)] bg-white shadow-md ring-1 ring-[var(--forest)]"
                  : "border-[var(--line)] bg-white shadow-sm"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                      isDone
                        ? "bg-emerald-600 text-white"
                        : "bg-[var(--forest)] text-white"
                    }`}
                  >
                    {isDone ? "✓" : step.order}
                  </span>

                  <div>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--muted)]">
                      {step.channel || "Office / Online"}
                    </span>
                    <h3 className="text-base font-bold text-[var(--ink)] mt-0.5">
                      {stepTitle}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleStep(step.order)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    isDone
                      ? "bg-emerald-100 text-emerald-800"
                      : "border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] hover:border-[var(--forest)]"
                  }`}
                >
                  {isDone
                    ? language === "en"
                      ? "✓ Completed"
                      : "✓ مکمل کر لیا"
                    : language === "en"
                    ? "Mark as Done"
                    : "مکمل نشان زد کریں"}
                </button>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)] ps-11">
                {stepDesc}
              </p>

              {/* Step metadata (fees, link, channel) */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line-soft)] pt-3 ps-11 text-xs">
                <div className="flex items-center gap-3 text-[var(--muted)]">
                  {step.fee && <span>💰 {step.fee}</span>}
                  {step.timeline && <span>⏱️ {step.timeline}</span>}
                </div>

                {step.url && (
                  <a
                    href={step.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[var(--forest)] hover:underline"
                  >
                    <span>{language === "en" ? "Access Portal / Form" : "آن لائن فارم / پورٹل"}</span>
                    <span>↗</span>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between border-t border-[var(--line)] pt-6">
        <Link
          href="/chat"
          className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-bold text-[var(--forest)] hover:bg-slate-50"
        >
          ← {language === "en" ? "Back to Chat" : "چیٹ پر واپس جائیں"}
        </Link>

        <Link
          href="/cases"
          className="rounded-xl bg-[var(--forest)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--forest-dark)]"
        >
          {language === "en" ? "View My Cases →" : "میرے کیسز →"}
        </Link>
      </div>
    </div>
  );
}
