"use client";

import Link from "next/link";
import type { Language } from "@/lib/types";
import { pickText, type LText } from "@/lib/opportunities/ltext";
import { KIND_LABELS, t, type StringKey } from "@/lib/opportunities/i18n";
import { windowStrip, type FlagshipPhase, type FlagshipRoute, type PlannerEntry } from "@/lib/opportunities/flagship-core";
import type { OpportunityKind } from "@/lib/opportunities/types";
import { formatDate, type Tone } from "./format";
import { useLanguage } from "./useLanguage";
import { Chip, KindBadge, Shell } from "./ui";

export interface DeadlineRow {
  id: string;
  title: string;
  kind: OpportunityKind;
  organization?: string;
  country?: string;
  deadline: string;
  daysLeft: number;
  sourceName: string;
  openToPakistan: boolean | null;
}

interface Props {
  tab: "planner" | "deadlines";
  q: string;
  kind: string;
  today: string;
  month: number;
  sections: { act: PlannerEntry[]; soon: PlannerEntry[]; prepare: PlannerEntry[]; later: PlannerEntry[] };
  total: number;
  deadlines: DeadlineRow[];
  /** Titles of the guides the programmes link to, resolved on the server so the browser does not load every guide. */
  guideTitles: Record<string, LText>;
}

const PHASE: Record<FlagshipPhase, { key: StringKey; tone: Tone }> = {
  "closing-soon": { key: "calPhaseClosingSoon", tone: "urgent" },
  open: { key: "calPhaseOpen", tone: "ok" },
  "typically-open": { key: "calPhaseTypical", tone: "rolling" },
  upcoming: { key: "calPhaseUpcoming", tone: "soon" },
  closed: { key: "calPhaseClosed", tone: "closed" },
  "off-season": { key: "calPhaseOff", tone: "none" },
};

const ROUTE_LABEL: Record<FlagshipRoute, { en: string; ur: string }> = {
  direct: { en: "Apply directly", ur: "براہِ راست اپلائی" },
  hec: { en: "Through HEC", ur: "ایچ ای سی کے ذریعے" },
  embassy: { en: "Through the embassy", ur: "سفارت خانے کے ذریعے" },
  agency: { en: "Official portal", ur: "سرکاری پورٹل" },
  university: { en: "Through the university", ur: "یونیورسٹی کے ذریعے" },
};

const KIND_FILTERS: OpportunityKind[] = ["scholarship", "job", "admission", "internship", "competition"];

const href = (tab: string, q: string, kind: string) => {
  const params = new URLSearchParams();
  if (tab !== "planner") params.set("tab", tab);
  if (q) params.set("q", q);
  if (kind) params.set("kind", kind);
  const query = params.toString();
  return `/opportunities/calendar${query ? `?${query}` : ""}`;
};

function monthNames(language: Language): string[] {
  const locale = language === "en" ? "en-GB" : language === "ur" ? "ur-PK" : "ps-AF";
  const format = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, index) => format.format(new Date(Date.UTC(2026, index, 15))));
}

function PhaseChip({ entry, language }: { entry: PlannerEntry; language: Language }) {
  const { phase, daysLeft, daysToOpen } = entry.status;
  const { key, tone } = PHASE[phase];
  const extra =
    daysLeft !== undefined ? ` · ${daysLeft} ${t(language, "calDaysLeft")}` : daysToOpen !== undefined ? ` · ${t(language, "calOpensIn")} ${daysToOpen} ${t(language, "days")}` : "";
  return <Chip tone={tone}>{t(language, key)}{extra}</Chip>;
}

