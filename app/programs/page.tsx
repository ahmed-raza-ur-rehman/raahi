"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import type { Domain, ServiceRecord } from "@/lib/types";

const DOMAINS: Array<{ id: Domain | "all"; labelEn: string; labelUr: string; icon: string }> = [
  { id: "all", labelEn: "All Services (85)", labelUr: "تمام خدمات (85)", icon: "🌐" },
  { id: "welfare", labelEn: "Social Welfare", labelUr: "سماجی بہبود", icon: "💰" },
  { id: "health", labelEn: "Healthcare", labelUr: "صحت و علاج", icon: "🏥" },
  { id: "education", labelEn: "Education", labelUr: "تعلیم و وظائف", icon: "🎓" },
  { id: "documentation", labelEn: "Identity & NADRA", labelUr: "شناختی دستاویزات", icon: "📄" },
  { id: "legal", labelEn: "Legal Aid", labelUr: "قانونی مدد", icon: "⚖️" },
  { id: "employment", labelEn: "Skills & Jobs", labelUr: "ہنر و روزگار", icon: "💼" },
  { id: "disaster", labelEn: "Emergency Relief", labelUr: "ہنگامی امداد", icon: "🚨" },
];

const PROVINCES = [
  { id: "all", labelEn: "All Regions", labelUr: "تمام علاقے" },
  { id: "Punjab", labelEn: "Punjab", labelUr: "پنجاب" },
  { id: "Khyber Pakhtunkhwa", labelEn: "KP", labelUr: "خیبر پختونخوا" },
  { id: "Sindh", labelEn: "Sindh", labelUr: "سندھ" },
  { id: "Balochistan", labelEn: "Balochistan", labelUr: "بلوچستان" },
];

