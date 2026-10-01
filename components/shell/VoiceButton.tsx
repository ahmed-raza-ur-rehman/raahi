"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { useLanguage } from "./LanguageProvider";
import { SPEECH_TAGS } from "@/lib/ai/speech-tags";
import type { Language } from "@/lib/types";
import { recognitionConstructor, type SpeechRecognitionLike } from "@/lib/client/speech";

/** Big microphone button: speaks → text, and reads answers aloud. */
export function VoiceButton({
  onTranscript,
  size = "md",
  label,
}: {
  onTranscript: (text: string) => void;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const { language, t } = useLanguage();
  const [listening, setListening] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setListening(false);
  }, []);

  /** Fallback path: record, upload, and let the server transcribe. */
  const recordAndTranscribe = useCallback(
    async (lang: Language) => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        chunksRef.current = [];
        recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
        recorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const buffer = await blob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer).slice(0, 3_000_000)));
          try {
            const response = await fetch("/api/voice/transcribe", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ audioBase64: base64, language: lang }),
            });
            const data = (await response.json()) as { text?: string };
            if (data.text) onTranscript(data.text);
          } catch {
            /* silent: the user can type instead */
          }
        };
        mediaRecorderRef.current = recorder;
        recorder.start();
        window.setTimeout(() => {
          if (recorder.state !== "inactive") recorder.stop();
        }, 8000);
      } catch {
        setUnsupported(true);
      }
    },
    [onTranscript],
  );

  const startListening = useCallback(() => {
    const Recognition = recognitionConstructor();
    transcriptRef.current = "";

    if (!Recognition) {
      setUnsupported(true);
      void recordAndTranscribe(language);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = SPEECH_TAGS[language].speech;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result?.[0]?.transcript) transcript += result[0].transcript;
      }
      transcriptRef.current = transcript;
      if (transcript.trim()) onTranscript(transcript.trim());
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [language, onTranscript, recordAndTranscribe]);

  const sizes = {
    sm: "h-10 w-10 text-lg",
    md: "h-14 w-14 text-2xl",
    lg: "h-20 w-20 text-4xl",
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-label={listening ? t("tapToStop") : label ?? t("speakNow")}
        onClick={listening ? stopListening : startListening}
        className={`${sizes[size]} flex items-center justify-center rounded-full shadow-lg transition active:scale-95 ${
          listening
            ? "bg-rose-600 text-white ring-4 ring-rose-200 animate-pulse"
            : "bg-[var(--forest)] text-white ring-4 ring-emerald-100 hover:bg-[var(--forest-dark)]"
        }`}
      >
        {listening ? "⏹" : "🎙️"}
      </button>
      <span className="text-[10.5px] font-bold text-[var(--muted)]">
        {listening ? t("listening") : label ?? t("speakNow")}
      </span>
      {unsupported ? <span className="max-w-[190px] text-center text-[10px] text-[var(--muted)]">{t("listeningNotSupported")}</span> : null}
    </div>
  );
}

/** Reads any text aloud in the user's language, in the browser. */
export function useSpeak() {
  const { language } = useLanguage();
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback(
    (text: string, lang?: Language) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 2000));
      utterance.lang = SPEECH_TAGS[lang ?? language].tts;
      utterance.rate = 0.95;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      synth.speak(utterance);
    },
    [language],
  );

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return { speak, stop, speaking };
}

export function SpeakButton({ text }: { text: string }) {
  const { t } = useLanguage();
  const { speak, stop, speaking } = useSpeak();
  if (!text.trim()) return null;
  return (
    <button
      type="button"
      onClick={() => (speaking ? stop() : speak(text))}
      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 py-1.5 text-[12px] font-bold text-[var(--forest)] hover:bg-[var(--forest-light)]"
    >
      🔊 {speaking ? t("stopAudio") : t("readAloud")}
    </button>
  );
}
