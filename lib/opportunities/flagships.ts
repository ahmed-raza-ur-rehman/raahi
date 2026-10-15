import { FLAGSHIPS } from "@/data/opportunities/flagships";
import type { Language } from "@/lib/types";
import { clockNow } from "./clock";
import { diffDays, todayInPakistan } from "./dates";
import {
  CLOSING_SOON_DAYS,
  STALE_CYCLE_DAYS,
  inWindow,
  monthsUntil,
  type Flagship,
  type FlagshipPhase,
  type FlagshipRoute,
  type FlagshipStatus,
  type Planner,
  type PlannerEntry,
} from "./flagship-core";
import { tokenize } from "./guides";
import { pickText, type LText } from "./ltext";
import type { Funding, Level, OpportunityKind } from "./types";

export * from "./flagship-core";

/**
 * The yearly planner: programmes that come round every year (Chevening, Fulbright, DAAD, CSS, MDCAT, Google Summer
 * of Code …) with the months they usually open and close, how a person in Pakistan actually applies, and what to
 * prepare beforehand.
 *
 * Scraped listings only exist while an advertisement is up. The planner answers the earlier question — "what
 * should I be preparing for right now?" — and is honest about certainty: a date is either `official` (read on the
 * organiser's own page) or `reported` (news or a summary; confirm on the official site), and every entry says
 * when a person last checked it.
 */

export function listFlagships(): Flagship[] {
  return FLAGSHIPS;
}

export function getFlagship(id: string): Flagship | undefined {
  return FLAGSHIPS.find((entry) => entry.id === id);
}

/**
 * When the usual window next opens. With `afterClosedCall`, a window that is "on" this month does not count: the call
 * has already run and closed, so the next one is next year's.
 */
function nextWindow(flagship: Flagship, month: number, afterClosedCall = false): { monthsToOpen: number; nextOpensMonth: number } {
  let best = { monthsToOpen: 12, nextOpensMonth: flagship.windows[0]?.from ?? month };
  for (const window of flagship.windows) {
    const running = inWindow(month, window);
    const months = running && !afterClosedCall ? 0 : monthsUntil(month, window.from) || 12;
    if (months < best.monthsToOpen) best = { monthsToOpen: months, nextOpensMonth: running && !afterClosedCall ? month : window.from };
  }
  return best;
}

export function flagshipStatus(flagship: Flagship, now: Date = clockNow()): FlagshipStatus {
  const today = todayInPakistan(now);
  const month = Number(today.slice(5, 7));
  const { monthsToOpen, nextOpensMonth } = nextWindow(flagship, month);
  const usualNow = flagship.windows.some((window) => inWindow(month, window));
  const cycle = flagship.cycle;

  const result = (phase: FlagshipPhase, extra: Partial<FlagshipStatus> = {}): FlagshipStatus => ({
    phase,
    monthsToOpen,
    nextOpensMonth,
    prepareNow: false,
    ...extra,
  });
  const prepare = (phase: FlagshipPhase) => phase !== "open" && phase !== "closing-soon" && phase !== "typically-open" && monthsToOpen <= flagship.prepMonths;

  if (cycle?.closes) {
    const left = diffDays(today, cycle.closes);
    if (left < 0) {
      // A call that closed months ago says nothing about next year's: once the usual window comes round again the
      // stored cycle is stale, so fall back to "usually open now" rather than claiming it is closed.
      if (usualNow && -left > STALE_CYCLE_DAYS) return result("typically-open");
      const next = nextWindow(flagship, month, true);
      return { phase: "closed", ...next, prepareNow: next.monthsToOpen <= flagship.prepMonths };
    }
    if (cycle.opens && diffDays(today, cycle.opens) > 0) {
      return result("upcoming", { daysToOpen: diffDays(today, cycle.opens), prepareNow: true });
    }
    if (cycle.opens || usualNow) {
      return result(left <= CLOSING_SOON_DAYS ? "closing-soon" : cycle.opens ? "open" : "typically-open", { daysLeft: left });
    }
    // A deadline is known but the opening is not: an announced call that has not opened yet.
    return result("upcoming", { prepareNow: true });
  }
  if (cycle?.opens && !cycle.closes) {
    const toOpen = diffDays(today, cycle.opens);
    return toOpen > 0 ? result("upcoming", { daysToOpen: toOpen, prepareNow: true }) : result("typically-open");
  }
  if (usualNow) return result("typically-open");
  return result("off-season", { prepareNow: prepare("off-season") });
}

const URGENCY: Record<FlagshipPhase, number> = { "closing-soon": 0, open: 1, "typically-open": 2, upcoming: 3, closed: 4, "off-season": 4 };

function compareAct(a: PlannerEntry, b: PlannerEntry): number {
  return URGENCY[a.status.phase] - URGENCY[b.status.phase] || (a.status.daysLeft ?? 999) - (b.status.daysLeft ?? 999) || a.flagship.title.en.localeCompare(b.flagship.title.en);
}

const openingDistance = (entry: PlannerEntry) => entry.status.daysToOpen ?? entry.status.monthsToOpen * 30;

