import { getResources, searchResources } from "@/lib/opportunities/directory";
import { appUrl, recommendPrep } from "@/lib/opportunities/ecosystem";
import { searchFlagshipsScored, summarizeFlagship, type PlannerEntry } from "@/lib/opportunities/flagships";
import { STRONG_MATCH, searchGuidesScored, tokenize, type Guide } from "@/lib/opportunities/guides";
import { interpretQuery } from "@/lib/opportunities/query";
import { analyzeOffer } from "@/lib/opportunities/scam";
import { getStatus, prepareOpportunities, searchOpportunities } from "@/lib/opportunities/store";
import {
  FUNDING_TYPES,
  LEVELS,
  OPPORTUNITY_KINDS,
  RESOURCE_CATEGORIES,
  type OpportunityQuery,
  type OpportunityView,
  type ResourceCategory,
} from "@/lib/opportunities/types";

/**
 * Chat tools for the Opportunities hub. They return compact JSON for the model (and the same compact
 * records for the UI cards), always with the official link, the deadline and how fresh the data is, so the
 * assistant can cite instead of inventing.
 */

export const OPPORTUNITY_TOOL_NAMES = ["search_opportunities", "find_resources", "check_offer_risk", "find_guides", "find_programmes"] as const;

export interface OpportunityToolDefinition {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export const OPPORTUNITY_TOOLS: OpportunityToolDefinition[] = [
  {
    type: "function" as const,
    function: {
      name: "search_opportunities",
      description:
        "Search RAAHI's live feed of scholarships, fellowships, government and private jobs (Pakistan, remote and overseas), internships, competitions, free courses/coupons, grants and BE&OE overseas-employment notices. Results carry deadlines, the official link and eligibility hints. Use this for any question about scholarships, jobs, internships, courses or going abroad — never answer those from memory, and never invent a deadline.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What the person wants, in their own words (any language), e.g. 'fully funded masters germany' or 'سرکاری نوکری'." },
          kind: { type: "string", enum: [...OPPORTUNITY_KINDS, "any"], description: "Type of opportunity. Use 'notice' for BE&OE regulator notices (blacklists, show-cause, complaints)." },
          scope: { type: "string", enum: ["pakistan", "international", "any"], description: "pakistan = in Pakistan; international = abroad or remote." },
          country: { type: "string", description: "Destination country in English, e.g. Germany, Saudi Arabia." },
          level: { type: "string", enum: LEVELS.filter((level) => level !== "any"), description: "Study level." },
          funding: { type: "string", enum: FUNDING_TYPES.filter((funding) => funding !== "unknown"), description: "Funding type." },
          open_to_pakistan: { type: "boolean", description: "Hide listings that look restricted to other nationalities. Default true." },
          deadline_within_days: { type: "number", description: "Only listings closing within this many days." },
          remote: { type: "boolean", description: "Only remote/online listings." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_resources",
      description:
        "Find official portals and trusted websites in RAAHI's curated directory: NJP, public service commissions (FPSC, PPSC, AJKPSC…), NTS, HEC, NAVTTC, DigiSkills, PSEB, BE&OE, OEC, scholarship programmes (Chevening, DAAD, Fulbright…), free learning platforms (edX, Harvard CS50, Coursera…), exam-prep tools, document attestation and complaint channels.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Topic or name, e.g. 'overseas employment agent verification' or 'free python course'." },
          category: { type: "string", enum: [...RESOURCE_CATEGORIES], description: "Optional category filter." },
          official_only: { type: "boolean", description: "Only government / institutional sources." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "check_offer_risk",
      description:
        "Check the text of a job, visa, scholarship or admission offer (for example a WhatsApp message from an agent) for common scam red flags. Call this whenever the user pastes or describes an offer that asks for money, promises guaranteed visas/jobs, or comes from an unlicensed agent. It lists warning signs and how to verify officially; it never declares an offer 'safe'.",
      parameters: {
        type: "object",
        properties: { text: { type: "string", description: "The offer or message text, as written by the sender." } },
        required: ["text"],
      },
    },
  },
];

OPPORTUNITY_TOOLS.push({
  type: "function" as const,
  function: {
    name: "find_guides",
    description:
      "Find RAAHI's step-by-step guides for 'how do I…' and 'what should I do…' questions: what to do after Matric/FSc, applying for government jobs, preparing for CSS/PMS/MDCAT, working abroad safely (BE&OE, OEP, OEC), spotting fake offers, attesting documents (HEC, IBCC, MOFA apostille), a study-abroad roadmap, English tests, CV/SOP, internships, freelancing and learning for free. Summarise the steps it returns, name the official links, and point to the guide page. Never add fees, ages, quotas or dates that the guide does not contain.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "The question or topic in the user's own words (any language), e.g. 'apostille kaise' or 'fsc ke baad kya karein'." } },
      required: ["query"],
    },
  },
});

