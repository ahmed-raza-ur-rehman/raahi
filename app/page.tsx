"use client";

import React, { useState } from "react";
import Link from "next/link";

type Language = "en" | "ur" | "ps";

const DEMO_SCENARIOS = [
  {
    id: "education-welfare",
    titleEn: "Education & Rashan for Low-Income Family",
    titleUr: "کم آمدن خاندان کے لیے بچوں کی فیس اور راشن",
    titlePs: "د ټیټ عاید لرونکې کورنۍ لپاره د زده کړې او راشن مرسته",
    query: "میرے بیٹے کی اسکول فیس کے لیے پیسے نہیں ہیں اور گھر کا راشن بھی چاہیے",
    domain: "welfare",
    icon: "🎓",
    tagEn: "BISP + PBM + Bait-ul-Mal",
    tagUr: "بینظیر تعلیمی وظائف + بیت المال",
  },
  {
    id: "healthcare-dialysis",
    titleEn: "Free Dialysis & Healthcare Assistance",
    titleUr: "مفت ڈائیلاسز اور صحت کارڈ سے علاج",
    titlePs: "وړیا ډایلسز او روغتیایی مرستې",
    query: "زما پلار د پښتورګو تکلیف لري، وړیا ډایلسز او صحت کارډ درملنه پکار ده",
    domain: "health",
    icon: "🏥",
    tagEn: "Sehat Card + Sundas + Indus",
    tagUr: "صحت کارڈ + سندس فاؤنڈیشن",
  },
  {
    id: "lost-cnic-renewal",
    titleEn: "Lost CNIC Renewal & Smart Card",
    titleUr: "گمشدہ شناختی کارڈ اور سمارٹ کارڈ تجدید",
    titlePs: "د ورک شوي نادرا پيژندپاڼې بیا جوړول",
    query: "میرا شناختی کارڈ گم ہو گیا ہے، نادرا سے نیا بنوانے کا کیا طریقہ ہے؟",
    domain: "documentation",
    icon: "📄",
    tagEn: "NADRA PakID + CRC",
    tagUr: "نادرا پاک آئی ڈی + تصدیق",
  },
  {
    id: "flood-disaster",
    titleEn: "Emergency Relief & Flood Assistance",
    titleUr: "سیلاب اور قدرتی آفت سے متاثرہ خاندان کی امداد",
    titlePs: "د سېلاب ځپلو لپاره بيړنۍ مرستې",
    query: "سیلاب میں ہمارا گھر تباہ ہو گیا ہے، ہنگامی راشن، خیمہ اور امداد چاہیے",
    domain: "disaster",
    icon: "🚨",
    tagEn: "Rescue 1122 + PDMA + NDMA",
    tagUr: "ریسکیو 1122 + پی ڈی ایم اے",
  },
  {
    id: "youth-freelancing",
    titleEn: "Free Youth Freelancing & Skills Training",
    titleUr: "نوجوانوں کے لیے مفت فری لانسنگ اور آئی ٹی کورسز",
    titlePs: "د ځوانانو لپاره وړیا آنلاین روزنه او مهارتونه",
    query: "I want to learn freelancing and computer skills for free to earn from home",
    domain: "employment",
    icon: "💼",
    tagEn: "DigiSkills + NAVTTC + Bano Qabil",
    tagUr: "ڈیجی اسکلز + بانو قابل",
  },
];

const DOMAINS = [
  { id: "welfare", icon: "💰", nameEn: "Social Welfare", nameUr: "سماجی بہبود", count: "15+ Programs" },
  { id: "education", icon: "🎓", nameEn: "Education & Grants", nameUr: "تعلیم اور وظائف", count: "14+ Schemes" },
  { id: "health", icon: "🏥", nameEn: "Healthcare", nameUr: "صحت و علاج", count: "13+ Facilities" },
  { id: "documentation", icon: "📄", nameEn: "NADRA & Records", nameUr: "نادرا و دستاویزات", count: "16+ Services" },
  { id: "legal", icon: "⚖️", nameEn: "Legal Aid", nameUr: "قانونی معاونت", count: "5+ Helplines" },
  { id: "employment", icon: "💼", nameEn: "Skills & Jobs", nameUr: "ہنر و روزگار", count: "8+ Tracks" },
  { id: "disaster", icon: "🚨", nameEn: "Disaster & Rescue", nameUr: "ہنگامی ریلیف", count: "14+ Teams" },
];

