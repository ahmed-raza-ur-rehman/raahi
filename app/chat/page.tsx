"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Language = "en" | "ur" | "ps";
type Profile = { province?: string; hasCnic?: boolean; isEnrolled?: boolean };
type Result = {
  service: { id: string; name: string; nameUr: string; namePs: string; description: string; descriptionUr: string; domain: string; applicationMethod: string; procedure: { order: number; title: string; titleUr: string; description: string; descriptionUr: string; channel: string; url?: string }[]; requiredDocuments: { type: string; label: string; labelUr: string; mandatory: boolean }[] };
  citation: { sourceUrl: string; sourceTitle: string; lastVerified: string };
  reasons: string[];
  eligibility: { status: "likely" | "possible" | "unlikely" | "unknown"; missingInfo: string[]; missingDocuments: string[]; confidenceReason: string };
};

const copy = {
  en: { title: "Where do you need a path?", intro: "Describe the situation in your own words. RAAHI will find relevant services, explain the next step, and show the source.", placeholder: "For example: I need help with my son's school fee", send: "Find my path", results: "Routes found", source: "Official source", documents: "Bring or prepare", steps: "Next steps", possible: "Possible", likely: "Likely", unlikely: "Unlikely", unknown: "Needs more information", reviewed: "Reviewed" },
  ur: { title: "آپ کو کس راستے کی ضرورت ہے؟", intro: "اپنی صورتحال اپنے الفاظ میں بتائیں۔ راہی متعلقہ خدمات، اگلا قدم اور اصل ذریعہ دکھائے گا۔", placeholder: "مثال: میرے بیٹے کی اسکول فیس کے لیے مدد چاہیے", send: "میرا راستہ تلاش کریں", results: "ملنے والے راستے", source: "سرکاری ذریعہ", documents: "ساتھ رکھیں", steps: "اگلے قدم", possible: "ممکن", likely: "ممکنہ طور پر اہل", unlikely: "امکان کم", unknown: "مزید معلومات درکار", reviewed: "جائزہ" },
  ps: { title: "تاسو کومې لارې ته اړتیا لرئ؟", intro: "خپل حالت په خپلو خبرو کې ولیکئ. راہی به اړوندې خدمتونه، بل ګام او سرچینه در وښيي.", placeholder: "بېلګه: زما د زوی د ښوونځي فیس لپاره مرسته غواړم", send: "زما لاره ومومئ", results: "موندل شوې لارې", source: "رسمي سرچینه", documents: "له ځان سره یې ولرئ", steps: "راتلونکي ګامونه", possible: "ممکن", likely: "احتمالي وړتیا", unlikely: "امکان کم", unknown: "نور معلومات پکار دي", reviewed: "کتل شوی" },
};

function statusLabel(status: Result["eligibility"]["status"], language: Language) {
  return copy[language][status];
}

