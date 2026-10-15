import type { LText } from "./ltext";
import type { Funding, Level, OpportunityKind } from "./types";

/**
 * Types and pure helpers for the yearly planner. Kept free of the programme data so client components can use them
 * without shipping every programme's text to the browser.
 */

export type FlagshipRoute = "direct" | "hec" | "embassy" | "agency" | "university";

export interface FlagshipCycle {
  label: LText;
  /** YYYY-MM-DD */
  opens?: string;
  /** YYYY-MM-DD — the calendar date as announced; `closesNote` carries the time zone and any second deadline. */
  closes?: string;
  closesNote?: LText;
  note?: LText;
  /** "official" = read on the organiser's own page; "reported" = from news or a summary — confirm before relying on it. */
  confidence: "official" | "reported";
  /** YYYY-MM-DD: when the dates were last confirmed. */
  checked: string;
  sourceUrl: string;
}

/** Months 1–12. `from > to` wraps over New Year (November → January). */
export interface MonthWindow {
  from: number;
  to: number;
}

export interface Flagship {
  id: string;
  kind: OpportunityKind;
  title: LText;
  provider: string;
  where: LText;
  levels: Level[];
  funding: Funding;
  summary: LText;
  route: FlagshipRoute;
  /** The step that is easy to miss: who you apply through, and what is checked first. */
  routeNote: LText;
  windows: MonthWindow[];
  /** Dates are set per course, university or sitting, so the months are only a rough guide. */
  variable?: boolean;
  windowNote: LText;
  /** Start preparing this many months before the window opens. */
  prepMonths: number;
  prep: LText[];
  official: string;
  /** The dates of the current or next call, when they are known. */
  cycle?: FlagshipCycle;
  tags: string[];
  /** Ids of guides in /opportunities/guides that help with this programme. */
  guides?: string[];
  /** YYYY-MM-DD: when RAAHI last reviewed this entry. */
  reviewed: string;
}

export type FlagshipPhase = "closing-soon" | "open" | "typically-open" | "upcoming" | "closed" | "off-season";

export interface FlagshipStatus {
  phase: FlagshipPhase;
  /** Days until the announced deadline (open / closing-soon / typically-open with a known deadline). */
  daysLeft?: number;
  /** Days until a confirmed opening date (upcoming). */
  daysToOpen?: number;
  /** Whole months until the usual window next opens (0 = it is open this month). */
  monthsToOpen: number;
  /** The usual window opens within `prepMonths`, or an announced call is about to open: time to prepare. */
  prepareNow: boolean;
  /** Month (1–12) in which the next usual window starts. */
  nextOpensMonth: number;
}

export interface PlannerEntry {
  flagship: Flagship;
  status: FlagshipStatus;
}

export interface Planner {
  /** Today in Pakistan, YYYY-MM-DD. */
  today: string;
  month: number;
  /** Open now, closing soon, or usually open this month — sorted by urgency. */
  act: PlannerEntry[];
  /** Announced or expected to open shortly. */
  soon: PlannerEntry[];
  /** Not open, but the preparation lead time has started. */
  prepare: PlannerEntry[];
  /** Everything else, by how soon it next opens. */
  later: PlannerEntry[];
}

export const CLOSING_SOON_DAYS = 14;
/** A cycle that ended this long ago no longer describes the programme's next call. */
export const STALE_CYCLE_DAYS = 120;

export function inWindow(month: number, window: MonthWindow): boolean {
  return window.from <= window.to ? month >= window.from && month <= window.to : month >= window.from || month <= window.to;
}

/** Whole months from `month` until `target` (0 when they are the same month). */
export function monthsUntil(month: number, target: number): number {
  return (((target - month) % 12) + 12) % 12;
}

/** The month names are rendered with `Intl` on the client; this is the 12-cell strip used by the year grid. */
export function windowStrip(flagship: Pick<Flagship, "windows">): boolean[] {
  return Array.from({ length: 12 }, (_, index) => flagship.windows.some((window) => inWindow(index + 1, window)));
}
