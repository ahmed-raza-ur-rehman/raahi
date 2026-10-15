"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Language } from "@/lib/types";
import { checkAge, daysFrom } from "@/lib/opportunities/age";
import { formatDate, TONE_CLASS } from "./format";

type L = { en: string; ur: string };
const pick = (language: Language, value: L) => (language === "en" ? value.en : value.ur);

const TEXT = {
  intro: {
    en: "Government job advertisements count your age on a fixed date — usually the closing date — against an upper limit. Enter the numbers from the advertisement to see where you stand.",
    ur: "سرکاری نوکری کے اشتہارات آپ کی عمر ایک مقررہ تاریخ (عموماً آخری تاریخ) پر بالائی حد کے مقابلے میں گنتے ہیں۔ اشتہار کے اعداد درج کریں اور اپنی صورتِ حال دیکھیں۔",
  },
  dob: { en: "Date of birth", ur: "تاریخِ پیدائش" },
  dobHint: { en: "Departments usually go by the date of birth on your matriculation certificate — use that one.", ur: "محکمے عموماً میٹرک سرٹیفکیٹ پر درج تاریخِ پیدائش مانتے ہیں — وہی استعمال کریں۔" },
  asOn: { en: "Age counted on", ur: "عمر کس تاریخ پر گنی جائے" },
  asOnHint: { en: "Normally the closing date. The advertisement says which date it uses.", ur: "عموماً آخری تاریخ۔ اشتہار میں لکھا ہوتا ہے کہ کون سی تاریخ مراد ہے۔" },
  today: { en: "Use today", ur: "آج کی تاریخ" },
  max: { en: "Upper age limit (years)", ur: "بالائی حدِ عمر (سال)" },
  relax: { en: "Relaxation (years)", ur: "رعایت (سال)" },
  relaxHint: { en: "Only if the advertisement grants it to your category. Enter exactly what it says.", ur: "صرف تب جب اشتہار آپ کی کیٹیگری کو دے۔ جو لکھا ہو وہی درج کریں۔" },
  min: { en: "Minimum age (years, optional)", ur: "کم از کم عمر (سال، اختیاری)" },
  yourAge: { en: "Your age on that date", ur: "اس تاریخ پر آپ کی عمر" },
  years: { en: "years", ur: "سال" },
  months: { en: "months", ur: "ماہ" },
  days: { en: "days", ur: "دن" },
  day: { en: "day", ur: "دن" },
  month: { en: "month", ur: "ماہ" },
  year: { en: "year", ur: "سال" },
  limitApplied: { en: "Limit applied", ur: "لاگو حد" },
  byYears: { en: "By completed years", ur: "مکمل سالوں کے حساب سے" },
  byYearsHelp: { en: "Within the limit if you have not yet had your next birthday after it — the usual reading of “not exceeding N years”.", ur: "اگر حد کے بعد کی اگلی سالگرہ ابھی نہیں آئی تو آپ حد کے اندر ہیں — “N سال سے زائد نہ ہو” کا عام مطلب۔" },
  toDay: { en: "To the day", ur: "دن کے حساب سے" },
  toDayHelp: { en: "Within the limit only up to exactly N years, 0 months, 0 days — the strictest reading.", ur: "صرف عین N سال، 0 ماہ، 0 دن تک حد کے اندر — سب سے سخت مطلب۔" },
  within: { en: "Within the limit", ur: "حد کے اندر" },
  over: { en: "Over the limit", ur: "حد سے زیادہ" },
  lastDay: { en: "Last day within the limit", ur: "حد کے اندر آخری دن" },
  daysAfter: { en: "day(s) after the counting date", ur: "دن گنتی کی تاریخ کے بعد" },
  daysBefore: { en: "day(s) before the counting date", ur: "دن گنتی کی تاریخ سے پہلے" },
  differ: {
    en: "The two readings give different answers for you. The advertisement’s exact wording — or the department’s recruitment rules — decides; if it is unclear, ask the department before you pay a fee.",
    ur: "دونوں مطلب آپ کے لیے الگ نتیجہ دیتے ہیں۔ اشتہار کے اصل الفاظ — یا محکمے کے بھرتی کے قواعد — فیصلہ کرتے ہیں؛ واضح نہ ہو تو فیس جمع کرانے سے پہلے محکمے سے پوچھ لیں۔",
  },
  minOk: { en: "Meets the minimum age", ur: "کم از کم عمر پوری ہے" },
  minNo: { en: "Below the minimum age", ur: "کم از کم عمر سے کم" },
  invalid: { en: "Enter a valid date of birth that is not after the counting date.", ur: "درست تاریخِ پیدائش درج کریں جو گنتی کی تاریخ کے بعد نہ ہو۔" },
  guide: { en: "How to apply for a government job", ur: "سرکاری نوکری کے لیے اپلائی کیسے کریں" },
  note: { en: "Ages and relaxations differ by post and category, and rules change: the advertisement and the department’s rules are final. RAAHI stores nothing you type here.", ur: "عمر اور رعایت آسامی اور کیٹیگری کے مطابق مختلف ہوتی ہے اور قواعد بدلتے رہتے ہیں: اشتہار اور محکمے کے قواعد حتمی ہیں۔ آپ یہاں جو لکھتے ہیں راہی اسے محفوظ نہیں کرتا۔" },
} satisfies Record<string, L>;

/** "1 day" / "2 days" (Urdu has one form). */
const unit = (language: Language, count: number, one: L, many: L) => pick(language, count === 1 ? one : many);

const number = (value: string): number | undefined => (value.trim() === "" ? undefined : Number(value));

