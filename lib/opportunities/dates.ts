import type { Opportunity, OpportunityStatus } from "./types";
import { clockNow } from "./clock";

/**
 * Date helpers. All "calendar date" values are ISO `YYYY-MM-DD` strings; deadlines are
 * treated as end-of-day in Pakistan Standard Time (UTC+5) because that is where most
 * RAAHI users are. Everything is computed in UTC so tests are timezone independent.
 */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const MONTH_PATTERN = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const ORDINAL = "(?:st|nd|rd|th)?";
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function toIsoDate(year: number, month: number, day: number): string | undefined {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return undefined;
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject overflow such as 31 February.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthNumber(name: string): number | undefined {
  return MONTHS[name.toLowerCase().replace(/\.$/, "")];
}

interface DateMatch {
  index: number;
  length: number;
  iso: string;
}

function findDates(text: string): DateMatch[] {
  const matches: DateMatch[] = [];

  const push = (m: RegExpExecArray, iso: string | undefined) => {
    if (iso) matches.push({ index: m.index, length: m[0].length, iso });
  };

  // 2026-11-14
  for (const m of text.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) {
    push(m as RegExpExecArray, toIsoDate(Number(m[1]), Number(m[2]), Number(m[3])));
  }
  // 14 November 2026 / 14th Nov, 2026 / 5-Oct-2026
  const dayFirst = new RegExp(`\\b(\\d{1,2})${ORDINAL}[\\s\\-/.]+(?:of\\s+)?${MONTH_PATTERN}\\.?,?[\\s\\-/.]+(\\d{4})\\b`, "gi");
  for (const m of text.matchAll(dayFirst)) {
    push(m as RegExpExecArray, toIsoDate(Number(m[3]), monthNumber(m[2]) ?? 0, Number(m[1])));
  }
  // November 14, 2026 / Nov 14 2026 / Nov. 14th, 2026
  const monthFirst = new RegExp(`\\b${MONTH_PATTERN}\\.?\\s+(\\d{1,2})${ORDINAL},?\\s+(\\d{4})\\b`, "gi");
  for (const m of text.matchAll(monthFirst)) {
    push(m as RegExpExecArray, toIsoDate(Number(m[3]), monthNumber(m[1]) ?? 0, Number(m[2])));
  }
  // 14/11/2026 or 14.11.2026 — South Asian day-first unless the second part cannot be a month.
  for (const m of text.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g)) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const [day, month] = a > 12 ? [a, b] : b > 12 ? [b, a] : [a, b];
    push(m as RegExpExecArray, toIsoDate(Number(m[3]), month, day));
  }

  // De-duplicate overlapping matches (e.g. the same text caught by two patterns).
  matches.sort((x, y) => x.index - y.index || y.length - x.length);
  const unique: DateMatch[] = [];
  for (const match of matches) {
    const last = unique[unique.length - 1];
    if (last && match.index < last.index + last.length) continue;
    unique.push(match);
  }
  return unique;
}

/** First calendar date mentioned in `text`, as ISO `YYYY-MM-DD`. */
export function parseLooseDate(text: string): string | undefined {
  return findDates(text)[0]?.iso;
}

const DEADLINE_KEYWORDS = new RegExp(
  [
    "submission deadline",
    "application deadline",
    "closing date",
    "deadline",
    "last date(?: to apply| of application| for submission)?",
    "last day(?: to apply)?",
    "apply (?:by|before|until|till)",
    "applications? (?:close|closes|closing|due|end|ends)",
    "closes? on",
    "due date",
    "available till",
    "valid (?:till|until)",
    "open until",
    "expires?(?: on)?",
  ].join("|"),
  "gi",
);

const ROLLING = /rolling (?:basis|admissions?|deadline|applications?|review)|open until (?:filled|further notice)|applications? (?:are )?accepted (?:year[- ]round|all year)|no (?:fixed )?deadline/i;

export interface ExtractedDeadline {
  date?: string;
  /** Original snippet such as "Deadline: November 14, 2026". */
  text?: string;
  rolling?: boolean;
}

/**
 * Find an application deadline in free text ("Deadline is 15 December 2026",
 * "Last date to apply: 22 June 2026", "Available Till Oct 25, 2026").
 */
export function extractDeadline(text: string): ExtractedDeadline {
  const rolling = ROLLING.test(text) || undefined;
  for (const keyword of text.matchAll(DEADLINE_KEYWORDS)) {
    const start = keyword.index ?? 0;
    const window = text.slice(start, start + keyword[0].length + 70);
    const date = parseLooseDate(window.slice(keyword[0].length));
    if (date) {
      return { date, text: window.replace(/\s+/g, " ").trim().slice(0, 120), rolling };
    }
  }
  return { rolling };
}

