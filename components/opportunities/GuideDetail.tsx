"use client";

import Link from "next/link";
import type { DirectoryItem } from "@/lib/opportunities/directory";
import { CATEGORY_TITLES, pickText, type Guide, type GuideToolId, type LText } from "@/lib/opportunities/guides";
import { t, type StringKey } from "@/lib/opportunities/i18n";
import type { OpportunityView } from "@/lib/opportunities/types";
import { formatDate } from "./format";
import { OpportunityCard } from "./OpportunityCard";
import { AUTHORITY_KEY, Chip, LinkStatus, Shell } from "./ui";
import { useGuideProgress } from "./useGuideProgress";
import { useLanguage } from "./useLanguage";
import { useSaved } from "./useSaved";

interface Props {
  guide: Guide;
  resources: DirectoryItem[];
  live?: { items: OpportunityView[]; total: number };
  apps: Array<{ id: string; name: string; nameUr: string; url: string; tagline: LText; cta: LText }>;
  related: Array<{ id: string; emoji: string; title: LText }>;
}

const TOOL_LABEL: Record<GuideToolId, { key: StringKey; emoji: string }> = {
  scam: { key: "toolScam", emoji: "🛡️" },
  match: { key: "toolMatch", emoji: "🔎" },
  plan: { key: "toolPlan", emoji: "🗓️" },
  abroad: { key: "toolAgent", emoji: "✈️" },
};

function ResourceChip({ item, language }: { item: DirectoryItem; language: "en" | "ur" | "ps" }) {
  const name = language === "en" ? item.name : item.nameUr ?? item.name;
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${item.name} — ${t(language, AUTHORITY_KEY[item.authority])}`}
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold leading-none transition hover:border-[var(--forest)] hover:text-[var(--forest)] ${item.authority === 1 ? "border-[color:rgb(19_122_66/0.3)] bg-[var(--success-bg)] text-[var(--success)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)]"}`}
    >
      <span className="truncate" dir="auto">{name}</span>
      <span aria-hidden>↗</span>
    </a>
  );
}

