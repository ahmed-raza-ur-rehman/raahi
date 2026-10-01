import { getDashScopeClient, isDashScopeConfigured } from "./client";
import { SPEECH_TAGS } from "./speech-tags";
import { withProvider } from "./resilience";
import type { Language } from "@/lib/types";

export interface TranscriptionResult {
  text: string;
  language: Language;
  provider: "dashscope" | "unavailable";
  note?: string;
}

/** BCP-47 / platform tags for browser speech engines. */
// Re-exported so server code keeps its existing import. The definition lives
// in ./speech-tags, which has no SDK import, so client components can use it
// without pulling the model library into the browser bundle.
export { SPEECH_TAGS, isRtlLanguage } from "./speech-tags";

/**
 * Speech-to-text. Uses DashScope SenseVoice when configured; otherwise returns
 * an explicit "unavailable" marker so the UI can switch to the browser's own
 * Web Speech API instead of pretending to have heard something.
 */
export async function transcribeAudio(
  audio: Buffer,
  language: Language = "ur",
): Promise<TranscriptionResult> {
  if (!audio || audio.length === 0) {
    return { text: "", language, provider: "unavailable", note: "No audio was received." };
  }

  // Plan B: an honest "unavailable", so the UI hands over to the browser's own
  // Web Speech API rather than inventing a transcript.
  const unavailable = (): TranscriptionResult => ({
    text: "",
    language,
    provider: "unavailable",
    note: "Server-side speech recognition is not available right now. Use the browser microphone button to dictate.",
  });

  if (!isDashScopeConfigured()) return unavailable();

  const text = await withProvider<string | undefined>("dashscope-audio", {
    timeoutMs: 12_000,
    label: "transcribe",
    call: async () => {
      const client = getDashScopeClient();
      const file = new File([new Uint8Array(audio)], "audio.wav", { type: "audio/wav" });
      const response = await client?.audio.transcriptions.create({
        file,
        model: "sensevoice-v1",
        language: language === "ps" ? "ps" : language === "en" ? "en" : "ur",
      } as never);
      return (response as unknown as { text?: string })?.text?.trim() ?? undefined;
    },
    fallback: () => undefined,
  });

  if (text) return { text, language, provider: "dashscope" };
  return unavailable();
}

/**
 * Text-to-speech. Returns audio when a provider is configured, otherwise a plan
 * the browser executes with its own speech synthesis engine.
 */
export async function synthesizeSpeech(text: string, language: Language = "ur") {
  // Plan B: hand the browser a speaking plan it executes itself. The citizen
  // still hears the answer, just from their own device instead of the server.
  const browserPlan = () => ({
    audioBase64: null,
    provider: "browser" as const,
    language,
    voiceTag: SPEECH_TAGS[language].tts,
    rate: 0.95,
    pitch: 1,
  });

  if (!isDashScopeConfigured()) return browserPlan();

  const audio = await withProvider<string | undefined>("dashscope-audio", {
    timeoutMs: 12_000,
    label: "synthesize",
    call: async () => {
      const client = getDashScopeClient();
      const response = await client?.audio.speech.create({
        model: "qwen-tts",
        voice: language === "en" ? "Chelsie" : "Serena",
        input: text.slice(0, 1500),
      } as never);
      // The OpenAI-compatible SDK returns an ArrayBuffer-ish response.
      const maybeArrayBuffer = (response as unknown as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer;
      if (typeof maybeArrayBuffer !== "function") return undefined;
      const buffer = Buffer.from(await maybeArrayBuffer.call(response));
      return buffer.length > 0 ? buffer.toString("base64") : undefined;
    },
    fallback: () => undefined,
  });

  if (audio) return { audioBase64: audio, provider: "dashscope" as const, language };
  return browserPlan();
}

/**
 * Deterministic intent router used when no LLM is available, and as a fast
 * first-pass classifier even when one is: it is far cheaper than a model call.
 */
export type VoiceIntent =
  | "scholarship"
  | "documents"
  | "tests"
  | "dates"
  | "jobs"
  | "health"
  | "blood"
  | "disaster"
  | "legal"
  | "aid"
  | "contacts"
  | "general";

const INTENT_PATTERNS: { intent: VoiceIntent; pattern: RegExp }[] = [
  { intent: "blood", pattern: /blood|خون|وینه|donor|عطیہ/ },
  { intent: "disaster", pattern: /flood|earthquake|relief|سیلاب|زلزلہ|ریلیف|آفت|سېلاب|طوفان/ },
  { intent: "legal", pattern: /lawyer|court|legal|وکیل|عدالت|قانونی|محکمه|police|ایف آئی آر|thana/ },
  { intent: "health", pattern: /doctor|hospital|ill|fever|disease|camp|علاج|ہسپتال|ڈاکٹر|بیمار|بخار|روغتون/ },
  { intent: "scholarship", pattern: /scholarship|scot|wazeefa|بورس|وظیفہ|تعلیمی|scholar/ },
  { intent: "tests", pattern: /ielts|toefl|test|mdcat|ecat|css|ٹیسٹ|امتحان|آئیلٹس|تیاری/ },
  { intent: "dates", pattern: /date|deadline|calendar|تاریخ|آخری تاریخ|کیلنڈر/ },
  { intent: "jobs", pattern: /job|internship|employment|naukri|نوکری|روزگار|انٹرنشپ|دنده/ },
  { intent: "documents", pattern: /cnic|domicile|certificate|passport|شناختی|ڈومیسائل|سرٹیفکیٹ|دستاویز|سند|attest/ },
  { intent: "aid", pattern: /bisp|8171|bait|zakat|kafalat|کفالت|زکوٰۃ|بیت المال|امداد|financial help/ },
  { intent: "contacts", pattern: /number|helpline|contact|call|نمبر|ہیلپ لائن|رابطہ|فون/ },
];

export function detectIntent(text: string, language?: Language): VoiceIntent {
  const value = text.toLowerCase();
  for (const { intent, pattern } of INTENT_PATTERNS) {
    if (pattern.test(value)) return intent;
  }
  if (language === "en") return "general";
  return "general";
}

export const INTENT_TO_MODULE: Record<VoiceIntent, { route: string; type: string }> = {
  scholarship: { route: "/scholarships", type: "opportunity" },
  documents: { route: "/documents", type: "document" },
  tests: { route: "/tests", type: "test" },
  dates: { route: "/dates", type: "opportunity" },
  jobs: { route: "/opportunities", type: "opportunity" },
  health: { route: "/health", type: "camp" },
  blood: { route: "/blood", type: "blood_bank" },
  disaster: { route: "/disaster", type: "disaster_channel" },
  legal: { route: "/legal", type: "legal_topic" },
  aid: { route: "/programs", type: "service" },
  contacts: { route: "/contacts", type: "contact" },
  general: { route: "/ask", type: "service" },
};
