import { addDays } from "../dates";
import type { Opportunity, OpportunityKind } from "../types";

/** Keep closed items this long so shared links still resolve ("closed 3 days ago") before they vanish. */
export const CLOSED_GRACE_DAYS = 14;

/** Days since an item was last listed by its source before we assume it is gone (no-deadline items). */
const STALE_AFTER_DAYS: Record<OpportunityKind, number> = {
  coupon: 2,
  notice: 120,
  job: 30,
  internship: 45,
  scholarship: 60,
  fellowship: 60,
  grant: 60,
  competition: 14,
  admission: 45,
  course: 90,
  training: 90,
};

const DAY_MS = 86_400_000;

/** Instant (epoch ms) after which an item should no longer be listed. */
export function expiryOf(item: Opportunity): number {
  if (item.deadline) return Date.parse(`${addDays(item.deadline, CLOSED_GRACE_DAYS)}T23:59:59+05:00`);
  if (item.kind === "notice") return Date.parse(item.postedAt ?? item.firstSeen) + STALE_AFTER_DAYS.notice * DAY_MS;
  return Date.parse(item.lastSeen) + STALE_AFTER_DAYS[item.kind] * DAY_MS;
}

export function isExpired(item: Opportunity, now: Date): boolean {
  return now.getTime() > expiryOf(item);
}

export interface MergeInput {
  previous: ReadonlyArray<Opportunity>;
  fresh: ReadonlyArray<Opportunity>;
  now: Date;
  /** Sources that returned usable data this run. Items of other sources are kept (stale-while-error). */
  succeeded: ReadonlySet<string>;
  retainHours: ReadonlyMap<string, number | undefined>;
}

/**
 * Combine the previous snapshot with this run's results:
 *  - items seen again keep their original `firstSeen` (so "New" badges are honest) and refresh `lastSeen`;
 *  - if a source failed this run its old items stay (a broken scraper must not empty the site);
 *  - if a source succeeded but stopped listing an item, `retainHours` decides (0 = drop, e.g. sold-out coupons);
 *  - anything past its deadline + grace, or stale beyond its kind's TTL, is removed.
 */
export function mergeSnapshot({ previous, fresh, now, succeeded, retainHours }: MergeInput): Opportunity[] {
  const previousById = new Map(previous.map((item) => [item.id, item]));
  const freshIds = new Set<string>();
  const merged: Opportunity[] = [];
  const nowIso = now.toISOString();

  for (const item of fresh) {
    freshIds.add(item.id);
    const before = previousById.get(item.id);
    merged.push({ ...item, firstSeen: before?.firstSeen ?? item.firstSeen, lastSeen: nowIso });
  }

  for (const old of previous) {
    if (freshIds.has(old.id)) continue;
    if (succeeded.has(old.sourceId)) {
      const retain = retainHours.get(old.sourceId);
      if (retain === 0) continue;
      if (retain !== undefined && now.getTime() - Date.parse(old.lastSeen) > retain * 3_600_000) continue;
    }
    merged.push(old);
  }

  return merged.filter((item) => !isExpired(item, now));
}

export function sortForDisplay(items: Opportunity[]): Opportunity[] {
  return [...items].sort((a, b) => {
    const left = Date.parse(a.postedAt ?? a.firstSeen);
    const right = Date.parse(b.postedAt ?? b.firstSeen);
    return right - left || a.title.localeCompare(b.title);
  });
}

