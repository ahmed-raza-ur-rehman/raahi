"use client";

import Link from "next/link";
import { useState } from "react";
import type { Language } from "@/lib/types";
import type { EcosystemApp } from "@/lib/opportunities/ecosystem";
import { FUNDING_LABELS, LEVEL_LABELS, FIELD_LABELS, countryLabel, pick, t } from "@/lib/opportunities/i18n";
import type { ChecklistItem, PlanStep } from "@/lib/opportunities/plan";
import type { OpportunityView } from "@/lib/opportunities/types";
import { OpportunityCard } from "./OpportunityCard";
import { deadlineInfo, formatDate } from "./format";
import { useLanguage } from "./useLanguage";
import { useSaved } from "./useSaved";
import { Chip, EcosystemStrip, KindBadge, Shell, StarIcon } from "./ui";

export interface PrepSuggestion {
  id: EcosystemApp["id"];
  name: string;
  nameUr: string;
  url: string;
  tagline: Record<Language, string>;
  cta: Record<Language, string>;
  boundary?: Record<Language, string>;
  reason: Record<Language, string>;
}

interface Props {
  item: OpportunityView;
  related: OpportunityView[];
  plan: PlanStep[];
  checklist: ChecklistItem[];
  prep: PrepSuggestion[];
}

export default function OpportunityDetail({ item, related, plan, checklist, prep }: Props) {
  const [language, setLanguage] = useLanguage();
  const { toggle, isSaved } = useSaved();
  const [copied, setCopied] = useState(false);

  const deadline = deadlineInfo(item, language);
  const overseasJob = item.kind === "job" && item.scope === "international" && !item.remote;
  const extra = item.extra ?? {};
  const facts: Array<[string, string]> = [];
  if (item.organization) facts.push([language === "en" ? "Organisation" : "ادارہ", item.organization]);
  if (item.country || item.remote) facts.push([t(language, "filterCountry"), item.remote ? t(language, "remote") : countryLabel(language, item.country as string)]);
  if (item.location && item.location !== item.country) facts.push([language === "en" ? "Location" : "مقام", item.location]);
  if (item.funding && item.funding !== "unknown") facts.push([t(language, "filterFunding"), pick(language, FUNDING_LABELS[item.funding])]);
  if (item.levels.length) facts.push([t(language, "filterLevel"), item.levels.map((l) => pick(language, LEVEL_LABELS[l])).join(", ")]);
  if (item.fields.length) facts.push([language === "en" ? "Field" : "شعبہ", item.fields.map((f) => (FIELD_LABELS[f] ? pick(language, FIELD_LABELS[f]) : f)).join(", ")]);
  if (typeof extra.grade === "string") facts.push([t(language, "grade"), extra.grade]);
  if (typeof extra.vacancies === "number") facts.push([t(language, "vacancies"), String(extra.vacancies)]);
  if (typeof extra.experienceYears === "number") facts.push([language === "en" ? "Experience" : "تجربہ", `${extra.experienceYears}+ ${language === "en" ? "years" : "سال"}`]);
  if (typeof extra.salary === "string") facts.push([t(language, "salary"), extra.salary]);
  if (typeof extra.prize === "string") facts.push([t(language, "prize"), extra.prize]);
  if (typeof extra.couponCode === "string") facts.push([language === "en" ? "Coupon code" : "کوپن کوڈ", extra.couponCode]);
  if (typeof extra.listPrice === "number") facts.push([t(language, "listPrice"), `$${extra.listPrice}`]);
  if (item.postedAt) facts.push([t(language, "posted"), formatDate(item.postedAt, language)]);
  facts.push([t(language, "firstSeen"), formatDate(item.firstSeen, language)]);

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${item.title}\n${window.location.href}`)}`, "_blank", "noopener,noreferrer");
  };
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: item.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // user cancelled sharing
    }
  };
  const askRaahi = `/chat?need=${encodeURIComponent(language === "en" ? `Tell me about "${item.title}" and how to apply safely` : `"${item.title}" کے بارے میں بتائیں اور محفوظ طریقے سے درخواست کیسے دوں`)}`;

  return (
    <Shell language={language} onLanguage={setLanguage} active="opportunities">
      <Link href="/opportunities" className="text-sm font-bold text-[var(--forest)] hover:underline">{t(language, "detailBack")}</Link>

      <article className="mt-3 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <header className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-1.5">
              <KindBadge kind={item.kind} language={language} />
              <Chip tone={deadline.tone}>⏳ {deadline.text}</Chip>
              {item.isNew && <Chip tone="ok">✨ {t(language, "badgeNew")}</Chip>}
              {item.openToPakistan === true && <Chip tone="ok" title={item.eligibilityNote}>✓ {t(language, "openToPk")}</Chip>}
              {item.openToPakistan === false && <Chip tone="closed" title={item.eligibilityNote}>⚠️ {t(language, "notOpenToPk")}</Chip>}
            </div>
            <h1 className="mt-3 text-xl font-black leading-snug text-[var(--ink)] sm:text-2xl" dir="auto">{item.title}</h1>
            {item.organization && <p className="mt-1 text-sm font-semibold text-[var(--muted)]" dir="auto">{item.organization}</p>}
            {item.summary && <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]" dir="auto">{item.summary}</p>}
            {(item.eligibilityNote || item.openToPakistan === undefined) && (
              <p className="mt-3 rounded-xl bg-[var(--amber-bg)] px-3 py-2 text-xs font-semibold text-[var(--amber)]">
                {item.eligibilityNote ?? t(language, "checkEligibility")}
              </p>
            )}
            {item.kind === "coupon" && <p className="mt-3 rounded-xl bg-[var(--amber-bg)] px-3 py-2 text-xs font-semibold text-[var(--amber)]">{t(language, "couponWarn")}</p>}

            <div className="mt-4 flex flex-wrap gap-2">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn-primary">{item.kind === "notice" ? t(language, "openSource") : t(language, "applyAtSource")} ↗</a>
              {item.deadline && item.status !== "closed" && (
                <>
                  <a href={`/api/opportunities/${item.id}/calendar`} className="btn-secondary">📅 {t(language, "addToCalendar")}</a>
                  {plan.length > 0 && <a href={`/api/opportunities/${item.id}/calendar?plan=1`} className="btn-secondary">🗓️ {t(language, "addPlanToCalendar")}</a>}
                </>
              )}
              <button
                type="button"
                onClick={() => toggle({ id: item.id, title: item.title, kind: item.kind, organization: item.organization, deadline: item.deadline, url: item.url, sourceName: item.sourceName })}
                aria-pressed={isSaved(item.id)}
                className="btn-secondary !gap-1.5"
              >
                <StarIcon filled={isSaved(item.id)} size={16} /> {isSaved(item.id) ? t(language, "saved") : t(language, "save")}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={shareWhatsApp} className="btn-ghost !text-xs">🟢 WhatsApp</button>
              <button type="button" onClick={share} className="btn-ghost !text-xs">🔗 {copied ? (language === "en" ? "Link copied" : "لنک کاپی ہو گیا") : language === "en" ? "Share" : "شیئر کریں"}</button>
              <Link href={askRaahi} className="btn-ghost !text-xs">💬 {t(language, "askRaahi")}</Link>
            </div>
          </header>

          {plan.length > 0 && (
            <section className="card p-5 sm:p-6" aria-labelledby="plan-title">
              <h2 id="plan-title" className="text-base font-black text-[var(--ink)]">🗓️ {t(language, "yourPlan")}</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">{t(language, "planNote")}</p>
              <ol className="mt-3 space-y-2.5">
                {plan.map((step, index) => (
                  <li key={step.id} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--forest-light)] text-xs font-black text-[var(--forest-dark)]">{index + 1}</span>
                    <div>
                      <p className="text-sm leading-relaxed text-[var(--ink)]">{language === "en" ? step.en : step.ur}</p>
                      <p className={`mt-0.5 text-[11px] font-bold ${step.late ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                        {step.due ? (step.late ? `${t(language, "doNow")} · ` : "") + formatDate(step.due, language) : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {checklist.length > 0 && item.kind !== "notice" && (
            <section className="card p-5 sm:p-6" aria-labelledby="check-title">
              <h2 id="check-title" className="text-base font-black text-[var(--ink)]">📄 {t(language, "checklist")}</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {checklist.map((entry) => (
                  <li key={entry.en} className="flex items-start gap-2 text-sm text-[var(--ink-soft)]">
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--forest)]" aria-label={entry.en} />
                    <span>{language === "en" ? entry.en : entry.ur}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {related.length > 0 && (
            <section aria-labelledby="related-title">
              <h2 id="related-title" className="mb-2 text-base font-black text-[var(--ink)]">{t(language, "similar")}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {related.map((entry) => (
                  <OpportunityCard
                    key={entry.id}
                    item={entry}
                    language={language}
                    saved={isSaved(entry.id)}
                    onToggleSave={(o) => toggle({ id: o.id, title: o.title, kind: o.kind, organization: o.organization, deadline: o.deadline, url: o.url, sourceName: o.sourceName })}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="card p-4" aria-label="Key facts">
            <dl className="space-y-2.5 text-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-3 border-b border-[var(--line-soft)] pb-2 last:border-0 last:pb-0">
                  <dt className="shrink-0 text-xs font-bold text-[var(--muted)]">{label}</dt>
                  <dd className="text-end font-semibold text-[var(--ink)]" dir="auto">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card p-4" aria-label="Source">
            <p className="text-xs text-[var(--muted)]">{t(language, "viaSource")}</p>
            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-black text-[var(--forest-dark)] hover:underline">{item.sourceName} ↗</a>
            {item.alsoOn && item.alsoOn.length > 0 && (
              <div className="mt-3 border-t border-[var(--line-soft)] pt-3">
                <p className="text-xs font-bold text-[var(--muted)]">{t(language, "alsoListedOn")}</p>
                <ul className="mt-1 space-y-1">
                  {item.alsoOn.map((other) => (
                    <li key={other.url}><a href={other.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[var(--forest)] hover:underline">{other.sourceName} ↗</a></li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className={`rounded-2xl border p-4 ${overseasJob ? "border-[var(--danger)] bg-[var(--danger-bg)]" : "border-[var(--line)] bg-[var(--surface-2)]"}`} aria-label={t(language, "safetyTitle")}>
            <h2 className="text-sm font-black text-[var(--ink)]">🛡️ {t(language, "safetyTitle")}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-soft)]">{t(language, overseasJob ? "safetyOverseas" : "safetyGeneric")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link href="/opportunities/tools" className="text-xs font-bold text-[var(--forest)] hover:underline">{t(language, "checkOffer")} →</Link>
              {overseasJob && <a href="https://beoe.gov.pk/list-of-oeps?show=active" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[var(--forest)] hover:underline">BE&amp;OE ↗</a>}
            </div>
          </section>

          {prep.length > 0 && (
            <section aria-label={t(language, "prepWith")} className="space-y-3">
              <h2 className="text-sm font-black text-[var(--ink)]">{t(language, "prepWith")}</h2>
              {prep.map((app) => (
                <a key={app.id} href={app.url} target="_blank" rel="noopener noreferrer" className="card block p-4 transition hover:-translate-y-0.5">
                  <p className="text-sm font-black text-[var(--forest-dark)]">{language === "en" ? app.name : app.nameUr} ↗</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--ink)]">{app.reason[language]}</p>
                  <p className="mt-1 text-xs text-[var(--ink-soft)]">{app.tagline[language]}</p>
                  {app.boundary && <p className="mt-1 text-[11px] text-[var(--muted)]">{app.boundary[language]}</p>}
                  <span className="btn-secondary mt-3 !min-h-9 !px-3 !py-1.5 !text-xs">{app.cta[language]}</span>
                </a>
              ))}
            </section>
          )}
        </aside>
      </article>

      <EcosystemStrip language={language} medium="opportunity-footer" />
    </Shell>
  );
}
