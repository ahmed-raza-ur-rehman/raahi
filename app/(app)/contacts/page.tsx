"use client";

import React, { useState } from "react";

import { useLanguage } from "@/components/shell/LanguageProvider";
import { Badge, CallButton, Card, Empty, Loader, Section, inputClass } from "@/components/shell/Ui";
import { useApi } from "@/lib/client/useApi";
import type { ContactRecord } from "@/lib/types";

export default function ContactsPage() {
  const { t, L, language } = useLanguage();
  const [query, setQuery] = useState("");
  const state = useApi<{ results: ContactRecord[]; emergency: { number: string; label: unknown; what: unknown }[] }>("/api/contacts");

  const results = (state.data?.results ?? []).filter((contact) => {
    if (!query.trim()) return true;
    return [L(contact.name), contact.authority, L(contact.purpose), contact.numbers.join(" ")]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  });

  return (
    <div>
      <div className="rounded-3xl bg-rose-600 p-4 text-white shadow-lg">
        <p className="text-[13px] font-black">{language === "en" ? "Emergency — tap to call" : "ایمرجنسی — کال کے لیے ٹیپ کریں"}</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {(state.data?.emergency ?? []).map((entry) => (
            <a key={entry.number} href={`tel:${entry.number}`} className="rounded-xl bg-white px-4 py-2.5 shadow">
              <span className="block text-[15px] font-black text-rose-700" dir="ltr">
                {entry.number}
              </span>
              <span className="block text-[10px] font-bold text-rose-600">{L(entry.label as never)}</span>
            </a>
          ))}
        </div>
      </div>

      <Section
        title={language === "en" ? "Direct numbers of responsible offices" : "ذمہ دار دفاتر کے براہِ راست نمبر"}
        subtitle={language === "en" ? "Numbers can change — confirm on the official source" : "نمبر بدل سکتے ہیں — سرکاری ذریعے سے تصدیق کریں"}
      >
        <input
          className={inputClass}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={language === "en" ? "Search: NADRA, BISP, helpline…" : "تلاش کریں: نادرا، بینظیر، ہیلپ لائن"}
          aria-label={t("search")}
        />
      </Section>

      {state.loading ? (
        <Loader />
      ) : results.length === 0 ? (
        <Empty>{t("noResults")}</Empty>
      ) : (
        <div className="space-y-2.5">
          {results.map((contact) => (
            <Card key={contact.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-extrabold leading-tight">{L(contact.name)}</p>
                  <p className="text-[11.5px] text-[var(--muted)]">{contact.authority}</p>
                </div>
                <Badge tone={contact.tier <= 2 ? "success" : "neutral"}>T{contact.tier}</Badge>
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--ink-soft)]">{L(contact.purpose)}</p>

              <div className="mt-2.5 flex flex-wrap gap-2">
                {contact.numbers.map((number) => (
                  <CallButton key={number} number={number} />
                ))}
                {contact.sms ? (
                  <a
                    href={`sms:${contact.sms}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-[12px] font-black text-white"
                  >
                    ✉️ SMS <span dir="ltr">{contact.sms}</span>
                  </a>
                ) : null}
                {contact.url ? (
                  <a
                    href={contact.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-xl border border-[var(--line)] px-3 py-2 text-[12px] font-bold text-[var(--muted)]"
                  >
                    {language === "en" ? "Official site" : "سرکاری سائٹ"} ↗
                  </a>
                ) : null}
              </div>

              {contact.note ? <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--muted)]">{L(contact.note)}</p> : null}
              <p className="mt-1 text-[10px] text-[var(--muted-light)]">
                {contact.hours} · {language === "en" ? "Coverage" : "علاقہ"}: {contact.coverage.join(", ")}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
