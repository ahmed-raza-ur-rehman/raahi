"use client";

import { useEffect, useState } from "react";
import { KIND_LABELS, pick, t } from "@/lib/opportunities/i18n";
import type { OpportunityStatusReport } from "@/lib/opportunities/store";
import type { OpportunityKind } from "@/lib/opportunities/types";
import { formatDate, timeAgoLabel, type Tone } from "./format";
import { useLanguage } from "./useLanguage";
import { Chip, Shell } from "./ui";

interface RegistryEntry {
  id: string;
  name: string;
  homepage: string;
  minIntervalMinutes: number;
  experimental: boolean;
  attribution: string;
  terms?: string;
  enabled: boolean;
}
type StatusResponse = OpportunityStatusReport & { linkHealthCheckedAt: string | null; registry: RegistryEntry[] };

const STATUS_TONE: Record<string, Tone> = { ok: "ok", empty: "soon", error: "urgent", skipped: "none" };

export default function StatusPage() {
  const [language, setLanguage] = useLanguage();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/opportunities/status")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("bad"))))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  const reports = new Map((data?.sources ?? []).map((report) => [report.sourceId, report]));

  return (
    <Shell language={language} onLanguage={setLanguage} active="status">
      <section className="rounded-3xl bg-gradient-to-br from-[var(--forest-deep)] via-[var(--forest-dark)] to-[var(--forest)] p-5 text-white shadow-[var(--shadow-forest)] sm:p-7">
        <h1 className="text-2xl font-black sm:text-3xl">{t(language, "statusTitle")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/85">{t(language, "statusSub")}</p>
      </section>

      {failed && <p role="alert" className="card mt-5 p-4 text-sm text-[var(--danger)]">{t(language, "loadError")}</p>}
      {!data && !failed && <div className="skeleton mt-5 h-40 rounded-2xl" />}

      {data && (
        <>
          {data.stale && <p role="alert" className="mt-5 rounded-xl border border-[var(--amber)] bg-[var(--amber-bg)] p-4 text-sm font-bold text-[var(--amber)]">⚠️ {t(language, "statusStale")}</p>}

          <section className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="Summary">
            <div className="card p-4"><p className="text-xs font-bold text-[var(--muted)]">{t(language, "statusLast")}</p><p className="mt-1 text-lg font-black text-[var(--ink)]">{data.generatedAt ? timeAgoLabel(data.generatedAt, language) : "—"}</p><p className="text-[11px] text-[var(--muted)]" dir="ltr">{data.generatedAt?.replace("T", " ").slice(0, 16)} UTC</p></div>
            <div className="card p-4"><p className="text-xs font-bold text-[var(--muted)]">{t(language, "statusTotal")}</p><p className="mt-1 text-lg font-black text-[var(--ink)]">{data.total}</p><p className="text-[11px] text-[var(--muted)]">{data.byKind.map((row) => `${pick(language, KIND_LABELS[row.value as OpportunityKind])} ${row.count}`).join(" · ")}</p></div>
            <div className="card p-4"><p className="text-xs font-bold text-[var(--muted)]">{language === "en" ? "Directory links checked" : "ڈائریکٹری لنکس کی جانچ"}</p><p className="mt-1 text-lg font-black text-[var(--ink)]">{data.linkHealthCheckedAt ? formatDate(data.linkHealthCheckedAt, language) : "—"}</p><p className="text-[11px] text-[var(--muted)]">{data.remoteRefresh ? (language === "en" ? "Live snapshot refresh: on" : "براہ راست اپ ڈیٹ: آن") : language === "en" ? "Live snapshot refresh: off" : "براہ راست اپ ڈیٹ: آف"}</p></div>
          </section>

          <section className="card mt-5 overflow-hidden" aria-label={t(language, "statusSource")}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-[var(--surface-2)] text-xs font-black text-[var(--muted)]">
                  <tr>
                    <th className="p-3 text-start">{t(language, "statusSource")}</th>
                    <th className="p-3 text-start">{t(language, "statusResult")}</th>
                    <th className="p-3 text-start">{t(language, "statusItems")}</th>
                    <th className="p-3 text-start">{t(language, "statusTerms")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.registry.map((source) => {
                    const report = reports.get(source.id);
                    const status = report?.status ?? "skipped";
                    return (
                      <tr key={source.id} className="border-t border-[var(--line-soft)] align-top">
                        <td className="p-3">
                          <a href={source.homepage} target="_blank" rel="noopener noreferrer" className="font-black text-[var(--forest-dark)] hover:underline">{source.name} ↗</a>
                          <p className="mt-0.5 text-[11px] text-[var(--muted)]">every ≥ {source.minIntervalMinutes >= 60 ? `${source.minIntervalMinutes / 60} h` : `${source.minIntervalMinutes} min`}</p>
                          {source.experimental && <p className="mt-0.5 text-[11px] font-semibold text-[var(--amber)]">{t(language, "statusExperimental")}</p>}
                        </td>
                        <td className="p-3">
                          <Chip tone={STATUS_TONE[status]}>{t(language, status === "ok" ? "ok" : status === "empty" ? "empty" : status === "error" ? "error" : "skipped")}</Chip>
                          {report?.lastSuccessAt && <p className="mt-1 text-[11px] text-[var(--muted)]">{timeAgoLabel(report.lastSuccessAt, language)}</p>}
                          {(report?.error || report?.note) && <p className="mt-1 max-w-xs text-[11px] leading-snug text-[var(--muted)]" dir="ltr">{report.error ?? report.note}</p>}
                        </td>
                        <td className="p-3 font-bold text-[var(--ink)]">{report?.items ?? 0}</td>
                        <td className="p-3 text-[11px] leading-snug text-[var(--ink-soft)]" dir="ltr"><p className="font-semibold">{source.attribution}</p>{source.terms && <p className="mt-0.5 text-[var(--muted)]">{source.terms}</p>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="text-base font-black text-[var(--ink)]">{t(language, "statusHow")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{t(language, "statusHowBody")}</p>
            </div>
            <div className="card p-5">
              <h2 className="text-base font-black text-[var(--ink)]">{language === "en" ? "Use this data in your own app" : "یہ ڈیٹا اپنی ایپ میں استعمال کریں"}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{language === "en" ? "Read-only JSON feeds with CORS enabled — for example to show the latest PSC jobs inside NeuroPrep or scholarships inside another RAAHI-family app." : "صرف پڑھنے والی JSON فیڈز، CORS کے ساتھ — مثلاً نیوروپریپ میں تازہ پی ایس سی نوکریاں یا کسی اور راہی ایپ میں اسکالرشپس دکھانے کے لیے۔"}</p>
              <ul className="mt-3 space-y-1.5 text-xs font-bold text-[var(--forest)]" dir="ltr">
                {["/api/opportunities?kind=job&scope=pakistan&limit=10", "/api/opportunities?q=fully+funded+masters&pk=1", "/api/resources?category=overseas-employment", "/api/ecosystem"].map((path) => (
                  <li key={path}><a href={path} target="_blank" rel="noopener noreferrer" className="break-all hover:underline">{path}</a></li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}
    </Shell>
  );
}
