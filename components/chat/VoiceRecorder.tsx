"use client";

import React, { useState, useRef, useEffect } from "react";

import {
  recognitionConstructor,
  speechLanguageTag,
  type SpeechRecognitionErrorEventLike,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionLike,
} from "@/lib/client/speech";

interface VoiceRecorderProps {
  language: "en" | "ur" | "ps";
  onTranscript: (transcript: string) => void;
  disabled?: boolean;
}

export function VoiceRecorder({
  language,
  onTranscript,
  disabled = false,
}: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Stop recording on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    setError(null);

    // 1. Try Browser SpeechRecognition first
    const SpeechRecognition = recognitionConstructor();

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = speechLanguageTag(language);
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onstart = () => {
          setRecording(true);
        };

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
          const text = Array.from(event.results)
            .map((result) => result[0].transcript)
            .join("");
          if (event.results[0].isFinal) {
            onTranscript(text);
            setRecording(false);
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
          console.warn("Speech recognition error, trying media recorder fallback", event.error);
          fallbackAudioCapture();
        };

        recognition.onend = () => {
          setRecording(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        return;
      } catch (e) {
        console.warn("SpeechRecognition init failed, falling back to MediaRecorder", e);
      }
    }

    fallbackAudioCapture();
  };

  const fallbackAudioCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setRecording(false);
        setProcessing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        stream.getTracks().forEach((track) => track.stop());

        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "speech.wav");
          formData.append("language", language);

          const res = await fetch("/api/chat/voice", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          if (data.text) {
            onTranscript(data.text);
          } else {
            setError(data.error || "Could not recognize audio.");
          }
        } catch {
          setError("Failed to process voice input.");
        } finally {
          setProcessing(false);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      setError(
        language === "en"
          ? "Microphone access denied. Please type your message."
          : "مائیکروفون کی اجازت نہیں ملی۔ براہ کرم لکھ کر بتائیں۔"
      );
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={recording ? stopRecording : startRecording}
        disabled={disabled || processing}
        title={
          recording
            ? language === "en"
              ? "Stop listening"
              : "آواز روکیں"
            : language === "en"
            ? "Speak with voice"
            : "بول کر بتائیں"
        }
        className={`relative flex items-center justify-center rounded-xl p-3 text-sm font-bold transition ${
          recording
            ? "recording-active text-white"
            : processing
            ? "bg-slate-100 text-[var(--muted)] animate-pulse"
            : "border border-[var(--line)] bg-white text-[var(--forest)] hover:border-[var(--forest)] hover:bg-[var(--forest-light)]"
        }`}
      >
        {recording ? (
          <div className="flex items-center gap-1.5 px-1">
            <span className="h-2 w-2 rounded-full bg-white animate-ping" />
            <span className="text-xs font-bold">
              {language === "en" ? "Listening..." : "سن رہا ہوں..."}
            </span>
          </div>
        ) : processing ? (
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-xs">⏳</span>
            <span className="text-xs">
              {language === "en" ? "Transcribing..." : "پڑھ رہا ہوں..."}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-base">🎙️</span>
            <span className="hidden sm:inline text-xs">
              {language === "en" ? "Voice" : language === "ps" ? "غږ" : "آواز"}
            </span>
          </div>
        )}
      </button>

      {error && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 rounded-lg bg-rose-600 px-2 py-1 text-center text-[11px] text-white shadow-md z-50">
          {error}
        </div>
      )}
    </div>
  );
}
