import type { Funding, Level, OpportunityKind } from "./types";

/**
 * Heuristic enrichment. These functions never *invent* facts: they only map words that
 * are present in the source text onto RAAHI's controlled vocabulary, and return
 * `undefined` / `null` when the text is not clear enough.
 */

const has = (text: string, pattern: RegExp) => pattern.test(text);

export function inferKind(title: string, text: string, fallback: OpportunityKind): OpportunityKind {
  const t = title.toLowerCase();
  const all = `${t} ${text.toLowerCase()}`;
  if (has(t, /\b(hackathon|competition|contest|challenge|olympiad|prize|award(?!ed)|pitch)\b/)) return "competition";
  if (has(t, /\b(internship|intern|traineeship|apprenticeship)\b/)) return "internship";
  if (has(t, /\bfellowship\b/)) return "fellowship";
  if (has(t, /\b(scholarship|bursary|stipend|studentship|financial aid|tuition waiver|funded (?:master|phd|ph\.d|msc|degree))\b/)) return "scholarship";
  if (has(t, /\b(grant|seed fund|funding call|call for proposals)\b/)) return "grant";
  if (has(t, /\b(course|certificate|certification|bootcamp|masterclass|tutorial|workshop|training)\b/)) return "course";
  if (has(t, /\b(vacanc|hiring|job|career|position|recruitment|we are looking)\b/)) return "job";
  if (has(all, /\bscholarship\b/) && !has(all, /\b(vacancy|hiring)\b/)) return "scholarship";
  return fallback;
}

