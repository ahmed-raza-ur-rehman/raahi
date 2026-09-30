"use client";

import React, { useState } from "react";

import { useLanguage } from "./LanguageProvider";
import { Badge, Card, Loader } from "./Ui";
import { PHOTO_CHECKLIST } from "@/lib/ai/vision";

interface VisionPayload {
  vision: {
    documentType: string;
    confidence: number;
    fields: Record<string, string>;
    checks: { ok: boolean; severity: string; code: string; message: string }[];
    quality: { width: number; height: number; byteSize: number; readable: boolean };
    simulated: boolean;
    piiMasked: boolean;
  };
}

/**
 * Camera capture for documents: take a photo, get an instant readability check,
 * and save it against the application. Works from phone and desktop.
 */
export function PhotoCapture({
  applicationId,
  documentType,
  onDone,
}: {
  applicationId: string;
  documentType: string;
  onDone: () => void;
}) {
  const { language } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<VisionPayload["vision"] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(file);
    });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 8_000_000) {
      setError(language === "en" ? "The photo is larger than 8 MB. Please take a new one." : "تصویر 8 ایم بی سے بڑی ہے۔ نئی تصویر لیں۔");
      return;
    }
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    const dataUrl = await fileToBase64(file);
    setPreview(dataUrl);

    try {
      const response = await fetch(`/api/applications/${applicationId}/documents`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          documentType,
          status: "uploaded",
          imageBase64: dataUrl,
          expectedType: documentType,
        }),
      });
      const data = (await response.json()) as VisionPayload & { error?: string };
      if (!response.ok) {
        setError(data.error ?? (language === "en" ? "Could not save the photo." : "تصویر محفوظ نہ ہو سکی۔"));
      } else {
        setResult(data.vision);
        if (data.vision?.quality.readable) onDone();
      }
    } catch {
      setError(language === "en" ? "Could not reach the server." : "سرور سے رابطہ نہیں ہو سکا۔");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="bg-[var(--surface-2)]">
      <div className="space-y-2">
        <details>
          <summary className="cursor-pointer text-[11px] font-bold text-[var(--forest)]">
            📋 {language === "en" ? "How to take a good photo" : "اچھی تصویر کا طریقہ"}
          </summary>
          <ol className="mt-1.5 space-y-0.5 text-[11px] leading-relaxed text-[var(--ink-soft)]">
            {PHOTO_CHECKLIST.map((item, index) => (
              <li key={index}>
                {index + 1}. {item}
              </li>
            ))}
          </ol>
        </details>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--line)] bg-white p-4 text-[12.5px] font-bold text-[var(--forest)] hover:border-[var(--forest)]">
          📷 {language === "en" ? "Take a photo or choose a file" : "تصویر لیں یا فائل منتخب کریں"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </label>

        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Document preview" className="max-h-48 w-full rounded-xl object-contain" />
        ) : null}

        {busy ? <Loader label={language === "en" ? "Checking the photo…" : "تصویر جانچی جا رہی ہے…"} /> : null}

        {error ? <p className="rounded-lg bg-rose-50 p-2 text-[11.5px] font-bold text-rose-700">{error}</p> : null}

        {result ? (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={result.quality.readable ? "success" : "danger"}>
                {result.quality.readable
                  ? language === "en"
                    ? "Photo looks readable"
                    : "تصویر صاف ہے"
                  : language === "en"
                  ? "Photo needs retaking"
                  : "دوبارہ تصویر لیں"}
              </Badge>
              <Badge tone="neutral">
                {result.quality.width}×{result.quality.height}
              </Badge>
              {result.piiMasked ? <Badge tone="success">🔒 {language === "en" ? "ID number masked" : "نمبر چھپایا گیا"}</Badge> : null}
              {result.simulated ? <Badge tone="warn">OCR off</Badge> : null}
            </div>
            {result.checks.map((check, index) => (
              <p
                key={index}
                className={`rounded-lg p-2 text-[11px] leading-relaxed ${
                  check.severity === "error"
                    ? "bg-rose-50 text-rose-700"
                    : check.severity === "warn"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-emerald-50 text-emerald-800"
                }`}
              >
                {check.message}
              </p>
            ))}
            {Object.keys(result.fields).length > 0 ? (
              <pre className="overflow-x-auto rounded-lg bg-white p-2 text-[10px]" dir="ltr">
                {JSON.stringify(result.fields, null, 1)}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
