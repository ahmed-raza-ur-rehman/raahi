"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_LABELS, FUNDING_LABELS, countryLabel, KIND_LABELS, LEVEL_LABELS, pick, t } from "@/lib/opportunities/i18n";
import { FUNDING_TYPES, LEVELS, type Funding, type Level, type OpportunityKind, type OpportunitySearchResult, type OpportunityView, type Scope } from "@/lib/opportunities/types";
import { OpportunityCard } from "./OpportunityCard";
import { formatDate, timeAgoLabel } from "./format";
import { useLanguage } from "./useLanguage";
import { useSaved } from "./useSaved";
import { EcosystemStrip, Shell, StarIcon } from "./ui";

interface Filters {
  q: string;
  kinds: OpportunityKind[];
  source?: string;
  scope?: Scope;
  country?: string;
  level?: Level;
  funding?: Funding;
  pk: boolean;
  remote: boolean;
  within?: number;
  isNew?: number;
  sort: "relevance" | "newest" | "deadline";
  limit: number;
}

const DEFAULTS: Filters = { q: "", kinds: [], pk: true, remote: false, sort: "relevance", limit: 12 };
const MAIN_KINDS: OpportunityKind[] = ["scholarship", "fellowship", "admission", "internship", "job", "competition", "coupon", "course", "training", "grant"];

const PRESETS: Array<{ key: "chipScholarships" | "chipGovtJobs" | "chipOverseas" | "chipInternships" | "chipFree" | "chipCompetitions" | "chipAdmissions" | "chipSoon" | "chipNew"; emoji: string; filters: Partial<Filters> }> = [
  { key: "chipScholarships", emoji: "🎓", filters: { kinds: ["scholarship", "fellowship"] } },
  { key: "chipAdmissions", emoji: "🏫", filters: { kinds: ["admission"], scope: "pakistan" } },
  { key: "chipGovtJobs", emoji: "🏛️", filters: { kinds: ["job"], scope: "pakistan" } },
  { key: "chipOverseas", emoji: "✈️", filters: { kinds: ["job"], scope: "international" } },
  { key: "chipInternships", emoji: "🧑‍💻", filters: { kinds: ["internship"] } },
  { key: "chipFree", emoji: "🎟️", filters: { kinds: ["coupon", "course", "training"] } },
  { key: "chipCompetitions", emoji: "🏆", filters: { kinds: ["competition"] } },
  { key: "chipSoon", emoji: "⏳", filters: { within: 14, sort: "deadline" } },
  { key: "chipNew", emoji: "✨", filters: { isNew: 7, sort: "newest" } },
];

function toParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.kinds.length) params.set("kind", filters.kinds.join(","));
  if (filters.source) params.set("source", filters.source);
  if (filters.scope) params.set("scope", filters.scope);
  if (filters.country) params.set("country", filters.country);
  if (filters.level) params.set("level", filters.level);
  if (filters.funding) params.set("funding", filters.funding);
  if (!filters.pk) params.set("pk", "0");
  if (filters.remote) params.set("remote", "1");
  if (filters.within) params.set("within", String(filters.within));
  if (filters.isNew) params.set("new", String(filters.isNew));
  if (filters.sort !== "relevance") params.set("sort", filters.sort);
  if (filters.limit !== DEFAULTS.limit) params.set("limit", String(filters.limit));
  return params;
}

function fromParams(params: URLSearchParams): Filters {
  const num = (name: string) => (params.get(name) && Number.isFinite(Number(params.get(name))) ? Number(params.get(name)) : undefined);
  const scope = params.get("scope");
  const sort = params.get("sort");
  return {
    q: params.get("q") ?? "",
    kinds: (params.get("kind") ?? "").split(",").filter((k): k is OpportunityKind => k in KIND_LABELS),
    source: params.get("source")?.slice(0, 60) || undefined,
    scope: scope === "pakistan" || scope === "international" ? scope : undefined,
    country: params.get("country") ?? undefined,
    level: (LEVELS as readonly string[]).includes(params.get("level") ?? "") ? (params.get("level") as Level) : undefined,
    funding: (FUNDING_TYPES as readonly string[]).includes(params.get("funding") ?? "") ? (params.get("funding") as Funding) : undefined,
    pk: params.get("pk") !== "0",
    remote: params.get("remote") === "1",
    within: num("within"),
    isNew: num("new"),
    sort: sort === "newest" || sort === "deadline" ? sort : "relevance",
    limit: Math.min(num("limit") ?? DEFAULTS.limit, 96),
  };
}

