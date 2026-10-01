"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

import { LanguageProvider, useLanguage } from "./LanguageProvider";
import type { Language, Localized } from "@/lib/types";

export interface NavItem {
  href: string;
  icon: string;
  title: Localized;
}

/**
 * The bottom navigation, supplied by the server from the module registry so a
 * deployment only offers the modules it has switched on. The fallback keeps
 * this component usable anywhere, including outside the app group.
 */
const DEFAULT_NAV: NavItem[] = [
  { href: "/", icon: "🏠", title: { en: "Home", ur: "گھر", ps: "کور", hkp: "گھر" } },
  { href: "/more", icon: "☰", title: { en: "More", ur: "مزید", ps: "نور", hkp: "ہور" } },
];

const LANGUAGE_OPTIONS: { id: Language; short: string }[] = [
  { id: "ur", short: "اردو" },
  { id: "ps", short: "پښتو" },
  { id: "hkp", short: "ہندکو" },
  { id: "en", short: "EN" },
];

function Header() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--forest)] to-[var(--forest-dark)] text-lg font-black text-white">
            ر
          </span>
          <span>
            <span className="block text-[15px] font-black leading-none text-[var(--forest)]">
              {language === "en" ? "RAAHI" : "راہی"}
            </span>
            <span className="block text-[9.5px] font-semibold text-[var(--muted)]">
              {language === "en" ? "Citizen guide · Pakistan" : "پاکستان کا عوامی رہنما"}
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          {/*
            Keyboard shortcuts are invisible, so the palette needs a door as
            well. This opens the same search that Ctrl+K does.
          */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("raahi:open-palette"))}
            aria-label={language === "en" ? "Search everything" : "ہر چیز تلاش کریں"}
            className="flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1.5 text-[11px] font-bold text-[var(--muted)] transition hover:border-[var(--forest)] hover:text-[var(--forest)]"
          >
            <span aria-hidden="true">🔎</span>
            <span className="hidden sm:inline">{language === "en" ? "Search" : "تلاش"}</span>
          </button>
          <div className="flex overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[10.5px]">
            {LANGUAGE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setLanguage(option.id)}
                className={`px-2 py-1 font-bold transition ${
                  language === option.id ? "bg-[var(--forest)] text-white" : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {option.short}
              </button>
            ))}
          </div>
          <a
            href="tel:1122"
            className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-black text-white hover:bg-rose-700"
            title={t("navContacts")}
          >
            🚨 1122
          </a>
        </div>
      </div>
    </header>
  );
}

function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const { L } = useLanguage();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-stretch justify-between px-2">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold transition ${
                active ? "text-[var(--forest)]" : "text-[var(--muted-light)]"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{L(item.title)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function AppShell({
  children,
  nav,
}: {
  children: React.ReactNode;
  /** Supplied by the server from the module registry. */
  nav?: NavItem[];
}) {
  const { dir, language } = useLanguage();

  return (
    <div dir={dir} lang={language} className="min-h-screen bg-[var(--paper)] pb-24">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-4">{children}</main>
      <BottomNav items={nav && nav.length > 0 ? nav : DEFAULT_NAV} />
    </div>
  );
}

export function ShellWithProvider({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <AppShell>{children}</AppShell>
    </LanguageProvider>
  );
}
