"use client";

import Link from "next/link";
import { useState } from "react";
import type { Language } from "@/lib/types";
import { ANSWER_KEYS, ANSWER_LABELS, type AnswerKey, type ScamAnalysis } from "@/lib/opportunities/scam";
import { CATEGORY_LABELS, FIELD_LABELS, KIND_LABELS, LEVEL_LABELS, pick, t } from "@/lib/opportunities/i18n";
import { buildIcs } from "@/lib/opportunities/ics";
import type { MatchResult } from "@/lib/opportunities/match";
import { buildApplicationPlan, documentChecklist } from "@/lib/opportunities/plan";
import type { Level, OpportunityKind, OpportunityView } from "@/lib/opportunities/types";
import { OpportunityCard } from "./OpportunityCard";
import { formatDate, TONE_CLASS } from "./format";
import { useLanguage } from "./useLanguage";
import { useSaved } from "./useSaved";
import AgeTool from "./AgeTool";
import CvBuilder from "./CvBuilder";
import { Shell } from "./ui";

type Tab = "scam" | "match" | "plan" | "age" | "cv" | "abroad";
const TABS: Array<{ id: Tab; key: "toolScam" | "toolMatch" | "toolPlan" | "toolAge" | "toolCv" | "toolAgent"; emoji: string }> = [
  { id: "scam", key: "toolScam", emoji: "🛡️" },
  { id: "match", key: "toolMatch", emoji: "🎯" },
  { id: "plan", key: "toolPlan", emoji: "🗓️" },
  { id: "age", key: "toolAge", emoji: "🎂" },
  { id: "cv", key: "toolCv", emoji: "📄" },
  { id: "abroad", key: "toolAgent", emoji: "✈️" },
];

