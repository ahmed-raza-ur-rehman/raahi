"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLanguage } from "./LanguageProvider";
import { useModules, type ClientModule } from "@/components/shell/ModulesProvider";
import type { Language, Localized } from "@/lib/types";
import { pick } from "@/lib/i18n";

/** The slice of a knowledge hit the palette needs. */
interface KnowledgeResult {
  entityType: string;
  entityId: string;
  title: string;
  summary: string;
  /** The record itself, used to tell one kind of opportunity from another. */
  record?: unknown;
}

/**
 * The command palette: one box that reaches everything.
 *
 * RAAHI has a lot in it, and a person looking for the right screen should not
 * have to know how it is organised. This searches the modules, the knowledge
 * base and the things you can do, and acts on the answer — open, call, or go.
 *
 * It is deliberately simple to look at: one line to type in, a short list of
 * results, and the keyboard works throughout for anyone who cannot easily tap
 * small targets.
 */

interface Action {
  id: string;
  icon: string;
  title: Localized;
  hint?: Localized;
  keywords: Partial<Record<Language, string[]>>;
  run: (context: { router: ReturnType<typeof useRouter>; language: Language }) => void;
}

/** Things you can do, as opposed to places you can go. */
function buildActions(): Action[] {
  return [
    {
      id: "call-rescue",
      icon: "🚨",
      title: { en: "Call Rescue 1122", ur: "ریسکیو 1122 پر کال کریں", ps: "ژغورنې 1122 ته زنګ", hkp: "ریسکیو 1122 تے کال کرو" },
      hint: { en: "Ambulance, fire, rescue", ur: "ایمبولینس، فائر، ریسکیو", ps: "امبولانس، اور وژنه", hkp: "ایمبولینس، فائر، ریسکیو" },
      keywords: { en: ["call", "rescue", "1122", "ambulance", "emergency", "help now"], ur: ["کال", "ریسکیو", "ایمبولینس", "ایمرجنسی"], ps: ["زنګ", "ژغورنه", "ایمبولانس"], hkp: ["کال", "ریسکیو", "ایمبولینس"] },
      run: () => {
        window.location.href = "tel:1122";
      },
    },
    {
      id: "call-police",
      icon: "👮",
      title: { en: "Call Police 15", ur: "پولیس 15 پر کال کریں", ps: "پولیسو 15 ته زنګ", hkp: "پولیس 15 تے کال کرو" },
      keywords: { en: ["police", "15", "crime", "theft", "report"], ur: ["پولیس", "چوری", "جرم"], ps: ["پولیس", "غلا"], hkp: ["پولیس", "چوری"] },
      run: () => {
        window.location.href = "tel:15";
      },
    },
    {
      id: "emergency-screen",
      icon: "🆘",
      title: { en: "All emergency numbers", ur: "تمام ایمرجنسی نمبر", ps: "ټول بېړني نمبرونه", hkp: "سارے ایمرجنسی نمبر" },
      keywords: { en: ["emergency", "numbers", "helpline", "urgent"], ur: ["ایمرجنسی", "نمبر", "ہیلپ لائن"], ps: ["بېړني", "نمبرونه"], hkp: ["ایمرجنسی", "نمبر"] },
      run: ({ router }) => router.push("/emergency"),
    },
    {
      id: "report-mistake",
      icon: "✏️",
      title: { en: "Report a mistake", ur: "غلظی کی اطلاع دیں", ps: "تېروتنه راپور کړئ", hkp: "غلظی دی اطلاع دو" },
      hint: { en: "Wrong fee, date or number", ur: "غلط فیس، تاریخ یا نمبر", ps: "غلطه فیص، نېټه یا نمبر", hkp: "غلط فیس، تاریخ یا نمبر" },
      keywords: { en: ["report", "mistake", "wrong", "correction", "fix", "error"], ur: ["غلظی", "درستی", "رپورٹ", "غلط"], ps: ["تېروتنه", "سمونه"], hkp: ["غلظی", "درستی"] },
      run: ({ router }) => router.push("/kb?tab=correct"),
    },
    {
      id: "my-applications",
      icon: "📂",
      title: { en: "My saved applications", ur: "میری محفوظ درخواستیں", ps: "زما خوندي غوښتنې", hkp: "میریاں محفوظ درخواستاں" },
      keywords: { en: ["saved", "applications", "mine", "progress", "continue"], ur: ["محفوظ", "درخواستیں", "میری"], ps: ["خوندي", "غوښتنې"], hkp: ["محفوظ", "درخواستاں"] },
      run: ({ router }) => router.push("/track"),
    },
    {
      id: "privacy",
      icon: "🔒",
      title: { en: "Privacy — what we keep", ur: "رازداری — ہم کیا رکھتے ہیں", ps: "محرمیت", hkp: "رازداری — اسیں کیا رکھدے آں" },
      keywords: { en: ["privacy", "data", "cnic", "safe", "delete"], ur: ["رازداری", "پرائیویسی", "معلومات"], ps: ["محرمیت", "معلومات"], hkp: ["رازداری"] },
      run: ({ router }) => router.push("/privacy"),
    },
    {
      id: "language-urdu",
      icon: "🇵🇰",
      title: { en: "Switch to Urdu", ur: "اردو میں بدلیں", ps: "اردو ته بدل کړئ", hkp: "اردو وچ بدلو" },
      keywords: { en: ["urdu", "language", "اردو"], ur: ["اردو", "زبان"], ps: ["اردو", "ژبه"], hkp: ["اردو", "زبان"] },
      run: () => window.dispatchEvent(new CustomEvent("raahi:set-language", { detail: "ur" })),
    },
    {
      id: "language-english",
      icon: "🔤",
      title: { en: "Switch to English", ur: "انگریزی میں بدلیں", ps: "انګلیسي ته بدل کړئ", hkp: "انگریزی وچ بدلو" },
      keywords: { en: ["english", "language", "switch"], ur: ["انگریزی", "زبان"], ps: ["انګلیسي", "ژبه"], hkp: ["انگریزی", "زبان"] },
      run: () => window.dispatchEvent(new CustomEvent("raahi:set-language", { detail: "en" })),
    },
  ];
}