function FlagshipCard({ entry, language, guideTitles }: { entry: PlannerEntry; language: Language; guideTitles: Record<string, LText> }) {
  const { flagship: f, status } = entry;
  const cycle = f.cycle;
  const route = ROUTE_LABEL[f.route];
  const showMonths = !cycle && status.phase === "off-season" && status.monthsToOpen > 0;
  return (
    <article id={f.id} className="card flex flex-col gap-3 p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <KindBadge kind={f.kind} language={language} />
            <PhaseChip entry={entry} language={language} />
          </div>
          <h3 className="mt-2 text-[15px] font-black leading-snug text-[var(--ink)]" dir="auto">{pickText(language, f.title)}</h3>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]" dir="auto">{f.provider} · {pickText(language, f.where)}</p>
        </div>
        <Chip title={pickText(language, f.routeNote)}>{language === "en" ? route.en : route.ur}</Chip>
      </header>

      <p className="text-[13px] leading-relaxed text-[var(--ink-soft)]" dir="auto">{pickText(language, f.summary)}</p>

      <div className="rounded-xl bg-[var(--surface-2)] p-3 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
        {cycle ? (
          <>
            <p className="font-bold text-[var(--ink)]" dir="auto">{t(language, "calLatestCall")}: {pickText(language, cycle.label)}</p>
            <p dir="auto">
              {cycle.opens && <>{t(language, "calOpens")}: <strong>{formatDate(cycle.opens, language)}</strong>{cycle.closes ? " · " : ""}</>}
              {cycle.closes && <>{t(language, "calCloses")}: <strong>{formatDate(cycle.closes, language)}</strong></>}
            </p>
            {cycle.closesNote && <p className="text-[11.5px] text-[var(--muted)]" dir="auto">{pickText(language, cycle.closesNote)}</p>}
            {cycle.note && <p className="mt-1" dir="auto">{pickText(language, cycle.note)}</p>}
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Chip tone={cycle.confidence === "official" ? "ok" : "soon"}>{t(language, cycle.confidence === "official" ? "calConfOfficial" : "calConfReported")}</Chip>
              <span className="text-[11px] text-[var(--muted)]">{t(language, "calChecked")}: {formatDate(cycle.checked, language)}</span>
            </p>
          </>
        ) : (
          <>
            <p className="font-bold text-[var(--ink)]">{t(language, "calUsual")}</p>
            <p dir="auto">{pickText(language, f.windowNote)}</p>
            {showMonths && <p className="mt-1 text-[11.5px] text-[var(--muted)]">≈ {status.monthsToOpen} {t(language, "calMonthsAway")}</p>}
          </>
        )}
        {f.variable && <p className="mt-1.5 text-[11px] text-[var(--muted)]">≈ {t(language, "calVariable")}</p>}
      </div>

      <details className="group rounded-xl border border-[var(--line)] p-3">
        <summary className="cursor-pointer list-none text-[13px] font-black text-[var(--forest-dark)]">{t(language, "calHow")} ▾</summary>
        <div className="mt-2 space-y-3 text-[13px] leading-relaxed text-[var(--ink-soft)]">
          <p dir="auto">{pickText(language, f.routeNote)}</p>
          {cycle && <p dir="auto"><span className="font-bold text-[var(--ink)]">{t(language, "calUsual")}: </span>{pickText(language, f.windowNote)}</p>}
          <div>
            <p className="font-black text-[var(--ink)]">{t(language, "calWhatToPrepare")}</p>
            <ul className="mt-1 list-disc space-y-1 ps-5">
              {f.prep.map((item, index) => <li key={index} dir="auto">{pickText(language, item)}</li>)}
            </ul>
          </div>
          {f.guides && f.guides.length > 0 && (
            <p className="flex flex-wrap items-center gap-1.5">
              <span className="font-black text-[var(--ink)]">{t(language, "calGuides")}:</span>
              {f.guides.map((id) => (guideTitles[id] ? <Link key={id} href={`/opportunities/guides/${id}`} className="font-bold text-[var(--forest)] hover:underline" dir="auto">{pickText(language, guideTitles[id])}</Link> : null))}
            </p>
          )}
          <a href={f.official} target="_blank" rel="noopener noreferrer" className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs">{t(language, "calOfficialSite")} ↗</a>
        </div>
      </details>
    </article>
  );
}

function Section({ title, entries, language, guideTitles }: { title: string; entries: PlannerEntry[]; language: Language; guideTitles: Record<string, LText> }) {
  if (entries.length === 0) return null;
  return (
    <section className="mt-6" aria-label={title}>
      <h2 className="text-base font-black text-[var(--ink)]">{title} <span className="text-xs font-bold text-[var(--muted)]">· {entries.length}</span></h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {entries.map((entry) => <FlagshipCard key={entry.flagship.id} entry={entry} language={language} guideTitles={guideTitles} />)}
      </div>
    </section>
  );
}