OPPORTUNITY_TOOLS.push({
  type: "function" as const,
  function: {
    name: "find_programmes",
    description:
      "Look up RAAHI's yearly planner for recurring scholarships, exams and programmes — Chevening, Commonwealth, Fulbright, DAAD, Stipendium Hungaricum, Türkiye Bursları, Chinese Government (CSC), MEXT, GKS, Erasmus Mundus, Aga Khan, World Bank, HEC HAT, CSS/FPSC, KPPSC PMS, MDCAT, ECAT, Google Summer of Code, Outreachy, NASA Space Apps and more. Use it for 'when does X open or close', 'is X open now', 'what should I prepare for X', 'what opens this month' or 'what should I start preparing'. It returns the usual months, the latest confirmed dates (each marked official or reported, with the day it was checked), how a person in Pakistan actually applies, and a preparation checklist.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The programme or topic in the user's own words (any language), e.g. 'chevening' or 'fulbright kab khulta hai'. Leave empty to list what matters now." },
        kind: { type: "string", enum: [...OPPORTUNITY_KINDS], description: "Optional: scholarship, job (exams such as CSS), admission (entry tests), internship, competition …" },
        only_now: { type: "boolean", description: "True to keep only programmes that are open, opening soon, or whose preparation window has started." },
      },
    },
  },
});

export function isOpportunityTool(name: string): boolean {
  return (OPPORTUNITY_TOOL_NAMES as readonly string[]).includes(name);
}

// ─── Compact records shared by the model and the UI ──────────────────────────

export interface CompactOpportunity {
  id: string;
  title: string;
  kind: string;
  organization?: string;
  country?: string;
  scope: string;
  deadline?: string;
  days_left: number | null;
  status: string;
  funding?: string;
  open_to_pakistan?: boolean;
  eligibility_note?: string;
  source_name: string;
  url: string;
  raahi_url: string;
  summary?: string;
  is_new: boolean;
  prep?: Array<{ name: string; url: string; why: string }>;
}

export function compactOpportunity(item: OpportunityView): CompactOpportunity {
  const prep = recommendPrep({
    kind: item.kind,
    title: item.title,
    organization: item.organization,
    summary: item.summary,
    tags: item.tags,
    jobType: typeof item.extra?.jobType === "string" ? item.extra.jobType : undefined,
  }).map(({ app, reason }) => ({ name: app.name, url: appUrl(app, "", "chat"), why: reason.en }));
  return {
    id: item.id,
    title: item.title,
    kind: item.kind,
    organization: item.organization,
    country: item.country,
    scope: item.scope,
    deadline: item.deadline,
    days_left: item.daysLeft,
    status: item.status,
    funding: item.funding,
    open_to_pakistan: item.openToPakistan ?? undefined,
    eligibility_note: item.eligibilityNote,
    source_name: item.sourceName,
    url: item.url,
    raahi_url: `/opportunities/${item.id}`,
    summary: item.summary?.slice(0, 220),
    is_new: item.isNew,
    ...(prep.length > 0 ? { prep } : {}),
  };
}

/** What the chat card needs: both languages, so the UI can follow the reader's language. */
export interface ChatGuideCard {
  id: string;
  emoji: string;
  title: { en: string; ur: string };
  summary: { en: string; ur: string };
  steps: number;
  url: string;
}

export function compactGuide(guide: Guide): ChatGuideCard {
  return { id: guide.id, emoji: guide.emoji, title: { en: guide.title.en, ur: guide.title.ur }, summary: { en: guide.summary.en, ur: guide.summary.ur }, steps: guide.steps.length, url: `/opportunities/guides/${guide.id}` };
}