export default function ToolsPage({ initialTab = "scam" }: { initialTab?: string }) {
  const [language, setLanguage] = useLanguage();
  const [tab, setTab] = useState<Tab>((["match", "plan", "age", "cv", "abroad"] as string[]).includes(initialTab) ? (initialTab as Tab) : "scam");

  const choose = (next: Tab) => {
    setTab(next);
    window.history.replaceState(null, "", `?tool=${next}`);
  };

  return (
    <Shell language={language} onLanguage={setLanguage} active="tools">
      <section className="rounded-3xl bg-gradient-to-br from-[var(--forest-deep)] via-[var(--forest-dark)] to-[var(--forest)] p-5 text-white shadow-[var(--shadow-forest)] print:hidden sm:p-7">
        <h1 className="text-2xl font-black sm:text-3xl">{t(language, "toolsTitle")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/85">{t(language, "toolsSub")}</p>
      </section>

      <div role="tablist" aria-label={t(language, "toolsTitle")} className="mt-4 flex gap-1 overflow-x-auto pb-1 print:hidden">
        {TABS.map((entry) => (
          <button key={entry.id} role="tab" id={`tab-${entry.id}`} aria-selected={tab === entry.id} aria-controls={`panel-${entry.id}`} onClick={() => choose(entry.id)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${tab === entry.id ? "bg-[var(--forest)] text-white" : "border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:bg-[var(--forest-light)]"}`}>
            <span aria-hidden>{entry.emoji}</span> {t(language, entry.key)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-4">
        {tab === "scam" && <ScamTool language={language} />}
        {tab === "match" && <MatchTool language={language} />}
        {tab === "plan" && <PlanTool language={language} />}
        {tab === "age" && <AgeTool language={language} />}
        {tab === "cv" && <CvBuilder language={language} />}
        {tab === "abroad" && <AbroadGuide language={language} />}
      </div>
    </Shell>
  );
}

// ─── Scam check ──────────────────────────────────────────────────────────────

const RISK_TONE = { high: "urgent", medium: "soon", low: "soon", none: "ok" } as const;
const RISK_KEY = { high: "riskHigh", medium: "riskMedium", low: "riskLow", none: "riskNone" } as const;

function ScamTool({ language }: { language: Language }) {
  const [text, setText] = useState("");
  const [answers, setAnswers] = useState<Partial<Record<AnswerKey, boolean>>>({});
  const [result, setResult] = useState<ScamAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/opportunities/scam-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, answers }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "error");
      setResult(json);
    } catch (e) {
      setResult(null);
      setError((e as Error).message === "error" ? t(language, "loadError") : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card space-y-3 p-5">
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">{t(language, "scamIntro")}</p>
        <label htmlFor="scam-text" className="sr-only">{t(language, "scamPlaceholder")}</label>
        <textarea id="scam-text" value={text} onChange={(event) => setText(event.target.value)} placeholder={t(language, "scamPlaceholder")} rows={7} maxLength={6000} className="input-field" dir="auto" />
        <fieldset>
          <legend className="text-xs font-black text-[var(--ink)]">{t(language, "scamTick")}</legend>
          <div className="mt-2 space-y-2">
            {ANSWER_KEYS.map((key) => (
              <label key={key} className="flex items-start gap-2 text-[13px] text-[var(--ink-soft)]">
                <input type="checkbox" checked={Boolean(answers[key])} onChange={(event) => setAnswers((current) => ({ ...current, [key]: event.target.checked }))} className="mt-1 h-4 w-4 accent-[var(--forest)]" />
                <span>{language === "en" ? ANSWER_LABELS[key].en : ANSWER_LABELS[key].ur}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="button" onClick={run} disabled={busy || (!text.trim() && !Object.values(answers).some(Boolean))} className="btn-primary w-full">{busy ? t(language, "loading") : t(language, "scamRun")}</button>
        {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
      </section>

      <section aria-live="polite">
        {result ? (
          <div className="card space-y-4 p-5">
            <div className={`rounded-xl border p-4 ${TONE_CLASS[RISK_TONE[result.level]]}`}>
              <p className="text-xs font-bold uppercase tracking-wide">{t(language, RISK_KEY[result.level])} · {result.score}/100</p>
              <p className="mt-1 text-base font-black">{result.headline[language === "en" ? "en" : "ur"]}</p>
            </div>
            {result.signals.length > 0 && (
              <div>
                <h3 className="text-sm font-black text-[var(--ink)]">{t(language, "scamFound")}</h3>
                <ul className="mt-2 space-y-2">
                  {result.signals.map((signal) => (
                    <li key={signal.id} className="flex gap-2 text-[13px] leading-relaxed text-[var(--ink-soft)]"><span aria-hidden>⚠️</span><span>{language === "en" ? signal.en : signal.ur}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {result.oepLicences.length > 0 && (
              <p className="rounded-xl bg-[var(--surface-2)] p-3 text-xs text-[var(--ink-soft)]">
                <span className="font-black">{t(language, "scamLicences")}: </span>{result.oepLicences.map((l) => `${l.number}/${l.city}`).join(" · ")}
              </p>
            )}
            <div>
              <h3 className="text-sm font-black text-[var(--ink)]">{t(language, "scamDoNext")}</h3>
              <ul className="mt-2 space-y-2.5">
                {result.advice.map((advice, index) => (
                  <li key={index} className="text-[13px] leading-relaxed text-[var(--ink-soft)]">
                    {language === "en" ? advice.en : advice.ur}
                    {advice.url && advice.label && (
                      <>
                        {" "}
                        <a href={advice.url} target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--forest)] hover:underline">{advice.label[language === "en" ? "en" : "ur"]} ↗</a>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--muted)]">{result.disclaimer[language === "en" ? "en" : "ur"]}</p>
          </div>
        ) : (
          <div className="card flex h-full min-h-48 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-[var(--muted)]">
            <span className="text-3xl" aria-hidden>🛡️</span>
            <p>{language === "en" ? "Your result appears here. Nothing you paste is stored." : "آپ کا نتیجہ یہاں نظر آئے گا۔ جو آپ چسپاں کرتے ہیں وہ محفوظ نہیں ہوتا۔"}</p>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Find for me ─────────────────────────────────────────────────────────────

const INTEREST_OPTIONS: Array<{ id: string; kinds: OpportunityKind[]; emoji: string; label: OpportunityKind }> = [
  { id: "scholarship", kinds: ["scholarship", "fellowship"], emoji: "🎓", label: "scholarship" },
  { id: "admission", kinds: ["admission"], emoji: "🏫", label: "admission" },
  { id: "job", kinds: ["job"], emoji: "💼", label: "job" },
  { id: "internship", kinds: ["internship"], emoji: "🧑‍💻", label: "internship" },
  { id: "learning", kinds: ["coupon", "course", "training"], emoji: "📚", label: "course" },
  { id: "competition", kinds: ["competition"], emoji: "🏆", label: "competition" },
  { id: "grant", kinds: ["grant"], emoji: "💰", label: "grant" },
];

function MatchTool({ language }: { language: Language }) {
  const { toggle, isSaved } = useSaved();
  const [level, setLevel] = useState<Level | "">("");
  const [interests, setInterests] = useState<string[]>(["scholarship"]);
  const [fields, setFields] = useState<string[]>([]);
  const [country, setCountry] = useState("");
  const [gender, setGender] = useState<"" | "female" | "male">("");
  const [needsFunding, setNeedsFunding] = useState(false);
  const [remoteOk, setRemoteOk] = useState(true);
  const [keywords, setKeywords] = useState("");
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const flip = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const run = async () => {
    setBusy(true);
    setError(false);
    try {
      const kinds = INTEREST_OPTIONS.filter((o) => interests.includes(o.id)).flatMap((o) => o.kinds);
      const response = await fetch("/api/opportunities/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: level || undefined, interests: kinds.length ? kinds : undefined, fields: fields.length ? fields : undefined, country: country.trim() || undefined, gender: gender || undefined, needsFunding, remoteOk, keywords: keywords.trim() || undefined }),
      });
      if (!response.ok) throw new Error("bad");
      setResults(((await response.json()) as { results: MatchResult[] }).results);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const chip = (active: boolean) => `rounded-full border px-3 py-1.5 text-xs font-bold transition ${active ? "border-[var(--forest)] bg-[var(--forest)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--forest)]"}`;

  return (
    <div className="space-y-4">
      <section className="card space-y-4 p-5">
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">{t(language, "matchIntro")}</p>
        <div>
          <p className="text-xs font-black text-[var(--ink)]">{t(language, "matchInterests")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {INTEREST_OPTIONS.map((option) => (
              <button key={option.id} type="button" aria-pressed={interests.includes(option.id)} onClick={() => setInterests(flip(interests, option.id))} className={chip(interests.includes(option.id))}>{option.emoji} {pick(language, KIND_LABELS[option.label])}</button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-black text-[var(--ink)]">{t(language, "matchLevel")}
            <select value={level} onChange={(event) => setLevel(event.target.value as Level | "")} className="input-field !py-2 !text-sm">
              <option value="">{t(language, "filterAny")}</option>
              {(["school", "undergraduate", "masters", "phd", "professional"] as Level[]).map((l) => <option key={l} value={l}>{pick(language, LEVEL_LABELS[l])}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-black text-[var(--ink)]">{t(language, "matchCountry")}
            <input value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Germany" className="input-field !py-2 !text-sm" dir="ltr" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-black text-[var(--ink)]">{t(language, "matchGender")}
            <select value={gender} onChange={(event) => setGender(event.target.value as "" | "female" | "male")} className="input-field !py-2 !text-sm">
              <option value="">—</option>
              <option value="female">{t(language, "female")}</option>
              <option value="male">{t(language, "male")}</option>
            </select>
          </label>
        </div>
        <div>
          <p className="text-xs font-black text-[var(--ink)]">{t(language, "matchFields")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.keys(FIELD_LABELS).map((field) => (
              <button key={field} type="button" aria-pressed={fields.includes(field)} onClick={() => setFields(flip(fields, field))} className={chip(fields.includes(field))}>{pick(language, FIELD_LABELS[field])}</button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1 text-xs font-black text-[var(--ink)]">{t(language, "matchKeywords")}
          <input value={keywords} onChange={(event) => setKeywords(event.target.value)} className="input-field !py-2 !text-sm" dir="auto" maxLength={200} />
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-soft)]"><input type="checkbox" checked={needsFunding} onChange={(event) => setNeedsFunding(event.target.checked)} className="h-4 w-4 accent-[var(--forest)]" />{t(language, "needsFunding")}</label>
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-soft)]"><input type="checkbox" checked={remoteOk} onChange={(event) => setRemoteOk(event.target.checked)} className="h-4 w-4 accent-[var(--forest)]" />{t(language, "remoteOk")}</label>
          <button type="button" onClick={run} disabled={busy} className="btn-primary ms-auto">{busy ? t(language, "loading") : `🎯 ${t(language, "matchRun")}`}</button>
        </div>
        {error && <p role="alert" className="text-sm text-[var(--danger)]">{t(language, "loadError")}</p>}
      </section>

      {results && (
        <section aria-live="polite">
          {results.length === 0 ? (
            <p className="card p-6 text-center text-sm text-[var(--muted)]">{t(language, "noResults")}</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {results.map((entry) => (
                <div key={entry.item.id} className="space-y-2">
                  <OpportunityCard item={entry.item as OpportunityView} language={language} saved={isSaved(entry.item.id)} onToggleSave={(o) => toggle({ id: o.id, title: o.title, kind: o.kind, organization: o.organization, deadline: o.deadline, url: o.url, sourceName: o.sourceName })} />
                  <div className="rounded-xl bg-[var(--forest-light)] p-3 text-xs text-[var(--forest-dark)]">
                    <p className="font-black">{t(language, "whyPicked")}</p>
                    <ul className="mt-1 list-disc ps-4">{entry.reasons.slice(0, 4).map((r) => <li key={r.en}>{language === "en" ? r.en : r.ur}</li>)}</ul>
                    {entry.warnings.length > 0 && (
                      <>
                        <p className="mt-2 font-black text-[var(--amber)]">{t(language, "checkFirst")}</p>
                        <ul className="mt-1 list-disc ps-4 text-[var(--amber)]">{entry.warnings.slice(0, 3).map((w) => <li key={w.en}>{language === "en" ? w.en : w.ur}</li>)}</ul>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ─── Deadline planner ────────────────────────────────────────────────────────

const PLAN_TYPES: Array<{ id: string; kind: OpportunityKind; scope: "pakistan" | "international"; tags: string[]; en: string; ur: string }> = [
  { id: "scholarship", kind: "scholarship", scope: "international", tags: [], en: "Scholarship / fellowship", ur: "اسکالرشپ / فیلوشپ" },
  { id: "govt", kind: "job", scope: "pakistan", tags: ["government"], en: "Government job", ur: "سرکاری نوکری" },
  { id: "overseas", kind: "job", scope: "international", tags: [], en: "Job abroad (through an agent or employer)", ur: "بیرون ملک نوکری (ایجنٹ یا آجر کے ذریعے)" },
  { id: "internship", kind: "internship", scope: "pakistan", tags: [], en: "Internship / private job", ur: "انٹرن شپ / نجی نوکری" },
  { id: "competition", kind: "competition", scope: "international", tags: [], en: "Competition / hackathon", ur: "مقابلہ / ہیکاتھون" },
];

function PlanTool({ language }: { language: Language }) {
  const [typeId, setTypeId] = useState("scholarship");
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [built, setBuilt] = useState<{ steps: ReturnType<typeof buildApplicationPlan>; checklist: ReturnType<typeof documentChecklist>; title: string; deadline: string } | null>(null);

  const build = () => {
    const type = PLAN_TYPES.find((entry) => entry.id === typeId) ?? PLAN_TYPES[0];
    const item = { kind: type.kind, scope: type.scope, tags: type.tags, country: undefined, deadline: date || undefined };
    setBuilt({ steps: buildApplicationPlan(item), checklist: documentChecklist(item), title: title.trim() || (language === "en" ? type.en : type.ur), deadline: date });
  };

  const download = () => {
    if (!built) return;
    const events = built.steps.filter((step) => step.due).map((step) => ({ uid: `custom-${step.id}-${built.deadline}`, summary: `${built.title}: ${step.en}`.slice(0, 120), date: step.due as string }));
    if (built.deadline) events.push({ uid: `custom-deadline-${built.deadline}`, summary: `Deadline: ${built.title}`, date: built.deadline });
    const blob = new Blob([buildIcs(events, `RAAHI — ${built.title}`)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "raahi-plan.ics";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <section className="card space-y-3 p-5">
        <p className="text-xs font-bold text-[var(--muted)]">{t(language, "planOrDate")}</p>
        <label className="flex flex-col gap-1 text-xs font-black text-[var(--ink)]">{language === "en" ? "Type" : "قسم"}
          <select value={typeId} onChange={(event) => setTypeId(event.target.value)} className="input-field !py-2 !text-sm">
            {PLAN_TYPES.map((type) => <option key={type.id} value={type.id}>{language === "en" ? type.en : type.ur}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-black text-[var(--ink)]">{language === "en" ? "Name (optional)" : "نام (اختیاری)"}
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="input-field !py-2 !text-sm" dir="auto" maxLength={80} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-black text-[var(--ink)]">{t(language, "planDate")}
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="input-field !py-2 !text-sm" dir="ltr" />
        </label>
        <button type="button" onClick={build} className="btn-primary w-full">🗓️ {t(language, "planBuild")}</button>
        <p className="text-[11px] text-[var(--muted)]">{language === "en" ? "Tip: open any listing and use its own plan — it already knows the deadline." : "مشورہ: کوئی بھی فہرست کھول کر اس کا اپنا منصوبہ دیکھیں — اسے آخری تاریخ پہلے سے معلوم ہے۔"} <Link href="/opportunities?within=30&sort=deadline" className="font-bold text-[var(--forest)] hover:underline">{t(language, "chipSoon")} →</Link></p>
      </section>

      <section aria-live="polite">
        {built ? (
          <div className="card space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-black text-[var(--ink)]" dir="auto">{built.title}</h2>
              {built.deadline && <button type="button" onClick={download} className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs">📅 {t(language, "planDownload")}</button>}
            </div>
            <p className="text-xs text-[var(--muted)]">{t(language, "planNote")}</p>
            <ol className="space-y-2.5">
              {built.steps.map((step, index) => (
                <li key={step.id} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--forest-light)] text-xs font-black text-[var(--forest-dark)]">{index + 1}</span>
                  <div>
                    <p className="text-sm leading-relaxed text-[var(--ink)]">{language === "en" ? step.en : step.ur}</p>
                    {step.due && <p className={`text-[11px] font-bold ${step.late ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>{step.late ? `${t(language, "doNow")} · ` : ""}{formatDate(step.due, language)}</p>}
                  </div>
                </li>
              ))}
            </ol>
            <div>
              <h3 className="text-sm font-black text-[var(--ink)]">📄 {t(language, "checklist")}</h3>
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {built.checklist.map((entry) => (
                  <li key={entry.en} className="flex items-start gap-2 text-[13px] text-[var(--ink-soft)]"><input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--forest)]" aria-label={entry.en} /><span>{language === "en" ? entry.en : entry.ur}</span></li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="card flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-[var(--muted)]"><span className="text-3xl" aria-hidden>🗓️</span><p>{language === "en" ? "Pick a type and a deadline to get a dated plan and a documents checklist." : "قسم اور آخری تاریخ چنیں تاکہ تاریخوں کے ساتھ منصوبہ اور دستاویزات کی فہرست مل سکے۔"}</p></div>
        )}
      </section>
    </div>
  );
}

// ─── Going abroad safely ─────────────────────────────────────────────────────

const ABROAD_STEPS: Array<{ en: string; ur: string; links: Array<{ label: string; url: string }> }> = [
  { en: "Decide the legal route. The government's own channel is OEC (government-to-government, e.g. EPS Korea). Otherwise a BE&OE-licensed promoter (OEP), or a direct offer from a real employer.", ur: "قانونی راستہ طے کریں۔ حکومت کا اپنا ذریعہ او ای سی ہے (حکومت سے حکومت، مثلاً ای پی ایس کوریا)۔ ورنہ بی ای او ای سے لائسنس یافتہ پروموٹر (او ای پی) یا کسی اصل آجر کی براہ راست پیشکش۔", links: [{ label: "OEC", url: "https://oec.gov.pk/" }, { label: "EPS Korea", url: "https://oec.gov.pk/eps" }] },
  { en: "Check the agent's licence number and city code on the official list of OEPs. The name, address and number must all match.", ur: "ایجنٹ کا لائسنس نمبر اور شہر کا کوڈ او ای پیز کی سرکاری فہرست میں دیکھیں۔ نام، پتہ اور نمبر تینوں بالکل ملنے چاہئیں۔", links: [{ label: "BE&OE — licensed agents", url: "https://beoe.gov.pk/list-of-oeps?show=active" }] },
  { en: "Look for complaints and notices about that agent, and make sure the trade-test centre is not blacklisted.", ur: "اس ایجنٹ کے خلاف شکایات اور نوٹسز دیکھیں اور یقینی بنائیں کہ ٹریڈ ٹیسٹ سینٹر بلیک لسٹ نہیں۔", links: [{ label: "BE&OE complaints", url: "https://beoe.gov.pk/complaints" }, { label: "Blacklisted centres", url: "https://beoe.gov.pk/blacklists" }] },
  { en: "Pay only the official fees listed by the Bureau, to official channels, and keep every receipt.", ur: "صرف بیورو کی فہرست میں درج سرکاری فیس، سرکاری ذرائع سے ادا کریں اور ہر رسید رکھیں۔", links: [{ label: "Official fee structure", url: "https://beoe.gov.pk/fee-structure-emigrant" }] },
  { en: "Read the full contract (salary, hours, housing, return ticket) before you travel, in a language you understand.", ur: "سفر سے پہلے پورا معاہدہ (تنخواہ، اوقات، رہائش، واپسی کا ٹکٹ) اپنی سمجھ والی زبان میں پڑھیں۔", links: [{ label: "BE&OE guidelines", url: "https://beoe.gov.pk/general-guidlines-for-emigrants" }] },
  { en: "Register for emigrant protection (e-Protector) and find your Protector of Emigrants office. Never work abroad on a visit visa.", ur: "ایمیگرنٹ پروٹیکشن (ای پروٹیکٹر) کے لیے رجسٹر کریں اور اپنا پروٹیکٹر آف ایمیگرنٹس دفتر معلوم کریں۔ وزٹ ویزے پر بیرون ملک کبھی کام نہ کریں۔", links: [{ label: "e-Protector registration", url: "https://beoe.gov.pk/online-emigrant-registration-delta" }, { label: "Find your PE office", url: "https://beoe.gov.pk/find-your-pe-office" }] },
  { en: "Prepare identity and education documents early: CNIC, passport, attested degrees.", ur: "شناختی اور تعلیمی دستاویزات پہلے سے تیار رکھیں: شناختی کارڈ، پاسپورٹ، تصدیق شدہ ڈگریاں۔", links: [{ label: "HEC attestation", url: "https://eservices.hec.gov.pk/" }, { label: "Passport (DGIP)", url: "https://www.dgip.gov.pk/" }] },
  { en: "If something goes wrong, keep all chats and receipts and report it.", ur: "اگر کچھ غلط ہو تو تمام چیٹس اور رسیدیں محفوظ رکھیں اور اطلاع دیں۔", links: [{ label: "BE&OE complaints", url: "https://beoe.gov.pk/complaints" }, { label: "FIA", url: "https://www.fia.gov.pk/" }] },
];

function AbroadGuide({ language }: { language: Language }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-black text-[var(--ink)]">✈️ {t(language, "agentTitle")}</h2>
        <ol className="mt-4 space-y-4">
          {ABROAD_STEPS.map((step, index) => (
            <li key={step.en} className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--forest)] text-sm font-black text-white">{index + 1}</span>
              <div>
                <p className="text-sm leading-relaxed text-[var(--ink)]">{language === "en" ? step.en : step.ur}</p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {step.links.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[var(--forest)] hover:underline">{link.label} ↗</a>)}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-[11px] text-[var(--muted)]">{language === "en" ? "Based on the guidance BE&OE and OEC publish. Rules change — always confirm on the official site." : "بی ای او ای اور او ای سی کی شائع کردہ رہنمائی پر مبنی۔ قواعد بدلتے رہتے ہیں — ہمیشہ سرکاری سائٹ پر تصدیق کریں۔"}</p>
      </section>
      <aside className="space-y-3">
        <Link href="/opportunities/tools?tool=scam" className="card block p-4 transition hover:-translate-y-0.5"><p className="text-sm font-black text-[var(--forest-dark)]">🛡️ {t(language, "toolScam")} →</p><p className="mt-1 text-xs text-[var(--ink-soft)]">{t(language, "checkOffer")}</p></Link>
        <Link href="/opportunities/resources?category=overseas-employment" className="card block p-4 transition hover:-translate-y-0.5"><p className="text-sm font-black text-[var(--forest-dark)]">{CATEGORY_LABELS["overseas-employment"].emoji} {pick(language, CATEGORY_LABELS["overseas-employment"])} →</p></Link>
        <Link href="/opportunities?kind=notice" className="card block p-4 transition hover:-translate-y-0.5"><p className="text-sm font-black text-[var(--forest-dark)]">📢 {pick(language, KIND_LABELS.notice)} →</p><p className="mt-1 text-xs text-[var(--ink-soft)]">{language === "en" ? "Latest BE&OE notices: show-cause, blacklisting, complaints." : "بی ای او ای کے تازہ نوٹسز: شوکاز، بلیک لسٹنگ، شکایات۔"}</p></Link>
      </aside>
    </div>
  );
}
