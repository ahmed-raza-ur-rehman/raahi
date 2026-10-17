import { clockNow } from "./clock";
import { todayInPakistan } from "./dates";
import { buildPlanner } from "./flagships";
import { searchOpportunities } from "./store";
import type { OpportunityView } from "./types";

/**
 * A short message of what matters today — closing soon, new, programmes to act on — written to be pasted into
 * WhatsApp or posted to a Telegram channel. It is built from the same live data and planner as the website, with the
 * same honesty: every line links to its page on RAAHI, which links to the original.
 */

export interface DigestLine {
  text: string;
  url: string;
}

export interface DigestSection {
  id: "closing" | "new-pakistan" | "new-abroad" | "programmes";
  title: string;
  lines: DigestLine[];
}

export interface Digest {
  date: string;
  language: "en" | "ur";
  sections: DigestSection[];
  /** WhatsApp style: *bold*, plain links. */
  text: string;
  /** Telegram HTML: <b>, <a href>. */
  html: string;
}

export interface DigestOptions {
  origin: string;
  now?: Date;
  language?: "en" | "ur";
  /** Upper bound for the message (Telegram allows 4096; a WhatsApp share link should stay far shorter). */
  maxChars?: number;
}

const COPY = {
  en: {
    title: "RAAHI — what to look at today",
    closing: "⏰ Closing within 7 days",
    pakistan: "🇵🇰 New in Pakistan",
    abroad: "🌍 New scholarships and programmes abroad",
    programmes: "📅 Yearly programmes to act on now",
    footer: "Confirm details on the official page before you apply or pay. RAAHI never asks for money or documents.",
    daysLeft: (days: number) => (days === 1 ? "1 day left" : `${days} days left`),
    closes: "closes",
    closesToday: "closes today",
    more: "More",
  },
  ur: {
    title: "راہی — آج کیا دیکھیں",
    closing: "⏰ 7 دن میں بند ہونے والے",
    pakistan: "🇵🇰 پاکستان میں نئے",
    abroad: "🌍 بیرون ملک نئی اسکالرشپس اور پروگرام",
    programmes: "📅 سالانہ پروگرام جن پر ابھی عمل کریں",
    footer: "اپلائی کرنے یا ادائیگی سے پہلے سرکاری صفحے پر تفصیل کی تصدیق کریں۔ راہی کبھی پیسے یا دستاویزات نہیں مانگتا۔",
    daysLeft: (days: number) => `${days} دن باقی`,
    closes: "بند",
    closesToday: "آج بند",
    more: "مزید",
  },
} as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

/** "closes today", or "closes 20 Oct · 5 days left" — never both. */
function closing(deadline: string | undefined, daysLeft: number | null | undefined, language: "en" | "ur"): string | undefined {
  if (!deadline) return undefined;
  const copy = COPY[language];
  if (daysLeft === 0) return copy.closesToday;
  return `${copy.closes} ${shortDate(deadline)}${daysLeft !== null && daysLeft !== undefined && daysLeft > 0 ? ` · ${copy.daysLeft(daysLeft)}` : ""}`;
}

function itemLine(item: OpportunityView, origin: string, language: "en" | "ur"): DigestLine {
  const detail = [item.organization, closing(item.deadline, item.daysLeft, language)].filter(Boolean).join(" · ");
  return { text: `${item.title}${detail ? ` — ${detail}` : ""}`, url: `${origin}/opportunities/${item.id}` };
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function render(date: string, language: "en" | "ur", sections: DigestSection[], origin: string): Pick<Digest, "text" | "html"> {
  const copy = COPY[language];
  const heading = `${copy.title} · ${date}`;
  const text = [`*${heading}*`, ...sections.flatMap((section) => ["", `*${section.title}*`, ...section.lines.map((line) => `• ${line.text}\n  ${line.url}`)]), "", copy.footer, `${copy.more}: ${origin}/opportunities`].join("\n");
  const html = [`<b>${escapeHtml(heading)}</b>`, ...sections.flatMap((section) => ["", `<b>${escapeHtml(section.title)}</b>`, ...section.lines.map((line) => `• <a href="${escapeHtml(line.url)}">${escapeHtml(line.text)}</a>`)]), "", escapeHtml(copy.footer), `<a href="${escapeHtml(origin)}/opportunities">${copy.more}</a>`].join("\n");
  return { text, html };
}

/** Drop the last line of the longest section until the message fits; a section left empty disappears. */
function fit(date: string, language: "en" | "ur", sections: DigestSection[], origin: string, maxChars: number): { sections: DigestSection[]; text: string; html: string } {
  let current = sections.map((section) => ({ ...section, lines: [...section.lines] }));
  for (let guard = 0; guard < 200; guard += 1) {
    const rendered = render(date, language, current, origin);
    if (rendered.text.length <= maxChars && rendered.html.length <= Math.max(maxChars * 2, 4096)) return { sections: current, ...rendered };
    const longest = [...current].sort((a, b) => b.lines.length - a.lines.length)[0];
    if (!longest || longest.lines.length === 0) return { sections: current, ...rendered };
    longest.lines.pop();
    current = current.filter((section) => section.lines.length > 0);
  }
  return { sections: current, ...render(date, language, current, origin) };
}

export function buildDigest(options: DigestOptions): Digest {
  const now = options.now ?? clockNow();
  const language = options.language ?? "en";
  const origin = options.origin.replace(/\/+$/, "");
  const copy = COPY[language];
  const date = todayInPakistan(now);

  // Choose by relevance (which already mixes kinds and sources), then list in the order they close.
  const soon = searchOpportunities({ deadlineWithinDays: 7, openToPakistan: true, limit: 40 }, now)
    .items.filter((item) => item.kind !== "coupon")
    .slice(0, 8)
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));
  const seen = new Set(soon.map((item) => item.id));
  const fresh = (query: Parameters<typeof searchOpportunities>[0], limit: number) =>
    searchOpportunities({ newWithinDays: 2, limit: 40, ...query }, now).items.filter((item) => item.kind !== "coupon" && !seen.has(item.id)).slice(0, limit);
  const pakistan = fresh({ scope: "pakistan" }, 5);
  pakistan.forEach((item) => seen.add(item.id));
  const abroad = fresh({ scope: "international", kinds: ["scholarship", "fellowship", "internship", "competition", "grant"], openToPakistan: true }, 4);

  const planner = buildPlanner(undefined, now);
  const programmes = planner.act
    .filter((entry) => entry.status.phase === "closing-soon" || entry.status.phase === "open")
    .slice(0, 3)
    .map((entry): DigestLine => ({
      text: `${language === "en" ? entry.flagship.title.en : entry.flagship.title.ur}${entry.flagship.cycle?.closes ? ` — ${closing(entry.flagship.cycle.closes, entry.status.daysLeft, language)}` : ""}`,
      url: `${origin}/opportunities/calendar#${entry.flagship.id}`,
    }));

  const sections: DigestSection[] = [
    { id: "closing" as const, title: copy.closing, lines: soon.map((item) => itemLine(item, origin, language)) },
    { id: "programmes" as const, title: copy.programmes, lines: programmes },
    { id: "new-pakistan" as const, title: copy.pakistan, lines: pakistan.map((item) => itemLine(item, origin, language)) },
    { id: "new-abroad" as const, title: copy.abroad, lines: abroad.map((item) => itemLine(item, origin, language)) },
  ].filter((section) => section.lines.length > 0);

  const fitted = fit(date, language, sections, origin, options.maxChars ?? 3800);
  return { date, language, sections: fitted.sections, text: fitted.text, html: fitted.html };
}