function YearGrid({ entries, month, language }: { entries: PlannerEntry[]; month: number; language: Language }) {
  const names = monthNames(language);
  return (
    <section className="mt-8" aria-labelledby="grid-title">
      <h2 id="grid-title" className="text-base font-black text-[var(--ink)]">{t(language, "calGrid")}</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">{t(language, "calGridNote")}</p>
      <div className="card mt-3 overflow-x-auto p-2">
        <table className="w-full min-w-[720px] border-separate border-spacing-y-1 text-center text-[11px]">
          <thead>
            <tr>
              <th scope="col" className="sticky start-0 bg-[var(--surface)] px-2 text-start font-bold text-[var(--muted)]"><span className="sr-only">Programme</span></th>
              {names.map((name, index) => (
                <th key={name} scope="col" className={`w-12 px-0.5 py-1 font-bold ${index + 1 === month ? "text-[var(--forest)]" : "text-[var(--muted)]"}`}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map(({ flagship }) => {
              const strip = windowStrip(flagship);
              return (
                <tr key={flagship.id}>
                  <th scope="row" className="sticky start-0 max-w-[220px] truncate bg-[var(--surface)] px-2 py-1 text-start text-[12px] font-bold text-[var(--ink)]" dir="auto">
                    <a href={`#${flagship.id}`} className="hover:underline">{pickText(language, flagship.title)}</a>
                  </th>
                  {strip.map((on, index) => (
                    <td key={index} className={`h-7 ${on ? (flagship.variable ? "bg-[var(--amber-bg)]" : "bg-[var(--forest-light)]") : "bg-[var(--surface-2)]"} ${index + 1 === month ? "outline outline-2 -outline-offset-2 outline-[var(--forest)]" : ""}`}>
                      <span className="sr-only">{names[index]}: {on ? t(language, "calPhaseTypical") : "—"}</span>
                      {on ? <span aria-hidden className="text-[var(--forest-dark)]">●</span> : null}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Deadlines({ rows, today, language }: { rows: DeadlineRow[]; today: string; language: Language }) {
  if (rows.length === 0) return <p className="card mt-5 p-6 text-center text-sm text-[var(--muted)]">{t(language, "calDeadlinesNone")}</p>;
  const groups = new Map<string, DeadlineRow[]>();
  for (const row of rows) groups.set(row.deadline, [...(groups.get(row.deadline) ?? []), row]);
  return (
    <section className="mt-5" aria-labelledby="deadline-title">
      <h2 id="deadline-title" className="text-base font-black text-[var(--ink)]">{t(language, "calDeadlinesTitle")} <span className="text-xs font-bold text-[var(--muted)]">· {rows.length}</span></h2>
      <ol className="mt-3 space-y-4">
        {[...groups.entries()].map(([date, items]) => {
          const left = items[0].daysLeft;
          return (
            <li key={date}>
              <h3 className="flex flex-wrap items-center gap-2 text-sm font-black text-[var(--forest-dark)]">
                {formatDate(date, language)}
                <Chip tone={left <= 3 ? "urgent" : left <= 7 ? "soon" : "ok"}>{date === today ? t(language, "calToday") : `${left} ${t(language, "days")}`}</Chip>
              </h3>
              <ul className="mt-2 grid gap-2 md:grid-cols-2">
                {items.map((item) => (
                  <li key={item.id} className="card flex flex-col gap-1.5 p-3">
                    <Link href={`/opportunities/${item.id}`} className="text-[14px] font-black leading-snug text-[var(--ink)] hover:text-[var(--forest)] hover:underline" dir="auto">{item.title}</Link>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <KindBadge kind={item.kind} language={language} />
                      {item.country && <Chip>{item.country}</Chip>}
                      {item.openToPakistan === true && <Chip tone="ok">🇵🇰 ✓</Chip>}
                      <span className="text-[11px] text-[var(--muted)]">{item.organization ? `${item.organization} · ` : ""}{item.sourceName}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Both views are plain links and a GET form, so they work without JavaScript and every state is a shareable URL. */
export default function CalendarPage({ tab, q, kind, today, month, sections, total, deadlines, guideTitles }: Props) {
  const [language, setLanguage] = useLanguage();
  const shown = sections.act.length + sections.soon.length + sections.prepare.length + sections.later.length;
  const everything = [...sections.act, ...sections.soon, ...sections.prepare, ...sections.later];

  return (
    <Shell language={language} onLanguage={setLanguage} active="calendar">
      <section className="rounded-3xl bg-gradient-to-br from-[var(--forest-deep)] via-[var(--forest-dark)] to-[var(--forest)] p-5 text-white shadow-[var(--shadow-forest)] sm:p-7">
        <h1 className="text-2xl font-black sm:text-3xl">{t(language, "calTitle")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/85">{t(language, "calSub")}</p>
        {tab === "planner" && (
          <form action="/opportunities/calendar" method="get" role="search" className="mt-4 flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="cal-search">{t(language, "calSearch")}</label>
            <input id="cal-search" name="q" defaultValue={q} placeholder={t(language, "calSearch")} className="input-field !bg-white !text-[var(--ink)] sm:flex-1" dir="auto" autoComplete="off" />
            {kind && <input type="hidden" name="kind" value={kind} />}
            <button type="submit" className="btn-primary !bg-none !bg-white !text-[var(--forest-dark)] sm:w-auto">{t(language, "search")}</button>
          </form>
        )}
      </section>

      <nav aria-label="Calendar views" className="mt-4 flex flex-wrap items-center gap-1.5">
        {(["planner", "deadlines"] as const).map((id) => (
          <Link key={id} href={href(id, id === "planner" ? q : "", kind)} aria-current={tab === id ? "page" : undefined} className={`rounded-xl px-3.5 py-2 text-sm font-bold ${tab === id ? "bg-[var(--forest)] text-white" : "text-[var(--ink-soft)] hover:bg-[var(--forest-light)]"}`}>
            {t(language, id === "planner" ? "calTabPlanner" : "calTabDeadlines")}
          </Link>
        ))}
        <span aria-hidden className="mx-1 h-5 w-px bg-[var(--line)]" />
        <Link href={href(tab, q, "")} aria-current={kind === "" ? "true" : undefined} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${kind === "" ? "border-[var(--forest)] bg-[var(--forest)] text-white" : "border-[var(--line)] text-[var(--ink-soft)]"}`}>{t(language, "calAllTypes")}</Link>
        {KIND_FILTERS.map((entry) => (
          <Link key={entry} href={href(tab, q, kind === entry ? "" : entry)} aria-current={kind === entry ? "true" : undefined} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${kind === entry ? "border-[var(--forest)] bg-[var(--forest)] text-white" : "border-[var(--line)] text-[var(--ink-soft)]"}`}>
            {KIND_LABELS[entry].emoji} {language === "en" ? KIND_LABELS[entry].en : KIND_LABELS[entry].ur}
          </Link>
        ))}
      </nav>

      {tab === "deadlines" ? (
        <Deadlines rows={deadlines} today={today} language={language} />
      ) : shown === 0 ? (
        <p className="card mt-5 p-6 text-center text-sm text-[var(--muted)]">{t(language, "calNone")}</p>
      ) : (
        <>
          <Section title={t(language, "calActNow")} entries={sections.act} language={language} guideTitles={guideTitles} />
          <Section title={t(language, "calSoon")} entries={sections.soon} language={language} guideTitles={guideTitles} />
          <Section title={t(language, "calPrepare")} entries={sections.prepare} language={language} guideTitles={guideTitles} />
          <Section title={t(language, "calLater")} entries={sections.later} language={language} guideTitles={guideTitles} />
          <YearGrid entries={everything} month={month} language={language} />
        </>
      )}
      <p className="mt-8 text-center text-xs text-[var(--muted)]">{tab === "planner" ? `${shown} / ${total} · ` : ""}{t(language, "calFooter")}</p>
    </Shell>
  );
}
