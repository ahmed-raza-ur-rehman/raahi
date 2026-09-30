"use client";

import React from "react";
import { ServiceCard, type ServiceCardProps } from "./ServiceCard";

export type ServiceSummary = ServiceCardProps["service"];
import { ActionPlan, ActionItem } from "./ActionPlan";
import { CitationChip } from "./CitationChip";

export interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
  activeTool?: string | null;
  services?: ServiceSummary[];
  actionItems?: ActionItem[];
  citations?: { sourceUrl: string; sourceTitle: string; authorityTier?: number; lastVerified?: string }[];
  language?: "en" | "ur" | "ps";
  onAddToCase?: (serviceId: string) => void;
  addedServiceIds?: string[];
  createdAt?: string;
}

// Simple parser to format markdown bold, lists, and linebreaks
function renderFormattedContent(text: string) {
  if (!text) return null;

  // Split into lines
  const lines = text.split("\n");

  return lines.map((line, idx) => {
    // Check if line is a numbered item e.g. "1. "
    const isNumbered = /^\d+\.\s/.test(line);
    // Check if line is a bullet item e.g. "- " or "* "
    const isBullet = /^[-*]\s/.test(line);

    // Replace bold **text**
    const parts = line.split(/(\*\*.*?\*\*)/g);
    const formattedLine = parts.map((part, pIdx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={pIdx} className="font-extrabold text-[var(--ink)]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });

    if (isNumbered || isBullet) {
      return (
        <div key={idx} className="flex items-start gap-2 my-1 ps-2">
          <span className="text-[var(--forest)] font-bold text-xs shrink-0 mt-1">
            {isNumbered ? line.match(/^\d+\./)?.[0] : "•"}
          </span>
          <span className="flex-1">
            {isNumbered ? formattedLine.slice(1) : formattedLine}
          </span>
        </div>
      );
    }

    if (line.trim() === "") {
      return <div key={idx} className="h-2" />;
    }

    return (
      <p key={idx} className="my-1">
        {formattedLine}
      </p>
    );
  });
}

export function MessageBubble({
  role,
  content,
  streaming = false,
  activeTool,
  services = [],
  actionItems = [],
  citations = [],
  language = "ur",
  onAddToCase,
  addedServiceIds = [],
}: MessageBubbleProps) {
  const isUser = role === "user";
  const [isSpeaking, setIsSpeaking] = React.useState(false);

  const toggleSpeech = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = content
      .replace(/[*_#`[\]()]/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices();
    const urduVoice = voices.find(
      (v) =>
        v.lang.startsWith("ur") ||
        v.lang.startsWith("hi") ||
        v.name.toLowerCase().includes("urdu")
    );

    if (urduVoice) {
      utterance.voice = urduVoice;
      utterance.lang = urduVoice.lang;
    } else {
      utterance.lang = language === "en" ? "en-US" : "ur-PK";
    }

    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const toolLabels: Record<string, { en: string; ur: string }> = {
    search_knowledge: {
      en: "Searching verified knowledge base...",
      ur: "تصدیق شدہ معلومات میں تلاش جاری ہے...",
    },
    check_eligibility: {
      en: "Evaluating eligibility requirements...",
      ur: "اہلیت کے معیار کا جائزہ لیا جا رہا ہے...",
    },
    create_case: {
      en: "Creating navigation case...",
      ur: "رہنمائی کیس تیار کیا جا رہا ہے...",
    },
    extract_profile: {
      en: "Updating citizen profile...",
      ur: "شہری پروفائل اپ ڈیٹ کی جا رہی ہے...",
    },
  };

  return (
    <div
      className={`msg-enter flex flex-col my-3 ${
        isUser ? "items-end" : "items-start"
      }`}
    >
      {/* Sender indicator */}
      <div className="flex items-center gap-1.5 mb-1 px-1 text-xs text-[var(--muted)] font-medium">
        <span>{isUser ? "👤" : "🏛️"}</span>
        <span>
          {isUser
            ? language === "en"
              ? "You"
              : "آپ"
            : language === "en"
            ? "RAAHI Navigator"
            : "راہی راہنما"}
        </span>
      </div>

      {/* Message content bubble */}
      <div
        className={`max-w-[95%] sm:max-w-[85%] rounded-2xl p-4 sm:p-5 leading-relaxed text-sm sm:text-base shadow-sm ${
          isUser
            ? "bubble-user text-white"
            : "bubble-assistant bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)]"
        }`}
      >
        {/* Active Tool Badge (during streaming) */}
        {activeTool && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-100/70 px-3 py-1.5 text-xs font-bold text-emerald-900 border border-emerald-300/60 animate-pulse">
            <span className="animate-spin">⚙️</span>
            <span>
              {toolLabels[activeTool]?.[language === "en" ? "en" : "ur"] ||
                `Tool: ${activeTool}...`}
            </span>
          </div>
        )}

        {/* Content */}
        <div
          className={`space-y-1 ${
            streaming && !content ? "text-[var(--muted)] italic" : ""
          } ${streaming ? "streaming-cursor" : ""}`}
        >
          {content ? (
            renderFormattedContent(content)
          ) : streaming ? (
            <span>
              {language === "en"
                ? "Connecting with verified resources..."
                : "راہی متعلقہ معلومات اور طریقہ کار تیار کر رہا ہے..."}
            </span>
          ) : null}
        </div>

        {/* Inline Citations */}
        {citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--line-soft)] pt-2.5">
            <span className="text-xs text-[var(--muted)] font-semibold me-1 self-center">
              {language === "en" ? "Sources:" : "ذرائع:"}
            </span>
            {citations.map((c, idx) => (
              <CitationChip
                key={idx}
                sourceUrl={c.sourceUrl}
                sourceTitle={c.sourceTitle}
                authorityTier={c.authorityTier}
                lastVerified={c.lastVerified}
                compact
              />
            ))}
          </div>
        )}

        {/* Audio Listen Button for Accessibility (Phase 9 Voice TTS) */}
        {!isUser && !streaming && content && (
          <div className="mt-3 flex items-center justify-between border-t border-[var(--line-soft)] pt-2 text-xs">
            <button
              type="button"
              onClick={toggleSpeech}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                isSpeaking
                  ? "border-emerald-400 bg-emerald-100 text-emerald-900 animate-pulse"
                  : "border-[var(--line)] bg-white text-[var(--forest)] hover:bg-[var(--forest-light)]"
              }`}
            >
              <span>{isSpeaking ? "⏹️" : "🔊"}</span>
              <span>
                {isSpeaking
                  ? language === "en"
                    ? "Stop Audio"
                    : "آواز روکیں"
                  : language === "en"
                  ? "Listen"
                  : "آواز سنیں"}
              </span>
            </button>

            <span className="text-[10px] text-[var(--muted)] font-mono">
              RAAHI Verified
            </span>
          </div>
        )}
      </div>

      {/* Attached Services Cards */}
      {services.length > 0 && (
        <div className="mt-4 w-full space-y-4 ps-1 sm:ps-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--forest)] flex items-center gap-1.5">
            <span>✨</span>
            <span>
              {language === "en"
                ? `Recommended Public Programs (${services.length})`
                : `تجویز کردہ تصدیق شدہ فلاحی و حکومتی پروگرامز (${services.length})`}
            </span>
          </p>

          <div className="grid grid-cols-1 gap-4">
            {services.map((svc) => (
              <ServiceCard
                key={svc.id}
                service={svc}
                eligibility={svc.eligibility}
                language={language}
                onAddToCase={onAddToCase}
                isAddedToCase={addedServiceIds.includes(svc.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Attached Action Plan */}
      {actionItems.length > 0 && (
        <div className="mt-4 w-full ps-1 sm:ps-4">
          <ActionPlan
            items={actionItems}
            language={language}
            onSaveToCase={
              onAddToCase && services[0]
                ? () => onAddToCase(services[0].id)
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