export default function GuideDetail({ guide, resources, live, apps, related }: Props) {
  const [language, setLanguage] = useLanguage();
  const { ticked, toggle, reset } = useGuideProgress(guide.id);
  const { toggle: toggleSaved, isSaved } = useSaved();
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  const category = CATEGORY_TITLES[guide.category];
  const panel = guide.resourceIds.map((id) => byId.get(id)).filter((item): item is DirectoryItem => Boolean(item));
  const done = [...ticked].filter((index) => index < guide.checklist.length).length;

  return (
    <Shell language={language} onLanguage={setLanguage} active="guides">
      <nav aria-label="Breadcrumb" className="mb-3 text-xs font-bold">
        <Link href="/opportunities/guides" className="text-[var(--forest)] hover:underline">← {t(language, "guideAll")}</Link>
      </nav>

      <header className="rounded-3xl bg-gradient-to-br from-[var(--forest-deep)] via-[var(--forest-dark)] to-[var(--forest)] p-5 text-white shadow-[var(--shadow-forest)] sm:p-7">
        <p className="text-xs font-bold text-white/75">{category.emoji} {pickText(language, category)}</p>
        <h1 className="mt-1 flex items-start gap-3 text-2xl font-black leading-snug sm:text-3xl" dir="auto">
          <span aria-hidden>{guide.emoji}</span>
          <span>{pickText(language, guide.title)}</span>
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/90" dir="auto">{pickText(language, guide.summary)}</p>
        <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
          <div className="rounded-xl bg-white/10 px-3 py-2"><dt className="font-bold text-white/70">{t(language, "guideAudience")}</dt><dd className="mt-0.5 font-semibold" dir="auto">{pickText(language, guide.audience)}</dd></div>
          {guide.duration && <div className="rounded-xl bg-white/10 px-3 py-2"><dt className="font-bold text-white/70">{t(language, "guideTime")}</dt><dd className="mt-0.5 font-semibold" dir="auto">{pickText(language, guide.duration)}</dd></div>}
          <div className="rounded-xl bg-white/10 px-3 py-2"><dt className="font-bold text-white/70">{t(language, "guideReviewed")}</dt><dd className="mt-0.5 font-semibold">{formatDate(guide.reviewed, language)}</dd></div>
        </dl>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section aria-labelledby="steps-title">
            <h2 id="steps-title" className="text-lg font-black text-[var(--ink)]">{t(language, "guideSteps")}</h2>
            <ol className="mt-3 space-y-3">
              {guide.steps.map((step, index) => (
                <li key={index} className="card flex gap-3 p-4">
                  <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--forest)] text-sm font-black text-white">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    {step.when && <Chip tone="rolling">⏱ {pickText(language, step.when)}</Chip>}
                    <h3 className="mt-1 text-[15px] font-black leading-snug text-[var(--ink)]" dir="auto">{pickText(language, step.title)}</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-soft)]" dir="auto">{pickText(language, step.body)}</p>
                    {step.resourceIds && step.resourceIds.length > 0 && (
                      <p className="mt-2.5 flex flex-wrap gap-1.5">
                        {step.resourceIds.map((id) => byId.get(id)).filter((item): item is DirectoryItem => Boolean(item)).map((item) => <ResourceChip key={item.id} item={item} language={language} />)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="checklist-title" className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="checklist-title" className="text-lg font-black text-[var(--ink)]">{t(language, "guideChecklist")}</h2>
              <span className="text-xs font-bold text-[var(--forest)]" aria-live="polite">{done}/{guide.checklist.length} {t(language, "guideDone")}</span>
            </div>
            <ul className="mt-3 space-y-2">
              {guide.checklist.map((item, index) => (
                <li key={index}>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg p-1.5 text-[13px] leading-relaxed text-[var(--ink-soft)] hover:bg-[var(--surface-2)]">
                    <input type="checkbox" checked={ticked.has(index)} onChange={() => toggle(index)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--forest)]" />
                    <span className={ticked.has(index) ? "text-[var(--muted)] line-through" : ""} dir="auto">{pickText(language, item)}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
              <span>{t(language, "guideSaved")}</span>
              {done > 0 && <button type="button" onClick={reset} className="font-bold text-[var(--forest)] hover:underline">{t(language, "guideReset")}</button>}
            </p>
          </section>

          <section aria-labelledby="pitfalls-title" className="rounded-2xl border border-[color:rgb(184_102_8/0.3)] bg-[var(--amber-bg)] p-4">
            <h2 id="pitfalls-title" className="text-lg font-black text-[var(--amber)]">⚠️ {t(language, "guidePitfalls")}</h2>
            <ul className="mt-3 list-disc space-y-2 ps-5 text-[13px] leading-relaxed text-[var(--ink)]">
              {guide.pitfalls.map((item, index) => <li key={index} dir="auto">{pickText(language, item)}</li>)}
            </ul>
          </section>

          {live && live.items.length > 0 && (
            <section aria-labelledby="live-title">
              <h2 id="live-title" className="text-lg font-black text-[var(--ink)]">⚡ {t(language, "guideLive")}</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {live.items.map((item) => (
                  <OpportunityCard
                    key={item.id}
                    item={item}
                    language={language}
                    saved={isSaved(item.id)}
                    onToggleSave={() => toggleSaved({ id: item.id, title: item.title, kind: item.kind, organization: item.organization, deadline: item.deadline, url: item.url, sourceName: item.sourceName })}
                  />
                ))}
              </div>
              <p className="mt-3 text-center">
                <Link href={`/opportunities?${new URLSearchParams({ kind: (guide.opportunityQuery?.kinds ?? []).join(","), ...(guide.opportunityQuery?.scope ? { scope: guide.opportunityQuery.scope } : {}) }).toString()}`} className="text-xs font-bold text-[var(--forest)] hover:underline">{t(language, "guideLiveAll")} ({live.total}) →</Link>
              </p>
            </section>
          )}
        </div>

        <aside className="space-y-4" aria-label="Reference">
          <section className="card p-4">
            <h2 className="text-sm font-black text-[var(--ink)]">🔗 {t(language, "guideOfficial")}</h2>
            <ul className="mt-3 space-y-2.5">
              {panel.map((item) => (
                <li key={item.id} className="flex flex-col gap-1">
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-[var(--forest-dark)] hover:underline" dir="auto">{language === "en" ? item.name : item.nameUr ?? item.name} ↗</a>
                  <span className="flex flex-wrap gap-1"><Chip tone={item.authority === 1 ? "ok" : item.authority === 4 ? "soon" : "none"}>{t(language, AUTHORITY_KEY[item.authority])}</Chip><LinkStatus item={item} language={language} /></span>
                </li>
              ))}
            </ul>
          </section>

          {guide.tools && guide.tools.length > 0 && (
            <section className="card p-4">
              <h2 className="text-sm font-black text-[var(--ink)]">🧰 {t(language, "guideTools")}</h2>
              <p className="mt-3 flex flex-wrap gap-2">
                {guide.tools.map((tool) => (
                  <Link key={tool} href={`/opportunities/tools?tool=${tool}`} className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs">{TOOL_LABEL[tool].emoji} {t(language, TOOL_LABEL[tool].key)}</Link>
                ))}
              </p>
            </section>
          )}

          {apps.length > 0 && (
            <section className="card p-4">
              <h2 className="text-sm font-black text-[var(--ink)]">🧠 {t(language, "guideApps")}</h2>
              <ul className="mt-3 space-y-3">
                {apps.map((app) => (
                  <li key={app.id}>
                    <a href={app.url} target="_blank" rel="noopener noreferrer" className="text-[13px] font-black text-[var(--forest-dark)] hover:underline">{language === "en" ? app.name : app.nameUr} ↗</a>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-soft)]" dir="auto">{pickText(language, app.tagline)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {related.length > 0 && (
            <section className="card p-4">
              <h2 className="text-sm font-black text-[var(--ink)]">📚 {t(language, "guideRelated")}</h2>
              <ul className="mt-3 space-y-2">
                {related.map((entry) => (
                  <li key={entry.id}><Link href={`/opportunities/guides/${entry.id}`} className="text-[13px] font-bold text-[var(--forest-dark)] hover:underline" dir="auto">{entry.emoji} {pickText(language, entry.title)}</Link></li>
                ))}
              </ul>
            </section>
          )}

          <Link href="/chat" className="btn-primary w-full justify-center !text-sm">💬 {t(language, "guideAsk")}</Link>
        </aside>
      </div>

      <p className="mt-8 rounded-2xl bg-[var(--surface-2)] p-4 text-center text-xs leading-relaxed text-[var(--muted)]">
        {t(language, "guideDisclaimer")}
        {guide.sources && guide.sources.length > 0 && (
          <span className="mt-1 block">
            {t(language, "guideSources")}:{" "}
            {guide.sources.map((url, index) => (
              <span key={url}>{index > 0 && " · "}<a href={url} target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--forest)] hover:underline" dir="ltr">{new URL(url).hostname}</a></span>
            ))}
          </span>
        )}
      </p>
    </Shell>
  );
}
