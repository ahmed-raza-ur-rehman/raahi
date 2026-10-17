"use client";

import Link from "next/link";
import { useState } from "react";
import type { Language } from "@/lib/types";
import { EMPTY_EDUCATION, EMPTY_EXPERIENCE, MAX_ENTRIES, useCvDraft, type CvDraft } from "./useCvDraft";

type L = { en: string; ur: string };
const pick = (language: Language, value: L) => (language === "en" ? value.en : value.ur);

const TEXT = {
  intro: {
    en: "Build a clean, one-page CV that recruiters and scholarship committees can read — and that applicant-tracking software can parse. Fill the form; the preview updates as you type. To keep it, press the Print button and choose “Save as PDF”.",
    ur: "ایک صاف ستھری، ایک صفحے کی سی وی بنائیں جسے بھرتی کرنے والے اور اسکالرشپ کمیٹیاں پڑھ سکیں — اور جو اپلیکنٹ ٹریکنگ سافٹ ویئر بھی سمجھ سکے۔ فارم بھریں؛ پیش منظر ساتھ ساتھ بدلتا ہے۔ محفوظ کرنے کے لیے پرنٹ کا بٹن دبائیں اور “Save as PDF” چنیں۔",
  },
  privacy: { en: "Saved only in this browser. Nothing you type is sent to RAAHI or anyone else.", ur: "صرف اسی براؤزر میں محفوظ ہوتا ہے۔ آپ جو لکھتے ہیں وہ راہی یا کسی اور کو نہیں بھیجا جاتا۔" },
  name: { en: "Full name", ur: "پورا نام" },
  headline: { en: "Headline (e.g. Civil Engineer · BSc Hons)", ur: "عنوان (مثلاً سول انجینئر · بی ایس سی آنرز)" },
  phone: { en: "Phone", ur: "فون" },
  email: { en: "Email", ur: "ای میل" },
  city: { en: "City", ur: "شہر" },
  links: { en: "Links (LinkedIn, GitHub, portfolio)", ur: "لنکس (لنکڈ اِن، گٹ ہب، پورٹ فولیو)" },
  summary: { en: "Profile — 2 to 3 lines", ur: "خلاصہ — 2 سے 3 سطریں" },
  education: { en: "Education", ur: "تعلیم" },
  degree: { en: "Degree / programme", ur: "ڈگری / پروگرام" },
  institute: { en: "Institute", ur: "ادارہ" },
  years: { en: "Years (2021–2025)", ur: "سال (2021–2025)" },
  result: { en: "CGPA / marks", ur: "سی جی پی اے / نمبر" },
  experience: { en: "Experience (newest first)", ur: "تجربہ (نیا پہلے)" },
  role: { en: "Role", ur: "عہدہ" },
  organization: { en: "Organisation", ur: "ادارہ / کمپنی" },
  points: { en: "What you did and achieved — one point per line, with numbers where you can", ur: "آپ نے کیا کیا اور کیا حاصل کیا — ہر سطر میں ایک نکتہ، جہاں ممکن ہو اعداد کے ساتھ" },
  skills: { en: "Skills (separate with commas)", ur: "مہارتیں (کاما سے الگ کریں)" },
  languages: { en: "Languages (e.g. Urdu — native, English — fluent)", ur: "زبانیں (مثلاً اردو — مادری، انگریزی — روانی)" },
  certifications: { en: "Certifications and courses — one per line", ur: "سرٹیفکیشن اور کورسز — ہر سطر میں ایک" },
  extra: { en: "Awards, volunteering, publications — one per line", ur: "اعزازات، رضاکارانہ کام، اشاعتیں — ہر سطر میں ایک" },
  add: { en: "Add another", ur: "ایک اور شامل کریں" },
  remove: { en: "Remove", ur: "ہٹائیں" },
  print: { en: "Print / save as PDF", ur: "پرنٹ / پی ڈی ایف محفوظ کریں" },
  clear: { en: "Clear everything", ur: "سب کچھ مٹائیں" },
  confirmClear: { en: "Delete this CV draft from this browser?", ur: "اس براؤزر سے یہ سی وی ڈرافٹ مٹا دیں؟" },
  headings: { en: "Headings in the CV", ur: "سی وی میں عنوانات" },
  preview: { en: "Preview", ur: "پیش منظر" },
  empty: { en: "Start typing on the left — your CV appears here.", ur: "بائیں طرف لکھنا شروع کریں — آپ کی سی وی یہاں نظر آئے گی۔" },
  tipsTitle: { en: "Before you send it", ur: "بھیجنے سے پہلے" },
  guide: { en: "CV, cover letter & SOP guide", ur: "سی وی، کور لیٹر اور ایس او پی کی رہنمائی" },
} satisfies Record<string, L>;

