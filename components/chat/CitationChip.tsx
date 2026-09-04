"use client";

import React from "react";

interface CitationChipProps {
  sourceUrl: string;
  sourceTitle: string;
  authorityTier?: number;
  lastVerified?: string;
  compact?: boolean;
}

export function CitationChip({
  sourceUrl,
  sourceTitle,
  authorityTier = 1,
  lastVerified,
  compact = false,
}: CitationChipProps) {
  const tierClasses: Record<number, { bg: string; text: string; border: string; label: string; labelUr: string }> = {
    1: {
      bg: "bg-sky-50",
      text: "text-sky-800",
      border: "border-sky-200",
      label: "Tier 1: Official Federal/Provincial",
      labelUr: "درجہ ۱: وفاقی / صوبائی سرکاری",
    },
    2: {
      bg: "bg-emerald-50",
      text: "text-emerald-800",
      border: "border-emerald-200",
      label: "Tier 2: Statutory / Recognized NGO",
      labelUr: "درجہ ۲: قانونی ادارہ / مستند این جی او",
    },
    3: {
      bg: "bg-purple-50",
      text: "text-purple-800",
      border: "border-purple-200",
      label: "Tier 3: Verified Community Partner",
      labelUr: "درجہ ۳: تصدیق شدہ فلاحی ادارہ",
    },
  };

  const tier = tierClasses[authorityTier] || tierClasses[1];

  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={`${sourceTitle} (${tier.label}) ${lastVerified ? `· Verified: ${lastVerified}` : ""}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition hover:opacity-85 ${tier.bg} ${tier.text} ${tier.border}`}
    >
      <span className="text-[10px]">🛡️</span>
      <span className="truncate max-w-[160px] sm:max-w-[220px]">{sourceTitle}</span>
      {lastVerified && !compact && (
        <span className="opacity-70 text-[10px]">
          ({lastVerified})
        </span>
      )}
      <svg
        className="h-3 w-3 opacity-60"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
        />
      </svg>
    </a>
  );
}