export function inferLevels(text: string): Level[] {
  const levels = new Set<Level>();
  if (has(text, /\b(bachelor'?s?|undergraduate|undergrad|b\.?sc|bsc|b\.?a\.?\b|bs\b|first degree)\b/i)) levels.add("undergraduate");
  if (has(text, /\b(master'?s?|msc|m\.?sc|mphil|m\.?phil|postgraduate|post-graduate|mba|llm|m\.?eng|graduate (?:program|studies|school))\b/i)) levels.add("masters");
  if (has(text, /\b(ph\.?d|doctoral|doctorate|dphil)\b/i)) levels.add("phd");
  if (has(text, /\b(post-?doc(?:toral)?|postdoctoral)\b/i)) levels.add("postdoc");
  if (has(text, /\b(high school|secondary school|a-levels?|o-levels?|matric|intermediate|college school|school students?)\b/i)) levels.add("school");
  if (has(text, /\b(mid-career|professionals?|executive|early-career professionals?)\b/i)) levels.add("professional");
  return [...levels];
}

export function inferFunding(text: string): Funding | undefined {
  if (has(text, /\b(fully[- ]funded|full(?:y)? (?:funding|scholarship|tuition|ride)|full tuition|all expenses|covers? (?:all|full) (?:tuition|costs))\b/i)) return "full";
  if (has(text, /\b(partially[- ]funded|partial (?:funding|scholarship|tuition)|tuition waiver|tuition discount|up to \d+% )\b/i)) return "partial";
  if (has(text, /\b(paid internship|paid position|competitive salary|salary)\b/i)) return "paid";
  if (has(text, /\b(stipend|monthly allowance|living allowance|monthly (?:support|payment))\b/i)) return "stipend";
  if (has(text, /\b(free of charge|100% off|free course|no cost|free to (?:join|apply|enrol))\b/i)) return "free";
  return undefined;
}

// ─── Countries ────────────────────────────────────────────────────────────────

const COUNTRY_ALIASES: Array<[string, string[]]> = [
  ["Pakistan", ["pakistan", "pakistani", "islamabad", "lahore", "karachi", "peshawar", "quetta", "rawalpindi", "azad kashmir", "ajk", "azad jammu"]],
  ["United Kingdom", ["united kingdom", "uk", "u.k.", "britain", "british", "england", "scotland", "wales"]],
  ["United States", ["united states", "usa", "u.s.a.", "u.s.", "america"]],
  ["Canada", ["canada", "canadian"]],
  ["Australia", ["australia", "australian"]],
  ["New Zealand", ["new zealand"]],
  ["Germany", ["germany", "german", "deutschland", "berlin", "munich"]],
  ["France", ["france", "french"]],
  ["Netherlands", ["netherlands", "dutch", "holland"]],
  ["Belgium", ["belgium", "belgian"]],
  ["Switzerland", ["switzerland", "swiss"]],
  ["Austria", ["austria", "austrian"]],
  ["Sweden", ["sweden", "swedish"]],
  ["Norway", ["norway", "norwegian"]],
  ["Denmark", ["denmark", "danish"]],
  ["Finland", ["finland", "finnish"]],
  ["Ireland", ["ireland", "irish"]],
  ["Italy", ["italy", "italian"]],
  ["Spain", ["spain", "spanish"]],
  ["Portugal", ["portugal", "portuguese"]],
  ["Poland", ["poland", "polish"]],
  ["Hungary", ["hungary", "hungarian"]],
  ["Czech Republic", ["czech republic", "czechia", "czech"]],
  ["Romania", ["romania", "romanian"]],
  ["Greece", ["greece", "greek"]],
  ["Russia", ["russia", "russian"]],
  ["Turkey", ["turkey", "türkiye", "turkiye", "turkish"]],
  ["Azerbaijan", ["azerbaijan"]],
  ["Kazakhstan", ["kazakhstan"]],
  ["China", ["china", "chinese"]],
  ["Hong Kong", ["hong kong"]],
  ["Taiwan", ["taiwan"]],
  ["Japan", ["japan", "japanese"]],
  ["South Korea", ["south korea", "korea", "korean"]],
  ["Singapore", ["singapore"]],
  ["Malaysia", ["malaysia", "malaysian"]],
  ["Indonesia", ["indonesia"]],
  ["Thailand", ["thailand", "thai"]],
  ["India", ["india", "indian"]],
  ["Bangladesh", ["bangladesh"]],
  ["Sri Lanka", ["sri lanka"]],
  ["Nepal", ["nepal"]],
  ["United Arab Emirates", ["united arab emirates", "uae", "dubai", "abu dhabi", "sharjah"]],
  ["Saudi Arabia", ["saudi arabia", "saudi", "riyadh", "jeddah"]],
  ["Qatar", ["qatar", "doha"]],
  ["Kuwait", ["kuwait"]],
  ["Oman", ["oman", "muscat"]],
  ["Bahrain", ["bahrain"]],
  ["Egypt", ["egypt"]],
  ["South Africa", ["south africa"]],
  ["Kenya", ["kenya"]],
  ["Ghana", ["ghana"]],
  ["Nigeria", ["nigeria"]],
  ["Rwanda", ["rwanda"]],
  ["Uganda", ["uganda"]],
  ["Ethiopia", ["ethiopia"]],
  ["Tanzania", ["tanzania"]],
  ["Brazil", ["brazil"]],
  ["Mexico", ["mexico"]],
  ["Europe", ["europe", "european union", "erasmus"]],
];

const COUNTRY_REGEX: Array<[string, RegExp]> = COUNTRY_ALIASES.map(([name, aliases]) => [
  name,
  new RegExp(`(?:^|[^a-z0-9])(?:${aliases.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![a-z0-9])`, "i"),
]);

export const KNOWN_COUNTRIES = COUNTRY_ALIASES.map(([name]) => name);

/**
 * Destination country mentioned earliest in the text. Two guards against wrong answers:
 *  - "Pakistani students" names the applicant's nationality, not where the programme is, so Pakistan
 *    is ignored whenever another country is present;
 *  - roundups ("study in the USA, UK, Canada, Australia…") are not about any single country.
 */
export function inferCountry(text: string): string | undefined {
  const found: Array<{ name: string; index: number }> = [];
  for (const [name, regex] of COUNTRY_REGEX) {
    const match = regex.exec(text);
    if (match) found.push({ name, index: match.index });
  }
  if (found.length === 0) return undefined;
  const abroad = found.filter((entry) => entry.name !== "Pakistan");
  const candidates = abroad.length > 0 ? abroad : found;
  if (candidates.length >= 3) return undefined;
  return candidates.sort((a, b) => a.index - b.index)[0].name;
}

/** Match a free-text query word to a canonical country name. */
export function countryFromWord(word: string): string | undefined {
  const lower = word.toLowerCase();
  for (const [name, aliases] of COUNTRY_ALIASES) {
    if (name.toLowerCase() === lower || aliases.includes(lower)) return name;
  }
  return undefined;
}

// ─── Fields of study ──────────────────────────────────────────────────────────

const FIELD_RULES: Array<[string, RegExp]> = [
  ["computer-science", /\b(computer science|software|programming|artificial intelligence|machine learning|\bai\b|data science|cyber ?security|information technology|\bit\b|informatics|web development|coding|developer)\b/i],
  ["engineering", /\b(engineering|engineer|mechanical|electrical|civil|chemical engineering|robotics|mechatronics)\b/i],
  ["medicine-health", /\b(medicine|medical|health|nursing|pharmacy|dentistry|public health|clinical|biomedical|mbbs|doctor)\b/i],
  ["business", /\b(business|mba|management|finance|economics|accounting|marketing|entrepreneur|commerce|banking)\b/i],
  ["law-policy", /\b(law|legal|policy|public administration|international relations|diplomacy|governance|human rights)\b/i],
  ["natural-sciences", /\b(physics|chemistry|biology|mathematics|statistics|geology|astronomy|life sciences|natural sciences)\b/i],
  ["agriculture-environment", /\b(agricultur|environment|climate|sustainab|forestry|water|energy|renewable)\b/i],
  ["education", /\b(education|teaching|teacher|pedagogy|curriculum)\b/i],
  ["arts-humanities", /\b(arts?|humanities|history|literature|languages?|linguistics|philosophy|design|architecture|music|film|journalism|media|communication)\b/i],
  ["social-sciences", /\b(social science|sociology|psychology|anthropology|political science|development studies|gender)\b/i],
];

export function inferFields(text: string): string[] {
  return FIELD_RULES.filter(([, regex]) => regex.test(text)).map(([field]) => field);
}

// ─── Eligibility for applicants from Pakistan ────────────────────────────────

export interface EligibilityGuess {
  openToPakistan: boolean | null;
  note?: string;
}

/**
 * `true`  – the text names Pakistan or clearly welcomes international applicants.
 * `false` – the text clearly restricts to another group (Africa-only, citizens-only…).
 * `null`  – unknown. Always confirm on the official page.
 */
export function inferEligibility(text: string): EligibilityGuess {
  if (/\bpakistan(?:i|is)?\b/i.test(text) && !/\b(?:not|excluding|except)\b[^.]{0,30}\bpakistan/i.test(text)) {
    return { openToPakistan: true, note: "Pakistan is mentioned in the listing." };
  }
  const welcomesInternational = /\b(international students?|all nationalit(?:y|ies)|any nationality|developing countr(?:y|ies)|worldwide|from any country|all countries|international applicants?|non-?eu (?:citizens|students)|global (?:applicants|students))\b/i.test(text);
  if (/\b(?:africans?|africa|sub-saharan)\b/i.test(text) && !welcomesInternational && !/\b(asia|asian)\b/i.test(text)) {
    return { openToPakistan: false, note: "Appears to be limited to African applicants." };
  }
  if (/\b(?:u\.?s\.? (?:citizens?|nationals?|permanent residents?)|american citizens?|must be a u\.?s\.? citizen|(?:eu|eea|uk|canadian|australian|new zealand) (?:citizens?|nationals?|residents?) only)\b/i.test(text)) {
    return { openToPakistan: false, note: "Appears to require citizenship or residency of another country." };
  }
  if (/\b(latin america(?:n)?|caribbean|pacific islands?)\b/i.test(text) && !welcomesInternational) {
    return { openToPakistan: false, note: "Appears to target another region." };
  }
  if (welcomesInternational) {
    return { openToPakistan: true, note: "Open to international applicants (confirm Pakistan is eligible)." };
  }
  return { openToPakistan: null };
}

/** For remote jobs: can someone based in Pakistan plausibly apply? */
export function inferRemoteEligibility(location: string | undefined | null): EligibilityGuess {
  const value = (location ?? "").trim();
  if (!value) return { openToPakistan: null };
  // "Online" / "Remote" with no region named is not a restriction — we simply do not know.
  if (/^(?:remote|online|virtual|work from home|wfh|hybrid)$/i.test(value)) return { openToPakistan: null };
  if (/\bpakistan\b/i.test(value)) return { openToPakistan: true, note: "Location includes Pakistan." };
  if (/\b(worldwide|anywhere|global|any location|all countries|open to all|remote anywhere|international)\b/i.test(value)) {
    return { openToPakistan: true, note: "Advertised as open worldwide." };
  }
  if (/\b(asia|apac|south asia|asia[- ]pacific)\b/i.test(value)) {
    return { openToPakistan: true, note: "Region includes Asia — check the time-zone requirement." };
  }
  return { openToPakistan: false, note: `Listed for: ${value.slice(0, 60)}. Residency in that region may be required.` };
}
