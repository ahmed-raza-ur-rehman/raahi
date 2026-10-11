"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Language } from "@/lib/types";
import { CATEGORY_LABELS, pick, t } from "@/lib/opportunities/i18n";
import type { DirectoryItem } from "@/lib/opportunities/directory";
import { RESOURCE_CATEGORIES, type ResourceCategory } from "@/lib/opportunities/types";
import { formatDate } from "./format";
import { useLanguage } from "./useLanguage";
import { Chip, Shell } from "./ui";

interface Response {
  total: number;
  items: DirectoryItem[];
  categories: Array<{ value: string; count: number }>;
  linkHealthCheckedAt: string | null;
}

const AUTHORITY_KEY = { 1: "authority1", 2: "authority2", 3: "authority3", 4: "authority4" } as const;

function LinkStatus({ item, language }: { item: DirectoryItem; language: Language }) {
  if (item.health?.verdict === "broken") return <Chip tone="urgent" title={`HTTP ${item.health.status || "—"}`}>⚠️ {t(language, "linkBroken")}</Chip>;
  if (item.health?.verdict === "blocked") return <Chip tone="rolling">{t(language, "linkBlocked")}</Chip>;
  if (item.health?.verdict === "unreachable") return <Chip tone="none" title="No answer from our servers — several Pakistani government sites do this to overseas networks. The link itself is probably fine.">{t(language, "linkUnreachable")}</Chip>;
  const confirmed = item.health?.verdict === "ok" ? item.health.checkedAt : item.checked;
  if (confirmed) return <Chip tone="ok" title={confirmed}>✓ {t(language, "linkChecked")} · {formatDate(confirmed, language)}</Chip>;
  return <Chip tone="none">{t(language, "linkUnchecked")}</Chip>;
}

function ResourceCard({ item, language }: { item: DirectoryItem; language: Language }) {
  const name = language === "en" ? item.name : item.nameUr ?? item.name;
  const description = language === "en" ? item.description : item.descriptionUr ?? item.description;
  const note = language === "en" ? item.note : item.noteUr ?? item.note;
  return (
    <article className="card flex flex-col gap-2.5 p-4">
      <div>
        <h3 className="text-[15px] font-black leading-snug text-[var(--ink)]" dir="auto">{name}</h3>
        {language !== "en" && item.nameUr && <p className="text-[11px] font-semibold text-[var(--muted)]" dir="ltr">{item.name}</p>}
      </div>
      <p className="text-[13px] leading-relaxed text-[var(--ink-soft)]" dir="auto">{description}</p>
      {note && <p className="rounded-lg bg-[var(--amber-bg)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--amber)]" dir="auto">{note}</p>}
      <div className="flex flex-wrap gap-1.5">
        <Chip tone={item.authority === 1 ? "ok" : item.authority === 4 ? "soon" : "none"}>{t(language, AUTHORITY_KEY[item.authority])}</Chip>
        {item.free && <Chip tone="ok">{t(language, "onlyFree")}</Chip>}
        {item.scope === "pakistan" && <Chip>🇵🇰</Chip>}
        <LinkStatus item={item} language={language} />
      </div>
      {item.related && item.related.length > 0 && (
        <p className="text-[11px] text-[var(--muted)]">
          {t(language, "relatedServices")}:{" "}
          {item.related.map((service, index) => (
            <span key={service.id}>
              {index > 0 && " · "}
              <Link href={`/procedure/${service.id}`} className="font-bold text-[var(--forest)] hover:underline">{language === "en" ? service.name : service.nameUr}</Link>
            </span>
          ))}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line-soft)] pt-3">
        {item.sourceId ? (
          <Link href={`/opportunities?${new URLSearchParams({ source: item.sourceId }).toString()}`} className="text-xs font-bold text-[var(--forest)] hover:underline">⚡ {t(language, "liveFeed")}</Link>
        ) : <span />}
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn-primary !min-h-9 !px-3 !py-1.5 !text-xs">{t(language, "goToSite")} ↗</a>
      </div>
    </article>
  );
}

