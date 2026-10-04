"use client";

import React, { useState, useEffect, useRef, FormEvent } from "react";
import Link from "next/link";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { VoiceRecorder } from "@/components/chat/VoiceRecorder";
import { EmergencyBanner } from "@/components/common/EmergencyBanner";
import FewClickNavigator from "@/components/navigator/FewClickNavigator";

type Language = "en" | "ur" | "ps";

interface MessageState {
  id: string;
  role: "user" | "assistant";
  content: string;
  services?: any[];
  actionItems?: any[];
  activeTool?: string | null;
  streaming?: boolean;
  citations?: any[];
}

const UI_TEXT = {
  en: {
    appName: "RAAHI",
    tagline: "AI Citizen Navigation Assistant for Pakistan",
    home: "Home",
    cases: "My Cases",
    emergency: "Emergency",
    placeholder: "Ask about government welfare, scholarships, healthcare, NADRA CNIC, legal aid...",
    send: "Send",
    thinking: "RAAHI is consulting verified knowledge...",
    emergencyAlert: "Emergency Helpline Activated",
    suggestions: [
      "BISP Kafalat registration & eligibility",
      "Ehsaas Rashan Riayat subsidy",
      "HEC Need-Based Undergraduate Scholarship",
      "Lost or expired CNIC renewal procedure",
      "Free dialysis & medical assistance",
    ],
    province: "Province",
    allProvinces: "All Provinces",
    hasCnic: "Has CNIC",
    bispBeneficiary: "BISP Beneficiary",
    clearChat: "New Conversation",
  },
  ur: {
    appName: "راہی",
    tagline: "پاکستانی شہریوں کے لیے سرکاری و فلاحی رہنمائی کا نظام",
    home: "ہوم",
    cases: "میرے کیسز",
    emergency: "ہنگامی مدد",
    placeholder: "احساس راشن، بے نظیر کفالت، صحت کارڈ، نادرا شناختی کارڈ، یا تعلیمی وظائف کے بارے میں پوچھیں...",
    send: "رہنمائی حاصل کریں",
    thinking: "راہی تصدیق شدہ قواعد اور ذرائع کی جانچ کر رہا ہے...",
    emergencyAlert: "ہنگامی صورتحال کے لیے فوری نمبرز",
    suggestions: [
      "بے نظیر کفالت پروگرام میں رجسٹریشن کیسے کروائیں؟",
      "احساس راشن پروگرام کے لیے اہلیت",
      "نادرا گمشدہ شناختی کارڈ کی تجدید کا طریقہ",
      "مفت علاج اور ڈائیلاسز فنڈ کی معلومات",
      "طلبہ کے لیے سرکاری اسکالرشپ",
    ],
    province: "صوبہ",
    allProvinces: "تمام صوبے",
    hasCnic: "شناختی کارڈ موجود ہے",
    bispBeneficiary: "بے نظیر کفالت میں رجسٹرڈ",
    clearChat: "نئی گفتگو",
  },
  ps: {
    appName: "راہی",
    tagline: "د پاکستان د خلکو لپاره د حکومت او خيريه لارښود سیسټم",
    home: "کور",
    cases: "زما قضیې",
    emergency: "بیړنۍ مرسته",
    placeholder: "د راشن، بی آی ایس پی، صحت کارډ، نادرا پیژندپاڼه یا تعلیمي مرستو په اړه وپوښتئ...",
    send: "لارښوونه ترلاسه کړئ",
    thinking: "راہی تایید شوې معلومات پلټي...",
    emergencyAlert: "د بیړني حالت شمیرې",
    suggestions: [
      "د بې نظیر کفالت پروګرام کې د نوم لیکنې طریقه",
      "د احسان راشن مرستې ترلاسه کولو شرایط",
      "د نادرا ورک شوي پيژندپاڼې نوي کول",
      "د زده کونکو لپاره د سکالرشپ معلومات",
    ],
    province: "ولایت",
    allProvinces: "ټول ولایتونه",
    hasCnic: "پيژندپاڼه لرم",
    bispBeneficiary: "بی آی ایس پی ګټه اخیستونکی",
    clearChat: "نوې خبرې",
  },
};

