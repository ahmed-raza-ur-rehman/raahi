/**
 * Pure text helpers (no Node-only imports) shared by scrapers, the store and the UI.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", laquo: "«", raquo: "»", copy: "©", reg: "®", trade: "™",
  euro: "€", pound: "£", middot: "·", bull: "•", times: "×", eacute: "é", egrave: "è", uuml: "ü", ouml: "ö",
  auml: "ä", szlig: "ß", ccedil: "ç", ntilde: "ñ", aacute: "á", oacute: "ó", iacute: "í", uacute: "ú",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (Number.isFinite(code) && code > 0 && code < 0x110000) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }
      return match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

const BOILERPLATE = [
  /\s*\[?(?:…|&hellip;|\.\.\.)\]?\s*$/i,
  /\s*(?:read more|continue reading|click here to read more)\s*»?\s*$/i,
  /\s*the post .{1,200}? appeared first on .{1,120}$/i,
];

/**
 * Characters that hide or spoof text and have no place in a title or summary: C0/C1 control characters (except tab,
 * line feed, carriage return), bidirectional embeddings / overrides / isolates (the "Trojan Source" family, e.g. U+202E
 * makes "gnp.exe" display as "exe.png"), line and paragraph separators, soft hyphen, word joiner, zero-width space and
 * the byte-order mark. LRM / RLM stay: Urdu mixed with numbers and Latin needs them.
 */
const SPOOFING_OR_INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00AD\u2028\u2029\u202A-\u202E\u2060\u2066-\u2069\u200B\uFEFF]/g;
const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFC]/;

/**
 * Remove invisible and spoofing characters. Zero-width (non-)joiners are kept only between two Arabic-script letters,
 * where Urdu and Persian spelling needs them (e.g. compound words); anywhere else they are noise or obfuscation.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/\u00a0/g, " ")
    .replace(SPOOFING_OR_INVISIBLE, "")
    .replace(/[\u200C\u200D]/g, (joiner, offset: number, whole: string) => (ARABIC_SCRIPT.test(whole[offset - 1] ?? "") && ARABIC_SCRIPT.test(whole[offset + 1] ?? "") ? joiner : ""));
}

/** HTML → single-paragraph plain text. */
export function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  let text = String(html)
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\s*br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|table|blockquote)>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  text = sanitizeText(decodeEntities(text)).replace(/\s+/g, " ").trim();
  for (let pass = 0; pass < 2; pass += 1) {
    for (const pattern of BOILERPLATE) text = text.replace(pattern, "").trim();
  }
  return text;
}

export function cleanTitle(value: string | undefined | null): string {
  return stripHtml(value).replace(/\s+/g, " ").trim();
}

/** Cut at a word boundary and add an ellipsis. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).replace(/[\s,;:.\-–—]+$/, "")}…`;
}

/** Stable, non-cryptographic 53-bit hash rendered as 14 hex chars (cyrb53). Good enough for IDs. */
export function stableHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const value = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return value.toString(16).padStart(14, "0");
}

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mc_|ref$|ref_|source$|spm$|igshid|yclid|msclkid)/i;

/** Lower-case host, drop fragments and tracking parameters (keeps `couponCode`). */
/** localhost, internal-only suffixes, single-label names and IP literals (v4 and v6). */
export function isUnsafeHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan")) return true;
  if (!host.includes(".") && !host.includes(":")) return true;
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[") || host.includes(":");
}

export function canonicalUrl(raw: string, base?: string): string | undefined {
  try {
    const url = new URL(raw.trim(), base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    // A listing never needs credentials, an IP literal or an internal name; they are how "trusted.org@evil.example"-style
    // phishing links and links into private networks are disguised.
    if (url.username || url.password || isUnsafeHost(url.hostname)) return undefined;
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    }
    let result = url.toString();
    if (url.pathname.length > 1 && result.endsWith("/") && !url.search) result = result.slice(0, -1);
    return result.length <= 2048 ? result : undefined;
  } catch {
    return undefined;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const TITLE_STOPWORDS = new Set([
  "scholarship", "scholarships", "scholar", "scholars", "program", "programme", "programs", "programmes",
  "apply", "now", "application", "applications", "applications", "open", "opens", "call", "for", "the", "of",
  "in", "at", "and", "to", "a", "an", "with", "by", "on", "fully", "funded", "funding", "fund", "intake",
  "cycle", "round", "edition", "international", "students", "student", "academic", "year", "new", "is",
  "are", "from", "2nd", "3rd", "4th", "5th",
]);

/** Tokens used to recognise the same opportunity listed on several sites. */
export function titleTokens(title: string): string[] {
  const normalised = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]s\b/g, "s")
    .replace(/\b20\d{2}(?:\s*[-/–]\s*(?:20)?\d{2,4})?\b/g, " ")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ");
  const tokens = normalised.split(/\s+/).filter((token) => token.length > 1 && !TITLE_STOPWORDS.has(token));
  return [...new Set(tokens)];
}

export function dedupeKeyFor(title: string, organization?: string): string {
  const tokens = titleTokens(`${title} ${organization ?? ""}`).sort();
  return tokens.join(" ") || slugify(title);
}

export function jaccard(a: ReadonlyArray<string>, b: ReadonlyArray<string>): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let shared = 0;
  for (const token of new Set(a)) if (setB.has(token)) shared += 1;
  return shared / (new Set(a).size + setB.size - shared);
}

export function uniq<T>(values: ReadonlyArray<T>): T[] {
  return [...new Set(values)];
}

/** Title-case ALL-CAPS words from sources that shout ("MINISTRY OF INTERIOR"). */
export function tidyCase(text: string): string {
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 6 || letters !== letters.toUpperCase()) return text;
  return text
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Of|And|The|For|In|At|To)\b/g, (m) => m.toLowerCase());
}