function guideForModel(guide: Guide) {
  const ids = [...new Set(guide.resourceIds)].slice(0, 8);
  return {
    id: guide.id,
    title: guide.title.en,
    title_ur: guide.title.ur,
    for_whom: guide.audience.en,
    guide_url: `/opportunities/guides/${guide.id}`,
    steps: guide.steps.map((step) => ({ title: step.title.en, ...(step.when ? { when: step.when.en } : {}), detail: step.body.en })),
    have_ready: guide.checklist.slice(0, 8).map((item) => item.en),
    mistakes_to_avoid: guide.pitfalls.slice(0, 4).map((item) => item.en),
    official_links: getResources(ids).map((resource) => ({ name: resource.name, url: resource.url })),
    last_reviewed: guide.reviewed,
    based_on: guide.sources,
  };
}

export interface ChatProgrammeCard {
  id: string;
  title: { en: string; ur: string };
  provider: string;
  phase: string;
  days_left?: number;
  days_to_open?: number;
  opens?: string;
  closes?: string;
  confidence?: "official" | "reported";
  usual: { en: string; ur: string };
  url: string;
}

export function compactProgramme(entry: PlannerEntry): ChatProgrammeCard {
  const { flagship, status } = entry;
  return {
    id: flagship.id,
    title: { en: flagship.title.en, ur: flagship.title.ur },
    provider: flagship.provider,
    phase: status.phase,
    days_left: status.daysLeft,
    days_to_open: status.daysToOpen,
    opens: flagship.cycle?.opens,
    closes: flagship.cycle?.closes,
    confidence: flagship.cycle?.confidence,
    usual: { en: flagship.windowNote.en, ur: flagship.windowNote.ur },
    url: `/opportunities/calendar#${flagship.id}`,
  };
}

function programmeForModel(entry: PlannerEntry) {
  const summary = summarizeFlagship(entry, "en");
  return { ...summary, planner_url: `/opportunities/calendar#${entry.flagship.id}` };
}

const oneOf = <T extends string>(allowed: readonly T[], value: unknown): T | undefined => (typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined);

export interface OpportunityToolResult {
  found: boolean;
  count: number;
  total: number;
  generated_at?: string;
  freshness: string;
  interpreted?: unknown;
  results: CompactOpportunity[];
  note?: string;
}

/** Shared by the tool, the offline fallback and tests. */
export async function runOpportunitySearch(query: OpportunityQuery, limit = 6): Promise<OpportunityToolResult> {
  await prepareOpportunities();
  const result = searchOpportunities({ ...query, limit });
  const status = getStatus();
  return {
    found: result.items.length > 0,
    count: result.items.length,
    total: result.total,
    generated_at: status.generatedAt,
    freshness: status.ageHours === null ? "unknown" : `Listings were last refreshed about ${Math.round(status.ageHours)} hour(s) ago from public sources. Deadlines and eligibility must be confirmed on the official page.`,
    interpreted: result.interpreted,
    results: result.items.map(compactOpportunity),
    note: result.items.length === 0 ? "No live listing matched. Suggest the curated directory (find_resources) or broader words, and do not guess." : undefined,
  };
}

