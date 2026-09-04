"use client";

import React, { useState } from "react";

export interface ActionItem {
  id: string;
  label: string;
  labelUr?: string;
  labelPs?: string;
  completed?: boolean;
  serviceId?: string;
  serviceName?: string;
  url?: string;
}

interface ActionPlanProps {
  title?: string;
  titleUr?: string;
  items: ActionItem[];
  language?: "en" | "ur" | "ps";
  onToggleItem?: (id: string, completed: boolean) => void;
  onSaveToCase?: () => void;
}

export function ActionPlan({
  title,
  titleUr,
  items,
  language = "ur",
  onToggleItem,
  onSaveToCase,
}: ActionPlanProps) {
  const [completedMap, setCompletedMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    items.forEach((item) => {
      init[item.id] = !!item.completed;
    });
    return init;
  });

  const toggle = (id: string) => {
    const next = !completedMap[id];
    setCompletedMap((prev) => ({ ...prev, [id]: next }));
    if (onToggleItem) {
      onToggleItem(id, next);
    }
  };

  const completedCount = Object.values(completedMap).filter(Boolean).length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  const handlePrint = () => {
    window.print();
  };

  const headerText =
    language === "en"
      ? title || "Your Personalized Action Plan"
      : language === "ps"
      ? title || "ستاسو د عمل پلان"
      : titleUr || title || "آپ کا ایکشن پلان (اگلے اقدامات)";

  return (
    <div className="card plan-enter rounded-2xl border-2 border-emerald-600/20 bg-gradient-to-b from-[#f7fcf9] to-white p-5 shadow-md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--forest)] text-xs text-white">
              📋
            </span>
            <h3 className="text-base font-black text-[var(--ink)]">
              {headerText}
            </h3>
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {language === "en"
              ? "Follow these concrete steps in order to access services"
              : language === "ps"
              ? "د خدمتونو ترلاسه کولو لپاره دا ګامونه تعقیب کړئ"
              : "خدمات حاصل کرنے کے لیے ان اقدامات پر ترتیب سے عمل کریں"}
          </p>
        </div>

        {/* Progress Bar & Actions */}
        <div className="flex items-center gap-3">
          <div className="text-end">
            <span className="text-xs font-bold text-[var(--forest)]">
              {completedCount} / {items.length} {language === "en" ? "Done" : "مکمل"}
            </span>
            <div className="mt-1 h-2 w-24 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-[var(--forest)] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            title={language === "en" ? "Print Checklist" : "پرنٹ کریں"}
            className="rounded-lg border border-[var(--line)] p-2 text-xs font-bold text-[var(--muted)] hover:bg-slate-50 transition"
          >
            🖨️
          </button>
        </div>
      </div>

      {/* Checklist */}
      <ul className="mt-4 space-y-3">
        {items.map((item, index) => {
          const isDone = !!completedMap[item.id];
          const itemText =
            language === "en"
              ? item.label
              : language === "ps" && item.labelPs
              ? item.labelPs
              : item.labelUr || item.label;

          return (
            <li
              key={item.id}
              onClick={() => toggle(item.id)}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                isDone
                  ? "border-emerald-200 bg-emerald-50/40 text-[var(--muted)]"
                  : "border-[var(--line)] bg-white hover:border-[var(--forest)] hover:bg-[#fbfdfb]"
              }`}
            >
              <input
                type="checkbox"
                checked={isDone}
                onChange={() => {}} // handled by li onClick
                className="mt-1 h-4 w-4 rounded text-[var(--forest)] focus:ring-[var(--forest)] cursor-pointer"
              />

              <div className="flex-1 text-sm leading-relaxed">
                <span
                  className={`font-semibold ${
                    isDone ? "line-through opacity-75" : "text-[var(--ink)]"
                  }`}
                >
                  <span className="text-xs opacity-60 me-2 font-mono">
                    #{index + 1}
                  </span>
                  {itemText}
                </span>

                {item.serviceName && (
                  <p className="mt-0.5 text-xs text-[var(--forest)] font-medium">
                    🏛️ {item.serviceName}
                  </p>
                )}
              </div>

              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-md bg-[var(--forest-light)] px-2 py-1 text-[11px] font-bold text-[var(--forest)] hover:underline shrink-0"
                >
                  {language === "en" ? "Visit →" : "پورٹل →"}
                </a>
              )}
            </li>
          );
        })}
      </ul>

      {/* Footer */}
      {onSaveToCase && (
        <div className="mt-4 flex justify-end border-t border-[var(--line-soft)] pt-3">
          <button
            type="button"
            onClick={onSaveToCase}
            className="rounded-xl bg-[var(--forest)] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[var(--forest-dark)] transition"
          >
            {language === "en" ? "Save to My Cases" : "اپنے کیسز میں محفوظ کریں"}
          </button>
        </div>
      )}
    </div>
  );
}
