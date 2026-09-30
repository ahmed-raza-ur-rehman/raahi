"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Domain, Language, ServiceRecord } from "@/lib/types";

interface FewClickNavigatorProps {
  initialLanguage?: Language;
  onSelectService?: (service: ServiceRecord) => void;
}

const PRIMARY_NEEDS: Array<{
  id: Domain;
  icon: string;
  titleEn: string;
  titleUr: string;
  descEn: string;
  descUr: string;
  badgeEn: string;
  badgeUr: string;
}> = [
  {
    id: "welfare",
    icon: "💰",
    titleEn: "Social Welfare & Rashan",
    titleUr: "بینظیر کفالت و راشن امداد",
    descEn: "BISP Kafaalat, Bait-ul-Mal, Ehsaas & monthly rations",
    descUr: "بی آئی ایس پی کفالت، راشن، زکوٰۃ گرانٹ اور بیت المال",
    badgeEn: "15+ Programs",
    badgeUr: "15+ اسکیمیں",
  },
  {
    id: "health",
    icon: "🏥",
    titleEn: "Free Healthcare & Dialysis",
    titleUr: "مفت علاج و ڈائیلاسز سپورٹ",
    descEn: "Sehat Card, subsidized surgeries & free medicines",
    descUr: "صحت کارڈ، سندس فاؤنڈیشن، انڈس ہسپتال اور مفت ادویات",
    badgeEn: "13+ Facilities",
    badgeUr: "13+ ہسپتال",
  },
  {
    id: "documentation",
    icon: "📄",
    titleEn: "CNIC, Domicile & NADRA",
    titleUr: "شناختی کارڈ، ب فارم و ڈومیسائل",
    descEn: "Smart CNIC, PakID, Domicile, FRC & police clearance",
    descUr: "نادرا سمارٹ کارڈ، بچوں کا ب فارم، ڈومیسائل اور پولیس ویریفکیشن",
    badgeEn: "16+ Services",
    badgeUr: "16+ دستاویزات",
  },
  {
    id: "education",
    icon: "🎓",
    titleEn: "Scholarships & Fee Support",
    titleUr: "تعلیمی وظائف و اسکول فیس",
    descEn: "HEC scholarships, school stipends & free education",
    descUr: "ایچ ای سی وظائف، بینظیر تعلیمی وظائف اور مفت اسکولنگ",
    badgeEn: "14+ Schemes",
    badgeUr: "14+ وظائف",
  },
  {
    id: "employment",
    icon: "💼",
    titleEn: "Free IT Courses & Freelancing",
    titleUr: "مفت کمپیوٹر کورسز و روزگار",
    descEn: "DigiSkills, NAVTTC & youth tech certifications",
    descUr: "ڈیجی اسکلز، بانو قابل، این او ٹی ٹی سی اور بلا سود قرضے",
    badgeEn: "8+ Tracks",
    badgeUr: "8+ کورسز",
  },
  {
    id: "legal",
    icon: "⚖️",
    titleEn: "Free Legal Aid & Protection",
    titleUr: "مفت قانونی مدد و تحفظ",
    descEn: "Legal Aid Society 0800-70806, family court & advice",
    descUr: "لیگل ایڈ سوسائٹی، فیملی تنازعات اور مفت سرکاری وکیل",
    badgeEn: "5+ Helplines",
    badgeUr: "5+ ہیلپ لائنز",
  },
  {
    id: "disaster",
    icon: "🚨",
    titleEn: "Emergency & Flood Relief",
    titleUr: "ہنگامی ریلیف و قدرتی آفات",
    descEn: "Rescue 1122, PDMA disaster relief & flood tents",
    descUr: "ریسکیو 1122، سیلاب ریلیف، خیمے اور ہنگامی مالی گرانٹ",
    badgeEn: "14+ Teams",
    badgeUr: "14+ ریلیف یونٹس",
  },
];

const PROVINCES = [
  { id: "Punjab", labelEn: "Punjab", labelUr: "پنجاب" },
  { id: "Khyber Pakhtunkhwa", labelEn: "KPK", labelUr: "خیبر پختونخوا" },
  { id: "Sindh", labelEn: "Sindh", labelUr: "سندھ" },
  { id: "Balochistan", labelEn: "Balochistan", labelUr: "بلوچستان" },
  { id: "Islamabad", labelEn: "Islamabad (ICT)", labelUr: "وفاقی دارالحکومت" },
];

