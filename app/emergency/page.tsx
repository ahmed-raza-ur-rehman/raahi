"use client";

import React, { useState } from "react";
import Link from "next/link";
import { EmergencyBanner } from "@/components/common/EmergencyBanner";

export default function EmergencyPage() {
  const [language, setLanguage] = useState<"en" | "ur" | "ps">("ur");

  return (
    <main
      className="app-shell min-h-screen px-4 sm:px-6 py-5 flex flex-col justify-between"
      dir={language === "en" ? "ltr" : "rtl"}
    >
      <div>
        <header className="flex items-center justify-between border-b border-[var(--line)] pb-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-lg font-black text-white">
              🚨
            </span>
            <span className="text-xl font-black text-red-700">
              {language === "en" ? "Emergency Center" : "ہنگامی امدادی مرکز"}
            </span>
          </Link>

          <div className="flex gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-0.5 text-xs">
            {(["ur", "ps", "en"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`rounded px-2.5 py-0.5 font-bold transition ${
                  language === lang
                    ? "bg-red-700 text-white shadow-xs"
                    : "text-[var(--muted)]"
                }`}
              >
                {lang === "ur" ? "اردو" : lang === "ps" ? "پښتو" : "EN"}
              </button>
            ))}
          </div>
        </header>

        {/* Banner with all contacts */}
        <section className="py-6">
          <EmergencyBanner language={language} />

          {/* Quick advice */}
          <div className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
              <span>ℹ️</span>
              <span>
                {language === "en"
                  ? "When to Contact Emergency Helplines"
                  : "ایمرجنسی سروسز کب کال کریں؟"}
              </span>
            </h2>

            <ul className="space-y-2 text-xs leading-relaxed text-[var(--muted)] ps-4 list-disc">
              <li>
                {language === "en"
                  ? "Chest pain, breathing difficulties, unconsciousness, severe bleeding: Call Rescue 1122 or Edhi 115."
                  : "سینے میں درد، سانس لینے میں شدید دشواری، بے ہوشی یا جان لیوا خون بہنا: فوری طور پر 1122 یا 115 پر کال کریں۔"}
              </li>
              <li>
                {language === "en"
                  ? "Fire, building collapse, major traffic accident: Call Rescue 1122 immediately."
                  : "آگ لگنے، عمارت گرنے یا سڑک حادثے کی صورت میں ریسکیو 1122 پر اطلاع دیں۔"}
              </li>
              <li>
                {language === "en"
                  ? "Robbery, violent threat, domestic harassment: Call Police 15 or Sindh CPLC 1102."
                  : "ڈکیتی، جسمانی تشدد یا ہراسانی کی صورت میں پولیس 15 پر رابطہ کریں۔"}
              </li>
            </ul>
          </div>
        </section>
      </div>

      <footer className="border-t border-[var(--line)] pt-4 pb-2 text-center">
        <Link
          href="/chat"
          className="rounded-xl bg-[var(--forest)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--forest-dark)] inline-block"
        >
          🧭 {language === "en" ? "Return to RAAHI Chat" : "راہی چیٹ پر واپس جائیں"}
        </Link>
      </footer>
    </main>
  );
}