export default function AgeTool({ language }: { language: Language }) {
  const [dob, setDob] = useState("");
  const [asOn, setAsOn] = useState("");
  const [max, setMax] = useState("");
  const [relax, setRelax] = useState("");
  const [min, setMin] = useState("");
  const tx = (key: keyof typeof TEXT) => pick(language, TEXT[key]);

  const result = useMemo(
    () => (dob && asOn ? checkAge({ dob, asOn, maxYears: number(max), relaxationYears: number(relax), minYears: number(min) }) : undefined),
    [dob, asOn, max, relax, min],
  );
  const ready = Boolean(dob && asOn);
  const differs = result && result.withinByCompletedYears !== undefined && result.withinByCompletedYears !== result.withinToTheDay;

  const verdict = (ok: boolean) => (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${TONE_CLASS[ok ? "ok" : "urgent"]}`}>{ok ? "✓" : "✗"} {ok ? tx("within") : tx("over")}</span>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card space-y-4 p-5">
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">{tx("intro")}</p>
        <label className="flex flex-col gap-1 text-xs font-black text-[var(--ink)]">{tx("dob")}
          <input type="date" value={dob} onChange={(event) => setDob(event.target.value)} className="input-field !py-2 !text-sm" dir="ltr" />
          <span className="text-[11px] font-normal text-[var(--muted)]">{tx("dobHint")}</span>
        </label>
        <div className="flex flex-col gap-1 text-xs font-black text-[var(--ink)]">
          <label htmlFor="age-as-on">{tx("asOn")}</label>
          <div className="flex gap-2">
            <input id="age-as-on" type="date" value={asOn} onChange={(event) => setAsOn(event.target.value)} className="input-field !py-2 !text-sm flex-1" dir="ltr" />
            <button type="button" onClick={() => setAsOn(new Date().toLocaleDateString("en-CA"))} className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs">{tx("today")}</button>
          </div>
          <span className="text-[11px] font-normal text-[var(--muted)]">{tx("asOnHint")}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-black text-[var(--ink)]">{tx("max")}
            <input type="number" inputMode="numeric" min={0} max={70} value={max} onChange={(event) => setMax(event.target.value)} className="input-field !py-2 !text-sm" dir="ltr" placeholder="28" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-black text-[var(--ink)]">{tx("relax")}
            <input type="number" inputMode="numeric" min={0} max={30} value={relax} onChange={(event) => setRelax(event.target.value)} className="input-field !py-2 !text-sm" dir="ltr" placeholder="0" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-black text-[var(--ink)]">{tx("min")}
            <input type="number" inputMode="numeric" min={0} max={70} value={min} onChange={(event) => setMin(event.target.value)} className="input-field !py-2 !text-sm" dir="ltr" placeholder="18" />
          </label>
        </div>
        <p className="text-[11px] text-[var(--muted)]">{tx("relaxHint")}</p>
      </section>

      <section aria-live="polite" className="space-y-3">
        {ready && !result && <p role="alert" className="card p-5 text-sm text-[var(--danger)]">{tx("invalid")}</p>}
        {result && (
          <div className="card space-y-4 p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{tx("yourAge")}</p>
              <p className="mt-1 text-2xl font-black text-[var(--forest-dark)]" dir="ltr">
                {result.age.years} <span className="text-sm">{unit(language, result.age.years, TEXT.year, TEXT.years)}</span> · {result.age.months} <span className="text-sm">{unit(language, result.age.months, TEXT.month, TEXT.months)}</span> · {result.age.days} <span className="text-sm">{unit(language, result.age.days, TEXT.day, TEXT.days)}</span>
              </p>
              {result.limit !== undefined && <p className="mt-1 text-xs text-[var(--muted)]">{tx("limitApplied")}: {result.limit} {tx("years")}</p>}
            </div>

            {result.limit !== undefined && result.lastDayByCompletedYears && result.lastDayToTheDay && (
              <div className="space-y-3">
                {([
                  { title: tx("byYears"), help: tx("byYearsHelp"), ok: Boolean(result.withinByCompletedYears), last: result.lastDayByCompletedYears },
                  { title: tx("toDay"), help: tx("toDayHelp"), ok: Boolean(result.withinToTheDay), last: result.lastDayToTheDay },
                ]).map((row) => {
                  const offset = daysFrom(asOn, row.last);
                  return (
                    <div key={row.title} className="rounded-xl border border-[var(--line)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-black text-[var(--ink)]">{row.title}</p>
                        {verdict(row.ok)}
                      </div>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--muted)]">{row.help}</p>
                      <p className="mt-2 text-[12.5px] text-[var(--ink-soft)]">
                        {tx("lastDay")}: <strong>{formatDate(row.last, language)}</strong>{" "}
                        <span className="text-[11.5px] text-[var(--muted)]">({Math.abs(offset)} {offset >= 0 ? tx("daysAfter") : tx("daysBefore")})</span>
                      </p>
                    </div>
                  );
                })}
                {differs && <p className="rounded-xl bg-[var(--amber-bg)] p-3 text-[12.5px] leading-relaxed text-[var(--amber)]">{tx("differ")}</p>}
              </div>
            )}

            {result.meetsMinimum !== undefined && (
              <p className="text-sm font-bold text-[var(--ink-soft)]">
                <span className={`me-2 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${TONE_CLASS[result.meetsMinimum ? "ok" : "urgent"]}`}>{result.meetsMinimum ? "✓" : "✗"}</span>
                {result.meetsMinimum ? tx("minOk") : tx("minNo")}
              </p>
            )}
            <Link href="/opportunities/guides/apply-government-job" className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs">{tx("guide")} →</Link>
          </div>
        )}
        <p className="px-1 text-[11px] leading-relaxed text-[var(--muted)]">{tx("note")}</p>
      </section>
    </div>
  );
}