export function buildPlanner(flagships: Flagship[] = FLAGSHIPS, now: Date = clockNow()): Planner {
  const today = todayInPakistan(now);
  const entries = flagships.map((flagship) => ({ flagship, status: flagshipStatus(flagship, now) }));
  const act: PlannerEntry[] = [];
  const soon: PlannerEntry[] = [];
  const prepare: PlannerEntry[] = [];
  const later: PlannerEntry[] = [];
  for (const entry of entries) {
    const { phase, prepareNow } = entry.status;
    if (phase === "closing-soon" || phase === "open" || phase === "typically-open") act.push(entry);
    else if (phase === "upcoming") soon.push(entry);
    else if (prepareNow) prepare.push(entry);
    else later.push(entry);
  }
  const byOpening = (a: PlannerEntry, b: PlannerEntry) => openingDistance(a) - openingDistance(b) || a.flagship.title.en.localeCompare(b.flagship.title.en);
  return { today, month: Number(today.slice(5, 7)), act: act.sort(compareAct), soon: soon.sort(byOpening), prepare: prepare.sort(byOpening), later: later.sort(byOpening) };
}

export interface FlagshipQuery {
  q?: string;
  kind?: OpportunityKind;
  level?: Level;
  funding?: Funding;
  route?: FlagshipRoute;
  limit?: number;
}

function haystack(flagship: Flagship): Array<{ weight: number; words: string[] }> {
  const both = (value: LText) => `${value.en} ${value.ur}`;
  return [
    { weight: 6, words: tokenize(`${both(flagship.title)} ${flagship.provider} ${flagship.id.replace(/-/g, " ")}`) },
    { weight: 5, words: flagship.tags.flatMap(tokenize) },
    { weight: 3, words: tokenize(`${both(flagship.summary)} ${both(flagship.where)}`) },
    { weight: 1, words: tokenize(`${both(flagship.routeNote)} ${both(flagship.windowNote)}`) },
  ];
}

const cache = new Map<string, ReturnType<typeof haystack>>();
const haystackFor = (flagship: Flagship) => {
  let value = cache.get(flagship.id);
  if (!value) {
    value = haystack(flagship);
    cache.set(flagship.id, value);
  }
  return value;
};

/** Matching programmes with their status. With no question, most urgent first (the planner order). */
export function searchFlagships(query: FlagshipQuery = {}, now: Date = clockNow()): PlannerEntry[] {
  const planner = buildPlanner(FLAGSHIPS, now);
  const ordered = [...planner.act, ...planner.soon, ...planner.prepare, ...planner.later];
  const pool = ordered.filter(({ flagship }) => {
    if (query.kind && flagship.kind !== query.kind) return false;
    if (query.level && !flagship.levels.includes(query.level)) return false;
    if (query.funding && flagship.funding !== query.funding) return false;
    if (query.route && flagship.route !== query.route) return false;
    return true;
  });
  const limit = query.limit ?? pool.length;
  const tokens = [...new Set(tokenize(query.q ?? ""))];
  if (tokens.length === 0) return pool.slice(0, limit);

  const scored: Array<{ entry: PlannerEntry; score: number; order: number }> = [];
  pool.forEach((entry, order) => {
    let score = 0;
    let matched = 0;
    for (const token of tokens) {
      let best = 0;
      for (const { weight, words } of haystackFor(entry.flagship)) {
        const hit = words.some((word) => word === token || (token.length >= 3 && (word.startsWith(token) || (word.length >= 4 && token.startsWith(word)))));
        if (hit) best = Math.max(best, weight);
      }
      if (best > 0) matched += 1;
      score += best;
    }
    if (matched >= Math.min(Math.ceil(tokens.length / 2), 2)) scored.push({ entry, score, order });
  });
  return scored
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map(({ entry }) => entry);
}

/** Compact form for the API and the assistant. */
export function summarizeFlagship(entry: PlannerEntry, language: Language = "en") {
  const { flagship, status } = entry;
  const cycle = flagship.cycle;
  return {
    id: flagship.id,
    kind: flagship.kind,
    title: pickText(language, flagship.title),
    provider: flagship.provider,
    where: pickText(language, flagship.where),
    levels: flagship.levels,
    funding: flagship.funding,
    summary: pickText(language, flagship.summary),
    route: flagship.route,
    routeNote: pickText(language, flagship.routeNote),
    usualWindow: pickText(language, flagship.windowNote),
    variable: Boolean(flagship.variable),
    phase: status.phase,
    daysLeft: status.daysLeft,
    daysToOpen: status.daysToOpen,
    monthsToOpen: status.monthsToOpen,
    prepareNow: status.prepareNow,
    prepare: flagship.prep.map((item) => pickText(language, item)),
    cycle: cycle
      ? {
          label: pickText(language, cycle.label),
          opens: cycle.opens,
          closes: cycle.closes,
          closesNote: cycle.closesNote ? pickText(language, cycle.closesNote) : undefined,
          note: cycle.note ? pickText(language, cycle.note) : undefined,
          confidence: cycle.confidence,
          checked: cycle.checked,
          source: cycle.sourceUrl,
        }
      : undefined,
    official: flagship.official,
    reviewed: flagship.reviewed,
  };
}
