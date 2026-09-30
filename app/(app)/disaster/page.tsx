"use client";

import React, { useMemo, useState } from "react";

import { useLanguage } from "@/components/shell/LanguageProvider";
import { Badge, Button, CallButton, Card, Field, Loader, Section, StepList, inputClass } from "@/components/shell/Ui";
import { apiPost, useApi } from "@/lib/client/useApi";
import { HAZARDS } from "@/data/disaster";
import type { DisasterChannel, DisasterGuide } from "@/lib/types";

interface DisasterPayload {
  channels: DisasterChannel[];
  guides: DisasterGuide[];
  hazards: { id: string; label: unknown }[];
  needs: { id: string; label: unknown }[];
}

export default function DisasterPage() {
  const { t, L, language } = useLanguage();
  const [hazard, setHazard] = useState("flood");
  const state = useApi<DisasterPayload>(`/api/disaster?hazard=${hazard}`);

  const guides = state.data?.guides ?? [];
  const ordered = useMemo(() => {
    const rank = { before: 0, during: 1, after: 2 };
    return [...guides].sort((a, b) => rank[a.phase] - rank[b.phase]);
  }, [guides]);

  return (
    <div>
      {/* Emergency first, always */}
      <div className="rounded-3xl bg-rose-600 p-4 text-white shadow-lg">
        <p className="text-[13px] font-black">
          {language === "en" ? "If someone is trapped or injured, call now" : "اگر کوئی پھنسا یا زخمی ہے تو ابھی کال کریں"}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <a href="tel:1122" className="rounded-xl bg-white px-4 py-2.5 text-[15px] font-black text-rose-700 shadow">
            📞 1122
          </a>
          <a href="tel:115" className="rounded-xl bg-white/20 px-4 py-2.5 text-[15px] font-black text-white ring-1 ring-white/40">
            📞 115
          </a>
          <a href="tel:15" className="rounded-xl bg-white/20 px-4 py-2.5 text-[15px] font-black text-white ring-1 ring-white/40">
            📞 15
          </a>
        </div>
      </div>

      <Section title={language === "en" ? "Choose the situation" : "صورتحال منتخب کریں"}>
        <div className="flex flex-wrap gap-1.5">
          {HAZARDS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setHazard(item.id)}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-bold ${
                hazard === item.id
                  ? "border-[var(--forest)] bg-[var(--forest)] text-white"
                  : "border-[var(--line)] bg-white text-[var(--muted)]"
              }`}
            >
              {L(item.label as never)}
            </button>
          ))}
        </div>
      </Section>

      {state.loading ? (
        <Loader />
      ) : (
        <div className="space-y-3">
          {ordered.map((guide) => (
            <Card key={guide.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13.5px] font-extrabold">{L(guide.title)}</p>
                <Badge tone={guide.phase === "during" ? "danger" : guide.phase === "before" ? "success" : "warn"}>{guide.phase}</Badge>
              </div>
              <div className="mt-2.5">
                <StepList
                  steps={guide.steps.map((step) => ({
                    title: { en: step.title, ur: step.titleUr },
                    detail: { en: step.description, ur: step.descriptionUr },
                  }))}
                />
              </div>
              {guide.kit.length > 0 ? (
                <div className="mt-3 rounded-xl bg-[var(--surface-2)] p-2.5">
                  <p className="text-[11px] font-black text-[var(--muted)]">
                    {language === "en" ? "Emergency bag" : "ہنگامی بیگ"}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {guide.kit.map((item, index) => (
                      <li key={index} className="flex gap-2 text-[11.5px] leading-relaxed text-[var(--ink-soft)]">
                        <span aria-hidden>🎒</span>
                        <span>{L(item as never)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {guide.trainings.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {guide.trainings.map((training) => (
                    <a key={training.provider + training.name.en} href={training.url} target="_blank" rel="noreferrer" className="block">
                      <div className="rounded-xl border border-sky-200 bg-sky-50 p-2.5">
                        <p className="text-[12px] font-bold text-sky-900">{L(training.name)}</p>
                        <p className="text-[11px] text-sky-800">
                          {training.provider} · {L(training.note)}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Section title={t("tileDisaster")} subtitle={language === "en" ? "Who handles relief" : "ریلیف کون سنبھالتا ہے"}>
        {(state.data?.channels ?? []).map((channel) => (
          <Card key={channel.id} className="mb-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[13px] font-extrabold">{L(channel.name)}</p>
                <p className="text-[11.5px] text-[var(--muted)]">{channel.authority}</p>
              </div>
              {channel.numbers.length > 0 ? (
                <div className="flex gap-1.5">
                  {channel.numbers.map((number) => (
                    <CallButton key={number} number={number} />
                  ))}
                </div>
              ) : null}
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--ink-soft)]">{L(channel.whatTheyDo)}</p>
            <details className="mt-2 text-[11px]">
              <summary className="cursor-pointer font-bold text-[var(--forest)]">
                {language === "en" ? "How to request help" : "مدد کی درخواست کا طریقہ"}
              </summary>
              <div className="mt-2">
                <StepList
                  steps={channel.howToRequest.map((step) => ({
                    title: { en: step.title, ur: step.titleUr },
                    detail: { en: step.description, ur: step.descriptionUr },
                  }))}
                />
              </div>
            </details>
          </Card>
        ))}
      </Section>

      <ReliefForm hazard={hazard} needs={(state.data?.needs ?? []) as { id: string; label: unknown }[]} />
    </div>
  );
}

function ReliefForm({ hazard, needs }: { hazard: string; needs: { id: string; label: unknown }[] }) {
  const { L, language } = useLanguage();
  const [form, setForm] = useState({ district: "", families: 1, contactNumber: "", locationNote: "" });
  const [selected, setSelected] = useState<string[]>(["shelter"]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [done, setDone] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    const response = await apiPost<{ routedTo: { id: string; name: string; numbers: string[] }[] }>("/api/disaster", {
      hazard,
      district: form.district,
      families: form.families,
      needs: selected,
      contactNumber: form.contactNumber,
      locationNote: form.locationNote,
    });
    setBusy(false);
    if (response.ok) {
      const first = response.data.routedTo.find((entry) => entry.numbers.length > 0);
      setDone(
        language === "en"
          ? `Request registered. ${response.data.routedTo.length} channels notified.${first ? ` Call ${first.numbers[0]} now.` : ""}`
          : `درخواست درج ہو گئی۔ ${response.data.routedTo.length} اداروں کو بھیجا گیا۔${first ? ` ابھی ${first.numbers[0]} پر کال کریں۔` : ""}`,
      );
    } else {
      setError(response.error);
    }
  };

  return (
    <Section title={language === "en" ? "Ask for relief for your area" : "اپنے علاقے کے لیے امداد طلب کریں"}>
      <Card>
        <div className="space-y-2.5">
          <Field label={language === "en" ? "District" : "ضلع"}>
            <input className={inputClass} value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value })} placeholder="Abbottabad" />
          </Field>
          <Field label={language === "en" ? "Approximate place" : "تقریباً مقام"}>
            <input className={inputClass} value={form.locationNote} onChange={(event) => setForm({ ...form, locationNote: event.target.value })} placeholder={language === "en" ? "Village / street / landmark" : "گاؤں / گلی / نشانی"} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={language === "en" ? "Families affected" : "متاثرہ خاندان"}>
              <input
                type="number"
                min={1}
                max={5000}
                className={inputClass}
                value={form.families}
                onChange={(event) => setForm({ ...form, families: Number(event.target.value) })}
              />
            </Field>
            <Field label={language === "en" ? "Contact number" : "رابطہ نمبر"}>
              <input className={inputClass} value={form.contactNumber} onChange={(event) => setForm({ ...form, contactNumber: event.target.value })} placeholder="0300-1234567" />
            </Field>
          </div>
          <div>
            <p className="mb-1.5 text-[12px] font-bold">{language === "en" ? "What is needed most?" : "سب سے زیادہ کیا درکار ہے؟"}</p>
            <div className="flex flex-wrap gap-1.5">
              {needs.map((need) => (
                <button
                  key={need.id}
                  type="button"
                  onClick={() =>
                    setSelected((previous) =>
                      previous.includes(need.id) ? previous.filter((item) => item !== need.id) : [...previous, need.id],
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${
                    selected.includes(need.id)
                      ? "border-[var(--forest)] bg-[var(--forest)] text-white"
                      : "border-[var(--line)] bg-white text-[var(--muted)]"
                  }`}
                >
                  {L(need.label as never)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error ? <p className="mt-2 text-[12px] font-bold text-rose-700">{error}</p> : null}
        {done ? <p className="mt-2 rounded-xl bg-emerald-50 p-2.5 text-[12px] font-bold text-emerald-800">{done}</p> : null}

        <div className="mt-3">
          <Button onClick={() => void submit()} disabled={busy || !form.district || !form.contactNumber || selected.length === 0}>
            🚨 {language === "en" ? "Send relief request" : "امدادی درخواست بھیجیں"}
          </Button>
        </div>
      </Card>
    </Section>
  );
}
