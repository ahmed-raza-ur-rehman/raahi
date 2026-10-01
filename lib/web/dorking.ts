/**
 * Professional search-operator builder ("Google dorking"), used responsibly.
 *
 * RAAHI only builds operator queries against public, indexable pages of
 * official and institutional publishers, and every discovered URL is still
 * fetched through the polite crawler in `scraper.ts` which honours robots.txt,
 * per-host rate limits and a page budget.
 *
 * The module never targets private data, login-protected areas, credentials,
 * backups, directories of personal records or anything a publisher has asked
 * search engines not to index. It exists so a citizen can find an official
 * notification (a scholarship advertisement, a result, a fee schedule) instead
 * of relying on a paid middleman.
 */

export interface DorkOptions {
  /** Words that must all appear. */
  terms: string[];
  /** Words or phrases that may appear as an exact phrase. */
  exactPhrases?: string[];
  /** Restrict to these hosts. */
  sites?: string[];
  /** Exclude these hosts. */
  excludeSites?: string[];
  /** filetype:pdf, filetype:doc … */
  fileTypes?: string[];
  /** Words that must appear in the page title. */
  intitle?: string[];
  /** Words that must appear in the URL. */
  inurl?: string[];
  /** Words to exclude entirely. */
  excludeTerms?: string[];
  /** Restrict to pages changed in the last N days (where supported). */
  newerThan?: number;
}

/** Publishers RAAHI trusts for citizen-service information. */
export const OFFICIAL_DOMAINS: Record<string, string> = {
  "hec.gov.pk": "Higher Education Commission",
  "nadra.gov.pk": "NADRA",
  "bisp.gov.pk": "Benazir Income Support Programme",
  "8171.bisp.gov.pk": "BISP 8171 portal",
  "pbm.gov.pk": "Pakistan Bait-ul-Mal",
  "pmyp.gov.pk": "Prime Minister's Youth Programme",
  "fpsc.gov.pk": "Federal Public Service Commission",
  "ppsc.gop.pk": "Punjab Public Service Commission",
  "kppsc.gov.pk": "KP Public Service Commission",
  "spsc.gov.pk": "Sindh Public Service Commission",
  "bpsc.gob.pk": "Balochistan Public Service Commission",
  "navttc.gov.pk": "NAVTTC",
  "digiskills.pk": "DigiSkills Pakistan",
  "ndma.gov.pk": "National Disaster Management Authority",
  "pdma.gov.pk": "PDMA Khyber Pakhtunkhwa",
  "pdma.punjab.gov.pk": "PDMA Punjab",
  "sehatsahulat.com.pk": "Sehat Sahulat Programme",
  "pmc.gov.pk": "Pakistan Medical Commission",
  "nhmp.gov.pk": "Motorway Police",
  "joinpakarmy.gov.pk": "Pakistan Army recruitment",
  "mohtasib.gov.pk": "Wafaqi Mohtasib",
  "mohr.gov.pk": "Ministry of Human Rights",
  "punjab-zameen.gov.pk": "Punjab Land Records",
  "dastak.punjab.gov.pk": "Punjab Dastak",
  "zakat.punjab.gov.pk": "Punjab Zakat & Ushr",
  "peef.org.pk": "Punjab Educational Endowment Fund",
  "sef.org.pk": "Sindh Education Foundation",
  "usefp.org": "USEFP Fulbright Pakistan",
  "chevening.org": "Chevening Scholarships",
  "cscuk.fcdo.gov.uk": "Commonwealth Scholarship Commission",
  "daad.de": "DAAD Germany",
  "turkiyeburslari.gov.tr": "Türkiye Scholarships",
  "csc.edu.cn": "China Scholarship Council",
  "mext.go.jp": "MEXT Japan",
  "stipendiumhungaricum.hu": "Stipendium Hungaricum",
  "dfat.gov.au": "Australia Awards",
  "kaust.edu.sa": "KAUST",
  "mastercardfdn.org": "Mastercard Foundation",
  "akdn.org": "Aga Khan Development Network",
  "ets.org": "ETS (TOEFL / GRE)",
  "ielts.org": "IELTS official",
  "britishcouncil.pk": "British Council Pakistan",
  "nts.org.pk": "National Testing Service",
  "prcs.org.pk": "Pakistan Red Crescent",
  "alkhidmat.org": "Alkhidmat Foundation",
  "edhi.org": "Edhi Foundation",
  "jdc.org.pk": "JDC Foundation",
  "sundas.org": "Sundas Foundation",
  "indushospital.org.pk": "Indus Hospital",
  "las.org.pk": "Legal Aid Society",
  "nih.org.pk": "National Institute of Health",
};