export default function Home() {
  const [language, setLanguage] = useState<Language>("ur");

  return (
    <main
      className="app-shell flex min-h-screen flex-col justify-between px-4 sm:px-6 py-5"
      dir={language === "en" ? "ltr" : "rtl"}
    >
      {/* ─── Header ────────────────────────────────────────────── */}
      <div>
        <header className="flex items-center justify-between border-b border-[var(--line)] pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--forest)] to-[var(--forest-dark)] text-xl font-black text-white shadow-md">
              ر
            </span>
            <div>
              <p className="text-xl font-black tracking-tight text-[var(--forest)]">
                {language === "en" ? "RAAHI" : "راہی"}
              </p>
              <p className="text-[11px] text-[var(--muted)] font-medium">
                {language === "en"
                  ? "Citizen Service Navigator for Pakistan"
                  : "پاکستان کا سرکاری و عوامی رہنمائی نظام"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Link
              href="/programs"
              className="rounded-xl border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-bold text-[var(--forest)] hover:bg-[var(--forest-light)] transition hidden sm:inline-block"
            >
              📋 {language === "en" ? "Catalog (85)" : "سروس کیٹلاگ"}
            </Link>

            <Link
              href="/cases"
              className="rounded-xl border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-bold text-[var(--forest)] hover:bg-[var(--forest-light)] transition"
            >
              📂 {language === "en" ? "Cases" : "کیسز"}
            </Link>

            <Link
              href="/emergency"
              className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-800 hover:bg-rose-100 transition"
            >
              🚨 1122
            </Link>

            <div className="flex gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-0.5 text-xs">
              {(["ur", "ps", "en"] as Language[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`rounded px-2.5 py-1 font-bold transition ${
                    language === lang
                      ? "bg-[var(--forest)] text-white shadow-xs"
                      : "text-[var(--muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {lang === "ur" ? "اردو" : lang === "ps" ? "پښتو" : "EN"}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* ─── Hero Section ───────────────────────────────────────── */}
        <section className="py-8 text-start animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-[var(--forest-light)] px-3.5 py-1 text-xs font-bold text-[var(--forest)] mb-4">
            <span>🛡️</span>
            <span>
              {language === "en"
                ? "Official Sources · No Middlemen · Free For All Citizens"
                : "تمام معلومات سرکاری و مستند ذرائع سے تصدیق شدہ"}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black leading-tight text-[var(--ink)]">
            {language === "en"
              ? "Find Your Path Through Government & Social Services"
              : language === "ps"
              ? "د حکومتي او ټولنیزو خدمتونو لارښود"
              : "سرکاری اور فلاحی سہولیات تک باآسانی رہنمائی"}
          </h1>

          <p className="mt-3 text-base sm:text-lg leading-relaxed text-[var(--muted)]">
            {language === "en"
              ? "RAAHI guides Pakistani citizens to verified welfare benefits, healthcare aid, university scholarships, NADRA ID cards, and disaster assistance — personalized to your exact situation."
              : "احساس راشن، بے نظیر کفالت، صحت کارڈ، مفت علاج، تعلیمی وظائف، شناختی دستاویزات اور قانونی امداد کے لیے اپنی ضرورت بتائیں۔ راہی آپ کو قدم بہ قدم مکمل طریقہ دکھائے گا۔"}
          </p>

          {/* Primary CTA Buttons */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/chat"
              className="flex items-center gap-2 rounded-2xl bg-[var(--forest)] px-6 py-4 text-base font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-[var(--forest-dark)] active:scale-[0.98]"
            >
              <span>🧭</span>
              <span>
                {language === "en" ? "Start In Chat" : "اپنی ضرورت بتائیں اور رہنمائی لیں"}
              </span>
              <span>{language === "en" ? "→" : "←"}</span>
            </Link>

            <Link
              href="/programs"
              className="rounded-2xl border-2 border-[var(--line)] bg-white px-5 py-3.5 text-sm font-bold text-[var(--ink-soft)] hover:border-[var(--forest)] hover:bg-[var(--forest-light)] transition"
            >
              📋 {language === "en" ? "Browse All 85 Services" : "تمام 85 خدمات دیکھیں"}
            </Link>

            <Link
              href="/portal"
              className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] hover:bg-white transition"
            >
              🏛️ {language === "en" ? "Partner Portal" : "تنظیمی پورٹل"}
            </Link>
          </div>

          {/* ─── Statistics Bar ───────────────────────────────────── */}
          <div className="mt-8 grid grid-cols-3 gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5 text-center">
            <div>
              <p className="text-xl sm:text-2xl font-black text-[var(--forest)] font-mono">
                85+
              </p>
              <p className="text-[11px] font-semibold text-[var(--muted)]">
                {language === "en" ? "Verified Services" : "تصدیق شدہ خدمات"}
              </p>
            </div>
            <div className="border-x border-[var(--line)]">
              <p className="text-xl sm:text-2xl font-black text-[var(--forest)] font-mono">
                27
              </p>
              <p className="text-[11px] font-semibold text-[var(--muted)]">
                {language === "en" ? "Institutions" : "سرکاری و فلاحی ادارے"}
              </p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black text-[var(--forest)] font-mono">
                3
              </p>
              <p className="text-[11px] font-semibold text-[var(--muted)]">
                {language === "en" ? "Languages" : "اردو · پښتو · English"}
              </p>
            </div>
          </div>
        </section>

        {/* ─── 5 Real Citizen Demo Scenarios ─────────────────────── */}
        <section className="py-6 border-t border-[var(--line)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--forest)]">
                {language === "en" ? "1-Click Live Demos" : "شہریوں کی بنیادی ضروریات"}
              </span>
              <h2 className="text-lg sm:text-xl font-black text-[var(--ink)] mt-0.5">
                {language === "en"
                  ? "Try Pre-Configured Scenarios"
                  : "عام مسائل پر فوری کلک کر کے رہنمائی آزمائیں"}
              </h2>
            </div>
          </div>

          <div className="space-y-2.5">
            {DEMO_SCENARIOS.map((scenario) => {
              const scenarioTitle =
                language === "en"
                  ? scenario.titleEn
                  : language === "ps"
                  ? scenario.titlePs
                  : scenario.titleUr;

              const scenarioTag =
                language === "en" ? scenario.tagEn : scenario.tagUr;

              return (
                <Link
                  key={scenario.id}
                  href={`/chat?need=${encodeURIComponent(scenario.query)}`}
                  className="quick-card flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white p-3.5 shadow-xs transition hover:border-[var(--forest)] hover:bg-[#fbfdfb]"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl">
                      {scenario.icon}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--ink)] leading-snug">
                        {scenarioTitle}
                      </h3>
                      <p className="text-[11px] font-medium text-[var(--forest)] mt-0.5">
                        🏛️ {scenarioTag}
                      </p>
                    </div>
                  </div>

                  <span className="rounded-xl bg-[var(--forest-light)] px-3 py-1.5 text-xs font-bold text-[var(--forest)] shrink-0">
                    {language === "en" ? "Ask →" : "پوچھیں ←"}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ─── Explore by Domain ──────────────────────────────────── */}
        <section className="py-6 border-t border-[var(--line)]">
          <h2 className="text-lg font-black text-[var(--ink)] mb-4">
            {language === "en" ? "Explore Service Categories" : "خدمات کے شعبے"}
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {DOMAINS.map((d) => (
              <Link
                key={d.id}
                href={`/programs?domain=${d.id}`}
                className="rounded-2xl border border-[var(--line)] bg-white p-3.5 text-start transition hover:border-[var(--forest)] hover:bg-[var(--forest-light)] group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{d.icon}</span>
                  <span className="text-xs text-[var(--forest)] font-bold opacity-0 group-hover:opacity-100 transition">
                    {language === "en" ? "Browse →" : "← فہرست"}
                  </span>
                </div>
                <p className="mt-2 text-xs font-bold text-[var(--ink)]">
                  {language === "en" ? d.nameEn : d.nameUr}
                </p>
                <p className="text-[10px] text-[var(--muted)] font-medium">
                  {d.count}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* ─── Footer ─────────────────────────────────────────────── */}
      <footer className="mt-10 border-t border-[var(--line)] pt-6 pb-4 text-center text-xs text-[var(--muted)] space-y-3">
        {/* Navigation Links */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-[var(--forest)]">
          <Link href="/" className="hover:underline">
            {language === "en" ? "Home" : "ہوم"}
          </Link>
          <span>·</span>
          <Link href="/chat" className="hover:underline">
            {language === "en" ? "AI Chat" : "اے آئی چیٹ"}
          </Link>
          <span>·</span>
          <Link href="/programs" className="hover:underline">
            {language === "en" ? "All Services (85)" : "تمام خدمات (85)"}
          </Link>
          <span>·</span>
          <Link href="/cases" className="hover:underline">
            {language === "en" ? "My Cases" : "میرے کیسز"}
          </Link>
          <span>·</span>
          <Link href="/portal" className="hover:underline">
            {language === "en" ? "Partner Portal" : "تنظیمی پورٹل"}
          </Link>
          <span>·</span>
          <Link href="/emergency" className="text-rose-700 hover:underline">
            🚨 {language === "en" ? "Emergency 1122" : "ہنگامی 1122"}
          </Link>
        </div>

        <p className="font-medium text-[var(--ink-soft)]">
          {language === "en"
            ? "RAAHI — Universal Citizen Navigation Assistant for Pakistan"
            : "راہی — تصدیق شدہ سرکاری و عوامی رہنمائی کا خودمختار نظام"}
        </p>
        <p className="text-[11px] text-[var(--muted)] max-w-xl mx-auto">
          {language === "en"
            ? "Grounding all claims in verified government & NGO sources. Zero hallucinations on fees, procedures, or eligibility."
            : "تمام رہنمائی سرکاری دستاویزات سے تصدیق شدہ ہے۔ فیس اور طریقہ کار میں کسی قسم کے فرضی دعوے سے پاک۔"}
        </p>
      </footer>
    </main>
  );
}
