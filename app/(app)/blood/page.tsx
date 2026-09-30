"use client";

import React, { useState } from "react";

import { useLanguage } from "@/components/shell/LanguageProvider";
import { Badge, Button, CallButton, Card, Field, FilterPills, Loader, Section, StepList, inputClass } from "@/components/shell/Ui";
import { apiPost, useApi } from "@/lib/client/useApi";
import { BLOOD_GROUPS, compatibleDonors, bloodRequestSteps, bloodDonationSteps, donorEligibility } from "@/data/blood-basics";

type Mode = "need" | "donate" | "banks";

interface BloodPayload {
  banks: { id: string; name: unknown; city: string; services: unknown[]; hours: string; contact: unknown[] }[];
  requests: { id: string; bloodGroup: string; city: string; hospital: string; units: number; neededBy: string; contactNumber: string }[];
  myRegistrations: Record<string, unknown>[];
  eligibility: { rule: unknown; blocking: boolean }[];
  howToDonate: { title: string }[];
  howToRequest: { title: string }[];
}

export default function BloodPage() {
  const { t, L, language } = useLanguage();
  const [mode, setMode] = useState<Mode>("need");
  const [group, setGroup] = useState("all");
  const [city, setCity] = useState("");
  const query = `/api/blood${group === "all" ? "" : `?group=${group}`}${city ? `${group === "all" ? "?" : "&"}city=${encodeURIComponent(city)}` : ""}`;
  const state = useApi<BloodPayload>(mode === "banks" ? query : query);

  return (
    <div>
      <Section
        title={t("tileBlood")}
        subtitle={
          language === "en"
            ? "Find donors, request blood, or register to donate. Never pay anyone for blood."
            : "ڈونر تلاش کریں، خون کی درخواست کریں یا خود رجسٹر ہوں۔ خون کے لیے کسی کو پیسے نہ دیں۔"
        }
      >
        <FilterPills<Mode>
          options={[
            { id: "need", label: language === "en" ? "I need blood" : "مجھے خون چاہیے" },
            { id: "donate", label: language === "en" ? "I will donate" : "میں خون دوں گا" },
            { id: "banks", label: language === "en" ? "Blood banks" : "بلڈ بینک" },
          ]}
          value={mode}
          onChange={setMode}
        />
      </Section>

      <div className="mb-3 flex flex-wrap gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3">
        <span className="text-[12px] font-black text-rose-700">{language === "en" ? "Emergency:" : "ایمرجنسی:"}</span>
        <CallButton number="115" label="Edhi" />
        <CallButton number="1122" label="Rescue" />
      </div>

      {mode === "need" ? <NeedBloodForm group={group} setGroup={setGroup} city={city} setCity={setCity} state={state} /> : null}
      {mode === "donate" ? <DonorForm group={group} setGroup={setGroup} city={city} setCity={setCity} state={state} /> : null}
      {mode === "banks" ? (
        state.loading ? (
          <Loader />
        ) : (
          <div className="space-y-2.5">
            {(state.data?.banks ?? []).map((bank) => (
              <Card key={bank.id}>
                <p className="text-[13.5px] font-extrabold">{L(bank.name as never)}</p>
                <p className="text-[11.5px] text-[var(--muted)]">
                  {bank.city} · {bank.hours}
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {bank.services.map((service, index) => (
                    <li key={index} className="text-[12px] text-[var(--ink-soft)]">
                      • {L(service as never)}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(bank.contact as { phone?: string; label?: unknown; url?: string }[]).map((entry, index) =>
                    entry.phone ? (
                      <CallButton key={index} number={entry.phone} label={entry.label ? L(entry.label as never) : undefined} />
                    ) : entry.url ? (
                      <a key={index} href={entry.url} target="_blank" rel="noreferrer" className="text-[11.5px] font-bold text-[var(--forest)]">
                        {language === "en" ? "Official page" : "سرکاری صفحہ"} ↗
                      </a>
                    ) : null,
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : null}

      <Section title={language === "en" ? "Open requests near you" : "قریبی درخواستیں"}>
        {state.loading ? (
          <Loader />
        ) : (state.data?.requests.length ?? 0) === 0 ? (
          <Card className="text-[12.5px] text-[var(--muted)]">{t("noResults")}</Card>
        ) : (
          <div className="space-y-2">
            {(state.data?.requests ?? []).slice(0, 10).map((request) => (
              <Card key={request.id} className="bg-[var(--surface-2)]">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-extrabold">
                    <span dir="ltr">{request.bloodGroup}</span> · {request.units} {language === "en" ? "units" : "یونٹ"}
                  </p>
                  <Badge tone="danger">{request.bloodGroup}</Badge>
                </div>
                <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">
                  {request.hospital} · {request.city}
                </p>
                <p className="mt-1 text-[11px]" dir="ltr">
                  {language === "en" ? "Contact: " : "رابطہ: "}
                  {request.contactNumber}
                </p>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title={language === "en" ? "Who can donate?" : "کون خون دے سکتا ہے؟"}>
        <ul className="space-y-1.5">
          {donorEligibility.map((rule, index) => (
            <li key={index} className="flex gap-2 rounded-xl border border-[var(--line)] bg-white p-2.5 text-[12px]">
              <span aria-hidden>{rule.blocking ? "⛔" : "ℹ️"}</span>
              <span>{L(rule.rule as never)}</span>
            </li>
          ))}
        </ul>
        <details className="mt-2 text-[11.5px]">
          <summary className="cursor-pointer font-bold text-[var(--forest)]">
            {language === "en" ? "How donating works" : "خون دینے کا طریقہ"}
          </summary>
          <div className="mt-2">
            <StepList steps={bloodDonationSteps.map((step) => ({ title: { en: step.title, ur: step.titleUr }, detail: { en: step.description, ur: step.descriptionUr } }))} />
          </div>
        </details>
      </Section>
    </div>
  );
}

function GroupPicker({ group, setGroup, language }: { group: string; setGroup: (value: string) => void; language: string }) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-bold">{language === "en" ? "Blood group" : "بلڈ گروپ"}</p>
      <div className="flex flex-wrap gap-1.5">
        {["all", ...BLOOD_GROUPS].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setGroup(option)}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-bold ${
              group === option ? "border-[var(--forest)] bg-[var(--forest)] text-white" : "border-[var(--line)] bg-white text-[var(--muted)]"
            }`}
          >
            {option === "all" ? (language === "en" ? "Any" : "کوئی بھی") : option}
          </button>
        ))}
      </div>
      {group !== "all" ? (
        <p className="mt-1.5 text-[10.5px] text-[var(--muted)]">
          {language === "en" ? "Compatible donors: " : "مطابق ڈونرز: "}
          <span dir="ltr">{compatibleDonors(group).join(", ")}</span>
        </p>
      ) : null}
    </div>
  );
}

function NeedBloodForm({
  group,
  setGroup,
  city,
  setCity,
  state,
}: {
  group: string;
  setGroup: (value: string) => void;
  city: string;
  setCity: (value: string) => void;
  state: ReturnType<typeof useApi<BloodPayload>>;
}) {
  const { language } = useLanguage();
  const [form, setForm] = useState({ patientName: "", units: 1, hospital: "", neededBy: "", contactNumber: "", notes: "" });
  const [result, setResult] = useState<{ donors: number } | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    const response = await apiPost<{ banks: unknown[]; donors: unknown[]; request: { id: string } }>("/api/blood", {
      ...form,
      bloodGroup: group === "all" ? "O-" : group,
      city,
    });
    setBusy(false);
    if (response.ok) {
      setResult({ donors: (response.data.donors ?? []).length });
      state.reload();
    } else {
      setError(response.error);
    }
  };

  return (
    <Card>
      <p className="text-[13px] font-extrabold">{language === "en" ? "Ask the hospital blood bank first — it is fastest" : "پہلے ہسپتال کے بلڈ بینک سے پوچھیں"}</p>
      <div className="mt-2">
        <StepList steps={bloodRequestSteps.slice(0, 2).map((step) => ({ title: { en: step.title, ur: step.titleUr }, detail: { en: step.description, ur: step.descriptionUr } }))} />
      </div>

      <div className="mt-3 space-y-2.5">
        <GroupPicker group={group} setGroup={setGroup} language={language} />
        <Field label={language === "en" ? "City" : "شہر"}>
          <input className={inputClass} value={city} onChange={(event) => setCity(event.target.value)} placeholder="Abbottabad" />
        </Field>
        <Field label={language === "en" ? "Patient name" : "مریض کا نام"}>
          <input className={inputClass} value={form.patientName} onChange={(event) => setForm({ ...form, patientName: event.target.value })} />
        </Field>
        <Field label={language === "en" ? "Hospital" : "ہسپتال"}>
          <input className={inputClass} value={form.hospital} onChange={(event) => setForm({ ...form, hospital: event.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={language === "en" ? "Units needed" : "یونٹ"}>
            <input
              type="number"
              min={1}
              max={20}
              className={inputClass}
              value={form.units}
              onChange={(event) => setForm({ ...form, units: Number(event.target.value) })}
            />
          </Field>
          <Field label={language === "en" ? "Needed by" : "کس تاریخ تک"}>
            <input type="date" className={inputClass} value={form.neededBy} onChange={(event) => setForm({ ...form, neededBy: event.target.value })} />
          </Field>
        </div>
        <Field label={language === "en" ? "Contact number" : "رابطہ نمبر"} hint={language === "en" ? "Only your own number is shared publicly; others see a masked number." : "صرف آپ کا نمبر ظاہر ہوتا ہے۔"}>
          <input className={inputClass} value={form.contactNumber} onChange={(event) => setForm({ ...form, contactNumber: event.target.value })} placeholder="0300-1234567" />
        </Field>
      </div>

      {error ? <p className="mt-2 text-[12px] font-bold text-rose-700">{error}</p> : null}
      {result ? (
        <p className="mt-2 rounded-xl bg-emerald-50 p-2.5 text-[12px] font-bold text-emerald-800">
          {language === "en"
            ? `Request posted. ${result.donors} matching donors found.`
            : `درخواست درج ہو گئی۔ ${result.donors} مطابق ڈونرز ملے۔`}
        </p>
      ) : null}

      <div className="mt-3">
        <Button onClick={() => void submit()} disabled={busy || group === "all" || !city || !form.patientName || !form.hospital || !form.contactNumber}>
          🩸 {language === "en" ? "Post this request" : "درخواست درج کریں"}
        </Button>
      </div>
    </Card>
  );
}

function DonorForm({
  group,
  setGroup,
  city,
  setCity,
  state,
}: {
  group: string;
  setGroup: (value: string) => void;
  city: string;
  setCity: (value: string) => void;
  state: ReturnType<typeof useApi<BloodPayload>>;
}) {
  const { language } = useLanguage();
  const [form, setForm] = useState({ fullName: "", phone: "", lastDonation: "" });
  const [done, setDone] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    const response = await apiPost<{ donor: { bloodGroup: string }; matching: number }>("/api/blood", {
      action: "register_donor",
      ...form,
      bloodGroup: group,
      city,
    });
    setBusy(false);
    if (response.ok) {
      setDone(
        language === "en"
          ? `Thank you. ${response.data.matching} open requests match your blood group.`
          : `شکریہ۔ آپ کے بلڈ گروپ سے ${response.data.matching} درخواستیں مطابقت رکھتی ہیں۔`,
      );
      state.reload();
    } else {
      setError(response.error);
    }
  };

  return (
    <Card>
      <p className="text-[13px] font-extrabold">{language === "en" ? "Register as a blood donor" : "بطور ڈونر رجسٹر ہوں"}</p>
      <div className="mt-3 space-y-2.5">
        <GroupPicker group={group} setGroup={setGroup} language={language} />
        <Field label={language === "en" ? "City" : "شہر"}>
          <input className={inputClass} value={city} onChange={(event) => setCity(event.target.value)} />
        </Field>
        <Field label={language === "en" ? "Your name" : "آپ کا نام"}>
          <input className={inputClass} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
        </Field>
        <Field label={language === "en" ? "Phone" : "فون نمبر"}>
          <input className={inputClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        </Field>
        <Field label={language === "en" ? "Last donation (optional)" : "آخری بار خون دیا (اختیاری)"} hint={language === "en" ? "You can donate again after 8–12 weeks." : "8 سے 12 ہفتوں بعد دوبارہ دیا جا سکتا ہے۔"}>
          <input type="date" className={inputClass} value={form.lastDonation} onChange={(event) => setForm({ ...form, lastDonation: event.target.value })} />
        </Field>
      </div>
      {error ? <p className="mt-2 text-[12px] font-bold text-rose-700">{error}</p> : null}
      {done ? <p className="mt-2 rounded-xl bg-emerald-50 p-2.5 text-[12px] font-bold text-emerald-800">{done}</p> : null}
      <div className="mt-3">
        <Button onClick={() => void submit()} disabled={busy || group === "all" || !city || !form.fullName || !form.phone}>
          🙋 {language === "en" ? "Register" : "رجسٹر کریں"}
        </Button>
      </div>
    </Card>
  );
}
