"use client";

import React, { useState, useRef } from "react";
import type { CaseDocument } from "@/lib/types";

interface DocumentUploaderModalProps {
  caseId: string;
  isOpen: boolean;
  onClose: () => void;
  onDocumentAdded: (doc: CaseDocument) => void;
  language?: "en" | "ur";
}

const DOCUMENT_TYPES = [
  { id: "cnic", labelEn: "CNIC (National Identity Card)", labelUr: "قومی شناختی کارڈ (CNIC)" },
  { id: "b_form", labelEn: "B-Form / CRC (Child Registration)", labelUr: "ب فارم / رجسٹریشن سرٹیفکیٹ" },
  { id: "domicile", labelEn: "Domicile Certificate", labelUr: "ڈومیسائل سرٹیفکیٹ" },
  { id: "income_cert", labelEn: "Salary Slip / Income Certificate", labelUr: "آمدن کا سرٹیفکیٹ / تنخواہ سلپ" },
  { id: "school_cert", labelEn: "School Enrollment / Certificate", labelUr: "اسکول کا تصدیقی سرٹیفکیٹ" },
  { id: "medical_report", labelEn: "Medical Report / Disability Certificate", labelUr: "میڈیکل رپورٹ / معذوری سرٹیفکیٹ" },
  { id: "other", labelEn: "Other Official Document", labelUr: "دیگر تصدیقی دستاویز" },
];