const TIPS: L[] = [
  { en: "One page for fresh graduates, two at most. Newest first, with dates.", ur: "نئے گریجویٹس کے لیے ایک صفحہ، زیادہ سے زیادہ دو۔ نیا پہلے، تاریخوں کے ساتھ۔" },
  { en: "Start each point with a verb and add a number: “Trained 40 students”, not “responsible for training”.", ur: "ہر نکتہ فعل سے شروع کریں اور عدد شامل کریں: “40 طلبہ کو تربیت دی”، نہ کہ “تربیت کا ذمہ دار”۔" },
  { en: "Leave out your CNIC number, father’s name, religion and marital status unless the advertisement or a government form asks for them.", ur: "شناختی کارڈ نمبر، والد کا نام، مذہب اور ازدواجی حیثیت نہ لکھیں، جب تک اشتہار یا سرکاری فارم نہ مانگے۔" },
  { en: "Use a plain email address with your name, and a phone number you answer.", ur: "اپنے نام والا سادہ ای میل اور ایسا فون نمبر دیں جو آپ اٹھاتے ہوں۔" },
  { en: "Tailor the profile and skills to each post — copy the exact words the advertisement uses where they are true.", ur: "ہر آسامی کے مطابق خلاصہ اور مہارتیں ڈھالیں — اشتہار کے الفاظ وہیں استعمال کریں جہاں وہ سچ ہوں۔" },
  { en: "Never pay anyone to “place” or “verify” your CV, and never send documents to an unknown agent.", ur: "سی وی “لگوانے” یا “تصدیق” کے لیے کسی کو پیسے نہ دیں اور نامعلوم ایجنٹ کو دستاویزات نہ بھیجیں۔" },
];

const HEADINGS: Record<"en" | "ur", Record<"profile" | "education" | "experience" | "skills" | "languages" | "certifications" | "extra", string>> = {
  en: { profile: "Profile", education: "Education", experience: "Experience", skills: "Skills", languages: "Languages", certifications: "Certifications", extra: "Additional" },
  ur: { profile: "خلاصہ", education: "تعلیم", experience: "تجربہ", skills: "مہارتیں", languages: "زبانیں", certifications: "اسناد", extra: "مزید" },
};

const lines = (value: string) => value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const commas = (value: string) => value.split(/[,،;]/).map((part) => part.trim()).filter(Boolean);

function isBlank(draft: CvDraft): boolean {
  return !(
    draft.name || draft.headline || draft.phone || draft.email || draft.city || draft.links || draft.summary || draft.skills || draft.languages || draft.certifications || draft.extra ||
    draft.education.some((row) => row.degree || row.institute) || draft.experience.some((row) => row.role || row.organization || row.points)
  );
}