interface Result {
  key: string;
  icon: string;
  title: string;
  hint?: string;
  score: number;
  href?: string;
  run?: () => void;
}

/** Case-insensitive, accent-free matching that also handles Roman Urdu. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "") // Arabic diacritics
    .replace(/[\u0622\u0623\u0625\u0627]/g, "ا") // alef variants
    .replace(/[\u06C0\u06D5\u0629]/g, "ه") // teh marbuta / heh
    .replace(/[\u0649\u064A]/g, "ی") // yeh variants
    .replace(/[\u06A9\u0643]/g, "ک") // keheh
    .trim();
}

function scoreMatch(haystack: string[], query: string): number {
  const normalised = normalise(query);
  if (!normalised) return 0;

  let best = 0;
  for (const candidate of haystack) {
    const text = normalise(candidate);
    if (!text) continue;
    if (text === normalised) best = Math.max(best, 100);
    else if (text.startsWith(normalised)) best = Math.max(best, 80);
    else if (text.split(/\s+/).some((word) => word.startsWith(normalised))) best = Math.max(best, 60);
    else if (text.includes(normalised)) best = Math.max(best, 40);
  }
  return best;
}

/**
 * Which module can open this record. A deployment never offers a result it
 * cannot show, and a record that more than one module could open goes to the
 * one that owns its kind.
 */
function ownerFor(hit: KnowledgeResult, modules: ClientModule[]): ClientModule | undefined {
  const claimants = modules.filter((module) => (module.entityTypes ?? []).includes(hit.entityType));
  if (claimants.length <= 1) return claimants[0];
  const kind = recordKind(hit);
  return claimants.find((module) => (module.entityKinds?.[hit.entityType] ?? []).includes(kind)) ?? claimants[0];
}

/** The `kind` a record declares about itself, if it declares one. */
function recordKind(hit: KnowledgeResult): string {
  const record = hit.record as { kind?: unknown } | null | undefined;
  return typeof record?.kind === "string" ? record.kind : "";
}

