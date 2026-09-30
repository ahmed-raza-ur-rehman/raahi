"use client";

import React from "react";

interface EmergencyBannerProps {
  language?: "en" | "ur" | "ps";
  province?: string;
  onDismiss?: () => void;
}

interface EmergencyContact {
  nameEn: string;
  nameUr: string;
  namePs: string;
  number: string;
  coverage: string;
  type: string;
}

const EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    nameEn: "Rescue 1122 (Ambulance / Fire / Rescue)",
    nameUr: "ریسکیو 1122 (ایمبولینس / فائر / ریسکیو)",
    namePs: "ریسکیو 1122 (امبولانس / اور وژنه / ژغورنه)",
    number: "1122",
    coverage: "Punjab, KP, Balochistan, Gilgit-Baltistan, AJK, Sindh",
    type: "All-Hazards Emergency",
  },
  {
    nameEn: "Edhi Ambulance Service",
    nameUr: "ایدھی ایمبولینس سروس",
    namePs: "ایدهي امبولانس خدمت",
    number: "115",
    coverage: "Nationwide",
    type: "Ambulance & Emergency Relief",
  },
  {
    nameEn: "Police Emergency Helpline",
    nameUr: "پولیس ایمرجنسی ہیلپ لائن",
    namePs: "د پولیسو بیړنۍ کرښه",
    number: "15",
    coverage: "Nationwide",
    type: "Police & Security",
  },
  {
    nameEn: "Aman Health & Ambulance (Sindh)",
    nameUr: "امان ہیلتھ و ایمبولینس (سندھ)",
    namePs: "امان روغتیا او امبولانس",
    number: "1021",
    coverage: "Karachi & Sindh",
    type: "Advanced Life Support Ambulance",
  },
  {
    nameEn: "National Disaster Management (NDMA)",
    nameUr: "قومی ڈیزاسٹر مینجمنٹ اتھارٹی (NDMA)",
    namePs: "د ناورین د مدیریت ملي اداره",
    number: "051-111-157-157",
    coverage: "Nationwide",
    type: "Floods, Earthquakes, Disaster Relief",
  },
];

export function EmergencyBanner({
  language = "ur",
  province,
  onDismiss,
}: EmergencyBannerProps) {
  // Show the numbers that actually cover this visitor first — in an emergency
  // nobody reads to the bottom of a list.
  const contacts = React.useMemo(() => {
    if (!province) return EMERGENCY_CONTACTS;
    const needle = province.trim().toLowerCase();
    const rank = (contact: EmergencyContact) => {
      const coverage = contact.coverage.toLowerCase();
      if (coverage.includes(needle)) return 0;
      if (coverage.includes("nationwide")) return 1;
      return 2;
    };
    return [...EMERGENCY_CONTACTS].sort((a, b) => rank(a) - rank(b));
  }, [province]);

  return (
    <div className="emergency-banner rounded-2xl border-2 border-red-500 bg-gradient-to-br from-red-600 via-rose-700 to-red-800 p-5 text-white shadow-xl animate-fade-in my-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl animate-pulse">
            🚨
          </span>
          <div>
            <span className="rounded-full bg-red-900/60 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-rose-200">
              {language === "en" ? "Emergency Helpline" : "فوری ایمرجنسی رابطے"}
            </span>
            <h2 className="text-xl font-black mt-0.5">
              {language === "en"
                ? "Immediate Emergency Assistance"
                : language === "ps"
                ? "فوري بیړنۍ مرسته"
                : "فوری ایمرجنسی مدد درکار ہے؟"}
            </h2>
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg bg-white/20 p-1.5 text-xs text-white hover:bg-white/30"
          >
            ✕
          </button>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-rose-100 font-medium">
        {language === "en"
          ? "If anyone is experiencing a life-threatening medical emergency, fire, violence, or natural disaster, please call an emergency helpline immediately. Once safe, return to RAAHI for follow-up support."
          : language === "ps"
          ? "که چیرې څوک د ژوند په خطر کې وي، د اور لګیدنې، تاوتریخوالي یا طبیعي ناورین سره مخ وي، سمدلاسه دغو شمیرو ته زنګ ووهئ."
          : "اگر کوئی شخص جان لیوا طبی صورتحال، آگ، تشدد یا قدرتی آفت کا شکار ہے تو فوری طور پر نیچے دیے گئے نمبرز پر کال کریں۔ محفوظ ہونے کے بعد راہی پر واپس آئیں تاکہ مزید بحالی اور فلاحی خدمات تلاش کی جا سکیں۔"}
      </p>

      {/* Touch-to-call buttons */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {contacts.map((contact, idx) => (
          <a
            key={idx}
            href={`tel:${contact.number.replace(/[^0-9]/g, "")}`}
            className="flex items-center justify-between rounded-xl bg-white/15 px-4 py-3 font-bold text-white backdrop-blur-sm transition hover:bg-white/25 active:scale-[0.98]"
          >
            <div className="flex flex-col">
              <span className="text-xs text-rose-200">
                {language === "en"
                  ? contact.nameEn
                  : language === "ps"
                  ? contact.namePs
                  : contact.nameUr}
              </span>
              <span className="text-xs font-normal opacity-80">
                {contact.coverage}
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-base font-black text-red-700 shadow-sm shrink-0">
              <span>📞</span>
              <span className="font-mono">{contact.number}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
