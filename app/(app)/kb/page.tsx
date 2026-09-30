"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";

import { useLanguage } from "@/components/shell/LanguageProvider";
import { Badge, Button, Card, Empty, Field, FilterPills, Loader, Section, inputClass } from "@/components/shell/Ui";
import { apiPost } from "@/lib/client/useApi";
import type { KnowledgeHit, WebSearchResult } from "@/lib/types";

type Tab = "knowledge" | "web" | "correct";

function KnowledgeBasePageInner() {
  const { t, language } = useLanguage();
  const params = useSearchParams();
  // The tab can be deep-linked (?tab=correct&correct=<id>), so it is derived
  // from the URL until the visitor picks one themselves.
  const requestedTab = params.get("tab");
  const [tabOverride, setTabOverride] = useState<Tab | null>(null);
  const tab: Tab =
    tabOverride ??
    (requestedTab === "web" || requestedTab === "correct" || requestedTab === "knowledge"
      ? requestedTab
      : "knowledge");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [hits, setHits] = useState<KnowledgeHit[]>([]);
  const [web, setWeb] = useState<WebSearchResult[]>([]);
  const [operators, setOperators] = useState<{ notification: string; dates: string } | undefined>(undefined);
  const [note, setNote] = useState<string | undefined>(undefined);
  // Start busy only when a deep-linked ?q= search is about to run.
  const [busy, setBusy] = useState(Boolean(params.get("q")));
  const correctFor = params.get("correct") ?? "";

  const search = async (value: string, target: Tab) => {
    if (!value.trim()) return;
    setBusy(true);
    setNote(undefined);
    if (target === "knowledge") {
      const result = await apiPost<{ results: KnowledgeHit[] }>("/api/knowledge/search", { query: value, limit: 12, language });
      setHits(result.ok ? result.data.results : []);
    } else {
      const result = await apiPost<{ web: WebSearchResult[]; operators: { notification: string; dates: string }; meta: { note?: string } }>(
        "/api/web/search",
        { query: value, mode: "search", limit: 6 },
      );
      if (result.ok) {
        setWeb(result.data.web);
        setOperators(result.data.operators);
        setNote(result.data.meta.note);
      }
    }
    setBusy(false);
  };

  // Deep link (?q=...) runs the first search. Every setState here happens inside
  // the async continuation, never synchronously in the effect body.
  useEffect(() => {
    const initial = params.get("q");
    if (!initial) return;
    let cancelled = false;
    void (async () => {
      const result = await apiPost<{ results: KnowledgeHit[] }>("/api/knowledge/search", {
        query: initial,
        limit: 12,
        language,
      });
      if (cancelled) return;
      if (result.ok) setHits(result.data.results);
      setBusy(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <Section
        title={language === "en" ? "Knowledge base" : "معلومات کا ذخیرہ"}
        subtitle={
          language === "en"
            ? "Every answer Raahi gives comes from here — with its source and the date it was verified."
            : "راہی کا ہر جواب یہیں سے آتا ہے — اپنے ماخذ اور تصدیق کی تاریخ کے ساتھ۔"
        }
      >
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void search(query, tab);
          }}
        >
          <input className={`${inputClass} flex-1`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchPlaceholder")} />
          <button type="submit" disabled={busy} className="rounded-xl bg-[var(--forest)] px-4 text-[13px] font-black text-white disabled:opacity-40">
            {t("search")}
          </button>
        </form>
        <div className="mt-2.5">
          <FilterPills<Tab>
            options={[
              { id: "knowledge", label: language === "en" ? "Verified" : "تصدیق شدہ" },
              { id: "web", label: language === "en" ? "Official web" : "سرکاری ویب" },
              { id: "correct", label: language === "en" ? "Report" : "درستی" },
            ]}
            value={tab}
            onChange={setTabOverride}
          />
        </div>
      </Section>

      {busy ? <Loader /> : null}

      {tab === "knowledge" ? (
        !busy && hits.length === 0 ? (
          <Empty>{t("noResults")}</Empty>
        ) : (
          <div className="space-y-2.5">
            {hits.map((hit) => (
              <Card key={`${hit.entityType}-${hit.entityId}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-extrabold leading-tight">{hit.title.split(" · ")[0]}</p>
                    <p className="text-[10.5px] font-bold text-[var(--muted-light)]">{hit.entityType}</p>
                  </div>
                  <Badge tone={hit.source.tier <= 2 ? "success" : "neutral"}>T{hit.source.tier}</Badge>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--ink-soft)]">{hit.summary.split(" · ")[0]}</p>
                {hit.reasons.length > 0 ? (
                  <p className="mt-1 text-[10.5px] text-[var(--muted-light)]">{hit.reasons.join(" · ")}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <a href={hit.source.url} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-[var(--forest)]">
                    {hit.source.title} ↗
                  </a>
                  <span className="text-[10px] text-[var(--muted-light)]">· {hit.source.lastVerified}</span>
                  <Link
                    href={`/kb?correct=${hit.entityId}&type=${hit.entityType}&tab=correct`}
                    className="text-[11px] font-bold text-[var(--muted)]"
                  >
                    ✏️ {language === "en" ? "Report a mistake" : "غلظی"}
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : null}

      {tab === "web" ? (
        <div className="space-y-2.5">
          {note ? <p className="rounded-xl border border-sky-200 bg-sky-50 p-2.5 text-[11.5px] leading-relaxed text-sky-900">{note}</p> : null}
          {!busy && web.length === 0 ? <Empty>{t("noResults")}</Empty> : null}
          {web.map((result) => (
            <a key={result.url} href={result.url} target="_blank" rel="noreferrer" className="block">
              <Card className="transition hover:border-[var(--forest)]">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[12.5px] font-extrabold leading-tight">{result.title}</p>
                  {result.official ? <Badge tone="success">{language === "en" ? "Official" : "سرکاری"}</Badge> : null}
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">{result.source}</p>
                {result.snippet ? <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--ink-soft)]">{result.snippet}</p> : null}
              </Card>
            </a>
          ))}

          {operators ? (
            <Card className="bg-[var(--surface-2)]">
              <p className="text-[11.5px] font-black">
                {language === "en" ? "Ready-made searches for official notifications" : "سرکاری نوٹیفکیشن کے لیے تیار تلاش"}
              </p>
              <pre className="mt-1.5 overflow-x-auto rounded-lg bg-white p-2 text-[10.5px]" dir="ltr">
                {operators.notification}
                {"\n"}
                {operators.dates}
              </pre>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-[var(--muted)]">
                {language === "en"
                  ? "These operator queries are restricted to publishers RAAHI trusts. Every page is fetched politely — robots.txt respected, one request at a time, results cached."
                  : "یہ تلاشیں صرف قابلِ اعتماد اداروں تک محدود ہیں۔ ہر صفحہ احترام کے ساتھ لیا جاتا ہے — robots.txt کا خیال، ایک وقت میں ایک درخواست، اور نتائج محفوظ۔"}
              </p>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "correct" ? <CorrectionForm defaultEntityId={correctFor} defaultType={params.get("type") ?? "opportunity"} /> : null}
    </div>
  );
}

function CorrectionForm({ defaultEntityId, defaultType }: { defaultEntityId: string; defaultType: string }) {
  const { language } = useLanguage();
  const [form, setForm] = useState({
    entityId: defaultEntityId,
    entityType: defaultType,
    field: "",
    suggestedValue: "",
    reportedValue: "",
    reason: "",
    evidenceUrl: "",
  });
  const [status, setStatus] = useState<{ tone: "ok" | "error"; message: string } | undefined>(undefined);

  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setStatus(undefined);
    const result = await apiPost<{ correction: { id: string } }>("/api/corrections", form);
    setBusy(false);
    setStatus(
      result.ok
        ? {
            tone: "ok",
            message:
              language === "en"
                ? `Thank you — your correction is in the review queue (${result.data.correction.id}).`
                : `شکریہ — آپ کی درستی جائزے کی فہرست میں ہے (${result.data.correction.id})۔`,
          }
        : { tone: "error", message: result.error },
    );
  };

  return (
    <Card>
      <p className="text-[13px] font-extrabold">{language === "en" ? "Report a mistake" : "غلظی کی اطلاع دیں"}</p>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--muted)]">
        {language === "en"
          ? "Tell us what is wrong and what it should say. Add an official link if you have one. Nothing changes until a reviewer verifies it."
          : "بتائیں کیا غلط ہے اور درست کیا ہے۔ اگر سرکاری لنک ہو تو وہ بھی دیں۔ جائزہ لینے والے کی تصدیق تک کچھ نہیں بدلتا۔"}
      </p>

      <div className="mt-3 space-y-2.5">
        <Field label={language === "en" ? "Which item is wrong?" : "کون سی معلومات غلط ہے؟"}>
          <input className={inputClass} value={form.entityId} onChange={(event) => setForm({ ...form, entityId: event.target.value })} placeholder="sch-hec-need-based" />
        </Field>
        <Field label={language === "en" ? "Which part?" : "کون سا حصہ؟"}>
          <input
            className={inputClass}
            value={form.field}
            onChange={(event) => setForm({ ...form, field: event.target.value })}
            placeholder={language === "en" ? "e.g. fee, deadline, phone number" : "مثلاً فیس، آخری تاریخ، فون نمبر"}
          />
        </Field>
        <Field label={language === "en" ? "What it says now" : "اب کیا لکھا ہے"}>
          <input className={inputClass} value={form.reportedValue} onChange={(event) => setForm({ ...form, reportedValue: event.target.value })} />
        </Field>
        <Field label={language === "en" ? "What it should say" : "درست معلومات"}>
          <input className={inputClass} value={form.suggestedValue} onChange={(event) => setForm({ ...form, suggestedValue: event.target.value })} />
        </Field>
        <Field label={language === "en" ? "Official link (optional)" : "سرکاری لنک (اختیاری)"}>
          <input className={inputClass} value={form.evidenceUrl} onChange={(event) => setForm({ ...form, evidenceUrl: event.target.value })} placeholder="https://" />
        </Field>
        <Field label={language === "en" ? "Anything else?" : "مزید کچھ؟"}>
          <textarea className={inputClass} rows={2} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
        </Field>
      </div>

      {status ? (
        <p className={`mt-2 rounded-xl p-2.5 text-[12px] font-bold ${status.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>
          {status.message}
        </p>
      ) : null}

      <div className="mt-3">
        <Button onClick={() => void submit()} disabled={busy || !form.entityId || !form.field || !form.suggestedValue}>
          ✏️ {language === "en" ? "Send for review" : "جائزے کے لیے بھیجیں"}
        </Button>
      </div>
    </Card>
  );
}

export default function KnowledgeBasePage() {
  return (
    <Suspense fallback={null}>
      <KnowledgeBasePageInner />
    </Suspense>
  );
}