export default function CommandPalette() {
  const { language, L, setLanguage } = useLanguage();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { modules } = useModules();
  const [hits, setHits] = useState<KnowledgeResult[]>([]);
  const [active, setActive] = useState(0);
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions = useMemo(() => buildActions(), []);

  // Ctrl/Cmd+K, and Escape to close.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setActive(0);
        setOpen((value) => !value);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** Opened from anywhere in the app via a custom event. */
  useEffect(() => {
    const onOpen = () => {
      setActive(0);
      setOpen(true);
    };
    window.addEventListener("raahi:open-palette", onOpen);
    return () => window.removeEventListener("raahi:open-palette", onOpen);
  }, []);

  /** The language switcher inside the palette talks to the provider. */
  useEffect(() => {
    const onLanguage = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail && setLanguage) setLanguage(detail as Language);
      setOpen(false);
    };
    window.addEventListener("raahi:set-language", onLanguage as EventListener);
    return () => window.removeEventListener("raahi:set-language", onLanguage as EventListener);
  }, [setLanguage]);

  // The module list comes from the provider, resolved on the server, so the
  // palette can offer them the moment it opens.

  /**
   * Search the knowledge base as the query changes. Stale results are simply
   * not shown once the query drops below two characters, rather than being
   * cleared from state inside an effect.
   */
  useEffect(() => {
    if (!open || query.trim().length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      // The knowledge base lives in SQLite on the server, so this goes through
      // the API rather than importing the search directly.
      const controller = new AbortController();
      fetch("/api/knowledge/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, limit: 6 }),
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
        .then((payload: { results?: KnowledgeResult[] }) => {
          if (!cancelled) setHits(payload.results ?? []);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        });
      return () => controller.abort();
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open, language]);

  const results = useMemo<Result[]>(() => {
    const trimmed = query.trim();

    const moduleResults: Result[] = modules.map((module) => ({
      key: `module:${module.id}`,
      icon: module.icon,
      title: pick(module.title, language),
      hint: pick(module.blurb, language),
      score: scoreMatch(
        [pick(module.title, "en"), pick(module.title, "ur"), ...(module.keywords.en ?? []), ...(module.keywords.ur ?? []), ...(module.keywords[language] ?? [])],
        trimmed,
      ),
      href: module.href,
    }));

    const actionResults: Result[] = actions.map((action) => ({
      key: `action:${action.id}`,
      icon: action.icon,
      title: pick(action.title, language),
      hint: action.hint ? pick(action.hint, language) : undefined,
      score:
        scoreMatch(
          [pick(action.title, "en"), pick(action.title, "ur"), ...(action.keywords.en ?? []), ...(action.keywords.ur ?? []), ...(action.keywords[language] ?? [])],
          trimmed,
        ) + 5, // actions sit slightly above modules when both match
      run: () => action.run({ router, language }),
    }));

    // Knowledge results are routed by the module that owns their entity type,
    // so a deployment only offers results it can actually open. Where a record
    // can be opened by more than one module — "opportunity" covers both
    // scholarships and jobs — the record's own `kind` decides.
    const knowledgeResults: Result[] = hits.flatMap((hit) => {
      const owner = ownerFor(hit, modules);
      if (!owner) return [];
      return [
        {
          key: `kb:${hit.entityType}:${hit.entityId}`,
          icon: "📚",
          title: hit.title,
          hint: hit.summary,
          score: 45,
          // Open the record itself when the module has a detail page, so one
          // keypress lands on the scholarship rather than on the list of all of
          // them.
          href: owner.detail ? owner.detail.replace("[id]", hit.entityId) : owner.href,
        },
      ];
    });

    const all = [...actionResults, ...moduleResults];
    if (trimmed.length >= 2) all.push(...knowledgeResults);

    return all
      .filter((result) => (trimmed.length === 0 ? true : result.score >= 35))
      .sort((left, right) => right.score - left.score)
      .slice(0, 12);
  }, [actions, hits, language, modules, query, router]);

  // Clamp while rendering rather than resetting in an effect: the list shrinks
  // as the query changes, and an index that no longer exists would do nothing
  // on Enter.
  const activeIndex = results.length === 0 ? 0 : Math.min(active, results.length - 1);

  // Focus after the dialog is in the DOM, and stop the page behind it from
  // scrolling. The query is kept when the palette closes, so reopening shows
  // what you last looked for.
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputRef.current?.focus());
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const choose = useCallback(
    (result: Result) => {
      setOpen(false);
      if (result.run) result.run();
      else if (result.href) router.push(result.href);
    },
    [router],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => (results.length === 0 ? 0 : (value + 1) % results.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) => (results.length === 0 ? 0 : (value - 1 + results.length) % results.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const result = results[activeIndex];
      if (result) choose(result);
    }
  };

  /** Speak instead of typing, for someone who cannot comfortably type Urdu. */
  const startListening = () => {
    const SpeechRecognition =
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition ??
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = language === "en" ? "en-PK" : language === "ps" ? "ps-AF" : "ur-PK";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setListening(true);

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      if (transcript) setQuery(transcript);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  if (!open) return null;

  const placeholder =
    language === "en"
      ? "Search, or type what you need…"
      : language === "ps"
      ? "ولټوئ، یا خپله اړتیا ولیکئ…"
      : "تلاش کریں، یا اپنی ضرورت لکھیں…";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-3 pt-[8vh]"
      role="dialog"
      aria-modal="true"
      aria-label={language === "en" ? "Search everything" : "ہر چیز تلاش کریں"}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-2.5">
          <span aria-hidden="true" className="text-base">
            🔎
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label={language === "en" ? "Search everything" : "ہر چیز تلاش کریں"}
            className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:text-[var(--muted-light)]"
          />
          <button
            type="button"
            onClick={startListening}
            aria-label={language === "en" ? "Speak your search" : "بول کر تلاش کریں"}
            className={`rounded-lg border px-2 py-1 text-sm transition ${
              listening ? "border-rose-300 bg-rose-50" : "border-[var(--line)] hover:border-[var(--forest)]"
            }`}
          >
            {listening ? "🔴" : "🎙️"}
          </button>
          <kbd className="hidden rounded border border-[var(--line)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--muted-light)] sm:block">
            Esc
          </kbd>
        </div>

        <ul className="max-h-[52vh] overflow-y-auto">
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center text-[12.5px] text-[var(--muted)]">
              {query.trim().length < 2
                ? language === "en"
                  ? "Start typing, or pick one of these."
                  : "لکھنا شروع کریں، یا ان میں سے کوئی منتخب کریں۔"
                : language === "en"
                ? "Nothing found. Try fewer words, or ask on the Ask screen."
                : "کچھ نہیں ملا۔ کم الفاظ آزمائیں، یا پوچھیں والے صفحے پر سوال کریں۔"}
            </li>
          ) : (
            results.map((result, index) => (
              <li key={result.key}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(result)}
                  className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-start transition ${
                    index === activeIndex ? "bg-[var(--forest-light)]" : "hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <span aria-hidden="true" className="mt-0.5 text-base leading-none">
                    {result.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-extrabold">{result.title}</span>
                    {result.hint ? (
                      <span className="mt-0.5 block line-clamp-2 text-[11.5px] leading-snug text-[var(--muted)]">
                        {L({ en: result.hint } as Localized)}
                      </span>
                    ) : null}
                  </span>
                  <span aria-hidden="true" className="mt-0.5 text-[11px] text-[var(--muted-light)]">
                    ↵
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-[10px] font-semibold text-[var(--muted-light)]">
          <span>↑ ↓ {language === "en" ? "to move" : "منتقل ہوں"}</span>
          <span>
            {language === "en" ? "Press" : "دبائیں"} Ctrl+K {language === "en" ? "anytime" : "کسی بھی وقت"}
          </span>
        </div>
      </div>
    </div>
  );
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  results?: { 0?: { transcript?: string } }[];
}
