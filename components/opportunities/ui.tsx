"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Language } from "@/lib/types";
import { ECOSYSTEM, appUrl } from "@/lib/opportunities/ecosystem";
import { KIND_LABELS, t } from "@/lib/opportunities/i18n";
import type { OpportunityKind } from "@/lib/opportunities/types";
import type { DirectoryItem } from "@/lib/opportunities/directory";
import { TONE_CLASS, dirOf, formatDate, type Tone } from "./format";

export function Chip({ children, tone = "none", title }: { children: ReactNode; tone?: Tone; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold leading-none ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

export const AUTHORITY_KEY = { 1: "authority1", 2: "authority2", 3: "authority3", 4: "authority4" } as const;

export function LinkStatus({ item, language }: { item: DirectoryItem; language: Language }) {
  if (item.health?.verdict === "broken") return <Chip tone="urgent" title={`HTTP ${item.health.status || "—"}`}>⚠️ {t(language, "linkBroken")}</Chip>;
  if (item.health?.verdict === "blocked") return <Chip tone="rolling">{t(language, "linkBlocked")}</Chip>;
  if (item.health?.verdict === "unreachable") return <Chip tone="none" title="No answer from our servers — several Pakistani government sites do this to overseas networks. The link itself is probably fine.">{t(language, "linkUnreachable")}</Chip>;
  const confirmed = item.health?.verdict === "ok" ? item.health.checkedAt : item.checked;
  if (confirmed) return <Chip tone="ok" title={confirmed}>✓ {t(language, "linkChecked")} · {formatDate(confirmed, language)}</Chip>;
  return <Chip tone="none">{t(language, "linkUnchecked")}</Chip>;
}

/** Inline SVG so the icon never depends on a device's symbol fonts. */
export function StarIcon({ filled, size = 18 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8L12 3.2z" />
    </svg>
  );
}

export function KindBadge({ kind, language }: { kind: OpportunityKind; language: Language }) {
  const label = KIND_LABELS[kind];
  const text = language === "en" ? label.en : language === "ur" ? label.ur : label.ps ?? label.ur;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--forest-light)] px-2.5 py-1 text-[11px] font-black text-[var(--forest-dark)]">
      <span aria-hidden>{label.emoji}</span>
      {text}
    </span>
  );
}

const LANGS: Array<{ id: Language; label: string }> = [
  { id: "ur", label: "اردو" },
  { id: "en", label: "English" },
  { id: "ps", label: "پښتو" },
];

export function LanguageSwitch({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  return (
    <div role="group" aria-label="Language" className="inline-flex rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0.5">
      {LANGS.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => onChange(entry.id)}
          aria-pressed={language === entry.id}
          className={`min-h-9 rounded-[10px] px-3 text-xs font-bold transition ${language === entry.id ? "bg-[var(--forest)] text-white" : "text-[var(--ink-soft)] hover:bg-[var(--forest-light)]"}`}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}

/** The user's own companion apps, shown with their honest one-line descriptions. */
export function EcosystemStrip({ language, medium = "opportunities" }: { language: Language; medium?: string }) {
  return (
    <section aria-labelledby="eco-title" className="mt-10">
      <h2 id="eco-title" className="text-base font-black text-[var(--ink)]">{t(language, "ecoTitle")}</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">{t(language, "ecoSub")}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {ECOSYSTEM.map((app) => (
          <a
            key={app.id}
            href={appUrl(app, "", medium)}
            target="_blank"
            rel="noopener noreferrer"
            className="card group flex flex-col gap-2 p-4 transition hover:-translate-y-0.5"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-black text-[var(--forest-dark)]">{language === "en" ? app.name : app.nameUr}</span>
              <span className="text-xs font-bold text-[var(--forest)] group-hover:underline">{t(language, "openApp")} ↗</span>
            </span>
            <span className="text-xs leading-relaxed text-[var(--ink-soft)]">{app.tagline[language]}</span>
            {app.boundary && <span className="text-[11px] text-[var(--muted)]">{app.boundary[language]}</span>}
          </a>
        ))}
      </div>
    </section>
  );
}

const NAV: Array<{ id: "opportunities" | "guides" | "resources" | "tools" | "status"; href: string; key: "navOpportunities" | "navGuides" | "navResources" | "navTools" | "navStatus" }> = [
  { id: "opportunities", href: "/opportunities", key: "navOpportunities" },
  { id: "guides", href: "/opportunities/guides", key: "navGuides" },
  { id: "resources", href: "/opportunities/resources", key: "navResources" },
  { id: "tools", href: "/opportunities/tools", key: "navTools" },
  { id: "status", href: "/opportunities/status", key: "navStatus" },
];

export function Shell({
  language,
  onLanguage,
  active,
  children,
}: {
  language: Language;
  onLanguage: (language: Language) => void;
  active: (typeof NAV)[number]["id"];
  children: ReactNode;
}) {
  return (
    <main className="app-shell flex min-h-screen flex-col px-4 py-5 sm:px-6" dir={dirOf(language)} lang={language}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
        <Link href="/" className="flex items-center gap-2.5" aria-label="RAAHI home">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--forest)] to-[var(--forest-dark)] text-xl font-black text-white shadow-md">ر</span>
          <span>
            <span className="block text-xl font-black leading-none tracking-tight text-[var(--forest)]">{language === "en" ? "RAAHI" : "راہی"}</span>
            <span className="mt-1 block text-[11px] font-medium text-[var(--muted)]">{t(language, "brandSub")}</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/chat" className="btn-secondary hidden !min-h-9 !px-3 !py-1.5 !text-xs sm:inline-flex">💬 {t(language, "navChat")}</Link>
          <LanguageSwitch language={language} onChange={onLanguage} />
        </div>
      </header>

      <nav aria-label="Opportunities sections" className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1 pb-1">
        {NAV.map((entry) => (
          <Link
            key={entry.id}
            href={entry.href}
            aria-current={active === entry.id ? "page" : undefined}
            className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-bold transition ${active === entry.id ? "bg-[var(--forest)] text-white" : "text-[var(--ink-soft)] hover:bg-[var(--forest-light)]"}`}
          >
            {t(language, entry.key)}
          </Link>
        ))}
      </nav>

      <div className="mx-auto w-full max-w-6xl flex-1 py-6">{children}</div>

      <footer className="mx-auto w-full max-w-6xl border-t border-[var(--line)] pt-5 text-center text-[11px] leading-relaxed text-[var(--muted)]">
        <p className="mx-auto max-w-2xl">{t(language, "footerNote")}</p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-3 font-bold text-[var(--forest)]">
          <Link href="/" className="hover:underline">{t(language, "navHome")}</Link>
          <span aria-hidden>·</span>
          <Link href="/programs" className="hover:underline">{language === "en" ? "Citizen services" : "شہری خدمات"}</Link>
          <span aria-hidden>·</span>
          <Link href="/chat" className="hover:underline">{t(language, "navChat")}</Link>
        </p>
      </footer>
    </main>
  );
}
