"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Domain, Language, ServiceRecord } from "@/lib/types";

interface ServiceDiscoveryWorkbenchProps { language: Language; initialDomain?: Domain; }

const domains: Array<{ id: Domain; en: string; ur: string }> = [
  { id: "welfare", en: "Social welfare", ur: "سماجی بہبود" },
  { id: "education", en: "Education", ur: "تعلیم" },
  { id: "health", en: "Healthcare", ur: "صحت" },
  { id: "documentation", en: "Documents", ur: "دستاویزات" },
  { id: "legal", en: "Legal aid", ur: "قانونی مدد" },
  { id: "employment", en: "Skills & jobs", ur: "ہنر و روزگار" },
  { id: "disaster", en: "Emergency relief", ur: "ہنگامی ریلیف" },
];

const labels = {
  en: { title: "Find the right service", description: "Search verified government and nonprofit services by need, region, or organization.", placeholder: "Try “school fee support” or “lost CNIC”", search: "Search", filters: "Filters", all: "All categories", province: "Province", anyProvince: "Any province", results: "Results", verified: "Verified source", save: "Save", saved: "Saved", clear: "Clear", empty: "No matching services yet. Try a broader phrase.", error: "Search is temporarily unavailable. Try again.", reset: "Reset filters", open: "View service", updated: "Last verified" },
  ur: { title: "اپنی مطلوبہ سروس تلاش کریں", description: "ضرورت، علاقے یا ادارے کے لحاظ سے تصدیق شدہ سرکاری اور فلاحی خدمات تلاش کریں۔", placeholder: "مثلاً اسکول فیس یا گمشدہ شناختی کارڈ", search: "تلاش", filters: "فلٹرز", all: "تمام شعبے", province: "صوبہ", anyProvince: "کوئی بھی صوبہ", results: "نتائج", verified: "مستند ذریعہ", save: "محفوظ", saved: "محفوظ ہوگیا", clear: "صاف کریں", empty: "کوئی سروس نہیں ملی۔ وسیع الفاظ آزمائیں۔", error: "تلاش عارضی طور پر دستیاب نہیں۔ دوبارہ کوشش کریں۔", reset: "فلٹرز بحال کریں", open: "سروس دیکھیں", updated: "آخری تصدیق" },
  ps: { title: "خپل خدمت پیدا کړئ", description: "د اړتیا، سیمې یا ادارې له مخې تایید شوي دولتي او خیریه خدمتونه ولټوئ.", placeholder: "لکه د ښوونځي فیس یا ورکه پېژندپاڼه", search: "لټون", filters: "فلټرونه", all: "ټولې برخې", province: "ولایت", anyProvince: "هر ولایت", results: "پایلې", verified: "تایید شویه سرچینه", save: "ساتل", saved: "خوندي شو", clear: "پاکول", empty: "خدمت ونه موندل شو. پراخې کلمې وکاروئ.", error: "لټون لنډمهاله بند دی. بیا هڅه وکړئ.", reset: "فلټرونه بیا وټاکئ", open: "خدمت وګورئ", updated: "وروستی تایید" },
} as const;

const PROVINCES = ["Punjab", "Khyber Pakhtunkhwa", "Sindh", "Balochistan", "Islamabad"];

function serviceName(service: ServiceRecord, language: Language) { return language === "en" ? service.name : language === "ps" ? service.namePs : service.nameUr; }
function serviceDescription(service: ServiceRecord, language: Language) { return language === "en" ? service.description : service.descriptionUr; }
function readSaved(): string[] { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem("raahi-saved-services") || "[]"); } catch { return []; } }
function saveSaved(ids: string[]) { localStorage.setItem("raahi-saved-services", JSON.stringify(ids.slice(0, 100))); }