export default function CvBuilder({ language }: { language: Language }) {
  const { draft, update, reset, saved } = useCvDraft();
  const [headingLanguage, setHeadingLanguage] = useState<"en" | "ur">("en");
  const tx = (key: keyof typeof TEXT) => pick(language, TEXT[key]);
  const field = "input-field !py-2 !text-sm";
  const label = "flex flex-col gap-1 text-xs font-black text-[var(--ink)]";
  const heading = HEADINGS[headingLanguage];

  const setEducation = (index: number, patch: Partial<CvDraft["education"][number]>) => update({ education: draft.education.map((row, i) => (i === index ? { ...row, ...patch } : row)) });
  const setExperience = (index: number, patch: Partial<CvDraft["experience"][number]>) => update({ experience: draft.experience.map((row, i) => (i === index ? { ...row, ...patch } : row)) });

  const education = draft.education.filter((row) => row.degree || row.institute);
  const experience = draft.experience.filter((row) => row.role || row.organization || row.points);
  const contact = [draft.city, draft.phone, draft.email, ...lines(draft.links)].filter(Boolean);
  const blank = isBlank(draft);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)] print:block">
      <div className="space-y-4 print:hidden">
        <section className="card space-y-4 p-5">
          <p className="text-sm leading-relaxed text-[var(--ink-soft)]">{tx("intro")}</p>
          <p className="rounded-xl bg-[var(--forest-light)] p-3 text-xs font-bold text-[var(--forest-dark)]">🔒 {tx("privacy")}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`${label} sm:col-span-2`}>{tx("name")}<input value={draft.name} onChange={(event) => update({ name: event.target.value })} className={field} dir="auto" autoComplete="name" maxLength={120} /></label>
            <label className={`${label} sm:col-span-2`}>{tx("headline")}<input value={draft.headline} onChange={(event) => update({ headline: event.target.value })} className={field} dir="auto" maxLength={160} /></label>
            <label className={label}>{tx("phone")}<input value={draft.phone} onChange={(event) => update({ phone: event.target.value })} className={field} dir="ltr" inputMode="tel" autoComplete="tel" maxLength={40} /></label>
            <label className={label}>{tx("email")}<input value={draft.email} onChange={(event) => update({ email: event.target.value })} className={field} dir="ltr" inputMode="email" autoComplete="email" maxLength={120} /></label>
            <label className={label}>{tx("city")}<input value={draft.city} onChange={(event) => update({ city: event.target.value })} className={field} dir="auto" maxLength={80} /></label>
            <label className={label}>{tx("links")}<input value={draft.links} onChange={(event) => update({ links: event.target.value.replace(/\n/g, " ") })} className={field} dir="ltr" maxLength={300} /></label>
            <label className={`${label} sm:col-span-2`}>{tx("summary")}<textarea value={draft.summary} onChange={(event) => update({ summary: event.target.value })} className={field} rows={3} dir="auto" maxLength={1200} /></label>
          </div>
        </section>

        <section className="card space-y-3 p-5">
          <h3 className="text-sm font-black text-[var(--ink)]">{tx("education")}</h3>
          {draft.education.map((row, index) => (
            <div key={index} className="grid gap-2 rounded-xl border border-[var(--line)] p-3 sm:grid-cols-2">
              <label className={`${label} sm:col-span-2`}>{tx("degree")}<input value={row.degree} onChange={(event) => setEducation(index, { degree: event.target.value })} className={field} dir="auto" maxLength={160} /></label>
              <label className={label}>{tx("institute")}<input value={row.institute} onChange={(event) => setEducation(index, { institute: event.target.value })} className={field} dir="auto" maxLength={160} /></label>
              <label className={label}>{tx("years")}<input value={row.years} onChange={(event) => setEducation(index, { years: event.target.value })} className={field} dir="auto" maxLength={40} /></label>
              <label className={label}>{tx("result")}<input value={row.result} onChange={(event) => setEducation(index, { result: event.target.value })} className={field} dir="auto" maxLength={80} /></label>
              {draft.education.length > 1 && <button type="button" onClick={() => update({ education: draft.education.filter((_, i) => i !== index) })} className="btn-secondary !min-h-8 !px-3 !py-1 !text-xs sm:col-span-2 sm:justify-self-end">{tx("remove")}</button>}
            </div>
          ))}
          {draft.education.length < MAX_ENTRIES && <button type="button" onClick={() => update({ education: [...draft.education, { ...EMPTY_EDUCATION }] })} className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs">＋ {tx("add")}</button>}
        </section>

        <section className="card space-y-3 p-5">
          <h3 className="text-sm font-black text-[var(--ink)]">{tx("experience")}</h3>
          {draft.experience.map((row, index) => (
            <div key={index} className="grid gap-2 rounded-xl border border-[var(--line)] p-3 sm:grid-cols-2">
              <label className={label}>{tx("role")}<input value={row.role} onChange={(event) => setExperience(index, { role: event.target.value })} className={field} dir="auto" maxLength={160} /></label>
              <label className={label}>{tx("organization")}<input value={row.organization} onChange={(event) => setExperience(index, { organization: event.target.value })} className={field} dir="auto" maxLength={160} /></label>
              <label className={`${label} sm:col-span-2`}>{tx("years")}<input value={row.years} onChange={(event) => setExperience(index, { years: event.target.value })} className={field} dir="auto" maxLength={40} /></label>
              <label className={`${label} sm:col-span-2`}>{tx("points")}<textarea value={row.points} onChange={(event) => setExperience(index, { points: event.target.value })} className={field} rows={4} dir="auto" maxLength={1500} /></label>
              {draft.experience.length > 1 && <button type="button" onClick={() => update({ experience: draft.experience.filter((_, i) => i !== index) })} className="btn-secondary !min-h-8 !px-3 !py-1 !text-xs sm:col-span-2 sm:justify-self-end">{tx("remove")}</button>}
            </div>
          ))}
          {draft.experience.length < MAX_ENTRIES && <button type="button" onClick={() => update({ experience: [...draft.experience, { ...EMPTY_EXPERIENCE }] })} className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs">＋ {tx("add")}</button>}
        </section>

        <section className="card space-y-3 p-5">
          <label className={label}>{tx("skills")}<textarea value={draft.skills} onChange={(event) => update({ skills: event.target.value })} className={field} rows={2} dir="auto" maxLength={600} /></label>
          <label className={label}>{tx("languages")}<input value={draft.languages} onChange={(event) => update({ languages: event.target.value })} className={field} dir="auto" maxLength={200} /></label>
          <label className={label}>{tx("certifications")}<textarea value={draft.certifications} onChange={(event) => update({ certifications: event.target.value })} className={field} rows={3} dir="auto" maxLength={1000} /></label>
          <label className={label}>{tx("extra")}<textarea value={draft.extra} onChange={(event) => update({ extra: event.target.value })} className={field} rows={3} dir="auto" maxLength={1000} /></label>
        </section>

        <section className="card p-5">
          <h3 className="text-sm font-black text-[var(--ink)]">{tx("tipsTitle")}</h3>
          <ul className="mt-2 list-disc space-y-1.5 ps-5 text-[13px] leading-relaxed text-[var(--ink-soft)]">
            {TIPS.map((tip) => <li key={tip.en}>{pick(language, tip)}</li>)}
          </ul>
          <Link href="/opportunities/guides/cv-cover-sop" className="btn-secondary mt-3 !min-h-9 !px-3 !py-1.5 !text-xs">{tx("guide")} →</Link>
        </section>
      </div>

      <section aria-label={tx("preview")} className="min-w-0 print:block">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <label className="flex items-center gap-2 text-xs font-black text-[var(--ink)]">{tx("headings")}
            <select value={headingLanguage} onChange={(event) => setHeadingLanguage(event.target.value === "ur" ? "ur" : "en")} className="input-field !min-h-9 !w-auto !py-1.5 !text-xs">
              <option value="en">English</option>
              <option value="ur">اردو</option>
            </select>
          </label>
          <div className="flex gap-2">
            {saved && <button type="button" onClick={() => { if (window.confirm(tx("confirmClear"))) reset(); }} className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs">{tx("clear")}</button>}
            <button type="button" onClick={() => window.print()} disabled={blank} className="btn-primary !min-h-9 !px-4 !py-1.5 !text-xs">🖨️ {tx("print")}</button>
          </div>
        </div>

        <article id="cv-preview" dir={headingLanguage === "ur" ? "rtl" : "ltr"} className="mx-auto min-h-[420px] w-full max-w-[794px] rounded-xl border border-[var(--line)] bg-white p-7 text-[13px] leading-snug text-black shadow-sm print:min-h-0 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
          {blank ? (
            <p className="py-16 text-center text-sm text-gray-500 print:hidden">{tx("empty")}</p>
          ) : (
            <>
              <header className="border-b-2 border-black pb-2">
                <h2 className="text-2xl font-black leading-tight" dir="auto">{draft.name || "—"}</h2>
                {draft.headline && <p className="mt-0.5 text-[14px] font-semibold text-gray-700" dir="auto">{draft.headline}</p>}
                {contact.length > 0 && <p className="mt-1 text-[12px] text-gray-700" dir="auto">{contact.join("  ·  ")}</p>}
              </header>

              {draft.summary && <CvSection title={heading.profile}><p dir="auto">{draft.summary}</p></CvSection>}

              {education.length > 0 && (
                <CvSection title={heading.education}>
                  {education.map((row, index) => (
                    <div key={index} className="mb-1.5">
                      <p className="flex flex-wrap justify-between gap-x-3"><strong dir="auto">{row.degree}</strong><span className="text-gray-700" dir="auto">{row.years}</span></p>
                      <p className="text-gray-800" dir="auto">{[row.institute, row.result].filter(Boolean).join(" — ")}</p>
                    </div>
                  ))}
                </CvSection>
              )}

              {experience.length > 0 && (
                <CvSection title={heading.experience}>
                  {experience.map((row, index) => (
                    <div key={index} className="mb-2">
                      <p className="flex flex-wrap justify-between gap-x-3"><strong dir="auto">{[row.role, row.organization].filter(Boolean).join(" — ")}</strong><span className="text-gray-700" dir="auto">{row.years}</span></p>
                      {lines(row.points).length > 0 && <ul className="mt-0.5 list-disc space-y-0.5 ps-5">{lines(row.points).map((point, i) => <li key={i} dir="auto">{point}</li>)}</ul>}
                    </div>
                  ))}
                </CvSection>
              )}

              {commas(draft.skills).length > 0 && <CvSection title={heading.skills}><p dir="auto">{commas(draft.skills).join("  ·  ")}</p></CvSection>}
              {draft.languages && <CvSection title={heading.languages}><p dir="auto">{draft.languages}</p></CvSection>}
              {lines(draft.certifications).length > 0 && <CvSection title={heading.certifications}><ul className="list-disc space-y-0.5 ps-5">{lines(draft.certifications).map((item, i) => <li key={i} dir="auto">{item}</li>)}</ul></CvSection>}
              {lines(draft.extra).length > 0 && <CvSection title={heading.extra}><ul className="list-disc space-y-0.5 ps-5">{lines(draft.extra).map((item, i) => <li key={i} dir="auto">{item}</li>)}</ul></CvSection>}
            </>
          )}
        </article>
      </section>
    </div>
  );
}

function CvSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-3.5 break-inside-avoid">
      <h3 className="border-b border-gray-400 pb-0.5 text-[12px] font-black uppercase tracking-wider text-gray-800">{title}</h3>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}
