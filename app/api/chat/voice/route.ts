import { NextResponse } from "next/server";
import { getDashScopeClient, isDashScopeConfigured } from "@/lib/ai/client";
import { guardLegacy, type LegacyLimit } from "@/lib/platform/legacy";
import { getLogger } from "@/lib/platform/log";

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const LANGUAGES = ["en", "ur", "ps"] as const;
type VoiceLanguage = (typeof LANGUAGES)[number];

const limits: LegacyLimit[] = [
  { policy: "ocr", by: "session" },
  { policy: "ocr", by: "ip" },
];

const language = (value: unknown): VoiceLanguage => (LANGUAGES as readonly unknown[]).includes(value) ? (value as VoiceLanguage) : "ur";

/**
 * Speech to text. It never invents a transcript: if no transcription provider is configured, or the provider fails,
 * the caller gets an honest error and the UI asks the person to type instead. (An earlier version returned a canned
 * sentence as if the person had said it.)
 */
export const POST = guardLegacy(
  async (request) => {
    let lang: VoiceLanguage = "ur";
    let audio: Buffer | undefined;
    try {
      if ((request.headers.get("content-type") || "").includes("multipart/form-data")) {
        const form = await request.formData();
        lang = language(form.get("language"));
        const file = form.get("audio");
        if (file instanceof File) {
          if (file.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: "That recording is too long." }, { status: 413 });
          audio = Buffer.from(await file.arrayBuffer());
        }
      } else {
        const body = (await request.json().catch(() => ({}))) as { language?: unknown; audioBase64?: unknown };
        lang = language(body.language);
        if (typeof body.audioBase64 === "string") {
          if (body.audioBase64.length > Math.ceil((MAX_AUDIO_BYTES * 4) / 3) + 4) return NextResponse.json({ error: "That recording is too long." }, { status: 413 });
          audio = Buffer.from(body.audioBase64, "base64");
        }
      }
    } catch {
      return NextResponse.json({ error: "The recording could not be read." }, { status: 400 });
    }

    if (!audio || audio.length === 0) return NextResponse.json({ error: "No audio data provided." }, { status: 400 });

    const client = isDashScopeConfigured() ? getDashScopeClient() : undefined;
    if (!client) {
      return NextResponse.json({ error: "Voice input is not available right now. Please type your question.", code: "not_configured" }, { status: 503 });
    }

    try {
      const response = await client.audio.transcriptions.create({
        file: new File([new Uint8Array(audio)], "audio.wav", { type: "audio/wav" }),
        model: "sensevoice-v1",
        language: lang,
      });
      if (response?.text) return NextResponse.json({ text: response.text, language: lang, provider: "dashscope" });
    } catch (error) {
      getLogger().warn("voice transcription failed", { error });
    }
    return NextResponse.json({ error: "We could not understand that recording. Please try again or type your question." }, { status: 502 });
  },
  { name: "voice", limits, maxBodyBytes: 6_500_000 },
);
