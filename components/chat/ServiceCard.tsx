"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CitationChip } from "./CitationChip";

export interface ServiceCardProps {
  service: {
    id: string;
    name: string;
    nameUr: string;
    namePs?: string;
    domain: string;
    description: string;
    descriptionUr: string;
    descriptionPs?: string;
    applicationMethod?: string;
    sourceUrl: string;
    sourceTitle: string;
    sourceAuthorityTier?: number;
    lastVerified?: string;
    coverage?: string[];
    requiredDocuments?: {
      type: string;
      label: string;
      labelUr: string;
      mandatory: boolean;
    }[];
    procedure?: {
      order: number;
      title: string;
      titleUr: string;
      description: string;
      descriptionUr: string;
      channel: string;
      url?: string;
    }[];
  };
  eligibility?: {
    status: "likely" | "possible" | "unlikely" | "unknown";
    confidenceReason?: string;
    missingInfo?: string[];
    missingDocuments?: string[];
  };
  language?: "en" | "ur" | "ps";
  onAddToCase?: (serviceId: string) => void;
  isAddedToCase?: boolean;
}

const domainIcons: Record<string, string> = {
  welfare: "💰",
  education: "🎓",
  health: "🏥",
  documentation: "📄",
  legal: "⚖️",
  employment: "💼",
  disaster: "🚨",
};

const domainLabels: Record<string, { en: string; ur: string; ps: string }> = {
  welfare: { en: "Social Welfare", ur: "سماجی بہبود", ps: "ټولنیزه هوساینه" },
  education: { en: "Education", ur: "تعلیم اور وظائف", ps: "ښوونه او روزنه" },
  health: { en: "Healthcare", ur: "صحت و علاج", ps: "روغتیا او درملنه" },
  documentation: { en: "NADRA & Documents", ur: "شناختی دستاویزات", ps: "نادرا او اسناد" },
  legal: { en: "Legal Aid", ur: "قانونی معاونت", ps: "قانوني مرسته" },
  employment: { en: "Skills & Jobs", ur: "روزگار و ہنر", ps: "مهارتونه او کار" },
  disaster: { en: "Emergency & Relief", ur: "ہنگامی امداد", ps: "بیړنۍ مرستې" },
};

const statusConfig = {
  likely: {
    en: "Likely Eligible",
    ur: "ممکنہ طور پر اہل",
    ps: "احتمالي وړ",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-300",
    icon: "✅",
  },
  possible: {
    en: "May Be Eligible",
    ur: "امکان موجود ہے",
    ps: "ممکن دی",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-300",
    icon: "ℹ️",
  },
  unlikely: {
    en: "Unlikely Eligible",
    ur: "اہلیت کا امکان کم ہے",
    ps: "احتمال کم دی",
    badgeClass: "bg-rose-50 text-rose-800 border-rose-300",
    icon: "⚠️",
  },
  unknown: {
    en: "Information Needed",
    ur: "مزید معلومات درکار ہیں",
    ps: "نورو معلوماتو ته اړتیا",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
    icon: "❓",
  },
};