const INCOME_RANGES = [
  { id: "low", labelEn: "Under Rs 25,000", labelUr: "25,000 سے کم (مستحق)" },
  { id: "mid", labelEn: "Rs 25,000 - 50,000", labelUr: "25,000 سے 50,000" },
  { id: "high", labelEn: "Above Rs 50,000", labelUr: "50,000 سے زیادہ" },
];

const NO_RESULTS: ServiceRecord[] = [];

export default function FewClickNavigator({ initialLanguage = "ur" }: FewClickNavigatorProps) {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>(initialLanguage);

  // Navigator Step
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Selected Criteria
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string>("Punjab");
  const [selectedIncome, setSelectedIncome] = useState<string>("low");
  const [hasCnic, setHasCnic] = useState<boolean>(true);
  const [specialCategory, setSpecialCategory] = useState<string>("none");

  // Results State
  const [settled, setSettled] = useState<{ key: string; items: ServiceRecord[] } | undefined>(undefined);
  const [creatingCase, setCreatingCase] = useState<boolean>(false);

  // Identifies the exact request currently being shown. Keying results this way
  // means a slow response for old criteria can never overwrite newer results.
  const requestKey = step === 3 && selectedDomain ? `${selectedDomain}|${selectedProvince}` : null;
  const fresh = requestKey !== null && settled?.key === requestKey;
  const results = fresh ? settled.items : NO_RESULTS;
  const loadingResults = requestKey !== null && !fresh;

  // When criteria change and we are at step 3, fetch matching services.
  // Every setState happens in an async continuation, and the keyed result means
  // a superseded response is discarded instead of flashing stale data.
  useEffect(() => {
    if (!requestKey || !selectedDomain) return;
    let cancelled = false;
    fetch(`/api/programs?domain=${selectedDomain}&province=${encodeURIComponent(selectedProvince)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSettled({ key: requestKey, items: data.results || [] });
      })
      .catch(() => {
        if (!cancelled) setSettled({ key: requestKey, items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, selectedDomain, selectedProvince]);

  const handleSelectNeed = (domain: Domain) => {
    setSelectedDomain(domain);
    setStep(2);
  };

  const handleApplyFilters = () => {
    setStep(3);
  };

  const handleReset = () => {
    setStep(1);
    setSelectedDomain(null);
  };

  const handleCreateCaseFromNavigator = async () => {
    if (!selectedDomain || results.length === 0) return;
    setCreatingCase(true);

    const topService = results[0];
    const caseTitle = language === "en" ? `${topService.name} Application` : `${topService.nameUr} درخواست`;
    const caseSummary =
      language === "en"
        ? `Personalized guidance for ${selectedProvince} citizen with income status: ${selectedIncome}.`
        : `${selectedProvince} کے شہری کے لیے رہنمائی۔ آمدن زمرہ: ${selectedIncome}`;

    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: caseTitle,
          titleUr: caseTitle,
          domain: selectedDomain,
          summary: caseSummary,
          serviceIds: results.slice(0, 3).map((s) => s.id),
          actions: topService.procedure?.map((p) => ({
            label: p.title,
            labelUr: p.titleUr,
            serviceId: topService.id,
          })) || [{ label: "Verify Eligibility", labelUr: "اہلیت کی تصدیق کریں" }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/cases/${data.case.id}`);
      } else {
        router.push("/cases");
      }
    } catch {
      router.push("/cases");
    } finally {
      setCreatingCase(false);
    }
  };

  return (
    <div
      className="w-full rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-7 shadow-sm transition-all"
      dir={language === "en" ? "ltr" : "rtl"}
    >
      {/* ─── Top Control Header ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line-soft)] pb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--forest-light)] text-base font-black text-[var(--forest)]">
            ⚡
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-black text-[var(--ink)]">
              {language === "en"
                ? "Few-Click Guided Navigator"
                : "چند کلکس میں رہنمائی (بغیر ٹائپنگ)"}
            </h2>
            <p className="text-[11px] text-[var(--muted)] font-medium">
              {language === "en"
                ? "Instant verified path in 3 simple taps · Zero waiting"
                : "صرف 3 کلکس میں تصدیق شدہ فلاحی و حکومتی راستہ معلوم کریں"}
            </p>
          </div>
        </div>

        {/* Language & Step Indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs font-mono text-[var(--muted)] font-bold me-1">
            <span>{language === "en" ? "Step" : "مرحلہ"}</span>
            <span className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[var(--forest)]">
              {step}/3
            </span>
          </div>

          <div className="flex gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-0.5 text-xs">
            {(["ur", "en"] as Language[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`rounded px-2 py-0.5 font-bold transition cursor-pointer ${
                  language === lang
                    ? "bg-[var(--forest)] text-white shadow-xs"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {lang === "ur" ? "اردو" : "EN"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── STEP 1: Select Primary Goal ────────────────────────────── */}
      {step === 1 && (
        <div className="py-5 animate-fade-in">
          <p className="text-xs sm:text-sm font-bold text-[var(--ink-soft)] mb-4">
            {language === "en"
              ? "1. What is your immediate need or goal? (Click to select)"
              : "1. آپ کی فوری ضرورت کیا ہے؟ (ایک منتخب کریں)"}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PRIMARY_NEEDS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNeed(item.id)}
                className="group flex flex-col justify-between rounded-2xl border-2 border-[var(--line)] bg-[var(--surface-2)] p-4 text-start transition-all hover:border-[var(--forest)] hover:bg-emerald-50/20 hover:shadow-md active:scale-[0.99] cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-3xl group-hover:scale-110 transition-transform">
                      {item.icon}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[var(--forest)] border border-[var(--line)]">
                      {language === "en" ? item.badgeEn : item.badgeUr}
                    </span>
                  </div>

                  <h3 className="mt-3 text-sm font-black text-[var(--ink)] group-hover:text-[var(--forest)] transition-colors">
                    {language === "en" ? item.titleEn : item.titleUr}
                  </h3>

                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)] line-clamp-2">
                    {language === "en" ? item.descEn : item.descUr}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-end text-xs font-bold text-[var(--forest)]">
                  <span>{language === "en" ? "Select →" : "← منتخب کریں"}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── STEP 2: Quick Context Chips ─────────────────────────────── */}
      {step === 2 && (
        <div className="py-5 animate-fade-in space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs sm:text-sm font-bold text-[var(--ink-soft)]">
              {language === "en"
                ? "2. Personalize your situation with quick taps (No typing needed)"
                : "2. اپنی صورتحال کے مطابق منتخب کریں (ٹائپنگ کی ضرورت نہیں)"}
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-bold text-[var(--muted)] hover:underline cursor-pointer"
            >
              {language === "en" ? "← Change Goal" : "تبدیل کریں →"}
            </button>
          </div>

          {/* Province Selector */}
          <div>
            <label className="block text-xs font-bold text-[var(--ink)] mb-2">
              📍 {language === "en" ? "Your Province / Location:" : "آپ کا صوبہ / علاقہ:"}
            </label>
            <div className="flex flex-wrap gap-2">
              {PROVINCES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProvince(p.id)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                    selectedProvince === p.id
                      ? "bg-[var(--forest)] text-white shadow-xs"
                      : "border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-soft)] hover:bg-white"
                  }`}
                >
                  {language === "en" ? p.labelEn : p.labelUr}
                </button>
              ))}
            </div>
          </div>

          {/* Income Level Selector */}
          <div>
            <label className="block text-xs font-bold text-[var(--ink)] mb-2">
              💵 {language === "en" ? "Monthly Household Income:" : "ماہانہ گھریلو آمدن:"}
            </label>
            <div className="flex flex-wrap gap-2">
              {INCOME_RANGES.map((inc) => (
                <button
                  key={inc.id}
                  type="button"
                  onClick={() => setSelectedIncome(inc.id)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                    selectedIncome === inc.id
                      ? "bg-[var(--forest)] text-white shadow-xs"
                      : "border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-soft)] hover:bg-white"
                  }`}
                >
                  {language === "en" ? inc.labelEn : inc.labelUr}
                </button>
              ))}
            </div>
          </div>

          {/* CNIC Status */}
          <div>
            <label className="block text-xs font-bold text-[var(--ink)] mb-2">
              🆔 {language === "en" ? "Computerized CNIC Status:" : "شناختی کارڈ کی صورتحال:"}
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setHasCnic(true)}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                  hasCnic
                    ? "bg-[var(--forest)] text-white shadow-xs"
                    : "border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-soft)] hover:bg-white"
                }`}
              >
                {language === "en" ? "✓ Yes, I have valid CNIC" : "✓ جی ہاں، شناختی کارڈ موجود ہے"}
              </button>
              <button
                type="button"
                onClick={() => setHasCnic(false)}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                  !hasCnic
                    ? "bg-amber-600 text-white shadow-xs"
                    : "border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-soft)] hover:bg-white"
                }`}
              >
                {language === "en" ? "❌ Expired / Lost / None" : "❌ شناختی کارڈ نہیں ہے / نیا چاہیے"}
              </button>
            </div>
          </div>

          {/* Vulnerable Situation */}
          <div>
            <label className="block text-xs font-bold text-[var(--ink)] mb-2">
              👨‍👩‍👧 {language === "en" ? "Special Condition (If applicable):" : "خصوصی رعایت / زمرہ:"}
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "none", en: "None / General Citizen", ur: "عام شہری" },
                { id: "widow", en: "Widow / Single Mother", ur: "بیوہ / اکیلی ماں" },
                { id: "orphan", en: "Orphan / Student", ur: "طالب علم / یتیم" },
                { id: "disabled", en: "Special Needs / Disability", ur: "معذور / خصوصی فرد" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSpecialCategory(cat.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    specialCategory === cat.id
                      ? "bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold"
                      : "border border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)] hover:bg-white"
                  }`}
                >
                  {language === "en" ? cat.en : cat.ur}
                </button>
              ))}
            </div>
          </div>

          {/* CTA Next */}
          <div className="pt-4 border-t border-[var(--line-soft)] flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
            >
              {language === "en" ? "← Back" : "← واپس"}
            </button>

            <button
              type="button"
              onClick={handleApplyFilters}
              className="flex items-center gap-2 rounded-2xl bg-[var(--forest)] px-6 py-3 text-xs font-bold text-white shadow-md hover:bg-[var(--forest-dark)] transition cursor-pointer"
            >
              <span>{language === "en" ? "Show My Personalized Plan" : "میری رہنمائی اور راستہ دکھائیں"}</span>
              <span>{language === "en" ? "→" : "←"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 3: Context-Aware Tailored Results & Action Plan ─────── */}
      {step === 3 && (
        <div className="py-5 animate-fade-in space-y-6">
          {/* User Context Chip Summary */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--forest-dark)]">
              <span className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 border border-emerald-200 shadow-2xs">
                📍 {selectedProvince}
              </span>
              <span className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 border border-emerald-200 shadow-2xs">
                💵 {INCOME_RANGES.find((i) => i.id === selectedIncome)?.labelUr}
              </span>
              <span className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 border border-emerald-200 shadow-2xs">
                🆔 {hasCnic ? "شناختی کارڈ موجود" : "شناختی کارڈ درکار"}
              </span>
              {specialCategory !== "none" && (
                <span className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 border border-emerald-200 shadow-2xs">
                  ✨ {specialCategory}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-xs font-bold text-[var(--forest)] hover:underline cursor-pointer"
            >
              {language === "en" ? "Edit Criteria ✏️" : "ترمیم کریں ✏️"}
            </button>
          </div>

          {/* Results List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-[var(--ink)] flex items-center gap-1.5">
                <span>🎯</span>
                <span>
                  {language === "en"
                    ? `Matched Verified Programs (${results.length})`
                    : `آپ کی صورتحال کے لیے موزوں تصدیق شدہ پروگرامز (${results.length})`}
                </span>
              </h3>

              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                {language === "en" ? "✓ 100% Official Source Citing" : "✓ مستند سرکاری قوانین پر مبنی"}
              </span>
            </div>

            {loadingResults ? (
              <div className="space-y-3">
                <div className="skeleton h-24 rounded-2xl w-full" />
                <div className="skeleton h-24 rounded-2xl w-full" />
              </div>
            ) : results.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-2)] p-6 text-center">
                <p className="text-xs font-bold text-[var(--ink)]">
                  {language === "en" ? "No specific programs found for this combination." : "اس امتزاج کے لیے کوئی خاص سروس نہیں ملی۔"}
                </p>
                <Link
                  href="/programs"
                  className="mt-2 inline-block text-xs font-bold text-[var(--forest)] hover:underline"
                >
                  {language === "en" ? "Browse all 85 services" : "تمام 85 خدمات کی فہرست دیکھیں"}
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {results.slice(0, 3).map((svc, idx) => (
                  <div
                    key={svc.id}
                    className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-xs transition hover:border-[var(--forest)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-md bg-[var(--forest-light)] px-2 py-0.5 text-[10px] font-bold text-[var(--forest)] uppercase">
                        {svc.domain} · Tier {svc.sourceAuthorityTier}
                      </span>

                      <span className="rounded-full bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                        {idx === 0
                          ? language === "en" ? "🟢 Highly Likely Eligible" : "🟢 اہلیت: قوی امکان"
                          : language === "en" ? "🟡 Possible Match" : "🟡 اہلیت: ممکن"}
                      </span>
                    </div>

                    <h4 className="mt-2 text-sm font-black text-[var(--ink)]">
                      {language === "en" ? svc.name : svc.nameUr}
                    </h4>

                    <p className="mt-1 text-xs text-[var(--muted)] leading-relaxed line-clamp-2">
                      {language === "en" ? svc.description : svc.descriptionUr}
                    </p>

                    {/* Required Documents Mini Pills */}
                    {svc.requiredDocuments && svc.requiredDocuments.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        <span className="text-[10px] font-bold text-[var(--muted)] self-center me-1">
                          {language === "en" ? "Required:" : "ضروری کاغذات:"}
                        </span>
                        {svc.requiredDocuments.map((d, i) => (
                          <span
                            key={i}
                            className="rounded bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink-soft)] border border-[var(--line-soft)]"
                          >
                            📄 {language === "en" ? d.label : d.labelUr}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Step-by-Step Procedure Quick Link */}
                    <div className="mt-3.5 border-t border-[var(--line-soft)] pt-2.5 flex items-center justify-between text-xs">
                      <Link
                        href={`/procedure/${svc.id}`}
                        className="font-bold text-[var(--forest)] hover:underline inline-flex items-center gap-1"
                      >
                        <span>📋 {language === "en" ? "Step-by-Step Guide" : "طریقہ کار گائیڈ"}</span>
                        <span>{language === "en" ? "→" : "←"}</span>
                      </Link>

                      <a
                        href={svc.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-[var(--muted)] hover:underline"
                      >
                        {svc.sourceTitle} ↗
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── Confirmed Next Steps Action Checklist ───────────────── */}
          {results.length > 0 && results[0].procedure && results[0].procedure.length > 0 && (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
              <h4 className="text-xs font-black text-[var(--ink)] flex items-center gap-1.5 mb-2">
                <span>📋</span>
                <span>{language === "en" ? "Your Confirmed Next Steps" : "آپ کے اگلے ضروری اقدامات"}</span>
              </h4>

              <div className="space-y-1.5 text-xs">
                {results[0].procedure.slice(0, 3).map((stepItem, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-xl bg-white p-2.5 border border-[var(--line-soft)]"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--forest-light)] text-[10px] font-black text-[var(--forest)] font-mono">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-bold text-[var(--ink)]">
                        {language === "en" ? stepItem.title : stepItem.titleUr}
                      </p>
                      <p className="text-[11px] text-[var(--muted)] mt-0.5">
                        {language === "en" ? stepItem.description : stepItem.descriptionUr}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Bottom Actions: Save Case vs Chat ─────────────────────── */}
          <div className="pt-3 border-t border-[var(--line-soft)] flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-bold text-[var(--muted)] hover:underline cursor-pointer"
            >
              {language === "en" ? "← Start Over" : "نئی تلاش کریں"}
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/chat?need=${encodeURIComponent(
                  results[0] ? (language === "en" ? results[0].name : results[0].nameUr) : "assistance"
                )}`}
                className="rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-xs font-bold text-[var(--ink)] hover:bg-[var(--forest-light)] transition"
              >
                💬 {language === "en" ? "Chat for Questions" : "چیٹ میں سوال پوچھیں"}
              </Link>

              <button
                type="button"
                onClick={handleCreateCaseFromNavigator}
                disabled={creatingCase || results.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--forest)] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[var(--forest-dark)] transition cursor-pointer disabled:opacity-50"
              >
                {creatingCase ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white border-t-transparent" />
                    <span>{language === "en" ? "Saving..." : "محفوظ ہو رہا ہے..."}</span>
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    <span>{language === "en" ? "Save As My Case" : "یہ کیس محفوظ کریں"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
