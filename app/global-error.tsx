"use client";

import React from "react";

/**
 * The last line of defence.
 *
 * If the app itself breaks, Next.js replaces the whole tree with this - so it
 * cannot rely on the language provider, the styles or anything else that may
 * have just failed. It is plain HTML with its own inline styles, and it leads
 * with the emergency numbers, because someone may be here in a hurry.
 */

const COPY = {
  en: {
    title: "Something went wrong",
    body: "Raahi could not open this page. Your saved applications are safe. Please go back and try again.",
    again: "Try again",
    home: "Go to the start",
    emergency: "If this is an emergency, call",
  },
  ur: {
    title: "کچھ غلط ہو گیا",
    body: "راہی یہ صفحہ نہیں کھول سکا۔ آپ کی محفوظ درخواستیں محفوظ ہیں۔ براہ کرم واپس جا کر دوبارہ کوشش کریں۔",
    again: "دوبارہ کوشش کریں",
    home: "شروع میں جائیں",
    emergency: "اگر ایمرجنسی ہے تو کال کریں",
  },
  ps: {
    title: "یوه ستونزه رامنځته شوه",
    body: "راہي دا پاڼه نشو پرانیستلی. ستاسو خوندي غوښتنې خوندي دي. مهرباني وکړئ بېرته ولاړ شئ او بیا هڅه وکړئ.",
    again: "بیا هڅه وکړئ",
    home: "پیل ته ولاړ شئ",
    emergency: "که بېړنی حالت وي، زنګ ووهئ",
  },
  hkp: {
    title: "کجھ غلط ہو گیا",
    body: "راہی ایہ صفحہ نئیں کھول سکیا۔ تہاڈیاں محفوظ درخواستاں محفوظ نیں۔ براہ کرم واپس جا کے دوبارہ کوشش کرو۔",
    again: "دوبارہ کوشش کرو",
    home: "شروع وچ جاؤ",
    emergency: "جے ایمرجنسی اے تاں کال کرو",
  },
} as const;

type Language = keyof typeof COPY;

/**
 * Read the reader's own chosen language straight from storage. Wrapped in
 * try/catch because private browsing modes throw on `localStorage`, and this
 * component must survive anything.
 */
function savedLanguage(): Language {
  try {
    const stored = window.localStorage.getItem("raahi.language");
    if (stored === "en" || stored === "ur" || stored === "ps" || stored === "hkp") return stored;
  } catch {
    // Storage unavailable: fall through to Urdu.
  }
  return "ur";
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Runs once on mount, and on the client only.
  const [language] = React.useState<Language>(() => (typeof window === "undefined" ? "ur" : savedLanguage()));
  const copy = COPY[language];
  const rtl = language !== "en";

  React.useEffect(() => {
    // Logged for whoever is on call; never shown to the reader.
    console.error("[raahi] unhandled application error", error);
  }, [error]);

  const button: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    padding: "0 18px",
    borderRadius: 14,
    border: "1px solid #d7dee5",
    background: "#ffffff",
    color: "#0f2f2a",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    textDecoration: "none",
  };

  return (
    <html lang={language} dir={rtl ? "rtl" : "ltr"}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6f8f7",
          color: "#12211f",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', 'Noto Nastaliq Urdu', sans-serif",
          padding: 20,
        }}
      >
        <main style={{ maxWidth: 420, textAlign: "center" }}>
          <div style={{ fontSize: 44, lineHeight: 1 }}>🧭</div>

          <h1 style={{ margin: "14px 0 8px", fontSize: 21, fontWeight: 900 }}>{copy.title}</h1>
          <p style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.7, color: "#47605c" }}>{copy.body}</p>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={reset} style={button}>
              ↻ {copy.again}
            </button>
            {/*
              Deliberately a full page load, not a client-side navigation:
              the router may be part of what just failed, and a fresh document
              is the most reliable way back to a working Raahi.
            */}
            <button type="button" onClick={() => window.location.assign(new URL("/", window.location.origin).href)} style={button}>
              🏠 {copy.home}
            </button>
          </div>

          <p style={{ marginTop: 22, fontSize: 13, fontWeight: 800, color: "#7a3d3d" }}>
            {copy.emergency}{" "}
            <a href="tel:1122" style={{ color: "#b3261e", textDecoration: "none" }}>
              1122
            </a>{" "}
            ·{" "}
            <a href="tel:15" style={{ color: "#b3261e", textDecoration: "none" }}>
              15
            </a>{" "}
            ·{" "}
            <a href="tel:115" style={{ color: "#b3261e", textDecoration: "none" }}>
              115
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
