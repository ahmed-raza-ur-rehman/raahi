"use client";

import Link from "next/link";
import React from "react";

import { useLanguage } from "@/components/shell/LanguageProvider";
import { BigTile, Card, Section } from "@/components/shell/Ui";

export default function MorePage() {
  const { t, language } = useLanguage();

  return (
    <div>
      <Section
        title={language === "en" ? "Everything Raahi can do" : "راہی سب کچھ"}
        subtitle={language === "en" ? "One tap away, in your language" : "ایک ٹیپ پر، آپ کی زبان میں"}
      >
        <div className="grid grid-cols-2 gap-2.5">
          <BigTile href="/scholarships" icon="🎓" title={t("tileScholarship")} accent="forest" />
          <BigTile href="/documents" icon="📄" title={t("tileDocuments")} accent="sky" />
          <BigTile href="/tests" icon="📝" title={t("tileTests")} accent="purple" />
          <BigTile href="/dates" icon="🗓️" title={t("tileDates")} accent="amber" />
          <BigTile href="/opportunities" icon="💼" title={t("tileJobs")} accent="forest" />
          <BigTile href="/health" icon="🏥" title={t("tileHealth")} accent="rose" />
          <BigTile href="/blood" icon="🩸" title={t("tileBlood")} accent="rose" />
          <BigTile href="/disaster" icon="🚨" title={t("tileDisaster")} accent="amber" />
          <BigTile href="/legal" icon="⚖️" title={t("tileLegal")} accent="purple" />
          <BigTile href="/track" icon="📂" title={t("myApplications")} accent="sky" />
          <BigTile href="/kb" icon="🔎" title={language === "en" ? "Knowledge base" : "معلومات کا ذخیرہ"} accent="forest" />
          <BigTile href="/contacts" icon="📞" title={t("navContacts")} accent="rose" />
        </div>
      </Section>

      <Section title={language === "en" ? "Corrections and review" : "درستی اور جائزہ"}>
        <Card>
          <p className="text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
            {language === "en"
              ? "Found a wrong fee, date or number? Tell us and we will send it to review — with evidence. Raahi never changes verified content automatically."
              : "کوئی غلط فیس، تاریخ یا نمبر ملا؟ بتائیں، ہم ثبوت کے ساتھ جائزے کے لیے بھیجیں گے۔ راہی خود بخود تصدیق شدہ معلومات نہیں بدلتا۔"}
          </p>
          <div className="mt-2.5">
            <Link href="/kb" className="inline-flex items-center rounded-xl bg-[var(--forest)] px-3.5 py-2 text-[12.5px] font-black text-white">
              ✏️ {language === "en" ? "Report a mistake" : "غلظی کی اطلاع دیں"}
            </Link>
          </div>
        </Card>
      </Section>

      <Section title={language === "en" ? "Advanced tools" : "اعلیٰ سہولتیں"}>
        <div className="grid gap-2 text-[12px]">
          <Link href="/classic" className="rounded-xl border border-[var(--line)] bg-white p-3 font-bold hover:border-[var(--forest)]">
            🧭 {language === "en" ? "Classic guided navigator" : "کلاسک رہنمائی"}
          </Link>
          <Link href="/programs" className="rounded-xl border border-[var(--line)] bg-white p-3 font-bold hover:border-[var(--forest)]">
            🏛️ {language === "en" ? "Government programmes" : "سرکاری پروگرام"}
          </Link>
          <Link href="/portal" className="rounded-xl border border-[var(--line)] bg-white p-3 font-bold hover:border-[var(--forest)]">
            🗂️ {language === "en" ? "Service portal" : "سروس پورٹل"}
          </Link>
          <Link href="/chat" className="rounded-xl border border-[var(--line)] bg-white p-3 font-bold hover:border-[var(--forest)]">
            💬 {language === "en" ? "Advisor chat" : "مشیر سے بات"}
          </Link>
          <Link href="/emergency" className="rounded-xl border border-[var(--line)] bg-white p-3 font-bold hover:border-[var(--forest)]">
            🚨 {language === "en" ? "Emergency numbers" : "ایمرجنسی نمبر"}
          </Link>
        </div>
      </Section>

      <Section title={language === "en" ? "Your information" : "آپ کی معلومات"}>
        <div className="grid gap-2 text-[12px]">
          <Link
            href="/privacy"
            className="rounded-xl border border-[var(--line)] bg-white p-3 font-bold hover:border-[var(--forest)]"
          >
            🔒 {language === "en" ? "Privacy — what we keep and what we pass on" : "رازداری — ہم کیا رکھتے اور کیا آگے بھیجتے ہیں"}
          </Link>
        </div>
      </Section>

      <Card className="mt-5 bg-[var(--surface-2)]">
        <p className="text-[11.5px] leading-relaxed text-[var(--muted)]">
          {language === "en"
            ? "RAAHI is free and open source. It never charges a citizen, never sells data, and never asks for a bribe. Report anyone who does to the relevant authority."
            : "راہی مفت اور اوپن سورس ہے۔ یہ کسی شہری سے فیس نہیں لیتا، ڈیٹا نہیں بیچتا اور رشوت کا مطالبہ نہیں کرتا۔ ایسا کرنے والے کی اطلاع متعلقہ ادارے کو دیں۔"}
        </p>
      </Card>
    </div>
  );
}