export async function executeOpportunityTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "search_opportunities": {
      const kind = oneOf([...OPPORTUNITY_KINDS, "any"] as const, args.kind);
      const scope = oneOf(["pakistan", "international", "any"] as const, args.scope);
      const query: OpportunityQuery = {
        q: typeof args.query === "string" ? args.query.slice(0, 200) : undefined,
        kinds: kind && kind !== "any" ? [kind] : undefined,
        scope: scope && scope !== "any" ? scope : undefined,
        country: typeof args.country === "string" ? args.country.slice(0, 80) : undefined,
        level: oneOf(LEVELS, args.level),
        funding: oneOf(FUNDING_TYPES, args.funding),
        openToPakistan: args.open_to_pakistan === false ? undefined : true,
        deadlineWithinDays: typeof args.deadline_within_days === "number" ? Math.max(1, Math.min(365, Math.round(args.deadline_within_days))) : undefined,
        remote: args.remote === true ? true : undefined,
      };
      return JSON.stringify(await runOpportunitySearch(query));
    }

    case "find_resources": {
      const category = oneOf(RESOURCE_CATEGORIES, args.category) as ResourceCategory | undefined;
      const result = searchResources({ q: typeof args.query === "string" ? args.query.slice(0, 200) : undefined, category, official: args.official_only === true || undefined });
      const authority = { 1: "government / regulator", 2: "university or institution", 3: "nonprofit or platform", 4: "community site — verify before acting" } as const;
      return JSON.stringify({
        found: result.total > 0,
        total: result.total,
        results: result.items.slice(0, 8).map((item) => ({
          id: item.id,
          name: item.name,
          name_ur: item.nameUr,
          url: item.url,
          category: item.category,
          run_by: authority[item.authority],
          link_confirmed_on: item.checked,
          description: item.description,
          note: item.note,
          related_raahi_services: item.related?.map((service) => ({ id: service.id, name: service.name })),
        })),
      });
    }

    case "find_guides": {
      const matches = searchGuidesScored({ q: typeof args.query === "string" ? args.query.slice(0, 200) : undefined, limit: 3 }).filter((entry, index) => index === 0 || entry.score >= STRONG_MATCH);
      return JSON.stringify({
        found: matches.length > 0,
        results: matches.map(({ guide }) => guideForModel(guide)),
        ui_cards: matches.map(({ guide }) => compactGuide(guide)),
        note: matches.length === 0 ? "No guide matched. Answer briefly, point to find_resources for official portals, and do not guess." : "Summarise the steps in the user's language and give the guide_url. Do not add figures that are not in the guide.",
      });
    }

    case "find_programmes": {
      const kind = oneOf(OPPORTUNITY_KINDS, args.kind);
      const query = typeof args.query === "string" ? args.query.slice(0, 200) : undefined;
      let entries = searchFlagshipsScored({ q: query, kind, limit: 12 }).map((scored) => scored.entry);
      if (args.only_now === true) {
        entries = entries.filter(({ status }) => ["closing-soon", "open", "typically-open", "upcoming"].includes(status.phase) || status.prepareNow);
      }
      entries = entries.slice(0, 4);
      return JSON.stringify({
        found: entries.length > 0,
        results: entries.map(programmeForModel),
        ui_cards: entries.slice(0, 3).map(compactProgramme),
        note:
          entries.length === 0
            ? "No programme in the yearly planner matched. Try find_resources for official portals or search_opportunities for live listings, and do not guess dates."
            : "Give the dates exactly as returned and say whether each is 'official' or 'reported' and when it was checked; for 'reported' dates tell the user to confirm on the official site. If a call is closed, say so and give the usual opening month instead of inventing a new date. Give the planner_url and the official link.",
      });
    }

    case "check_offer_risk": {
      const text = typeof args.text === "string" ? args.text : "";
      const analysis = analyzeOffer({ text });
      return JSON.stringify({
        risk_level: analysis.level,
        score: analysis.score,
        headline: analysis.headline.en,
        warning_signs: analysis.signals.map((signal) => signal.en),
        licences_found: analysis.oepLicences.map((licence) => `${licence.number}/${licence.city}`),
        what_to_do: analysis.advice.map((advice) => ({ text: advice.en, url: advice.url })),
        disclaimer: analysis.disclaimer.en,
      });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// ─── Offline fallback (no API key): decide whether a message is about opportunities ───

const INTENT_PATTERN =
  /\b(?:admissions?|scholarships?|fellowships?|internships?|jobs?|vacanc(?:y|ies)|hiring|careers?|hackathons?|competitions?|courses?|coupons?|udemy|coursera|edx|abroad|overseas|visa|emigrat\w*|oep|beoe|be&oe|oec|eps korea|protector|manpower|agent|scam|fraud|fake|ielts|toefl|gre|css|pms|fpsc|ppsc|ajkpsc|kppsc|spsc|nts|mdcat|digiskills|navttc|pseb|njp|nastp|chevening|fulbright|daad|commonwealth|erasmus|naukri|wazifa|sarkari|bahar)\b|داخلہ|داخلے|اسکالرشپ|سکالرشپ|نوکری|نوکریاں|ملازمت|روزگار|انٹرن|کورس|مقابلہ|بیرون\s*ملک|ویزا|ایجنٹ|فراڈ|دھوکہ|آئیلٹس|پبلک سروس|بھرتی|آسامی|دنده|دندې|بهر/i;

/** Questions that ask for steps ("how do I…", "…kaise", "kya karein") — a guide is the right answer even without a kind keyword. */
const HOWTO_PATTERN = /\b(?:how (?:do|can|to)|what (?:should|to do)|steps?|process|procedure|guide|roadmap|checklist|kaise|kese|kaisay|kya karein|kya karun|tareeqa|tariqa)\b|کیسے|کیا کریں|کیا کروں|طریقہ|رہنمائی|مرحل/i;

/** A guide the user plausibly wants: they asked how to do something, or named a topic a guide covers by title/keyword. */
export function guideForMessage(message: string): ChatGuideCard[] {
  const strong = searchGuidesScored({ q: message.slice(0, 300), limit: 2 }).filter((entry) => entry.score >= STRONG_MATCH);
  if (strong.length === 0) return [];
  if (HOWTO_PATTERN.test(message) || strong[0].score >= STRONG_MATCH + 4) return strong.map(({ guide }) => compactGuide(guide));
  return [];
}

/**
 * Timing and preparation words in English, Roman Urdu and Urdu: "when does it open", "kab khulta hai", "last date",
 * "kya tayari karein". A message that names a programme AND asks about timing gets the planner card.
 */
const TIMING_PATTERN = /\b(?:when|opens?|opening|clos(?:e|es|ing)|deadlines?|last date|dates?|schedule|calendar|timeline|prepare|preparation|next|this month|kab|khulta|khulti|khulte|band|aakhri|akhri|tareekh|tayari)\b|کب|کھل|بند|تاریخ|آخری|تیاری|شیڈول/i;

/**
 * Planner cards for a message that names a programme (and asks when/how to prepare, or is just the name).
 * "Names" means a word that belongs to exactly one programme's title — "chevening", "fulbright", "css", "mdcat" —
 * not words shared by many ("scholarship", "uk", "test"), so ordinary searches are left to the listings.
 */
export function programmesForMessage(message: string): ChatProgrammeCard[] {
  const text = message.slice(0, 300);
  const tokens = tokenize(text);
  if (tokens.length === 0) return [];
  const all = searchFlagshipsScored({ q: text });
  const sharedBy = new Map<string, number>();
  for (const scored of all) for (const token of scored.nameTokens) sharedBy.set(token, (sharedBy.get(token) ?? 0) + 1);
  const specific = all.filter((scored) => scored.nameTokens.some((token) => sharedBy.get(token) === 1));
  if (specific.length === 0) return [];
  const best = specific[0].score;
  const chosen = specific.filter((scored) => scored.score === best).slice(0, 2);
  // "chevening", "chevening vs fulbright", "scholarship in germany": every word is accounted for by the programmes' names.
  const covered = new Set(chosen.flatMap((scored) => scored.nameTokens));
  const justTheName = tokens.length <= 3 && tokens.every((token) => covered.has(token));
  return TIMING_PATTERN.test(text) || justTheName ? chosen.map((scored) => compactProgramme(scored.entry)) : [];
}

export function opportunityIntent(message: string): boolean {
  if (INTENT_PATTERN.test(message)) return true;
  const parsed = interpretQuery(message);
  return Boolean(parsed.kinds && parsed.kinds.length > 0);
}

const OVERSEAS_PATTERN = /\b(?:visa|overseas|abroad|agent|oep|beoe|emigrat\w*|protector|manpower|gulf|saudi|dubai|qatar|kuwait|oman|bahrain)\b|بیرون\s*ملک|ویزا|ایجنٹ|دبئی|سعودی|قطر|کویت/i;

/**
 * Query for the directory when the user's whole message (possibly a pasted offer) is the input. Overseas/agent
 * questions always get the official verification route first; other messages use their meaningful words.
 */
export function resourceQueryFor(message: string, risky: boolean): string {
  if (risky || OVERSEAS_PATTERN.test(message)) return "overseas employment agent licence complaint";
  const parsed = interpretQuery(message);
  const topic = parsed.terms.slice(0, 4).join(" ");
  return [parsed.kinds?.[0], parsed.country, topic].filter(Boolean).join(" ") || message.slice(0, 80);
}
