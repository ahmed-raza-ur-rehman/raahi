import type { Language, Localized } from "@/lib/types";

/**
 * "Verified" is a promise about a point in time, not a permanent badge.
 *
 * Every record in Raahi carries the date a human last checked it against the
 * issuing authority. This module turns that date into something a reader can
 * judge: how old the information is, and whether it should still be trusted
 * without a second look.
 *
 * Deadlines go stale far faster than a helpline number, so the threshold
 * depends on what kind of thing we are showing.
 */

export type FreshnessState = "fresh" | "aging" | "stale" | "unknown";

export interface Freshness {
  state: FreshnessState;
  /** Whole days since the check, or null when we cannot tell. */
  days: number | null;
  /** Short label for a badge, in the reader's language. */
  label: Localized;
}

/** Anything with a `lastVerified` date, optionally narrowed by kind. */
export type VerifiableKind =
  | "opportunity"
  | "test"
  | "camp"
  | "blood"
  | "contact"
  | "disaster"
  | "guide"
  | "general";

interface Policy {
  aging: number;
  stale: number;
}

/**
 * Days before we start warning. Scholarships and exam dates expire; a
 * ministry's helpline number does not.
 */
const POLICY: Record<VerifiableKind, Policy> = {
  opportunity: { aging: 14, stale: 30 },
  test: { aging: 21, stale: 45 },
  camp: { aging: 7, stale: 14 },
  blood: { aging: 30, stale: 60 },
  contact: { aging: 120, stale: 240 },
  disaster: { aging: 90, stale: 180 },
  guide: { aging: 90, stale: 180 },
  general: { aging: 60, stale: 120 },
};

const LABELS: Record<FreshnessState, Localized> = {
  fresh: { en: "Verified", ur: "تصدیق شدہ", ps: "تایید شوی", hkp: "تصدیق شدہ" },
  aging: { en: "Re-check", ur: "دوبارہ تصدیق کریں", ps: "بیا تایید کړئ", hkp: "دوبارہ تصدیق کرو" },
  stale: {
    en: "May be out of date",
    ur: "معلومات پرانی ہو سکتی ہیں",
    ps: "معلومات زړې کېدای شي",
    hkp: "معلومات پراݨیاں ہو سکدیاں نیں",
  },
  unknown: { en: "Not dated", ur: "تاریخ درج نہیں", ps: "نېټه نه ده ثبت", hkp: "تاریخ درج نئیں" },
};

/** Warning shown when a record is past its sell-by date. */
export const STALENESS_NOTICE: Localized = {
  en: "This was last checked a while ago. Confirm the details on the official source before you rely on them.",
  ur: "یہ معلومات کافی عرصہ پہلے چیک کی گئی تھیں۔ براہ کرم ان پر بھروسہ کرنے سے پہلے سرکاری ذریعے سے تصدیق کر لیں۔",
  ps: "دا معلومات ډېر وخت مخکې کتل شوي دي. پرې د باور کولو مخکې له رسمي سرچینې تایید کړئ.",
  hkp: "اے معلومات بہوں عرصہ پہلے چیک کیتیاں گئیاں سن۔ اینداں تے بھروسہ کرن توں پہلے سرکاری ذریعے نال تصدیق کر لو۔",
};

export function daysSince(isoDate: string, now: Date = new Date()): number | null {
  if (!isoDate) return null;
  const then = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(then.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));
}

/**
 * How much can we still trust this? Never throws: an unparseable date is
 * reported as `unknown` rather than being treated as fresh.
 */
export function freshnessOf(
  lastVerified: string | undefined,
  kind: VerifiableKind = "general",
  now: Date = new Date(),
): Freshness {
  const days = lastVerified ? daysSince(lastVerified, now) : null;
  if (days === null) return { state: "unknown", days: null, label: LABELS.unknown };

  const policy = POLICY[kind] ?? POLICY.general;
  const state: FreshnessState = days >= policy.stale ? "stale" : days >= policy.aging ? "aging" : "fresh";
  return { state, days, label: LABELS[state] };
}

/** "today" / "3 days ago" / "2 months ago", in the reader's language. */
export function describeAge(days: number | null, language: Language): string {
  if (days === null) return "";
  if (days === 0) {
    return language === "en" ? "today" : language === "ps" ? "نن" : "آج";
  }
  if (days === 1) {
    return language === "en" ? "yesterday" : language === "ps" ? "پرون" : "کل";
  }
  if (days < 31) {
    return language === "en"
      ? `${days} days ago`
      : language === "ps"
      ? `${days} ورځې مخکې`
      : `${days} دن پہلے`;
  }
  const months = Math.floor(days / 30);
  return language === "en"
    ? `${months} month${months === 1 ? "" : "s"} ago`
    : language === "ps"
    ? `${months} میاشتې مخکې`
    : `${months} ماہ پہلے`;
}

/** Tone for the shared `Badge` component. */
export function freshnessTone(state: FreshnessState): "success" | "warn" | "danger" | "neutral" {
  switch (state) {
    case "fresh":
      return "success";
    case "aging":
      return "warn";
    case "stale":
      return "danger";
    default:
      return "neutral";
  }
}

/**
 * Whole-corpus check, for the health endpoint and for reviewers. Groups every
 * record by how old its last verification is so the team can see what needs a
 * phone call before the next release.
 */
export function summariseFreshness(
  records: { id: string; kind: VerifiableKind; lastVerified?: string }[],
  now: Date = new Date(),
): {
  total: number;
  fresh: number;
  aging: number;
  stale: number;
  unknown: number;
  oldestDays: number | null;
  staleIds: string[];
} {
  let fresh = 0;
  let aging = 0;
  let stale = 0;
  let unknown = 0;
  let oldestDays: number | null = null;
  const staleIds: string[] = [];

  for (const record of records) {
    const result = freshnessOf(record.lastVerified, record.kind, now);
    if (result.state === "fresh") fresh += 1;
    if (result.state === "aging") aging += 1;
    if (result.state === "stale") {
      stale += 1;
      staleIds.push(record.id);
    }
    if (result.state === "unknown") unknown += 1;
    if (result.days !== null && (oldestDays === null || result.days > oldestDays)) oldestDays = result.days;
  }

  return { total: records.length, fresh, aging, stale, unknown, oldestDays, staleIds };
}