/** Start/end dates from ranges like "Aug 31 - Oct 23, 2026" or "Oct 05 - 27, 2026". */
export function parseDateRange(text: string): { start?: string; end?: string } {
  const clean = text.replace(/\s+/g, " ").trim();

  // Dec 15, 2026 - Jan 20, 2027
  const full = new RegExp(`${MONTH_PATTERN}\\.?\\s+(\\d{1,2})${ORDINAL},?\\s+(\\d{4})\\s*[-–—]\\s*${MONTH_PATTERN}\\.?\\s+(\\d{1,2})${ORDINAL},?\\s+(\\d{4})`, "i").exec(clean);
  if (full) {
    return {
      start: toIsoDate(Number(full[3]), monthNumber(full[1]) ?? 0, Number(full[2])),
      end: toIsoDate(Number(full[6]), monthNumber(full[4]) ?? 0, Number(full[5])),
    };
  }

  // Aug 31 - Oct 23, 2026   (start year inferred; wraps over New Year when start month > end month)
  const crossMonth = new RegExp(`${MONTH_PATTERN}\\.?\\s+(\\d{1,2})${ORDINAL}\\s*[-–—]\\s*${MONTH_PATTERN}\\.?\\s+(\\d{1,2})${ORDINAL},?\\s+(\\d{4})`, "i").exec(clean);
  if (crossMonth) {
    const startMonth = monthNumber(crossMonth[1]) ?? 0;
    const endMonth = monthNumber(crossMonth[3]) ?? 0;
    const endYear = Number(crossMonth[5]);
    const startYear = startMonth > endMonth ? endYear - 1 : endYear;
    return {
      start: toIsoDate(startYear, startMonth, Number(crossMonth[2])),
      end: toIsoDate(endYear, endMonth, Number(crossMonth[4])),
    };
  }

  // Oct 05 - 27, 2026
  const sameMonth = new RegExp(`${MONTH_PATTERN}\\.?\\s+(\\d{1,2})${ORDINAL}\\s*[-–—]\\s*(\\d{1,2})${ORDINAL},?\\s+(\\d{4})`, "i").exec(clean);
  if (sameMonth) {
    const month = monthNumber(sameMonth[1]) ?? 0;
    const year = Number(sameMonth[4]);
    return {
      start: toIsoDate(year, month, Number(sameMonth[2])),
      end: toIsoDate(year, month, Number(sameMonth[3])),
    };
  }

  const single = parseLooseDate(clean);
  return single ? { end: single } : {};
}

/** Accept Date | ISO string | RFC 822 string | unix seconds and return a full ISO timestamp (UTC). */
export function toIsoDateTime(input: unknown): string | undefined {
  if (input === null || input === undefined || input === "") return undefined;
  let ms: number;
  if (input instanceof Date) {
    ms = input.getTime();
  } else if (typeof input === "number") {
    ms = input < 1e11 ? input * 1000 : input; // seconds vs milliseconds
  } else if (typeof input === "string") {
    const value = input.trim();
    // "2026-10-08T21:47:32" or "2026-10-08 05:41:04" without a zone is treated as UTC.
    const naive = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(\.\d+)?$/.exec(value);
    ms = naive ? Date.parse(`${naive[1]}T${naive[2]}${naive[3] ?? ""}Z`) : Date.parse(value);
    if (Number.isNaN(ms)) {
      const loose = parseLooseDate(value);
      if (!loose) return undefined;
      ms = Date.parse(`${loose}T00:00:00Z`);
    }
  } else {
    return undefined;
  }
  if (Number.isNaN(ms)) return undefined;
  return new Date(ms).toISOString();
}

export function isoDateOf(dateTime: string): string {
  return dateTime.slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Whole days between two ISO calendar dates (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** Calendar date "today" in Pakistan (UTC+5). */
export function todayInPakistan(now: Date = clockNow()): string {
  return new Date(now.getTime() + PKT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Days left until the end of the deadline day in Pakistan; negative once it has passed. */
export function daysUntil(deadline: string, now: Date = clockNow()): number {
  return diffDays(todayInPakistan(now), deadline);
}

export function computeStatus(
  item: Pick<Opportunity, "deadline" | "rolling" | "kind">,
  now: Date = clockNow(),
): { status: OpportunityStatus; daysLeft: number | null } {
  if (item.deadline) {
    const daysLeft = daysUntil(item.deadline, now);
    if (daysLeft < 0) return { status: "closed", daysLeft };
    return { status: daysLeft <= 7 ? "closing-soon" : "open", daysLeft };
  }
  if (item.rolling) return { status: "rolling", daysLeft: null };
  return { status: "unknown", daysLeft: null };
}

export function isRecentlySeen(firstSeen: string, now: Date = clockNow(), withinDays = 3): boolean {
  return now.getTime() - Date.parse(firstSeen) <= withinDays * DAY_MS;
}

/** "3 hours ago" style label used by the status UI. */
export function timeAgo(iso: string | undefined, now: Date = clockNow()): string {
  if (!iso) return "never";
  const minutes = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