export function ServiceCard({
  service,
  eligibility = { status: "possible", confidenceReason: "Official review required" },
  language = "ur",
  onAddToCase,
  isAddedToCase = false,
}: ServiceCardProps) {
  const [showProcedure, setShowProcedure] = useState(false);

  const title =
    language === "en"
      ? service.name
      : language === "ps" && service.namePs
      ? service.namePs
      : service.nameUr || service.name;

  const description =
    language === "en"
      ? service.description
      : language === "ps" && service.descriptionPs
      ? service.descriptionPs
      : service.descriptionUr || service.description;

  const domainLabel =
    domainLabels[service.domain]?.[language] || service.domain;
  const statusInfo = statusConfig[eligibility.status] || statusConfig.possible;
  const statusText = statusInfo[language];

  return (
    <article className="card rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm transition hover:shadow-md">
      {/* Header with Domain & Status */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line-soft)] pb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--forest-light)] text-lg">
            {domainIcons[service.domain] || "📋"}
          </span>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--forest)]">
              {domainLabel}
            </span>
            <h3 className="text-lg font-black text-[var(--ink)] leading-snug mt-0.5">
              {title}
            </h3>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${statusInfo.badgeClass}`}
        >
          <span>{statusInfo.icon}</span>
          <span>{statusText}</span>
        </span>
      </div>

      {/* Description */}
      <p className="mt-3.5 text-sm leading-relaxed text-[var(--ink-soft)] opacity-90">
        {description}
      </p>

      {/* Eligibility reason */}
      {eligibility.confidenceReason && (
        <div className="mt-3 rounded-xl bg-[var(--surface-2)] p-2.5 text-xs font-medium text-[var(--muted)] flex items-start gap-2">
          <span className="text-sm shrink-0">💡</span>
          <span>{eligibility.confidenceReason}</span>
        </div>
      )}

      {/* Required Documents */}
      {service.requiredDocuments && service.requiredDocuments.length > 0 && (
        <div className="mt-4 rounded-xl border border-[var(--line-soft)] bg-[#f9fbf9] p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--ink)] flex items-center gap-1.5">
            <span>📑</span>
            <span>
              {language === "en"
                ? "Required Documents"
                : language === "ps"
                ? "اړین اسناد"
                : "لازمی دستاویزات"}
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {service.requiredDocuments.map((doc, idx) => (
              <span
                key={idx}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
                  doc.mandatory
                    ? "bg-emerald-100/70 text-emerald-900 font-semibold"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                <span>{doc.mandatory ? "•" : "○"}</span>
                <span>{language === "en" ? doc.label : doc.labelUr || doc.label}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Expandable Procedure Steps */}
      {service.procedure && service.procedure.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowProcedure(!showProcedure)}
            className="flex items-center gap-2 text-xs font-bold text-[var(--forest)] hover:underline"
          >
            <span>{showProcedure ? "▲" : "▼"}</span>
            <span>
              {language === "en"
                ? `${showProcedure ? "Hide" : "Preview"} Step-by-Step Procedure (${service.procedure.length} steps)`
                : language === "ps"
                ? `${showProcedure ? "پټ کړئ" : "وګورئ"} پړاو په پړاو طریقه (${service.procedure.length} ګامونه)`
                : `${showProcedure ? "چھپائیں" : "دیکھیں"} قدم بہ قدم طریقہ کار (${service.procedure.length} مراحل)`}
            </span>
          </button>

          {showProcedure && (
            <ol className="mt-3 space-y-2.5 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-2)] p-3 text-xs leading-relaxed animate-fade-in">
              {service.procedure.map((step) => (
                <li key={step.order} className="flex gap-2.5 items-start">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--forest)] text-[10px] font-bold text-white">
                    {step.order}
                  </span>
                  <div>
                    <p className="font-bold text-[var(--ink)]">
                      {language === "en" ? step.title : step.titleUr || step.title}
                    </p>
                    <p className="text-[var(--muted)] mt-0.5">
                      {language === "en"
                        ? step.description
                        : step.descriptionUr || step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Footer & Actions */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line-soft)] pt-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <CitationChip
            sourceUrl={service.sourceUrl}
            sourceTitle={service.sourceTitle}
            authorityTier={service.sourceAuthorityTier ?? 1}
            lastVerified={service.lastVerified}
            compact
          />
        </div>

        <div className="flex items-center gap-2">
          {onAddToCase && (
            <button
              type="button"
              onClick={() => onAddToCase(service.id)}
              disabled={isAddedToCase}
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                isAddedToCase
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                  : "border-[var(--line)] bg-white text-[var(--forest)] hover:bg-[var(--forest-light)]"
              }`}
            >
              {isAddedToCase
                ? language === "en"
                  ? "✓ Saved"
                  : "✓ شامل ہے"
                : language === "en"
                ? "+ Add to Case"
                : "+ کیس میں شامل کریں"}
            </button>
          )}

          <Link
            href={`/procedure/${service.id}`}
            className="rounded-lg bg-[var(--forest)] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[var(--forest-dark)]"
          >
            {language === "en"
              ? "Full Guide →"
              : language === "ps"
              ? "بشپړ لارښود →"
              : "مکمل رہنمائی →"}
          </Link>
        </div>
      </div>
    </article>
  );
}