export default function ChatPage() {
  const [language, setLanguage] = useState<Language>("ur");
  const [inputQuery, setInputQuery] = useState("");
  const [messages, setMessages] = useState<MessageState[]>([]);
  const [loading, setLoading] = useState(false);
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [conversationId, setConversationId] = useState<string>("");
  const [province, setProvince] = useState<string>("");
  const [hasCnic, setHasCnic] = useState<boolean>(true);
  const [isBisp, setIsBisp] = useState<boolean>(false);
  const [savedCaseIds, setSavedCaseIds] = useState<string[]>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const [entryMode, setEntryMode] = useState<"navigator" | "suggestions">("navigator");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const t = UI_TEXT[language];

  const changeLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    document.cookie = `raahi-language=${nextLanguage}; max-age=31536000; path=/; SameSite=Lax`;
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel("raahi-preferences");
      channel.postMessage({ language: nextLanguage });
      channel.close();
    }
  };

  // Restore the shared language preference so every entry point uses one UI language.
  useEffect(() => {
    const saved = document.cookie.match(/(?:^|; )raahi-language=([^;]+)/)?.[1] as Language | undefined;
    if (saved && ["en", "ur", "ps"].includes(saved)) setLanguage(saved);

    const channel = "BroadcastChannel" in window ? new BroadcastChannel("raahi-preferences") : null;
    const onPreference = (event: MessageEvent<{ language?: Language }>) => {
      if (event.data.language && ["en", "ur", "ps"].includes(event.data.language)) setLanguage(event.data.language);
    };
    channel?.addEventListener("message", onPreference);

    return () => {
      channel?.removeEventListener("message", onPreference);
      channel?.close();
    };
  }, []);

  // Initialize session & load initial need from URL query
  useEffect(() => {
    let sid = localStorage.getItem("raahi_session_id");
    if (!sid) {
      sid = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem("raahi_session_id", sid);
    }
    setSessionId(sid);

    const savedConv = localStorage.getItem("raahi_conv_id");
    if (savedConv) {
      setConversationId(savedConv);
    }

    const initialNeed = new URLSearchParams(window.location.search).get("need");
    if (initialNeed) {
      setInputQuery(initialNeed);
    }
  }, []);

  // Auto scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleNewChat = () => {
    const newConvId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setConversationId(newConvId);
    localStorage.setItem("raahi_conv_id", newConvId);
    setMessages([]);
    setEmergencyActive(false);
    showToast(language === "en" ? "New conversation started" : "نئی گفتگو شروع کی گئی");
  };

  const handleSaveToCase = async (serviceId: string) => {
    try {
      // Find service in existing messages
      let targetService: any = null;
      for (const m of messages) {
        if (m.services) {
          const found = m.services.find((s) => s.id === serviceId);
          if (found) {
            targetService = found;
            break;
          }
        }
      }

      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          title: targetService?.name || "Navigation Case",
          titleUr: targetService?.nameUr || targetService?.name || "شہری رہنمائی کیس",
          domain: targetService?.domain || "welfare",
          summary: inputQuery || targetService?.description || "User navigation query",
          serviceIds: [serviceId],
          actions: targetService?.procedure?.map((p: any) => ({
            label: p.title,
            labelUr: p.titleUr,
            serviceId,
          })) || [],
        }),
      });

      const data = await res.json();
      if (data.id) {
        setSavedCaseIds((prev) => [...prev, serviceId]);
        showToast(
          language === "en"
            ? "Case saved to 'My Cases'!"
            : "کیس کامیابی سے 'میرے کیسز' میں شامل کر دیا گیا"
        );
      }
    } catch {
      showToast("Could not save case.");
    }
  };

  const handleOcrUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = String(reader.result).split(",")[1] || String(reader.result);

      // Add user message indicating document upload
      const docUserMsgId = `usr-doc-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: docUserMsgId,
          role: "user",
          content: `📄 [Uploaded Document: ${file.name}]`,
        },
      ]);

      setLoading(true);
      try {
        const res = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64 }),
        });

        const data = await res.json();
        const extracted = data.result;

        const responseMsg = extracted
          ? `📋 **دستاویز کی جانچ مکمل / Document Analyzed:**\n- نوعیت: **${extracted.documentType}**\n${
              extracted.fields?.cnicNumber ? `- CNIC: ${extracted.fields.cnicNumber}\n` : ""
            }${extracted.fields?.name ? `- نام: ${extracted.fields.name}\n` : ""}${
              extracted.fields?.familyHead ? `- سربراہ خاندان: ${extracted.fields.familyHead}\n` : ""
            }\n${extracted.notes || ""}`
          : "دستاویز کی جانچ میں دشواری ہوئی۔ براہ کرم صاف تصویر اپ لوڈ کریں۔";

        setMessages((prev) => [
          ...prev,
          {
            id: `ast-doc-${Date.now()}`,
            role: "assistant",
            content: responseMsg,
          },
        ]);
      } catch {
        showToast("Document analysis failed.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const submitQuery = async (queryText: string) => {
    const query = queryText.trim();
    if (!query || loading) return;

    const userMsgId = `usr-${Date.now()}`;
    const assistantMsgId = `ast-${Date.now()}`;

    // Add user message
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: query },
      {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        streaming: true,
        services: [],
        actionItems: [],
      },
    ]);

    setInputQuery("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          message: query,
          conversationId: conversationId || undefined,
          sessionId,
          language,
          profile: {
            province: province || undefined,
            hasCnic,
            isBispBeneficiary: isBisp,
          },
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Connection failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      let assistantText = "";
      let foundServices: any[] = [];
      let foundActions: any[] = [];
      let currentActiveTool: string | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const parsed = JSON.parse(trimmed.slice(6));

            if (parsed.type === "meta") {
              if (parsed.conversationId) {
                setConversationId(parsed.conversationId);
                localStorage.setItem("raahi_conv_id", parsed.conversationId);
              }
            } else if (parsed.type === "content") {
              assistantText += parsed.content;
              if (parsed.emergency) {
                setEmergencyActive(true);
              }

              // Update current streaming message
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: assistantText, streaming: true }
                    : msg
                )
              );
            } else if (parsed.type === "tool_call") {
              currentActiveTool = parsed.tool;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, activeTool: currentActiveTool }
                    : msg
                )
              );
            } else if (parsed.type === "search_results") {
              if (Array.isArray(parsed.results)) {
                foundServices = [...foundServices, ...parsed.results];
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, services: foundServices, activeTool: null }
                      : msg
                  )
                );
              }
            } else if (parsed.type === "done") {
              currentActiveTool = null;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, streaming: false, activeTool: null }
                    : msg
                )
              );
            } else if (parsed.type === "error") {
              assistantText += `\n[Notice: ${parsed.error}]`;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: assistantText, streaming: false }
                    : msg
                )
              );
            }
          } catch {
            // ignore JSON parse error in stream line
          }
        }
      }

      // Finish streaming
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, streaming: false, activeTool: null }
            : msg
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content:
                  language === "en"
                    ? "Connection error. Please retry your inquiry."
                    : "رابطے میں رکاوٹ آئی۔ براہ کرم دوبارہ کوشش فرمائیں۔",
                streaming: false,
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitQuery(inputQuery);
  };

  return (
    <main
      className="app-shell min-h-screen flex flex-col justify-between px-4 sm:px-6 py-4"
      dir={language === "en" ? "ltr" : "rtl"}
    >
      {/* ─── Header ────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4 pt-1">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--forest)] to-[var(--forest-dark)] text-xl font-black text-white shadow-md transition group-hover:scale-105">
              ر
            </span>
            <div>
              <span className="text-xl font-black text-[var(--forest)] tracking-tight">
                {t.appName}
              </span>
              <p className="text-[11px] text-[var(--muted)] font-medium">
                {language === "en" ? "Verified Citizen Navigator" : "تصد��ق شدہ عوامی رہنمائی"}
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation & Language Select */}
        <div className="flex items-center gap-2">
          <Link
            href="/cases"
            className="rounded-xl border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--forest)] hover:bg-[var(--forest-light)] transition"
          >
            📋 {t.cases}
          </Link>

          <button
            type="button"
            onClick={handleNewChat}
            className="rounded-xl border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] hover:bg-slate-50 transition"
            title={t.clearChat}
          >
            🔄 {t.clearChat}
          </button>

          {/* Language Switcher */}
          <div className="flex gap-0.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-0.5 text-xs">
            {(["ur", "ps", "en"] as Language[]).map((lang) => (
              <button
                key={lang}
                type="button"
                className={`rounded-lg px-2.5 py-1 font-bold transition ${
                  language === lang
                    ? "bg-[var(--forest)] text-white shadow-xs"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
                onClick={() => changeLanguage(lang)}
              >
                {lang === "ur" ? "اردو" : lang === "ps" ? "پښتو" : "EN"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ─── Emergency Overlay Banner (When Triggered) ──────────── */}
      {emergencyActive && (
        <EmergencyBanner
          language={language}
          province={province}
          onDismiss={() => setEmergencyActive(false)}
        />
      )}

      {/* ─── Toast Notification ─────────────────────────────────── */}
      {notification && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-[var(--forest-dark)] px-4 py-2 text-xs font-bold text-white shadow-xl animate-fade-in">
          {notification}
        </div>
      )}

      {/* ─── Chat Message Area ──────────────────────────────────── */}
      <section className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center animate-fade-up">
            <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-3xl shadow-inner border border-emerald-100">
              🧭
            </span>
            <h1 className="mt-4 text-2xl font-black text-[var(--ink)]">
              {language === "en"
                ? "How can RAAHI assist you today?"
                : language === "ps"
                ? "راہی نن څنګه ستاسو سره مرسته کولی شي؟"
                : "راہی آپ کی کس سرکاری یا فلاحی ضرورت میں مدد کرے؟"}
            </h1>
            <p className="mt-2 max-w-md text-sm text-[var(--muted)] leading-relaxed">
              {language === "en"
                ? "Ask about federal & provincial programs, medical assistance, education grants, or document procedures. All information is grounded in official government sources."
                : "بے نظیر انکم سپورٹ، احساس راشن، صحت کارڈ، نادرا کے مسائل یا فلاحی وظائف کے بارے میں پوچھیں۔ تمام رہنمائی تصدیق شدہ قواعد و ضوابط پر مبنی ہے۔"}
            </p>

            {/* Mode Switcher: Few-Click Fast Path vs Suggestions */}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => setEntryMode("navigator")}
                className={`rounded-2xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                  entryMode === "navigator"
                    ? "bg-[var(--forest)] text-white shadow-xs"
                    : "border border-[var(--line)] bg-white text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                ⚡ {language === "en" ? "Few-Click Guided Navigator" : "چند کلکس میں رہنمائی (بغیر ٹائپنگ)"}
              </button>
              <button
                type="button"
                onClick={() => setEntryMode("suggestions")}
                className={`rounded-2xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                  entryMode === "suggestions"
                    ? "bg-[var(--forest)] text-white shadow-xs"
                    : "border border-[var(--line)] bg-white text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                💡 {language === "en" ? "Common Suggestions" : "عام تجاویز و سوالات"}
              </button>
            </div>

            {/* Mode Content */}
            <div className="mt-6 w-full max-w-2xl text-start">
              {entryMode === "navigator" ? (
                <FewClickNavigator language={language} />
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] ps-1">
                    {language === "en" ? "Common citizen requests:" : "شہریوں کی عام ضروریات:"}
                  </p>
                  <div className="flex flex-col gap-2">
                    {t.suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => submitQuery(suggestion)}
                        className="quick-card flex items-center justify-between rounded-xl border border-[var(--line)] bg-white p-3 text-xs font-semibold text-[var(--ink-soft)] transition hover:border-[var(--forest)] hover:bg-[var(--forest-light)] cursor-pointer"
                      >
                        <span>{suggestion}</span>
                        <span className="text-[var(--forest)] font-bold">→</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                streaming={msg.streaming}
                activeTool={msg.activeTool}
                services={msg.services}
                actionItems={msg.actionItems}
                language={language}
                onAddToCase={handleSaveToCase}
                addedServiceIds={savedCaseIds}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </section>

      {/* ─── Profile / Eligibility Quick Filters ─────────────────── */}
      <section className="border-t border-[var(--line-soft)] pt-2 pb-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
          <span className="font-semibold text-[var(--ink-soft)]">⚙️ {t.province}:</span>
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-xs font-medium text-[var(--ink)] outline-none focus:border-[var(--forest)]"
          >
            <option value="">{t.allProvinces}</option>
            <option value="Punjab">Punjab (پنجاب)</option>
            <option value="Sindh">Sindh (سندھ)</option>
            <option value="Khyber Pakhtunkhwa">Khyber Pakhtunkhwa (خیبر پختونخوا)</option>
            <option value="Balochistan">Balochistan (بلوچستان)</option>
            <option value="Islamabad">Islamabad (اسلام آباد)</option>
          </select>

          <label className="flex items-center gap-1.5 cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2 py-1 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={hasCnic}
              onChange={(e) => setHasCnic(e.target.checked)}
              className="rounded text-[var(--forest)] focus:ring-[var(--forest)]"
            />
            <span>{t.hasCnic}</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2 py-1 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={isBisp}
              onChange={(e) => setIsBisp(e.target.checked)}
              className="rounded text-[var(--forest)] focus:ring-[var(--forest)]"
            />
            <span>{t.bispBeneficiary}</span>
          </label>
        </div>
      </section>

      {/* ─── Input & Actions Form ───────────────────────────────── */}
      <footer className="pt-2">
        <form onSubmit={handleFormSubmit} className="relative">
          <div className="flex items-end gap-2 rounded-2xl border-2 border-[var(--line)] bg-white p-2 shadow-sm focus-within:border-[var(--forest)] focus-within:ring-4 focus-within:ring-emerald-100/60 transition">
            <textarea
              rows={2}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitQuery(inputQuery);
                }
              }}
              placeholder={t.placeholder}
              disabled={loading}
              className="flex-1 resize-none bg-transparent p-2 text-sm leading-relaxed text-[var(--ink)] outline-none placeholder:text-[var(--muted-light)]"
            />

            {/* Utility action buttons inside bar */}
            <div className="flex items-center gap-1.5 pb-1">
              {/* Voice button */}
              <VoiceRecorder
                language={language}
                onTranscript={(transcript) => {
                  setInputQuery((prev) => (prev ? `${prev} ${transcript}` : transcript));
                }}
                disabled={loading}
              />

              {/* OCR document attachment */}
              <label
                title={language === "en" ? "Scan CNIC or Document" : "دستاویز یا شناختی کارڈ اسکین کریں"}
                className="flex cursor-pointer items-center justify-center rounded-xl border border-[var(--line)] bg-white p-3 text-sm font-bold text-[var(--forest)] hover:border-[var(--forest)] hover:bg-[var(--forest-light)] transition"
              >
                <span>📄</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleOcrUpload(file);
                  }}
                  disabled={loading}
                />
              </label>

              {/* Send Button */}
              <button
                type="submit"
                disabled={loading || !inputQuery.trim()}
                className="flex items-center justify-center rounded-xl bg-[var(--forest)] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[var(--forest-dark)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <span className="animate-spin text-base">⏳</span>
                ) : (
                  <span>{t.send}</span>
                )}
              </button>
            </div>
          </div>
        </form>

        <p className="mt-2 text-center text-[10px] text-[var(--muted)] font-medium">
          🛡️ {language === "en"
            ? "RAAHI is grounded in official government sources. Final eligibility is determined by the issuing authority."
            : "راہی کی تمام معلومات سرکاری اور مستند ذرائع پر مبنی ہیں۔ حتمی اہلیت کا فیصلہ متعلقہ ادارہ کرتا ہے۔"}
        </p>
      </footer>
    </main>
  );
}
