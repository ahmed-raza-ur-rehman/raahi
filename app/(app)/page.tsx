"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";

import { useLanguage } from "@/components/shell/LanguageProvider";
import { VoiceButton } from "@/components/shell/VoiceButton";
import { Badge, BigTile, CallButton, Card, Loader, Section, inputClass } from "@/components/shell/Ui";
import { useApi } from "@/lib/client/useApi";
import { EMERGENCY_NUMBERS } from "@/data/emergency";
import type { ImportantDate } from "@/lib/types";

export default function HomePage() {
  const { t, L, language } = useLanguage();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const dates = useApi<{ results: ImportantDate[] }>("/api/dates");

  const go = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/ask?q=${encodeURIComponent(trimmed)}`);
  };

  const upcoming = (dates.data?.results ?? []).slice(0, 3);

  return (
    <div className="pb-4">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="rounded-3xl bg-gradient-to-br from-[var(--forest)] to-[var(--forest-deep)] p-5 text-white shadow-lg">
        <p className="text-[12px] font-bold opacity-90">
          {language === "en" ? "Free · Verified · No middlemen" : "مفت · تصدیق شدہ · کوئی ایجنٹ نہیں"}
        </p>
        <h1 className="mt-1 text-2xl font-black leading-tight">
          {language === "en"
            ? "Tell Raahi what you need"
            : language === "ps"
            ? "راہي ته ووایاست چې څه غواړئ"
            : "راہی کو بتائیں آپ کو کیا چاہیے"}
        </h1>
        <p className="mt-1.5 text-[12.5px] leading-relaxed opacity-90">
          {language === "en"
            ? "Speak in Urdu, Pashto or Hindko. Raahi shows the verified steps, documents and phone numbers."
            : "اردو، پښتو یا ہندکو میں بولیں۔ راہی تصدیق شدہ طریقہ، دستاویزات اور رابطہ نمبر دکھائے گا۔"}
        </p>

        <div className="mt-4 flex items-center gap-4 rounded-2xl bg-white/10 p-3">
          <VoiceButton size="lg" onTranscript={go} label={t("speakNow")} />
          <p className="flex-1 text-[12px] leading-relaxed opacity-90">
            {language === "en"
              ? "Press the microphone and say what you need — a scholarship, a CNIC, blood, flood help."
              : "مائیک دبائیں اور بتائیں — سکالرشپ، شناختی کارڈ، خون، سیلابی امداد۔"}
          </p>
        </div>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            go(draft);
          }}
        >
          <input
            className={`${inputClass} flex-1 ltr-override`}
            dir={language === "en" ? "ltr" : "rtl"}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("search")}
          />
          <button
            type="submit"
            className="rounded-xl bg-white px-4 text-[13px] font-black text-[var(--forest)] hover:bg-emerald-50"
          >
            {language === "en" ? "Go" : "تلاش"}
          </button>
        </form>
      </section>

      {/* ── Emergency strip ──────────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3">
        <span className="text-[12px] font-black text-rose-700">
          {language === "en" ? "Emergency? Call now:" : "ایمرجنسی؟ ابھی کال کریں:"}
        </span>
        {EMERGENCY_NUMBERS.map((entry) => (
          <CallButton key={entry.number} number={entry.number} label={L(entry.label)} />
        ))}
      </div>

      {/* ── Service tiles ────────────────────────────────────── */}
      <Section title={language === "en" ? "What do you need today?" : "آج آپ کو کیا چاہیے؟"}>
        <div className="grid grid-cols-2 gap-2.5">
          <BigTile href="/scholarships" icon="🎓" title={t("tileScholarship")} subtitle={t("tileScholarshipSub")} accent="forest" />
          <BigTile href="/documents" icon="📄" title={t("tileDocuments")} subtitle={t("tileDocumentsSub")} accent="sky" />
          <BigTile href="/tests" icon="📝" title={t("tileTests")} subtitle={t("tileTestsSub")} accent="purple" />
          <BigTile href="/dates" icon="🗓️" title={t("tileDates")} subtitle={t("tileDatesSub")} accent="amber" />
          <BigTile href="/opportunities" icon="💼" title={t("tileJobs")} subtitle={t("tileJobsSub")} accent="forest" />
          <BigTile href="/health" icon="🏥" title={t("tileHealth")} subtitle={t("tileHealthSub")} accent="rose" />
          <BigTile href="/blood" icon="🩸" title={t("tileBlood")} subtitle={t("tileBloodSub")} accent="rose" />
          <BigTile href="/disaster" icon="🚨" title={t("tileDisaster")} subtitle={t("tileDisasterSub")} accent="amber" />
          <BigTile href="/legal" icon="⚖️" title={t("tileLegal")} subtitle={t("tileLegalSub")} accent="purple" />
          <BigTile href="/track" icon="📂" title={t("myApplications")} subtitle={t("progress")} accent="sky" />
        </div>
      </Section>

      {/* ── Upcoming dates ───────────────────────────────────── */}
      <Section
        title={t("tileDates")}
        subtitle={language === "en" ? "Confirm every date on the official source" : "ہر تاریخ کی تصدیق سرکاری ذریعے سے کریں"}
        action={
          <button type="button" onClick={dates.reload} className="text-[11px] font-bold text-[var(--forest)]">
            {language === "en" ? "Refresh" : "تازہ کریں"}
          </button>
        }
      >
        {dates.loading ? (
          <Loader />
        ) : upcoming.length === 0 ? (
          <Card className="text-[12.5px] text-[var(--muted)]">{t("noResults")}</Card>
        ) : (
          <div className="space-y-2">
            {upcoming.map((date) => (
              <Card key={date.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13.5px] font-bold">{L(date.title)}</p>
                    <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">
                      {date.kind === "rolling"
                        ? language === "en"
                          ? "Open all year"
                          : "سال بھر کھلا"
                        : date.kind === "recurring"
                        ? language === "en"
                          ? "Repeats every year"
                          : "ہر سال دہرایا جاتا ہے"
                        : date.date}
                    </p>
                  </div>
                  <Badge tone={date.category === "test" ? "info" : date.category === "job" ? "success" : "warn"}>
                    {date.category}
                  </Badge>
                </div>
                {date.note ? <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--muted)]">{L(date.note)}</p> : null}
              </Card>
            ))}
          </div>
        )}
      </Section>

      <p className="mt-6 text-center text-[10.5px] leading-relaxed text-[var(--muted-light)]">
        {t("confirmWithSource")}
      </p>
    </div>
  );
}