export default function ResourcesPage({ initialQ = "", initialCategory = "" }: { initialQ?: string; initialCategory?: string }) {
  const [language, setLanguage] = useLanguage();
  const [q, setQ] = useState(initialQ);
  const [input, setInput] = useState(initialQ);
  const [category, setCategory] = useState<ResourceCategory | "">((RESOURCE_CATEGORIES as readonly string[]).includes(initialCategory) ? (initialCategory as ResourceCategory) : "");
  const [scope, setScope] = useState<"" | "pakistan" | "international">("");
  const [free, setFree] = useState(false);
  const [official, setOfficial] = useState(false);
  const [verified, setVerified] = useState(false);
  const [data, setData] = useState<Response | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setQ(input), 300);
    return () => clearTimeout(handle);
  }, [input]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (category) params.set("category", category);
    if (scope) params.set("scope", scope);
    if (free) params.set("free", "1");
    if (official) params.set("official", "1");
    if (verified) params.set("verified", "1");
    return params.toString();
  }, [q, category, scope, free, official, verified]);
  const failed = failedFor === query;

  useEffect(() => {
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
    const controller = new AbortController();
    fetch(`/api/resources?${query}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("bad"))))
      .then((json) => {
        setData(json);
        setFailedFor(null);
      })
      .catch((error: unknown) => {
        if ((error as Error).name !== "AbortError") setFailedFor(query);
      });
    return () => controller.abort();
  }, [query]);

  const grouped = useMemo(() => {
    const groups = new Map<ResourceCategory, DirectoryItem[]>();
    for (const item of data?.items ?? []) groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
    return RESOURCE_CATEGORIES.filter((c) => groups.has(c)).map((c) => ({ category: c, items: groups.get(c) as DirectoryItem[] }));
  }, [data]);
  const counts = new Map((data?.categories ?? []).map((c) => [c.value, c.count]));

  return (
    <Shell language={language} onLanguage={setLanguage} active="resources">
      <section className="rounded-3xl bg-gradient-to-br from-[var(--forest-deep)] via-[var(--forest-dark)] to-[var(--forest)] p-5 text-white shadow-[var(--shadow-forest)] sm:p-7">
        <h1 className="text-2xl font-black sm:text-3xl">{t(language, "dirTitle")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/85">{t(language, "dirSub")}</p>
        <label className="sr-only" htmlFor="res-search">{t(language, "dirSearch")}</label>
        <input id="res-search" value={input} onChange={(event) => setInput(event.target.value)} placeholder={t(language, "dirSearch")} className="input-field mt-4 !bg-white !text-[var(--ink)]" dir="auto" autoComplete="off" />
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Where" className="inline-flex rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0.5">
          {(["", "pakistan", "international"] as const).map((value) => (
            <button key={value || "all"} role="tab" aria-selected={scope === value} onClick={() => setScope(value)} className={`min-h-9 rounded-[10px] px-3.5 text-sm font-bold transition ${scope === value ? "bg-[var(--forest)] text-white" : "text-[var(--ink-soft)] hover:bg-[var(--forest-light)]"}`}>
              {t(language, value === "pakistan" ? "scopePakistan" : value === "international" ? "scopeAbroad" : "scopeAll")}
            </button>
          ))}
        </div>
        {([[free, setFree, "onlyFree"], [official, setOfficial, "onlyOfficial"], [verified, setVerified, "onlyVerified"]] as const).map(([value, set, key]) => (
          <label key={key} className="flex items-center gap-2 text-xs font-bold text-[var(--ink-soft)]">
            <input type="checkbox" checked={value} onChange={(event) => set(event.target.checked)} className="h-4 w-4 accent-[var(--forest)]" />
            {t(language, key)}
          </label>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Categories">
        <button type="button" onClick={() => setCategory("")} aria-pressed={category === ""} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${category === "" ? "border-[var(--forest)] bg-[var(--forest)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)]"}`}>{t(language, "all")}</button>
        {RESOURCE_CATEGORIES.map((value) => (
          <button key={value} type="button" onClick={() => setCategory(category === value ? "" : value)} aria-pressed={category === value} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${category === value ? "border-[var(--forest)] bg-[var(--forest)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--forest)]"}`}>
            {CATEGORY_LABELS[value].emoji} {pick(language, CATEGORY_LABELS[value])}{counts.has(value) && category !== value ? ` · ${counts.get(value)}` : ""}
          </button>
        ))}
      </div>

      {failed && <p role="alert" className="card mt-5 p-4 text-sm text-[var(--danger)]">{t(language, "loadError")}</p>}
      {!data && !failed && <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((n) => <div key={n} className="skeleton h-44 rounded-2xl" />)}</div>}
      {data && data.total === 0 && <p className="card mt-5 p-6 text-center text-sm text-[var(--muted)]">{t(language, "noResults")}</p>}

      <div aria-live="polite">
        {grouped.map(({ category: key, items }) => (
          <section key={key} className="mt-7" aria-labelledby={`cat-${key}`}>
            <h2 id={`cat-${key}`} className="mb-2 flex items-center gap-2 text-base font-black text-[var(--ink)]">
              <span aria-hidden>{CATEGORY_LABELS[key].emoji}</span> {pick(language, CATEGORY_LABELS[key])} <span className="text-xs font-bold text-[var(--muted)]">({items.length})</span>
            </h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => <ResourceCard key={item.id} item={item} language={language} />)}
            </div>
          </section>
        ))}
      </div>

      {data && (
        <p className="mt-8 text-center text-xs text-[var(--muted)]">
          {data.total} · {data.linkHealthCheckedAt ? `${t(language, "linkChecked")}: ${formatDate(data.linkHealthCheckedAt, language)}` : t(language, "linkUnchecked")}
        </p>
      )}
    </Shell>
  );
}
