"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Language } from "@/lib/types";
import {
  DEFAULT_PREFERENCES,
  LANGUAGE_LABELS,
  PROVINCE_OPTIONS,
  applyPreferenceAttributes,
  exportPreferences,
  getAccessibleSummary,
  mergePreferences,
  readPreferences,
  subscribeToPreferences,
  writePreferences,
  type RaahiPreferences,
} from "@/lib/raahi-preferences";

interface PreferencesWorkspaceProps {
  language: Language;
  onLanguageChange?: (language: Language) => void;
  compact?: boolean;
}

const copy = {
  en: {
    title: "Your RAAHI settings",
    description: "Personalize language, readability, privacy, and the way service results are presented.",
    language: "Interface language",
    readability: "Readability",
    contrast: "High contrast",
    textSize: "Text size",
    standard: "Standard",
    large: "Large",
    xlarge: "Extra large",
    motion: "Reduce motion",
    compact: "Compact spacing",
    data: "Reduce data usage",
    province: "Default province",
    save: "Settings save automatically",
    reset: "Reset settings",
    saved: "Updated across your open RAAHI tabs",
    privacy: "Privacy note",
    privacyText: "These preferences stay in your browser and are never sent with your questions.",
    status: "Current setup",
  },
  ur: {
    title: "راہی کی ترتیبات",
    description: "زبان، پڑھنے میں آسانی، رازداری اور خدمات دکھانے کا انداز اپنی ضرورت کے مطابق بنائیں۔",
    language: "انٹرفیس کی زبان",
    readability: "پڑھنے میں آسانی",
    contrast: "زیادہ واضح رنگ",
    textSize: "متن کا سائز",
    standard: "معیاری",
    large: "بڑا",
    xlarge: "بہت بڑا",
    motion: "حرکت کم کریں",
    compact: "کم فاصلہ",
    data: "کم ڈیٹا استعمال کریں",
    province: "آپ کا صوبہ",
    save: "ترتیبات خود محفوظ ہوتی ہیں",
    reset: "ترتیبات بحال کریں",
    saved: "آپ کے کھلے راہی ٹیبز میں بھی اپ ڈیٹ ہوگیا",
    privacy: "رازداری",
    privacyText: "یہ ترتیبات صرف آپ کے براؤزر میں رہتی ہیں اور سوالات کے ساتھ نہیں بھیجی جاتیں۔",
    status: "موجودہ ترتیب",
  },
  ps: {
    title: "د راهي امستنې",
    description: "ژبه، لوستلو اسانتیا، محرمیت او د خدمتونو ښودلو بڼه خپله کړئ.",
    language: "د انټر فېس ژبه",
    readability: "لوستلو اسانتیا",
    contrast: "لوړ توپیر",
    textSize: "د متن کچه",
    standard: "معیاري",
    large: "لوی",
    xlarge: "ډېر لوی",
    motion: "حرکت کم کړئ",
    compact: "لنډ واټن",
    data: "کم ډیټا وکاروئ",
    province: "ستاسو ولایت",
    save: "امستنې په خپله خوندي کېږي",
    reset: "امستنې بېرته وټاکئ",
    saved: "ستاسو په پرانیستو راهي ټبونو کې هم نوي شول",
    privacy: "محرمیت",
    privacyText: "دا امستنې یوازې ستاسو په براوزر کې ساتل کېږي او له پوښتنو سره نه لېږل کېږي.",
    status: "اوسنۍ بڼه",
  },
} as const;

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: () => void; label: string; description: string }) {
  return (
    <button type="button" onClick={onChange} role="switch" aria-checked={checked} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-3 text-start transition hover:border-[var(--forest)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)]">
      <span>
        <span className="block text-sm font-bold text-[var(--ink)]">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--muted)]">{description}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full p-1 transition ${checked ? "bg-[var(--forest)]" : "bg-slate-300"}`} aria-hidden="true">
        <span className={`block size-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </span>
    </button>
  );
}

export default function PreferencesWorkspace({ language, onLanguageChange, compact = false }: PreferencesWorkspaceProps) {
  const [preferences, setPreferences] = useState<RaahiPreferences>(DEFAULT_PREFERENCES);
  const [announcement, setAnnouncement] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const t = copy[language];

  useEffect(() => {
    const initial = readPreferences();
    setPreferences(initial);
    applyPreferenceAttributes(initial);
    return subscribeToPreferences((next) => {
      setPreferences(next);
      applyPreferenceAttributes(next);
      setAnnouncement(t.saved);
    });
  }, [t.saved]);

  const update = (patch: Partial<RaahiPreferences>) => {
    const next = mergePreferences(preferences, patch);
    setPreferences(next);
    writePreferences(next);
    applyPreferenceAttributes(next);
    if (patch.language && onLanguageChange) onLanguageChange(next.language);
    setAnnouncement(t.saved);
  };

  const status = useMemo(() => getAccessibleSummary(preferences), [preferences]);

  const download = () => {
    const url = URL.createObjectURL(exportPreferences(preferences));
    const link = document.createElement("a");
    link.href = url;
    link.download = "raahi-preferences.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (file: File) => {
    try {
      const imported = JSON.parse(await file.text()) as Partial<RaahiPreferences>;
      update(imported);
    } catch {
      setAnnouncement(language === "en" ? "That settings file could not be read." : "ترتیبات کی فائل نہیں پڑھی جا سکی۔");
    }
  };

  return (
    <section aria-labelledby="preferences-title" className={`card-premium ${compact ? "p-4" : "p-5 sm:p-7"}`} dir={language === "en" ? "ltr" : "rtl"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.15em] text-[var(--forest)]">RAAHI</p>
          <h2 id="preferences-title" className="mt-1 text-xl font-black text-[var(--ink)]">{t.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">{t.description}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-end">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">{t.status}</p>
          <p className="mt-1 max-w-[210px] text-xs font-bold text-[var(--forest)]">{status}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <fieldset>
            <legend className="mb-2 text-sm font-black text-[var(--ink)]">{t.language}</legend>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(LANGUAGE_LABELS) as Language[]).map((value) => (
                <button key={value} type="button" aria-pressed={preferences.language === value} onClick={() => update({ language: value })} className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)] ${preferences.language === value ? "border-[var(--forest)] bg-[var(--forest)] text-white" : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-soft)] hover:border-[var(--forest)]"}`}>
                  {LANGUAGE_LABELS[value]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-black text-[var(--ink)]">{t.textSize}</legend>
            <div className="grid grid-cols-3 gap-2">
              {(["standard", "large", "xlarge"] as const).map((value) => (
                <button key={value} type="button" aria-pressed={preferences.textScale === value} onClick={() => update({ textScale: value })} className={`rounded-xl border px-2 py-2.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)] ${preferences.textScale === value ? "border-[var(--forest)] bg-[var(--forest-light)] text-[var(--forest)]" : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)] hover:border-[var(--forest)]"}`}>
                  {t[value]}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="text-sm font-black text-[var(--ink)]" htmlFor="default-province">{t.province}</label>
          <select id="default-province" value={preferences.preferredProvince} onChange={(event) => update({ preferredProvince: event.target.value })} className="input-field min-h-11 w-full text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)]">
            {PROVINCE_OPTIONS.map((province) => <option key={province} value={province}>{province}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-3">
          <Toggle checked={preferences.contrast === "high"} onChange={() => update({ contrast: preferences.contrast === "high" ? "standard" : "high" })} label={t.contrast} description={language === "en" ? "Increase boundaries and text contrast across the app." : "ایپ میں سرحدوں اور متن کا فرق بڑھائیں۔"} />
          <Toggle checked={preferences.motion === "reduced"} onChange={() => update({ motion: preferences.motion === "reduced" ? "full" : "reduced" })} label={t.motion} description={language === "en" ? "Respect your motion preference and soften transitions." : "حرکت کی ترجیح کا احترام کریں اور تبدیلیاں نرم کریں۔"} />
          <Toggle checked={preferences.density === "compact"} onChange={() => update({ density: preferences.density === "compact" ? "comfortable" : "compact" })} label={t.compact} description={language === "en" ? "Fit more service information into each screen." : "ہر اسکرین پر مزید معلومات دکھائیں۔"} />
          <Toggle checked={preferences.reduceData} onChange={() => update({ reduceData: !preferences.reduceData })} label={t.data} description={language === "en" ? "Prefer lighter previews and fewer automatic requests." : "ہلکی جھلکیاں اور کم خودکار درخواستیں استعمال کریں۔"} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line-soft)] pt-4">
        <p className="text-xs font-semibold text-[var(--muted)]">{t.save}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={download} className="btn-secondary text-xs">{language === "en" ? "Export" : "برآمد کریں"}</button>
          <button type="button" onClick={() => importRef.current?.click()} className="btn-secondary text-xs">{language === "en" ? "Import" : "درآمد کریں"}</button>
          <input ref={importRef} type="file" accept="application/json" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.currentTarget.value = ""; }} />
          <button type="button" onClick={() => { const next = DEFAULT_PREFERENCES; setPreferences(next); writePreferences(next); applyPreferenceAttributes(next); onLanguageChange?.(next.language); }} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50">{t.reset}</button>
        </div>
      </div>
      <p className="mt-4 rounded-xl bg-[var(--surface-2)] p-3 text-xs leading-relaxed text-[var(--muted)]"><strong className="text-[var(--ink)]">{t.privacy}:</strong> {t.privacyText}</p>
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    </section>
  );
}