export default function ChatPage() {
  const [language, setLanguage] = useState<Language>("ur");
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<Profile>({});
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [saved, setSaved] = useState(false);
  const [recording, setRecording] = useState(false);
  const text = copy[language];

  useEffect(() => { const initial = new URLSearchParams(window.location.search).get("need"); if (initial) setQuery(initial); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: query, language, profile }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Something went wrong.");
      setResults(data.results ?? []);
      setMessages((current) => [...current, { role: "user", text: query }, { role: "assistant", text: data.message }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function saveCase() {
    const first = results[0];
    if (!first) return;
    await fetch("/api/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: first.service.name, titleUr: first.service.nameUr, domain: first.service.domain, summary: query, serviceIds: results.map((result) => result.service.id), actions: first.service.procedure.map((step) => ({ label: step.title, labelUr: step.titleUr, serviceId: first.service.id })) }) });
    setSaved(true);
  }

  function startVoice() {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => { lang: string; interimResults: boolean; start: () => void; onresult: (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void; onend: () => void } }).SpeechRecognition;
    if (!SpeechRecognition) { setError("اس براؤزر میں آواز کی سہولت دستیاب نہیں۔ براہ کرم لکھ کر بتائیں۔"); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = language === "en" ? "en-PK" : language === "ps" ? "ps" : "ur-PK";
    recognition.interimResults = false;
    setRecording(true);
    recognition.onresult = (event) => setQuery(event.results[0][0].transcript);
    recognition.onend = () => setRecording(false);
    recognition.start();
  }

  async function uploadDocument(file: File) {
    const reader = new FileReader();
    reader.onload = async () => { const value = String(reader.result); const response = await fetch("/api/ocr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64: value.split(",")[1] ?? value }) }); const data = await response.json(); setMessages((current) => [...current, { role: "assistant", text: data.result ? `دستاویز: ${data.result.documentType} · ${data.result.simulated ? "ڈیمو استخراج، تصدیق ضروری ہے" : "تصدیق شدہ پڑھائی"}` : data.error }]); };
    reader.readAsDataURL(file);
  }

  return (
    <main className="app-shell min-h-screen px-5 py-6" dir={language === "en" ? "ltr" : "rtl"}>
      <header className="flex items-center justify-between border-b border-[var(--line)] pb-5">
        <div><a href="/" className="text-xl font-black text-[var(--forest)]">راہی</a><p className="text-xs text-[var(--muted)]">RAAHI navigator</p></div>
        <div className="flex gap-1 rounded-full border border-[var(--line)] p-1 text-xs">
          {(["ur", "ps", "en"] as Language[]).map((item) => <button key={item} className={`rounded-full px-3 py-1 ${language === item ? "bg-[var(--forest)] text-white" : "text-[var(--muted)]"}`} onClick={() => setLanguage(item)}>{item === "ur" ? "اردو" : item === "ps" ? "پښتو" : "EN"}</button>)}
        </div>
      </header>

      <section className="py-10">
        <p className="mb-3 text-sm font-bold text-[var(--forest)]">01 / RAAHI</p>
        <h1 className="max-w-xl text-3xl font-black leading-[1.45] text-[var(--ink)]">{text.title}</h1>
        <p className="mt-3 max-w-xl leading-7 text-[var(--muted)]">{text.intro}</p>
        <form className="mt-7" onSubmit={submit}>
          <textarea className="min-h-32 w-full resize-y rounded-2xl border border-[var(--line)] bg-[#fbfcfa] p-4 text-base leading-7 outline-none transition focus:border-[var(--forest)] focus:ring-4 focus:ring-emerald-100" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.placeholder} aria-label={text.title} />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button className="rounded-xl bg-[var(--forest)] px-5 py-3 font-bold text-white shadow-lg shadow-emerald-900/10 transition hover:bg-[var(--forest-dark)] disabled:cursor-not-allowed disabled:opacity-50" disabled={loading || query.trim().length < 2}>{loading ? "..." : text.send}</button>
            <button type="button" onClick={startVoice} className={`rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-bold ${recording ? "bg-red-50 text-red-700" : "text-[var(--forest)]"}`}>{recording ? "سن رہا ہوں..." : "🎙 آواز"}</button>
            <label className="rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-bold text-[var(--forest)]">📄 OCR<input className="hidden" type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && uploadDocument(event.target.files[0])} /></label>
            <label className="flex items-center gap-2 text-sm text-[var(--muted)]"><span>صوبہ</span><select className="rounded-lg border border-[var(--line)] bg-white px-2 py-2" value={profile.province ?? ""} onChange={(event) => setProfile({ ...profile, province: event.target.value || undefined })}><option value="">سب</option><option>Punjab</option><option>Khyber Pakhtunkhwa</option><option>Sindh</option><option>Balochistan</option></select></label>
            <label className="flex items-center gap-2 text-sm text-[var(--muted)]"><input type="checkbox" checked={profile.hasCnic ?? false} onChange={(event) => setProfile({ ...profile, hasCnic: event.target.checked })} /> CNIC موجود ہے</label>
          </div>
        </form>
        {messages.length > 0 && <div className="mt-7 space-y-3">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`max-w-[90%] rounded-2xl px-4 py-3 leading-7 ${message.role === "user" ? "ms-auto bg-[var(--forest)] text-white" : "bg-[#eef6ef] text-[var(--ink)]"}`}>{message.text}</div>)}</div>}
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-[var(--danger)]">{error}</p>}
      </section>

      {results.length > 0 && <section className="border-t border-[var(--line)] py-8"><div className="mb-5 flex items-baseline justify-between"><h2 className="text-xl font-black">{text.results}</h2><div className="flex gap-3"><button type="button" onClick={saveCase} className="text-sm font-bold text-[var(--forest)] underline">{saved ? "محفوظ" : "کیس محفوظ کریں"}</button><span className="text-sm text-[var(--muted)]">{results.length}</span></div></div><div className="space-y-5">{results.map((result) => <article className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm" key={result.service.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[var(--forest)]">{result.service.domain}</p><h3 className="mt-1 text-lg font-black">{language === "en" ? result.service.name : language === "ps" ? result.service.namePs : result.service.nameUr}</h3></div><span className={`rounded-full px-3 py-1 text-xs font-bold status-${result.eligibility.status}`}>{statusLabel(result.eligibility.status, language)}</span></div><p className="mt-3 leading-7 text-[var(--muted)]">{language === "en" ? result.service.description : result.service.descriptionUr}</p><p className="mt-3 text-sm font-semibold text-[var(--ink)]">{result.eligibility.confidenceReason}</p>{result.eligibility.missingInfo?.length > 0 && <p className="mt-2 text-sm text-[var(--amber)]">{result.eligibility.missingInfo.join(" ")}</p>}{result.eligibility.missingDocuments?.length > 0 && <div className="mt-4"><p className="text-sm font-bold">{text.documents}</p><p className="mt-1 text-sm text-[var(--muted)]">{result.eligibility.missingDocuments.join(" · ")}</p></div>}<div className="mt-5 border-t border-[var(--line)] pt-4"><p className="text-sm font-bold">{text.steps}</p><ol className="mt-3 space-y-3">{result.service.procedure.map((step) => <li className="flex gap-3 text-sm leading-6" key={step.order}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e7f4eb] text-xs font-bold text-[var(--forest)]">{step.order}</span><span>{language === "en" ? step.description : step.descriptionUr}{step.url && <a className="ms-2 font-bold text-[var(--forest)] underline" href={step.url} target="_blank" rel="noreferrer">{text.source}</a>}</span></li>)}</ol></div><div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]"><Link className="font-bold text-[var(--forest)] underline" href={`/procedure/${result.service.id}`}>تفصیلی طریقہ</Link><a className="font-bold text-[var(--forest)] underline" href={result.citation.sourceUrl} target="_blank" rel="noreferrer">{text.source}: {result.citation.sourceTitle}</a><span>{text.reviewed}: {result.citation.lastVerified}</span></div></article>)}</div></section>}
      <div className="pb-8 text-center"><Link href="/cases" className="text-sm font-bold text-[var(--forest)] underline">میرے کیسز دیکھیں</Link></div>
    </main>
  );
}