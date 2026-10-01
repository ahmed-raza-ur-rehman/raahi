"use client";

import Link from "next/link";
import React from "react";

import { useLanguage } from "@/components/shell/LanguageProvider";
import { BigTile, Card, Section } from "@/components/shell/Ui";
import { ModuleLink } from "@/components/shell/ModuleLink";
import { useModules, type ClientModule } from "@/components/shell/ModulesProvider";
import { ALL_MODULE_COUNT } from "@/lib/modules/registry";
import { APP_NAME, APP_VERSION, BUILD_COMMIT_SHORT } from "@/lib/version";

/** Tile colour by module group, so related things look related. */
const ACCENTS: Record<string, "forest" | "sky" | "purple" | "amber" | "rose"> = {
  start: "forest",
  learn: "forest",
  life: "sky",
  emergency: "rose",
  manage: "purple",
};

/** The home screen does not appear in the grid; you are already there. */
const HIDDEN = new Set(["ask"]);

export default function MorePage() {
  const { language, L } = useLanguage();
  const { modules, ready } = useModules();
  const tiles: ClientModule[] = modules.filter((module) => !HIDDEN.has(module.id));
  const canCorrect = modules.some((module) => module.id === "kb");

  return (
    <div>
      <Section
        title={language === "en" ? "Everything Raahi can do" : "راہی سب کچھ"}
        subtitle={language === "en" ? "One tap away, in your language" : "ایک ٹیپ پر، آپ کی زبان میں"}
      >
        {/*
          Built from the module registry rather than a hard-coded grid, so this
          screen always matches what this deployment actually runs. A module
          that is switched off is not offered here — showing someone a screen
          that then refuses to work is worse than not showing it.
        */}
        <div className="grid grid-cols-2 gap-2.5">
          {tiles.length === 0 && !ready
            ? Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="h-[74px] animate-pulse rounded-2xl bg-[var(--surface-2)]" />
              ))
            : null}
          {tiles.map((module) => (
            <BigTile
              key={module.id}
              href={module.href}
              icon={module.icon}
              title={L(module.title)}
              accent={ACCENTS[module.group] ?? "forest"}
            />
          ))}
        </div>
      </Section>

      {canCorrect ? (
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
      ) : null}

      <Section title={language === "en" ? "Advanced tools" : "اعلیٰ سہولتیں"}>
        <div className="grid gap-2 text-[12px]">
          <ModuleLink id="classic" href="/classic" className="rounded-xl border border-[var(--line)] bg-white p-3 font-bold hover:border-[var(--forest)]">
            🧭 {language === "en" ? "Classic guided navigator" : "کلاسک رہنمائی"}
          </ModuleLink>
          <ModuleLink id="programs" href="/programs" className="rounded-xl border border-[var(--line)] bg-white p-3 font-bold hover:border-[var(--forest)]">
            🏛️ {language === "en" ? "Government programmes" : "سرکاری پروگرام"}
          </ModuleLink>
          <ModuleLink id="portal" href="/portal" className="rounded-xl border border-[var(--line)] bg-white p-3 font-bold hover:border-[var(--forest)]">
            🗂️ {language === "en" ? "Service portal" : "سروس پورٹل"}
          </ModuleLink>
          <ModuleLink id="chat" href="/chat" className="rounded-xl border border-[var(--line)] bg-white p-3 font-bold hover:border-[var(--forest)]">
            💬 {language === "en" ? "Advisor chat" : "مشیر سے بات"}
          </ModuleLink>
          <ModuleLink id="emergency" href="/emergency" className="rounded-xl border border-[var(--line)] bg-white p-3 font-bold hover:border-[var(--forest)]">
            🚨 {language === "en" ? "Emergency numbers" : "ایمرجنسی نمبر"}
          </ModuleLink>
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
        {/*
          An operator debugging a report from the field needs to know which
          build they are looking at, and what it has switched on.
        */}
        <p className="mt-2 text-[10.5px] font-semibold text-[var(--muted)]">
          {APP_NAME} {APP_VERSION}
          {BUILD_COMMIT_SHORT ? ` · ${BUILD_COMMIT_SHORT}` : ""} ·{" "}
          {language === "en"
            ? `${modules.length} of ${ALL_MODULE_COUNT} capabilities on`
            : `${ALL_MODULE_COUNT} میں سے ${modules.length} سہولتیں فعال`}
        </p>
      </Card>
    </div>
  );
}
