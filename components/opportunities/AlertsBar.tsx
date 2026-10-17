"use client";

import { useState } from "react";
import type { Language } from "@/lib/types";
import { t, type StringKey } from "@/lib/opportunities/i18n";
import { MAX_SAVED_SEARCHES, useNewCounts, useSavedSearches } from "./useSavedSearches";

interface Props {
  language: Language;
  /** The current search as a URL query string (may include `limit`). */
  query: string;
  /** True when no filter or search text is set — there is nothing worth saving. */
  isDefault: boolean;
  suggestedName: string;
  onApply: (query: string) => void;
}

const FEEDS: Array<{ key: StringKey; path: string; extra: string }> = [
  { key: "alertsRss", path: "/api/opportunities/feed", extra: "" },
  { key: "alertsAtom", path: "/api/opportunities/feed", extra: "format=atom" },
  { key: "alertsJson", path: "/api/opportunities/feed", extra: "format=json" },
  { key: "alertsCalendar", path: "/api/opportunities/calendar", extra: "" },
];

function withoutLimit(query: string): URLSearchParams {
  const params = new URLSearchParams(query);
  params.delete("limit");
  return params;
}

/**
 * "Alerts & feeds": follow the current search in a feed reader or calendar, and keep a few searches in this browser
 * with a count of what is new since each was last opened. No account, no email, nothing stored on a server.
 */
export function AlertsBar({ language, query, isDefault, suggestedName, onApply }: Props) {
  const { searches, save, remove, markSeen } = useSavedSearches();
  const counts = useNewCounts(searches);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [full, setFull] = useState(false);

  const shared = withoutLimit(query);
  const link = (path: string, extra: string) => {
    const params = new URLSearchParams(shared);
    if (extra) for (const [key, value] of new URLSearchParams(extra)) params.set(key, value);
    const text = params.toString();
    return `${path}${text ? `?${text}` : ""}`;
  };

  const copy = async (label: string, relative: string) => {
    const absolute = `${window.location.origin}${relative}`;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(label);
      setTimeout(() => setCopied((current) => (current === label ? null : current)), 2000);
    } catch {
      window.prompt(t(language, "alertsCopy"), absolute);
    }
  };

  const totalNew = searches.reduce((sum, entry) => sum + (counts[entry.id] ?? 0), 0);
  const apply = (id: string, savedQuery: string) => {
    markSeen(id);
    onApply(savedQuery);
  };

  return (
    <section className="mt-3" aria-label={t(language, "alertsTitle")}>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${open ? "border-[var(--forest)] bg-[var(--forest)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--forest)]"}`}
        >
          <span aria-hidden>🔔</span> {t(language, "alertsTitle")}
          {totalNew > 0 && <span className="rounded-full bg-[var(--amber)] px-1.5 py-0.5 text-[10px] font-black leading-none text-white">{totalNew} {t(language, "alertsNew")}</span>}
        </button>
        {searches.map((entry) => {
          const fresh = counts[entry.id] ?? 0;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => apply(entry.id, entry.query)}
              className="inline-flex min-h-9 max-w-[16rem] items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--ink-soft)] transition hover:border-[var(--forest)] hover:text-[var(--forest)]"
              title={entry.name}
            >
              <span className="truncate" dir="auto">{entry.name}</span>
              {fresh > 0 && <span className="shrink-0 rounded-full bg-[var(--amber-bg)] px-1.5 py-0.5 text-[10px] font-black leading-none text-[var(--amber)]">+{fresh}</span>}
            </button>
          );
        })}
      </div>

      {open && (
        <div className="card mt-3 grid gap-5 p-4 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-black text-[var(--ink)]">{t(language, "alertsFollow")}</h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{t(language, "alertsFollowHelp")}</p>
            <ul className="mt-3 space-y-2">
              {FEEDS.map((feed) => {
                const relative = link(feed.path, feed.extra);
                return (
                  <li key={feed.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2">
                    <a href={relative} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[var(--forest-dark)] hover:underline">{t(language, feed.key)} ↗</a>
                    <button type="button" onClick={() => copy(feed.key, relative)} className="!text-xs !font-bold text-[var(--forest)] hover:underline">{copied === feed.key ? t(language, "alertsCopied") : t(language, "alertsCopy")}</button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-black text-[var(--ink)]">{t(language, "alertsSaveTitle")}</h3>
            {isDefault ? (
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{t(language, "alertsPickFilters")}</p>
            ) : (
              <form
                className="mt-2 flex flex-wrap gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const saved = save((name || suggestedName).slice(0, 60), withoutLimit(query).toString());
                  setFull(!saved);
                  if (saved) setName("");
                }}
              >
                <label className="sr-only" htmlFor="alert-name">{t(language, "alertsName")}</label>
                <input id="alert-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={suggestedName || t(language, "alertsName")} maxLength={60} className="input-field !min-h-9 !w-auto min-w-0 flex-1 !py-1.5 !text-xs" dir="auto" autoComplete="off" />
                <button type="submit" className="btn-primary !min-h-9 !px-3 !py-1.5 !text-xs">{t(language, "alertsSave")}</button>
              </form>
            )}
            {full && <p role="alert" className="mt-2 text-xs font-bold text-[var(--danger)]">{t(language, "alertsFull")}</p>}
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">{t(language, "alertsSavedNote")} ({searches.length}/{MAX_SAVED_SEARCHES})</p>

            {searches.length === 0 ? (
              <p className="mt-3 text-xs text-[var(--muted)]">{t(language, "alertsNone")}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {searches.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2">
                    <span className="min-w-0 truncate text-xs font-bold text-[var(--ink)]" dir="auto">
                      {entry.name}
                      {(counts[entry.id] ?? 0) > 0 && <span className="ms-1.5 text-[var(--amber)]">+{counts[entry.id]} {t(language, "alertsNew")}</span>}
                    </span>
                    <span className="flex shrink-0 gap-3 text-xs font-bold">
                      <button type="button" onClick={() => apply(entry.id, entry.query)} className="text-[var(--forest)] hover:underline">{t(language, "alertsOpen")}</button>
                      <button type="button" onClick={() => remove(entry.id)} className="text-[var(--danger)] hover:underline">{t(language, "alertsRemove")}</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
