import type { Language } from "@/lib/types";
import { t, type StringKey } from "@/lib/opportunities/i18n";
import type { OpportunityView } from "@/lib/opportunities/types";

export type Tone = "urgent" | "soon" | "ok" | "closed" | "rolling" | "none";

export function formatDate(iso: string | undefined, language: Language): string {
  if (!iso) return "";
  const date = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const locale = language === "en" ? "en-GB" : language === "ur" ? "ur-PK" : "ps-AF";
  try {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
  }
}

export function deadlineInfo(item: Pick<OpportunityView, "deadline" | "daysLeft" | "status" | "kind">, language: Language): { text: string; tone: Tone } {
  const label = (key: StringKey) => t(language, key);
  if (item.kind === "coupon") return { text: label("couponWarn").split(".")[0], tone: "soon" };
  if (item.deadline && item.daysLeft !== null) {
    const date = formatDate(item.deadline, language);
    if (item.daysLeft < 0) return { text: `${label("closedAgo")} ${Math.abs(item.daysLeft)} ${label("daysAgo")}`, tone: "closed" };
    if (item.daysLeft === 0) return { text: `${label("closesToday")} · ${date}`, tone: "urgent" };
    const tone: Tone = item.daysLeft <= 3 ? "urgent" : item.daysLeft <= 7 ? "soon" : "ok";
    return { text: `${label("closesIn")} ${item.daysLeft} ${label("days")} · ${date}`, tone };
  }
  if (item.status === "rolling") return { text: label("rolling"), tone: "rolling" };
  return { text: label("noDeadline"), tone: "none" };
}

export const TONE_CLASS: Record<Tone, string> = {
  urgent: "bg-[var(--danger-bg)] text-[var(--danger)] border-[color:rgb(180_35_24/0.25)]",
  soon: "bg-[var(--amber-bg)] text-[var(--amber)] border-[color:rgb(184_102_8/0.25)]",
  ok: "bg-[var(--success-bg)] text-[var(--success)] border-[color:rgb(19_122_66/0.2)]",
  closed: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--line)]",
  rolling: "bg-[#eaf2ff] text-[var(--sky)] border-[color:rgb(37_99_235/0.2)]",
  none: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--line)]",
};

export function dirOf(language: Language): "ltr" | "rtl" {
  return language === "en" ? "ltr" : "rtl";
}

export function timeAgoLabel(iso: string | undefined, language: Language, now = Date.now()): string {
  if (!iso) return "—";
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  const value = minutes < 60 ? minutes : hours < 48 ? hours : days;
  const unit = minutes < 60 ? { en: "min", ur: "منٹ", ps: "دقیقې" } : hours < 48 ? { en: "h", ur: "گھنٹے", ps: "ساعتونه" } : { en: "d", ur: "دن", ps: "ورځې" };
  const suffix = { en: "ago", ur: "پہلے", ps: "مخکې" };
  return language === "en" ? `${value} ${unit.en} ${suffix.en}` : `${value} ${language === "ur" ? unit.ur : unit.ps} ${language === "ur" ? suffix.ur : suffix.ps}`;
}
