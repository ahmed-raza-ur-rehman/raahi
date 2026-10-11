"use client";

import Link from "next/link";
import type { LText } from "@/lib/opportunities/guides";
import { pickText } from "@/lib/opportunities/guides";
import { t } from "@/lib/opportunities/i18n";
import { formatDate } from "./format";
import { useLanguage } from "./useLanguage";
import { Chip, Shell } from "./ui";

export interface GuideCard {
  id: string;
  category: string;
  emoji: string;
  title: LText;
  summary: LText;
  duration?: LText;
  steps: number;
  reviewed: string;
}

interface Props {
  guides: GuideCard[];
  categories: Array<{ id: string; emoji: string; label: { en: string; ur: string }; count: number }>;
  q: string;
  category: string;
  total: number;
}

const href = (q: string, category: string) => {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  const query = params.toString();
  return `/opportunities/guides${query ? `?${query}` : ""}`;
};

/** Search is a plain GET form: it works without JavaScript and every result page is a shareable link. */
export default function GuidesPage({ guides, categories, q, category, total }: Props) {
  const [language, setLanguage] = useLanguage();
  return (
    <Shell language={language} onLanguage={setLanguage} active="guides">
      <section className="rounded-3xl bg-gradient-to-br from-[var(--forest-deep)] via-[var(--forest-dark)] to-[var(--forest)] p-5 text-white shadow-[var(--shadow-forest)] sm:p-7">
        <h1 className="text-2xl font-black sm:text-3xl">{t(language, "guidesTitle")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/85">{t(language, "guidesSub")}</p>
        <form action="/opportunities/guides" method="get" role="search" className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="guide-search">{t(language, "guidesSearch")}</label>
          <input id="guide-search" name="q" defaultValue={q} placeholder={t(language, "guidesSearch")} className="input-field !bg-white !text-[var(--ink)] sm:flex-1" dir="auto" autoComplete="off" />
          {category && <input type="hidden" name="category" value={category} />}
          <button type="submit" className="btn-primary !bg-none !bg-white !text-[var(--forest-dark)] sm:w-auto">{t(language, "search")}</button>
        </form>
      </section>

      <nav aria-label="Categories" className="mt-4 flex flex-wrap gap-1.5">
        <Link href={href(q, "")} aria-current={category === "" ? "page" : undefined} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${category === "" ? "border-[var(--forest)] bg-[var(--forest)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--forest)]"}`}>
          {t(language, "all")}
        </Link>
        {categories.map((entry) => (
          <Link key={entry.id} href={href(q, category === entry.id ? "" : entry.id)} aria-current={category === entry.id ? "page" : undefined} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${category === entry.id ? "border-[var(--forest)] bg-[var(--forest)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--forest)]"}`}>
            {entry.emoji} {language === "en" ? entry.label.en : entry.label.ur}
            {category !== entry.id && ` · ${entry.count}`}
          </Link>
        ))}
      </nav>

      {guides.length === 0 ? (
        <p className="card mt-5 p-6 text-center text-sm text-[var(--muted)]">
          {t(language, "guidesNone")}
          <span className="mt-3 block">
            <Link href="/chat" className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs">💬 {t(language, "navChat")}</Link>
          </span>
        </p>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {guides.map((guide) => (
            <article key={guide.id} className="card flex flex-col gap-2.5 p-4 transition hover:-translate-y-0.5">
              <div className="flex items-start gap-3">
                <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--forest-light)] text-2xl">{guide.emoji}</span>
                <h2 className="text-[15px] font-black leading-snug text-[var(--ink)]" dir="auto">
                  <Link href={`/opportunities/guides/${guide.id}`} className="hover:text-[var(--forest)] hover:underline">{pickText(language, guide.title)}</Link>
                </h2>
              </div>
              <p className="text-[13px] leading-relaxed text-[var(--ink-soft)]" dir="auto">{pickText(language, guide.summary)}</p>
              <div className="flex flex-wrap gap-1.5">
                <Chip>{guide.steps} {t(language, "guideStepsWord")}</Chip>
                {guide.duration && <Chip>⏱ {pickText(language, guide.duration)}</Chip>}
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--line-soft)] pt-3">
                <span className="text-[11px] text-[var(--muted)]">{t(language, "guideReviewed")}: {formatDate(guide.reviewed, language)}</span>
                <Link href={`/opportunities/guides/${guide.id}`} className="btn-primary !min-h-9 !px-3 !py-1.5 !text-xs">{t(language, "guideOpen")} →</Link>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="mt-6 text-center text-xs text-[var(--muted)]">{guides.length} / {total} · {t(language, "guideDisclaimer")}</p>
    </Shell>
  );
}
