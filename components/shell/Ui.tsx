"use client";

import Link from "next/link";
import React from "react";

import { useLanguage } from "./LanguageProvider";
import type { Citation, Localized, SourceRef } from "@/lib/types";

/* ────────────────────────────────────────────────────────────────
 * Design language: huge touch targets, one idea per card, emoji
 * first, words second. Built for a first-time smartphone user.
 * ──────────────────────────────────────────────────────────────── */

export function Section({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-[var(--ink)]">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function BigTile({
  href,
  icon,
  title,
  subtitle,
  accent = "forest",
  onClick,
}: {
  href?: string;
  icon: string;
  title: string;
  subtitle?: string;
  accent?: "forest" | "sky" | "amber" | "rose" | "purple";
  onClick?: () => void;
}) {
  const accents: Record<string, string> = {
    forest: "from-emerald-50 to-white border-emerald-200 hover:border-emerald-400",
    sky: "from-sky-50 to-white border-sky-200 hover:border-sky-400",
    amber: "from-amber-50 to-white border-amber-200 hover:border-amber-400",
    rose: "from-rose-50 to-white border-rose-200 hover:border-rose-400",
    purple: "from-violet-50 to-white border-violet-200 hover:border-violet-400",
  };

  const body = (
    <div className="flex h-full items-start gap-3 text-start">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm ring-1 ring-black/5">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-extrabold leading-tight text-[var(--ink)]">{title}</span>
        {subtitle ? <span className="mt-1 block text-[11.5px] leading-snug text-[var(--muted)]">{subtitle}</span> : null}
      </span>
      <span aria-hidden className="mt-2 text-[var(--muted-light)]">›</span>
    </div>
  );

  const className = `block h-full rounded-2xl border bg-gradient-to-br p-3.5 shadow-sm transition active:scale-[0.99] ${accents[accent]}`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`${className} w-full`}>
      {body}
    </button>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm ${className}`}>{children}</div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warn" | "danger" | "info";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--line)]",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    info: "bg-sky-50 text-sky-700 border-sky-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  href,
  variant = "primary",
  size = "md",
  disabled,
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const variants: Record<string, string> = {
    primary: "bg-[var(--forest)] text-white hover:bg-[var(--forest-dark)] shadow-sm",
    secondary: "bg-white text-[var(--ink-soft)] border border-[var(--line)] hover:border-[var(--forest)]",
    ghost: "bg-transparent text-[var(--muted)] hover:text-[var(--ink)]",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  };
  const sizes: Record<string, string> = {
    sm: "px-3 py-2 text-[12px]",
    md: "px-4 py-2.5 text-[13px]",
    lg: "px-5 py-4 text-[15px]",
  };
  const classes = `inline-flex items-center justify-center gap-2 rounded-xl font-bold transition active:scale-[0.98] disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}

export function SourceChip({ source }: { source: SourceRef | Citation }) {
  const { t } = useLanguage();
  const url = "url" in source ? source.url : source.sourceUrl;
  const title = "title" in source ? source.title : source.sourceTitle;
  const tier = "tier" in source ? source.tier : source.authorityTier;
  const verified = "lastVerified" in source ? source.lastVerified : "";

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1 text-[10.5px] font-semibold text-[var(--muted)] hover:text-[var(--forest)]"
    >
      <span className={`tier-${Math.min(3, Math.max(1, tier))} rounded px-1.5 py-0.5`}>T{tier}</span>
      <span className="truncate">{title}</span>
      <span className="text-[var(--muted-light)]">· {verified}</span>
      <span aria-hidden>↗</span>
      <span className="sr-only">{t("source")}</span>
    </a>
  );
}

export function StepList({
  steps,
  numbered = true,
}: {
  steps: { title: Localized | string; detail?: Localized | string }[];
  numbered?: boolean;
}) {
  const { L } = useLanguage();
  return (
    <ol className="space-y-2.5">
      {steps.map((item, index) => (
        <li key={index} className="flex gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--forest)] text-[12px] font-black text-white">
            {numbered ? index + 1 : "•"}
          </span>
          <span className="min-w-0">
            <span className="block text-[13.5px] font-bold leading-snug text-[var(--ink)]">{L(item.title)}</span>
            {item.detail ? <span className="mt-1 block text-[12px] leading-relaxed text-[var(--muted)]">{L(item.detail)}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function BulletList({ items, tone = "neutral" }: { items: (Localized | string)[]; tone?: "neutral" | "check" | "alert" }) {
  const { L } = useLanguage();
  const icon = tone === "check" ? "✅" : tone === "alert" ? "⚠️" : "•";
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
          <span aria-hidden className="mt-0.5 shrink-0">{icon}</span>
          <span>{L(item)}</span>
        </li>
      ))}
    </ul>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-2)] p-6 text-center text-[13px] text-[var(--muted)]">
      {children}
    </div>
  );
}

export function Loader({ label }: { label?: string }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-[var(--muted)]">
      <span className="h-3 w-3 animate-ping rounded-full bg-[var(--forest)]" />
      {label ?? t("loading")}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold text-[var(--ink-soft)]">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-[var(--muted)]">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--forest)]";

export function CallButton({ number, label }: { number: string; label?: string }) {
  return (
    <a
      href={`tel:${number.replace(/[^\d+]/g, "")}`}
      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[12.5px] font-black text-white shadow-sm hover:bg-emerald-700"
    >
      📞 <span dir="ltr">{number}</span>
      {label ? <span className="font-semibold opacity-90">· {label}</span> : null}
    </a>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--line-soft)]">
      <div
        className="h-full rounded-full bg-[var(--forest)] transition-all"
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

export function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={String(option.id)}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-full border px-3 py-1.5 text-[12px] font-bold transition ${
            value === option.id
              ? "border-[var(--forest)] bg-[var(--forest)] text-white"
              : "border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--forest)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