export default function DocumentUploaderModal({
  caseId,
  isOpen,
  onClose,
  onDocumentAdded,
  language = "ur",
}: DocumentUploaderModalProps) {
  const [selectedType, setSelectedType] = useState<string>("cnic");
  const [customLabel, setCustomLabel] = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedData, setExtractedData] = useState<Record<string, string> | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** An explanation of why automatic reading did not happen — not an error. */
  const [note, setNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setNote(null);
    setExtractedData(null);
    setIsConfirmed(false);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      analyzeDocument(base64);
    };
    reader.readAsDataURL(file);
  };

  const analyzeDocument = async (imageBase64: string) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageBase64,
          documentType: selectedType,
        }),
      });

      if (!res.ok) {
        throw new Error(language === "en" ? "OCR analysis failed" : "دستاویز اسکیننگ میں مسئلہ پیش آیا");
      }

      const data = await res.json();
      const result = data.result as
        | { available: boolean; fields?: Record<string, string>; note?: string; documentType?: string }
        | undefined;

      if (result && result.available && result.fields && Object.keys(result.fields).length > 0) {
        // A real model read it. The visitor still has to confirm the details
        // are right before anything is marked verified.
        setExtractedData(result.fields);
        setNote(null);
      } else {
        // Automatic reading is unavailable. Show why, and leave the fields
        // EMPTY: inventing "pre-verified" values is the one thing a document
        // tool must never do.
        setExtractedData(null);
        setNote(
          result?.note ??
            (language === "en"
              ? "Automatic reading is unavailable. Save the document and fill in the details yourself."
              : "خودکار پڑھنا دستیاب نہیں۔ دستاویز محفوظ کریں اور تفصیلات خود درج کریں۔"),
        );
      }
    } catch {
      setExtractedData(null);
      setNote(
        language === "en"
          ? "The image could not be analysed. Save the document and fill in the details yourself."
          : "تصویر کا تجزیہ نہیں ہو سکا۔ دستاویز محفوظ کریں اور تفصیلات خود درج کریں۔",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!isConfirmed) {
      setError(language === "en" ? "Please verify that the details are correct." : "براہ کرم تصدیق کریں کہ معلومات درست ہیں۔");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const typeObj = DOCUMENT_TYPES.find((d) => d.id === selectedType);
    const label = customLabel.trim() || (language === "en" ? typeObj?.labelEn : typeObj?.labelUr) || selectedType;

    try {
      const res = await fetch(`/api/cases/${caseId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: selectedType,
          label,
          ocrData: extractedData || undefined,
          // Only a real read that a person has checked counts as verified.
          verified: Boolean(extractedData) && isConfirmed,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save document to case.");
      }

      const data = await res.json();
      onDocumentAdded(data.document);
      handleReset();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Submission error";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setImagePreview(null);
    setExtractedData(null);
    setIsConfirmed(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in"
      dir={language === "en" ? "ltr" : "rtl"}
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-[var(--line)] bg-white p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--line-soft)] pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--forest-light)] text-lg text-[var(--forest)]">
              📄
            </span>
            <div>
              <h2 className="text-base font-black text-[var(--ink)]">
                {language === "en" ? "Upload & Verify Document" : "دستاویز اپلوڈ اور تصدیق"}
              </h2>
              <p className="text-[11px] text-[var(--muted)]">
                {language === "en"
                  ? "Qwen-VL Vision Engine automatically extracts verified details"
                  : "راہی ویژن انجن خودکار طریقے سے تفصیلات کی تصدیق کرتا ہے"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-[var(--muted)] hover:bg-slate-100 transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-4">
          {/* Document Type Selector */}
          <div>
            <label className="block text-xs font-bold text-[var(--ink)] mb-1">
              {language === "en" ? "Select Document Category" : "دستاویز کی قسم منتخب کریں"}
            </label>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                if (imagePreview) analyzeDocument(imagePreview);
              }}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-2.5 text-xs font-semibold text-[var(--ink)] focus:border-[var(--forest)] focus:outline-hidden"
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {language === "en" ? type.labelEn : type.labelUr}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Label if Other */}
          {selectedType === "other" && (
            <div>
              <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                {language === "en" ? "Document Title" : "دستاویز کا عنوان"}
              </label>
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder={language === "en" ? "e.g. Electricity Bill, Rent Agreement" : "مثال: بجلی کا بل، کرایہ نامہ"}
                className="w-full rounded-xl border border-[var(--line)] bg-white p-2.5 text-xs font-medium focus:border-[var(--forest)] focus:outline-hidden"
              />
            </div>
          )}

          {/* File Upload Box */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition ${
              imagePreview
                ? "border-[var(--forest)] bg-emerald-50/20"
                : "border-[var(--line)] hover:border-[var(--forest)] bg-[var(--surface-2)]"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {imagePreview ? (
              <div className="space-y-3">
                {/* Local object-URL preview of the file the visitor just picked:
                    next/image optimisation has nothing to add, so <img> is right. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Document Preview"
                  className="mx-auto max-h-40 rounded-xl object-contain shadow-xs border border-[var(--line)]"
                />
                <p className="text-xs font-bold text-[var(--forest)]">
                  {language === "en" ? "✓ Document Loaded · Click to Change" : "✓ تصویر منتخب کر لی گئی · تبدیل کرنے کے لیے کلک کریں"}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 py-3">
                <span className="text-3xl">📷</span>
                <p className="text-xs font-bold text-[var(--ink)]">
                  {language === "en" ? "Take photo or upload document image" : "تصویر لیں یا دستاویز کی فائل اپلوڈ کریں"}
                </p>
                <p className="text-[11px] text-[var(--muted)]">
                  {language === "en" ? "JPG, PNG, WebP supported" : "تصویر صاف اور واضح ہونی چاہیے"}
                </p>
              </div>
            )}
          </div>

          {/* Analysis State */}
          {isAnalyzing && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--forest)] border-t-transparent mb-2" />
              <p className="text-xs font-bold text-[var(--forest)]">
                {language === "en" ? "Analyzing Document with Qwen-VL OCR..." : "راہی ویژن انجن دستاویز کا معائنہ کر رہا ہے..."}
              </p>
              <p className="text-[11px] text-[var(--muted)] mt-1">
                {language === "en" ? "Extracting CNIC, names, and validity dates" : "شناختی کوائف، نام اور تاریخوں کا اندراج"}
              </p>
            </div>
          )}

          {/* Extracted Details Preview Table (S5) */}
          {extractedData && !isAnalyzing && (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black text-[var(--forest)] flex items-center gap-1.5">
                  <span>🔍</span>
                  <span>{language === "en" ? "Extracted Information (OCR)" : "شناخت شدہ معلومات (خودکار)"}</span>
                </h3>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  {language === "en" ? "✓ Verified" : "✓ تصدیق شدہ"}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                {Object.entries(extractedData).map(([key, val]) => (
                  <div
                    key={key}
                    className="flex justify-between items-center rounded-lg bg-white px-3 py-2 border border-[var(--line-soft)]"
                  >
                    <span className="font-bold text-[var(--muted)]">{key}:</span>
                    <span className="font-mono font-bold text-[var(--ink)] text-end">{val}</span>
                  </div>
                ))}
              </div>

              {/* Confirmation Checkbox */}
              <label className="mt-4 flex cursor-pointer items-start gap-2 pt-2 border-t border-[var(--line-soft)]">
                <input
                  type="checkbox"
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded text-[var(--forest)] focus:ring-[var(--forest)]"
                />
                <span className="text-xs font-bold text-[var(--ink)]">
                  {language === "en"
                    ? "I confirm that this document belongs to this case and the details are accurate."
                    : "میں تصدیق کرتا/کرتی ہوں کہ یہ دستاویز درست ہے اور تمام معلومات صحیح ہیں۔"}
                </span>
              </label>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
              ⚠️ {error}
            </div>
          )}

          {note && !error && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
              🔎 {note}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-2 border-t border-[var(--line-soft)] pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-[var(--line)] px-4 py-2 text-xs font-bold text-[var(--muted)] hover:bg-slate-100 transition"
          >
            {language === "en" ? "Cancel" : "منسوخ"}
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !imagePreview || isAnalyzing}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--forest)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--forest-dark)] transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                <span>{language === "en" ? "Saving..." : "محفوظ ہو رہا ہے..."}</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>{language === "en" ? "Save & Attach to Case" : "کیس میں شامل کریں"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
