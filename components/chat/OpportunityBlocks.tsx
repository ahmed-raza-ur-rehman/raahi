"use client";

import Link from "next/link";
import type { ChatGuideCard, CompactOpportunity } from "@/lib/ai/opportunity-tools";
import { KIND_LABELS, pick, t } from "@/lib/opportunities/i18n";
import type { OpportunityKind } from "@/lib/opportunities/types";

type Language = "en" | "ur" | "ps";

export interface ChatResource {
  id: string;
  name: string;
  name_ur?: string;
  url: string;
  run_by?: string;
  link_confirmed_on?: string;
  description?: string;
  note?: string;
}

export interface ChatRisk {
  level: "high" | "medium";
  score: number;
  headline: { en: string; ur: string };
  signals: Array<{ en: string; ur: string }>;
  advice: Array<{ en: string; ur: string; url?: string; label?: { en: string; ur: string } }>;
}

interface Props {
  opportunities?: CompactOpportunity[];
  resources?: ChatResource[];
  risk?: ChatRisk;
  guides?: ChatGuideCard[];
  language: Language;
}

function deadlineText(item: CompactOpportunity, language: Language): string {
  if (item.kind === "coupon") return t(language, "couponWarn").split(".")[0];
  if (item.deadline && item.days_left !== null) {
    if (item.days_left < 0) return `${t(language, "closedAgo")} ${Math.abs(item.days_left)} ${t(language, "daysAgo")}`;
    if (item.days_left === 0) return t(language, "closesToday");
    return `${t(language, "closesIn")} ${item.days_left} ${t(language, "days")} · ${item.deadline}`;
  }
  return t(language, "noDeadline");
}

/** Cards the assistant attaches to a reply: scam warning, live listings, official portals. */
export function ChatOpportunityBlocks({ opportunities = [], resources = [], risk, guides = [], language }: Props) {
  if (opportunities.length === 0 && resources.length === 0 && guides.length === 0 && !risk) return null;
  const lang = language === "en" ? "en" : "ur";

  return (
    <div className="mt-4 w-full space-y-4 ps-1 sm:ps-4">
      {guides.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-[var(--muted)]">📘 {lang === "en" ? "Step-by-step guide" : "مرحلہ وار رہنمائی"}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {guides.map((guide) => (
              <li key={guide.id}>
                <Link href={guide.url} className="card flex h-full flex-col gap-1.5 p-3.5 transition hover:-translate-y-0.5">
                  <span className="text-sm font-black text-[var(--forest-dark)]" dir="auto">{guide.emoji} {guide.title[lang]}</span>
                  <span className="text-xs leading-relaxed text-[var(--ink-soft)]" dir="auto">{guide.summary[lang]}</span>
                  <span className="mt-auto text-[11px] font-bold text-[var(--forest)]">{guide.steps} {lang === "en" ? "steps" : "مراحل"} · {lang === "en" ? "Open guide" : "رہنمائی کھولیں"} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {risk && (
        <div role="alert" className={`rounded-2xl border p-4 ${risk.level === "high" ? "border-[var(--danger)] bg-[var(--danger-bg)]" : "border-[var(--amber)] bg-[var(--amber-bg)]"}`}>
          <p className="text-sm font-black text-[var(--ink)]">🛡️ {risk.headline[lang]} <span className="text-xs font-bold text-[var(--muted)]">({risk.score}/100)</span></p>
          <ul className="mt-2 space-y-1.5">
            {risk.signals.map((signal) => <li key={signal.en} className="text-xs leading-relaxed text-[var(--ink-soft)]">• {signal[lang]}</li>)}
          </ul>
          <ul className="mt-3 space-y-1.5 border-t border-[var(--line)] pt-3">
            {risk.advice.map((advice) => (
              <li key={advice.en} className="text-xs leading-relaxed text-[var(--ink)]">
                {advice[lang]}{" "}
                {advice.url && advice.label && <a href={advice.url} target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--forest)] hover:underline">{advice.label[lang]} ↗</a>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {opportunities.length > 0 && (
        <section aria-label={t(language, "navOpportunities")}>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--forest)]">
            <span aria-hidden>🎓</span> {t(language, "navOpportunities")} ({opportunities.length})
          </p>
          <ul className="mt-2 space-y-2.5">
            {opportunities.map((item) => (
              <li key={item.id} className="card p-3.5">
                <p className="text-[11px] font-bold text-[var(--forest)]">
                  {KIND_LABELS[item.kind as OpportunityKind]?.emoji} {KIND_LABELS[item.kind as OpportunityKind] ? pick(language, KIND_LABELS[item.kind as OpportunityKind]) : item.kind}
                  {item.country ? ` · ${item.country}` : ""}
                  {item.open_to_pakistan === true && item.scope === "international" ? ` · ✓ ${t(language, "openToPk")}` : ""}
                </p>
                <Link href={item.raahi_url} className="mt-0.5 block text-sm font-black text-[var(--ink)] hover:underline" dir="auto">{item.title}</Link>
                {item.organization && <p className="text-xs text-[var(--muted)]" dir="auto">{item.organization}</p>}
                <p className="mt-1.5 text-xs font-semibold text-[var(--ink-soft)]">⏳ {deadlineText(item, language)}</p>
                {item.eligibility_note && item.open_to_pakistan !== true && <p className="mt-1 text-[11px] text-[var(--amber)]">{item.eligibility_note}</p>}
                {item.prep && item.prep.length > 0 && (
                  <p className="mt-1.5 text-[11px] text-[var(--muted)]">
                    {item.prep.map((app) => <a key={app.name} href={app.url} target="_blank" rel="noopener noreferrer" className="me-2 font-bold text-[var(--forest)] hover:underline">{app.name} ↗</a>)}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
                  <span>{t(language, "viaSource")} {item.source_name}</span>
                  <span className="flex gap-2">
                    <Link href={item.raahi_url} className="font-bold text-[var(--forest)] hover:underline">{t(language, "details")}</Link>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--forest)] hover:underline">{t(language, "applyAtSource")} ↗</a>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <Link href="/opportunities" className="mt-2 inline-block text-xs font-bold text-[var(--forest)] hover:underline">{t(language, "homeAll")} →</Link>
        </section>
      )}

      {resources.length > 0 && (
        <section aria-label={t(language, "navResources")}>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--forest)]">
            <span aria-hidden>🔗</span> {t(language, "navResources")}
          </p>
          <ul className="mt-2 space-y-2">
            {resources.map((resource) => (
              <li key={resource.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-sm font-black text-[var(--forest-dark)] hover:underline" dir="auto">
                  {language === "en" ? resource.name : resource.name_ur ?? resource.name} ↗
                </a>
                {resource.run_by && <p className="text-[11px] font-semibold text-[var(--muted)]">{resource.run_by}{resource.link_confirmed_on ? ` · ✓ ${resource.link_confirmed_on}` : ""}</p>}
                {resource.note && <p className="mt-1 text-[11px] text-[var(--amber)]">{resource.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