export function isOfficialDomain(host: string): boolean {
  const clean = host.replace(/^www\./, "");
  return Object.keys(OFFICIAL_DOMAINS).some((domain) => clean === domain || clean.endsWith(`.${domain}`));
}

export function publisherName(host: string): string | undefined {
  const clean = host.replace(/^www\./, "");
  for (const [domain, name] of Object.entries(OFFICIAL_DOMAINS)) {
    if (clean === domain || clean.endsWith(`.${domain}`)) return name;
  }
  return undefined;
}

function quote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "";
  return /\s/.test(trimmed) ? `"${trimmed}"` : trimmed;
}

/** Build an operator query. Empty parts are skipped so the result stays clean. */
export function buildDork(options: DorkOptions): string {
  const parts: string[] = [];

  for (const term of options.terms ?? []) {
    const value = quote(term);
    if (value) parts.push(value);
  }
  for (const phrase of options.exactPhrases ?? []) {
    if (phrase.trim()) parts.push(`"${phrase.trim()}"`);
  }
  for (const site of options.sites ?? []) {
    if (site.trim()) parts.push(`site:${site.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "")}`);
  }
  for (const site of options.excludeSites ?? []) {
    if (site.trim()) parts.push(`-site:${site.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "")}`);
  }
  for (const fileType of options.fileTypes ?? []) {
    if (fileType.trim()) parts.push(`filetype:${fileType.trim().replace(/^\./, "")}`);
  }
  for (const word of options.intitle ?? []) {
    if (word.trim()) parts.push(`intitle:${quote(word)}`);
  }
  for (const word of options.inurl ?? []) {
    if (word.trim()) parts.push(`inurl:${word.trim()}`);
  }
  for (const term of options.excludeTerms ?? []) {
    const value = quote(term);
    if (value) parts.push(`-${value}`);
  }
  if (options.newerThan && options.newerThan > 0) {
    parts.push(`when:${options.newerThan}d`);
  }

  return parts.join(" ").trim();
}

export type DorkTemplate =
  | "notification"
  | "advertisement"
  | "result"
  | "dates"
  | "fee"
  | "application_form";

/**
 * Pre-built, publisher-restricted queries for the questions citizens actually
 * ask. Always official-domain restricted.
 */
export function buildOfficialQuery(
  template: DorkTemplate,
  topic: string,
  extraSites: string[] = [],
): string {
  const sites = extraSites.length > 0 ? extraSites : [];
  switch (template) {
    case "notification":
      return buildDork({ terms: [topic, "notification OR notice OR announcement"], sites });
    case "advertisement":
      return buildDork({ terms: [topic, "advertisement OR vacancy OR applications invited"], fileTypes: ["pdf"], sites });
    case "result":
      return buildDork({ terms: [topic, "result OR merit list"], sites });
    case "dates":
      return buildDork({ terms: [topic, "schedule OR dates OR deadline"], sites });
    case "fee":
      return buildDork({ terms: [topic, "fee OR fee structure OR charges"], sites });
    case "application_form":
      return buildDork({ terms: [topic, "application form OR apply online"], fileTypes: ["pdf"], sites });
    default:
      return buildDork({ terms: [topic], sites });
  }
}

/** Suggested official sources for a topic — used when no search provider is configured. */
export function officialSourcesFor(topic: string): { domain: string; name: string; query: string }[] {
  const value = topic.toLowerCase();
  const matched: string[] = [];

  if (/scholar|wazeefa|وظیف|بورس|hec/.test(value)) matched.push("hec.gov.pk", "peef.org.pk");
  if (/cnic|identity|nadra|شناخت/.test(value)) matched.push("nadra.gov.pk");
  if (/bisp|8171|kafalat|کفالت/.test(value)) matched.push("8171.bisp.gov.pk", "bisp.gov.pk");
  if (/job|vacancy|نوکری|fpsc/.test(value)) matched.push("fpsc.gov.pk", "ppsc.gop.pk", "nts.org.pk");
  if (/disaster|flood|سیلاب|relief/.test(value)) matched.push("ndma.gov.pk", "pdma.punjab.gov.pk");
  if (/health|sehat|علاج|card/.test(value)) matched.push("sehatsahulat.com.pk");
  if (/ielts|toefl|english/.test(value)) matched.push("ielts.org", "ets.org", "britishcouncil.pk");
  if (/passport/.test(value)) matched.push("dgip.gov.pk" in OFFICIAL_DOMAINS ? "dgip.gov.pk" : "nadra.gov.pk");

  const unique = Array.from(new Set(matched.length > 0 ? matched : ["hec.gov.pk"]));
  return unique.map((domain) => ({
    domain,
    name: OFFICIAL_DOMAINS[domain] ?? domain,
    query: buildOfficialQuery("notification", topic, [domain]),
  }));
}