const isDefault = (filters: Filters) => toParams({ ...filters, limit: DEFAULTS.limit }).toString() === "";

export default function HubPage({ initialQuery = "" }: { initialQuery?: string }) {
  const [language, setLanguage] = useLanguage();
  const { saved, toggle, isSaved } = useSaved();
  const [filters, setFilters] = useState<Filters>(() => fromParams(new URLSearchParams(initialQuery)));
  const [input, setInput] = useState(filters.q);
  const [data, setData] = useState<(OpportunitySearchResult & { generatedAt?: string }) | null>(null);
  const [settled, setSettled] = useState<string | null>(null); // the query string `data` (or a failure) belongs to
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [soon, setSoon] = useState<OpportunityView[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [showMore, setShowMore] = useState(() => Boolean(filters.country || filters.level || filters.funding || filters.remote || !filters.pk));
  const typing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const query = useMemo(() => toParams(filters).toString(), [filters]);
  const loading = settled !== query;
  const failed = failedFor === query;

  useEffect(() => {
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
    const controller = new AbortController();
    const params = new URLSearchParams(query);
    if (!params.has("limit")) params.set("limit", String(DEFAULTS.limit));
    fetch(`/api/opportunities?${params.toString()}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("bad response"))))
      .then((json) => {
        setData(json);
        setFailedFor(null);
        setSettled(query);
      })
      .catch((error: unknown) => {
        if ((error as Error).name === "AbortError") return;
        setFailedFor(query);
        setSettled(query);
      });
    return () => controller.abort();
  }, [query, attempt]);

  useEffect(() => {
    fetch("/api/opportunities?within=14&sort=deadline&pk=1&limit=4")
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => json && setSoon(json.items))
      .catch(() => undefined);
  }, []);

  const update = (patch: Partial<Filters>) => setFilters((current) => ({ ...current, ...patch, limit: DEFAULTS.limit }));
  const onType = (value: string) => {
    setInput(value);
    if (typing.current) clearTimeout(typing.current);
    typing.current = setTimeout(() => update({ q: value }), 350);
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (typing.current) clearTimeout(typing.current);
    update({ q: input });
  };
  const applyPreset = (preset: Partial<Filters>) => {
    const next = { ...DEFAULTS, ...preset, pk: filters.pk };
    setInput("");
    setFilters(next);
    setShowSaved(false);
  };
  const toggleKind = (kind: OpportunityKind) => update({ kinds: filters.kinds.includes(kind) ? filters.kinds.filter((k) => k !== kind) : [...filters.kinds, kind] });
  const reset = () => {
    setFilters(DEFAULTS);
    setInput("");
  };

  const kindCounts = new Map((data?.facets.kind ?? []).map((f) => [f.value, f.count]));
  const interpreted = data?.interpreted;
  const understood = [
    ...(interpreted?.kinds ?? []).map((k) => pick(language, KIND_LABELS[k])),
    interpreted?.level ? pick(language, LEVEL_LABELS[interpreted.level]) : undefined,
    interpreted?.country ? countryLabel(language, interpreted.country) : undefined,
    interpreted?.funding ? pick(language, FUNDING_LABELS[interpreted.funding]) : undefined,
    interpreted?.scope ? t(language, interpreted.scope === "pakistan" ? "scopePakistan" : "scopeAbroad") : undefined,
    interpreted?.deadlineWithinDays ? `≤ ${interpreted.deadlineWithinDays} ${t(language, "days")}` : undefined,
    interpreted?.remote ? t(language, "remote") : undefined,
  ].filter(Boolean) as string[];

  const toggleSave = (item: OpportunityView) =>
    toggle({ id: item.id, title: item.title, kind: item.kind, organization: item.organization, deadline: item.deadline, url: item.url, sourceName: item.sourceName });
  const loaded = data?.items ?? [];
  const showSoon = isDefault(filters) && soon.length > 0 && !showSaved;
  const soonIds = new Set(showSoon ? soon.map((entry) => entry.id) : []);
  const items = loaded.filter((entry) => !soonIds.has(entry.id));

  return (
    <Shell language={language} onLanguage={setLanguage} active="opportunities">
      {/* Hero + search */}
      <section className="rounded-3xl bg-gradient-to-br from-[var(--forest-deep)] via-[var(--forest-dark)] to-[var(--forest)] p-5 text-white shadow-[var(--shadow-forest)] sm:p-8">
        <h1 className="text-2xl font-black leading-tight sm:text-3xl">{t(language, "heroTitle")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/85">{t(language, "heroSub")}</p>
        <form onSubmit={submit} role="search" className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="opp-search">{t(language, "search")}</label>
          <input
            id="opp-search"
            value={input}
            onChange={(event) => onType(event.target.value)}
            placeholder={t(language, "searchPlaceholder")}
            className="input-field !bg-white !text-[var(--ink)] sm:flex-1"
            dir="auto"
            autoComplete="off"
          />
          <button type="submit" className="btn-primary !bg-none !bg-white !text-[var(--forest-dark)] !shadow-none sm:w-auto">🔎 {t(language, "search")}</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button key={preset.key} type="button" onClick={() => applyPreset(preset.filters)} className="rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20">
              {preset.emoji} {t(language, preset.key)}
            </button>
          ))}
        </div>
      </section>

      {/* Scope + toggles */}
      <section className="mt-5 flex flex-wrap items-center justify-between gap-3" aria-label="Filters">
        <div role="tablist" aria-label="Where" className="inline-flex rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0.5">
          {([undefined, "pakistan", "international"] as const).map((scope) => (
            <button
              key={scope ?? "all"}
              role="tab"
              aria-selected={filters.scope === scope}
              onClick={() => update({ scope })}
              className={`min-h-9 rounded-[10px] px-3.5 text-sm font-bold transition ${filters.scope === scope ? "bg-[var(--forest)] text-white" : "text-[var(--ink-soft)] hover:bg-[var(--forest-light)]"}`}
            >
              {t(language, scope === "pakistan" ? "scopePakistan" : scope === "international" ? "scopeAbroad" : "scopeAll")}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-bold text-[var(--ink-soft)]">
            {t(language, "sortBy")}
            <select value={filters.sort} onChange={(event) => update({ sort: event.target.value as Filters["sort"] })} className="input-field !min-h-9 !w-auto !px-2 !py-1.5 !text-xs">
              <option value="relevance">{t(language, "sortRelevance")}</option>
              <option value="newest">{t(language, "sortNewest")}</option>
              <option value="deadline">{t(language, "sortDeadline")}</option>
            </select>
          </label>
          <button type="button" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore} className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs">⚙️ {t(language, "moreFilters")}</button>
          <button type="button" onClick={() => setShowSaved((v) => !v)} aria-pressed={showSaved} className={`!min-h-9 !gap-1.5 !px-3 !py-1.5 !text-xs ${showSaved ? "btn-primary" : "btn-secondary"}`}><StarIcon filled={showSaved} size={14} /> {t(language, "savedTitle")} ({saved.length})</button>
        </div>
      </section>

      {filters.source && (
        <p className="mt-3 flex items-center gap-2 text-xs font-bold text-[var(--ink-soft)]">
          {t(language, "statusSource")}:
          <button type="button" onClick={() => update({ source: undefined })} className="inline-flex items-center gap-1 rounded-full border border-[var(--forest)] bg-[var(--forest-light)] px-2.5 py-1 text-[var(--forest-dark)]" aria-label={`${t(language, "reset")} ${filters.source}`}>
            {filters.source} <span aria-hidden>×</span>
          </button>
        </p>
      )}

      {/* Kind chips */}
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={t(language, "filterKind")}>
        {MAIN_KINDS.map((kind) => {
          const active = filters.kinds.includes(kind);
          const count = kindCounts.get(kind);
          return (
            <button key={kind} type="button" onClick={() => toggleKind(kind)} aria-pressed={active} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${active ? "border-[var(--forest)] bg-[var(--forest)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--forest)]"}`}>
              {KIND_LABELS[kind].emoji} {pick(language, KIND_LABELS[kind])}{count !== undefined && !active ? ` · ${count}` : ""}
            </button>
          );
        })}
      </div>

      {showMore && (
        <div className="card mt-3 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label={t(language, "filterCountry")} value={filters.country ?? ""} onChange={(value) => update({ country: value || undefined })} anyLabel={t(language, "filterAny")} options={(data?.facets.country ?? []).map((f) => ({ value: f.value, label: `${countryLabel(language, f.value)} (${f.count})` }))} />
          <Select label={t(language, "filterLevel")} value={filters.level ?? ""} onChange={(value) => update({ level: (value || undefined) as Level | undefined })} anyLabel={t(language, "filterAny")} options={LEVELS.filter((l) => l !== "any").map((l) => ({ value: l, label: pick(language, LEVEL_LABELS[l]) }))} />
          <Select label={t(language, "filterFunding")} value={filters.funding ?? ""} onChange={(value) => update({ funding: (value || undefined) as Funding | undefined })} anyLabel={t(language, "filterAny")} options={FUNDING_TYPES.filter((f) => f !== "unknown").map((f) => ({ value: f, label: pick(language, FUNDING_LABELS[f]) }))} />
          <Select label={t(language, "filterWithin")} value={String(filters.within ?? "")} onChange={(value) => update({ within: value ? Number(value) : undefined })} anyLabel={t(language, "filterAny")} options={[7, 14, 30, 60, 90].map((d) => ({ value: String(d), label: `${d} ${t(language, "days")}` }))} />
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-soft)]">
            <input type="checkbox" checked={filters.pk} onChange={(event) => update({ pk: event.target.checked })} className="h-4 w-4 accent-[var(--forest)]" />
            {t(language, "filterPk")}
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-soft)]">
            <input type="checkbox" checked={filters.remote} onChange={(event) => update({ remote: event.target.checked })} className="h-4 w-4 accent-[var(--forest)]" />
            {t(language, "filterRemote")}
          </label>
          <button type="button" onClick={reset} className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs sm:col-span-2 lg:col-span-2 lg:justify-self-end">↺ {t(language, "reset")}</button>
        </div>
      )}

      {/* Saved */}
      {showSaved && (
        <section className="mt-5" aria-label={t(language, "savedTitle")}>
          {saved.length === 0 ? (
            <p className="card p-5 text-sm text-[var(--muted)]">{t(language, "savedEmpty")}</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {saved.map((item) => (
                <li key={item.id} className="card flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-[var(--forest)]">{KIND_LABELS[item.kind].emoji} {pick(language, KIND_LABELS[item.kind])} · {item.sourceName}</p>
                    <Link href={`/opportunities/${item.id}`} className="mt-0.5 block text-sm font-black text-[var(--ink)] hover:underline" dir="auto">{item.title}</Link>
                    {item.deadline && <p className="mt-1 text-xs text-[var(--muted)]">⏳ {formatDate(item.deadline, language)}</p>}
                  </div>
                  <button type="button" onClick={() => toggle(item)} aria-label={t(language, "saved")} className="shrink-0 text-[var(--amber)]"><StarIcon filled /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Closing soon strip */}
      {showSoon && (
        <section className="mt-6" aria-labelledby="soon-title">
          <h2 id="soon-title" className="mb-2 text-base font-black text-[var(--ink)]">⏳ {t(language, "closingSoonTitle")}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {soon.map((item) => <OpportunityCard key={item.id} item={item} language={language} saved={isSaved(item.id)} onToggleSave={toggleSave} />)}
          </div>
        </section>
      )}

      {/* Results */}
      {!showSaved && (
        <section className="mt-6" aria-live="polite" aria-busy={loading}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-black text-[var(--ink)]">
              {data ? `${showSoon ? `${t(language, "allListings")} · ` : ""}${data.total} ${t(language, "results")}` : t(language, "loading")}
            </h2>
            {understood.length > 0 && filters.q && (
              <p className="text-xs text-[var(--muted)]">{t(language, "understood")}: <span className="font-bold text-[var(--forest-dark)]">{understood.join(" · ")}</span></p>
            )}
          </div>

          {failed && (
            <div role="alert" className="card flex flex-wrap items-center justify-between gap-3 border-[var(--danger)] p-4 text-sm text-[var(--danger)]">
              <span>{t(language, "loadError")}</span>
              <button type="button" className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs" onClick={() => setAttempt((n) => n + 1)}>{t(language, "retry")}</button>
            </div>
          )}

          {loading && items.length === 0 && !failed && (
            <div className="grid gap-3 md:grid-cols-2">{[0, 1, 2, 3].map((n) => <div key={n} className="skeleton h-44 rounded-2xl" />)}</div>
          )}

          {!loading && !failed && items.length === 0 && (
            <p className="card p-6 text-center text-sm text-[var(--muted)]">{t(language, "noResults")}</p>
          )}

          {items.length > 0 && (
            <div className={`grid gap-3 transition-opacity md:grid-cols-2 ${loading ? "opacity-60" : ""}`}>
              {items.map((item) => <OpportunityCard key={item.id} item={item} language={language} saved={isSaved(item.id)} onToggleSave={toggleSave} />)}
            </div>
          )}

          {data && data.total > loaded.length && (
            <div className="mt-4 text-center">
              <button type="button" onClick={() => setFilters((f) => ({ ...f, limit: Math.min(f.limit + 12, 96) }))} className="btn-secondary">{t(language, "loadMore")} ({loaded.length}/{data.total})</button>
            </div>
          )}
        </section>
      )}

      <p className="mt-6 text-center text-xs text-[var(--muted)]">
        {t(language, "updated")}: {data?.generatedAt ? timeAgoLabel(data.generatedAt, language) : "—"} ·{" "}
        <Link href="/opportunities/status" className="font-bold text-[var(--forest)] hover:underline">{t(language, "navStatus")}</Link> ·{" "}
        <Link href="/opportunities/resources" className="font-bold text-[var(--forest)] hover:underline">{t(language, "navResources")}</Link>
      </p>

      <ExplainCategories language={language} />
      <EcosystemStrip language={language} />
    </Shell>
  );
}

function Select({ label, value, onChange, options, anyLabel }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; anyLabel: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-bold text-[var(--ink-soft)]">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="input-field !min-h-10 !py-2 !text-sm">
        <option value="">{anyLabel}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

/** A small "where to look" map so the hub also works as a guide for people who do not know what to search for. */
function ExplainCategories({ language }: { language: "en" | "ur" | "ps" }) {
  const featured = ["scholarships", "scholarships-pk", "govt-recruitment", "overseas-employment", "skills-pk", "learning", "exam-prep", "safety"] as const;
  return (
    <section className="mt-10" aria-labelledby="dir-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="dir-title" className="text-base font-black text-[var(--ink)]">{t(language, "dirTitle")}</h2>
          <p className="mt-1 max-w-2xl text-xs text-[var(--muted)]">{t(language, "dirSub")}</p>
        </div>
        <Link href="/opportunities/resources" className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs">{t(language, "navResources")} →</Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        {featured.map((category) => (
          <Link key={category} href={`/opportunities/resources?category=${category}`} className="quick-card flex items-center gap-2 p-3 text-xs font-bold text-[var(--ink)]">
            <span className="text-lg" aria-hidden>{CATEGORY_LABELS[category].emoji}</span>
            {pick(language, CATEGORY_LABELS[category])}
          </Link>
        ))}
      </div>
    </section>
  );
}

