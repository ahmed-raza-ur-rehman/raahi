import type { Language } from "@/lib/types";
import type { OpportunityView } from "./types";

/**
 * Sharing text for WhatsApp and Telegram — how most opportunities travel between people in Pakistan. Pure functions:
 * the page supplies the absolute link.
 */

type Shareable = Pick<OpportunityView, "title" | "organization" | "deadline" | "daysLeft" | "status" | "kind">;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(iso: string): string {
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  return `${day} ${MONTHS[month - 1] ?? ""} ${iso.slice(0, 4)}`.trim();
}

/** One short message: title, who and when, the link. */
export function shareText(item: Shareable, url: string, language: Language = "en"): string {
  const ur = language !== "en";
  const when =
    item.kind === "coupon"
      ? ur ? "محدود وقت کا کوپن — جلد استعمال کریں" : "Limited-time coupon — use it soon"
      : item.deadline
        ? `${ur ? "آخری تاریخ" : "Deadline"}: ${shortDate(item.deadline)}${item.daysLeft !== null && item.daysLeft >= 0 && item.daysLeft <= 14 ? ` (${item.daysLeft} ${ur ? "دن باقی" : item.daysLeft === 1 ? "day left" : "days left"})` : ""}`
        : undefined;
  return [`*${item.title}*`, [item.organization, when].filter(Boolean).join(" · "), url, ur ? "راہی کے ذریعے" : "via RAAHI"].filter(Boolean).join("\n");
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function telegramUrl(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}
