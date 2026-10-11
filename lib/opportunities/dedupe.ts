import { diffDays } from "./dates";
import { jaccard } from "./text";
import type { AlsoOn, Opportunity, OpportunityKind } from "./types";

/**
 * Collapse the same opportunity listed on several aggregators into one record.
 *
 * Matching is deliberately conservative (it is worse to hide a distinct scholarship than to
 * show a duplicate): same kind family, high title-token overlap, and compatible deadlines.
 * The most authoritative source wins; the others are kept in `alsoOn` for transparency.
 */

const FAMILY: Partial<Record<OpportunityKind, string>> = {
  scholarship: "funding",
  fellowship: "funding",
  grant: "funding",
  course: "learning",
  training: "learning",
};

const NEVER_MERGE: ReadonlySet<OpportunityKind> = new Set(["coupon", "notice"]);

function family(kind: OpportunityKind) {
  return FAMILY[kind] ?? kind;
}

function tokensOf(item: Opportunity): string[] {
  return item.dedupeKey.split(" ").filter(Boolean);
}

function compatible(a: Opportunity, b: Opportunity): boolean {
  if (family(a.kind) !== family(b.kind)) return false;
  if (a.deadline && b.deadline && Math.abs(diffDays(a.deadline, b.deadline)) > 45) return false;
  if (a.kind === "job" || a.kind === "internship") {
    // Different employers can share a job title; require matching organisations when both are known.
    if (a.organization && b.organization && a.organization.toLowerCase() !== b.organization.toLowerCase()) return false;
  }
  return true;
}

function betterThan(a: Opportunity, b: Opportunity, authority: (sourceId: string) => number): boolean {
  const authA = authority(a.sourceId);
  const authB = authority(b.sourceId);
  if (authA !== authB) return authA < authB;
  if (Boolean(a.deadline) !== Boolean(b.deadline)) return Boolean(a.deadline);
  return Date.parse(a.firstSeen) <= Date.parse(b.firstSeen);
}

function mergeInto(winner: Opportunity, loser: Opportunity): Opportunity {
  const alsoOn: AlsoOn[] = [...(winner.alsoOn ?? [])];
  const push = (entry: AlsoOn) => {
    if (entry.url !== winner.url && !alsoOn.some((existing) => existing.url === entry.url)) alsoOn.push(entry);
  };
  push({ sourceName: loser.sourceName, url: loser.url });
  for (const other of loser.alsoOn ?? []) push(other);

  return {
    ...winner,
    summary: winner.summary ?? loser.summary,
    country: winner.country ?? loser.country,
    funding: winner.funding ?? loser.funding,
    deadline: winner.deadline ?? loser.deadline,
    deadlineText: winner.deadline ? winner.deadlineText : loser.deadlineText ?? winner.deadlineText,
    levels: winner.levels.length > 0 ? winner.levels : loser.levels,
    fields: winner.fields.length > 0 ? winner.fields : loser.fields,
    postedAt: [winner.postedAt, loser.postedAt].filter(Boolean).sort()[0],
    firstSeen: winner.firstSeen < loser.firstSeen ? winner.firstSeen : loser.firstSeen,
    openToPakistan: winner.openToPakistan ?? loser.openToPakistan,
    eligibilityNote: winner.eligibilityNote ?? loser.eligibilityNote,
    alsoOn: alsoOn.length > 0 ? alsoOn : undefined,
  };
}

export function dedupeOpportunities(
  items: ReadonlyArray<Opportunity>,
  authority: (sourceId: string) => number = () => 4,
): Opportunity[] {
  const result: Array<Opportunity | undefined> = [];
  const tokenIndex = new Map<string, number[]>();
  const exact = new Map<string, number>();

  const register = (position: number, item: Opportunity) => {
    exact.set(`${family(item.kind)}|${item.dedupeKey}`, position);
    for (const token of tokensOf(item)) {
      const list = tokenIndex.get(token);
      if (list) list.push(position);
      else tokenIndex.set(token, [position]);
    }
  };

  for (const item of items) {
    if (NEVER_MERGE.has(item.kind)) {
      result.push(item);
      continue;
    }

    let matchPosition = exact.get(`${family(item.kind)}|${item.dedupeKey}`);
    const existingExact = matchPosition !== undefined ? result[matchPosition] : undefined;
    if (!existingExact || !compatible(existingExact, item)) matchPosition = undefined;

    if (matchPosition === undefined) {
      const tokens = tokensOf(item);
      const sharedCounts = new Map<number, number>();
      for (const token of tokens) {
        for (const position of tokenIndex.get(token) ?? []) {
          sharedCounts.set(position, (sharedCounts.get(position) ?? 0) + 1);
        }
      }
      let bestScore = 0;
      for (const [position, shared] of sharedCounts) {
        const other = result[position];
        if (!other || shared < 2 || !compatible(other, item)) continue;
        const score = jaccard(tokens, tokensOf(other));
        const minTokens = Math.min(tokens.length, tokensOf(other).length);
        if (score >= 0.8 && minTokens >= 2 && score > bestScore) {
          bestScore = score;
          matchPosition = position;
        }
      }
    }

    if (matchPosition === undefined) {
      result.push(item);
      register(result.length - 1, item);
      continue;
    }

    const existing = result[matchPosition] as Opportunity;
    const merged = betterThan(item, existing, authority) ? mergeInto(item, existing) : mergeInto(existing, item);
    result[matchPosition] = merged;
    register(matchPosition, merged);
  }

  return result.filter((item): item is Opportunity => item !== undefined);
}