export default function ProgramsCatalogPage() {
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<"en" | "ur">("ur");
  const [selectedDomain, setSelectedDomain] = useState<Domain | "all">("all");
  const [selectedProvince, setSelectedProvince] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    let url = "/api/programs?";
    if (selectedDomain !== "all") url += `domain=${selectedDomain}&`;
    if (selectedProvince !== "all") url += `province=${encodeURIComponent(selectedProvince)}&`;
    if (searchQuery.trim()) url += `q=${encodeURIComponent(searchQuery.trim())}&`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setServices(data.results || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedDomain, selectedProvince, searchQuery]);

  return (
    <main
      className="app-shell min-h-screen px-4 sm:px-6 py-5 flex flex-col justify-between"
      dir={language === "en" ? "ltr" : "rtl"}
    >
      <div>
        {/* Navigation Bar */}
        <header className="flex items-center justify-between border-b border-[var(--line)] pb-4">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--forest)] text-base font-black text-white shadow-xs"
            >
              ر
            </Link>
            <div>
              <h1 className="text-sm font-black text-[var(--ink)]">
                {language === "en" ? "Service Catalog & Programs" : "پاکستان سروس کیٹلاگ"}
              </h1>
              <p className="text-[10px] text-[var(--muted)]">
                {language === "en" ? "85+ Research-Verified Official & NGO Services" : "85 سے زائد تصدیق شدہ سرکاری و فلاحی خدمات"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/chat"
              className="rounded-xl bg-[var(--forest)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--forest-dark)] transition"
            >
              💬 {language === "en" ? "AI Chat" : "اے آئی چیٹ"}
            </Link>

            <button
              type="button"
              onClick={() => setLanguage(language === "en" ? "ur" : "en")}
              className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-xs font-bold text-[var(--forest)]"
            >
              {language === "en" ? "اردو" : "English"}
            </button>
          </div>
        </header>

        {/* Search & Filters */}
        <section className="py-6">
          <div className="flex flex-col gap-4">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  language === "en"
                    ? "Search 85 services by name, CNIC, dialysis, scholarship, relief..."
                    : "سروس تلاش کریں (مثلاً: شناختی کارڈ، ڈائیلاسز، احساس راشن، وظیفہ)..."
                }
                className="w-full rounded-2xl border-2 border-[var(--line)] bg-white px-4 py-3.5 text-sm font-medium text-[var(--ink)] shadow-xs focus:border-[var(--forest)] focus:outline-hidden transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute end-4 top-3.5 text-xs text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Domain Filter Chips */}
            <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
              {DOMAINS.map((dom) => (
                <button
                  key={dom.id}
                  type="button"
                  onClick={() => setSelectedDomain(dom.id)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    selectedDomain === dom.id
                      ? "bg-[var(--forest)] text-white shadow-xs"
                      : "border border-[var(--line)] bg-white text-[var(--muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  <span>{dom.icon}</span>
                  <span>{language === "en" ? dom.labelEn : dom.labelUr}</span>
                </button>
              ))}
            </div>

            {/* Province Filters */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-[var(--muted)]">
                {language === "en" ? "Region:" : "علاقہ:"}
              </span>
              <div className="flex flex-wrap gap-1">
                {PROVINCES.map((prov) => (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => setSelectedProvince(prov.id)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                      selectedProvince === prov.id
                        ? "bg-emerald-100 text-emerald-800 font-bold"
                        : "text-[var(--muted)] hover:bg-slate-100"
                    }`}
                  >
                    {language === "en" ? prov.labelEn : prov.labelUr}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── Services Grid ─────────────────────────────────────────── */}
        <section className="mb-12">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="skeleton h-44 rounded-2xl w-full" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-2)] p-12 text-center">
              <span className="text-3xl">🔍</span>
              <h3 className="mt-3 text-base font-black text-[var(--ink)]">
                {language === "en" ? "No matching services found" : "کوئی مطابقت رکھنے والی سروس نہیں ملی"}
              </h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {language === "en"
                  ? "Try searching for a broader term or select 'All Services'."
                  : "مختلف الفاظ تلاش کریں یا دیگر شعبہ جات منتخب کریں۔"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedDomain("all");
                  setSelectedProvince("all");
                  setSearchQuery("");
                }}
                className="mt-4 rounded-xl bg-[var(--forest)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--forest-dark)]"
              >
                {language === "en" ? "Reset Filters" : "فلٹرز ری سیٹ کریں"}
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="flex flex-col justify-between rounded-2xl border border-[var(--line)] bg-white p-5 shadow-xs transition hover:border-[var(--forest)] hover:shadow-md"
                >
                  <div>
                    {/* Top Row Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-md bg-[var(--forest-light)] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[var(--forest)]">
                        {service.domain}
                      </span>

                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                        {service.applicationMethod.toUpperCase()}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="mt-3 text-base font-black text-[var(--ink)]">
                      {language === "en" ? service.name : service.nameUr}
                    </h3>

                    {/* Description */}
                    <p className="mt-2 text-xs leading-relaxed text-[var(--muted)] line-clamp-3">
                      {language === "en" ? service.description : service.descriptionUr}
                    </p>

                    {/* Required Documents Pill Preview */}
                    {service.requiredDocuments && service.requiredDocuments.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {service.requiredDocuments.slice(0, 3).map((d, i) => (
                          <span
                            key={i}
                            className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)]"
                          >
                            📄 {language === "en" ? d.label : d.labelUr}
                          </span>
                        ))}
                        {service.requiredDocuments.length > 3 && (
                          <span className="text-[10px] font-bold text-[var(--muted)]">
                            +{service.requiredDocuments.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Bottom Bar */}
                  <div className="mt-5 border-t border-[var(--line-soft)] pt-3 flex items-center justify-between gap-2">
                    <Link
                      href={`/procedure/${service.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[var(--forest)] hover:underline"
                    >
                      <span>📋 {language === "en" ? "Procedure Guide" : "طریقہ کار"}</span>
                      <span>{language === "en" ? "→" : "←"}</span>
                    </Link>

                    <Link
                      href={`/chat?need=${encodeURIComponent(language === "en" ? service.name : service.nameUr)}`}
                      className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-bold text-[var(--ink)] hover:bg-[var(--forest)] hover:text-white transition"
                    >
                      💬 {language === "en" ? "Ask RAAHI" : "رہنمائی لیں"}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer className="mt-8 border-t border-[var(--line)] pt-4 text-center text-xs text-[var(--muted)]">
        <p>RAAHI Knowledge Engine · Verified across 27 institutions in 7 domains</p>
      </footer>
    </main>
  );
}