export default function ServiceDiscoveryWorkbench({ language, initialDomain }: ServiceDiscoveryWorkbenchProps) {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState<Domain | "">(initialDomain || "");
  const [province, setProvince] = useState("");
  const [results, setResults] = useState<ServiceRecord[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const t = labels[language];

  useEffect(() => setSaved(readSaved()), []);

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (domain) params.set("domain", domain);
    if (province) params.set("province", province);
    return `/api/search?${params.toString()}`;
  }, [query, domain, province]);

  const search = async (event?: FormEvent) => {
    event?.preventDefault();
    setLoading(true); setError(""); setHasSearched(true);
    try {
      const response = await fetch(requestUrl, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("search_failed");
      const data = await response.json();
      setResults(Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : []);
    } catch { setError(t.error); setResults([]); }
    finally { setLoading(false); }
  };

  const toggleSaved = (id: string) => {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id];
    setSaved(next); saveSaved(next);
  };

  const reset = () => { setQuery(""); setDomain(""); setProvince(""); setResults([]); setHasSearched(false); setError(""); };

  return (
    <section className="card-premium p-5 sm:p-7" aria-labelledby="service-search-title" dir={language === "en" ? "ltr" : "rtl"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-[var(--forest)]">RAAHI DIRECTORY</p><h2 id="service-search-title" className="mt-1 text-xl font-black text-[var(--ink)]">{t.title}</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)]">{t.description}</p></div>
        {saved.length > 0 && <span className="rounded-full bg-[var(--forest-light)] px-3 py-1 text-xs font-bold text-[var(--forest)]">{saved.length} {t.saved}</span>}
      </div>
      <form onSubmit={search} className="mt-5 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="service-query" className="sr-only">{t.title}</label>
        <input id="service-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.placeholder} className="input-field min-h-12 flex-1 text-sm" autoComplete="off" />
        <button type="submit" disabled={loading} className="btn-primary min-h-12 px-6 disabled:cursor-wait disabled:opacity-60">{loading ? "…" : t.search}</button>
      </form>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="flex flex-col gap-1 text-[11px] font-bold text-[var(--muted)]"><span>{t.filters}</span><select value={domain} onChange={(event) => setDomain(event.target.value as Domain | "")} className="input-field min-h-10 text-xs"><option value="">{t.all}</option>{domains.map((item) => <option key={item.id} value={item.id}>{language === "en" ? item.en : item.ur}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-[var(--muted)]"><span>{t.province}</span><select value={province} onChange={(event) => setProvince(event.target.value)} className="input-field min-h-10 text-xs"><option value="">{t.anyProvince}</option>{PROVINCES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <button type="button" onClick={reset} className="self-end rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-bold text-[var(--muted)] hover:bg-[var(--surface-2)]">{t.clear}</button>
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</p>}
      <div className="mt-6" aria-live="polite">
        {loading && <div className="grid gap-3 sm:grid-cols-2" aria-label="Loading results"><div className="skeleton h-32 rounded-2xl" /><div className="skeleton h-32 rounded-2xl" /></div>}
        {!loading && hasSearched && results.length === 0 && !error && <div className="rounded-2xl border border-dashed border-[var(--line)] p-8 text-center text-sm font-semibold text-[var(--muted)]">{t.empty}</div>}
        {!loading && results.length > 0 && <div><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black text-[var(--ink)]">{t.results} ({results.length})</h3><button type="button" onClick={reset} className="text-xs font-bold text-[var(--forest)] hover:underline">{t.reset}</button></div><div className="grid gap-3 lg:grid-cols-2">{results.map((service) => <article key={service.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4 transition hover:border-[var(--forest)]"><div className="flex items-start justify-between gap-3"><div><span className="inline-flex rounded-full bg-[var(--forest-light)] px-2 py-1 text-[10px] font-bold text-[var(--forest)]">{t.verified}</span><h4 className="mt-2 text-sm font-black text-[var(--ink)]">{serviceName(service, language)}</h4></div><button type="button" onClick={() => toggleSaved(service.id)} aria-label={`${saved.includes(service.id) ? t.saved : t.save}: ${serviceName(service, language)}`} className={`rounded-lg px-2 py-1 text-xs font-bold ${saved.includes(service.id) ? "bg-[var(--forest)] text-white" : "border border-[var(--line)] text-[var(--muted)]"}`}>{saved.includes(service.id) ? "✓" : "☆"}</button></div><p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--muted)]">{serviceDescription(service, language)}</p><div className="mt-3 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold text-[var(--muted)]">{t.updated}: {service.lastVerified}</span><Link href={`/programs/${service.id}`} className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-bold text-[var(--forest)] shadow-xs hover:bg-[var(--forest-light)]">{t.open} →</Link></div></article>)}</div></div>}
      </div>
    </section>
  );
}
