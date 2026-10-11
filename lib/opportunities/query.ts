import { countryFromWord } from "./infer";
import type { Funding, Level, OpportunityKind, Scope } from "./types";

/**
 * Turn what a person types — "fully funded masters in germany", "سعودی عرب میں نوکری",
 * "bahar ke mulk scholarship", "free udemy python" — into structured filters plus the leftover
 * words to search for. Deterministic dictionaries, no AI needed (so it works offline too).
 */

export interface ParsedQuery {
  terms: string[];
  kinds?: OpportunityKind[];
  country?: string;
  level?: Level;
  funding?: Funding;
  scope?: Scope;
  deadlineWithinDays?: number;
  remote?: boolean;
}

const KIND_WORDS: Record<OpportunityKind, string[]> = {
  scholarship: ["scholarship", "scholarships", "bursary", "wazifa", "wazaif", "وظیفہ", "وظائف", "وظیفے", "اسکالرشپ", "سکالرشپ", "اسکالرشپس", "سکالرشپس", "بورس", "بورسونه", "وظیفې"],
  fellowship: ["fellowship", "fellowships", "فیلوشپ", "فیلوشپس"],
  internship: ["internship", "internships", "intern", "انٹرن", "انٹرنشپ", "انٹرنشپس", "انټرن", "انټرنشپ"],
  job: ["job", "jobs", "vacancy", "vacancies", "career", "careers", "hiring", "naukri", "naukrian", "nokri", "nokrian", "mulazmat", "mulazmatain", "bharti", "rozgar", "ملازمت", "ملازمتیں", "ملازمتوں", "نوکری", "نوکریاں", "نوکریوں", "جاب", "جابز", "آسامی", "آسامیاں", "آسامیوں", "بھرتی", "بھرتیاں", "روزگار", "دنده", "دندې", "کار"],
  competition: ["competition", "competitions", "contest", "contests", "hackathon", "hackathons", "olympiad", "مقابلہ", "مقابلے", "مقابلوں", "ہیکاتھون", "سیالنه"],
  course: ["course", "courses", "class", "classes", "certification", "certificate", "mooc", "کورس", "کورسز", "کورسونه", "سرٹیفکیٹ"],
  coupon: ["coupon", "coupons", "udemy", "کوپن", "کوپنز", "یوڈیمی"],
  training: ["training", "workshop", "bootcamp", "tarbiyat", "تربیت", "ٹریننگ", "ورکشاپ", "روزنه"],
  grant: ["grant", "grants", "funding", "گرانٹ", "گرانٹس"],
  notice: ["notice", "notices", "alert", "alerts", "blacklist", "blacklisted", "complaint", "complaints", "نوٹس", "نوٹسز", "شکایت", "شکایات"],
};

const KIND_BY_WORD = new Map<string, OpportunityKind>();
for (const [kind, words] of Object.entries(KIND_WORDS) as Array<[OpportunityKind, string[]]>) {
  for (const word of words) KIND_BY_WORD.set(word, kind);
}

const LEVEL_WORDS: Array<[Level, string[]]> = [
  ["undergraduate", ["bachelor", "bachelors", "undergraduate", "undergrad", "bs", "bsc", "ba", "بیچلر", "بیچلرز", "انڈرگریجویٹ", "بی ایس"]],
  ["masters", ["master", "masters", "ms", "msc", "mphil", "mba", "postgraduate", "ماسٹر", "ماسٹرز", "ایم فل", "ایم ایس", "پوسٹ گریجویٹ"]],
  ["phd", ["phd", "doctorate", "doctoral", "پی ایچ ڈی", "ڈاکٹریٹ"]],
  ["postdoc", ["postdoc", "postdoctoral"]],
  ["school", ["school", "matric", "intermediate", "fsc", "alevel", "میٹرک", "انٹرمیڈیٹ", "ایف ایس سی"]],
];
const LEVEL_BY_WORD = new Map<string, Level>();
for (const [level, words] of LEVEL_WORDS) for (const word of words) LEVEL_BY_WORD.set(word, level);

const URDU_COUNTRIES: Record<string, string> = {
  برطانیہ: "United Kingdom", انگلینڈ: "United Kingdom", امریکہ: "United States", امریکا: "United States", کینیڈا: "Canada",
  آسٹریلیا: "Australia", جرمنی: "Germany", فرانس: "France", ترکی: "Turkey", چین: "China", جاپان: "Japan", کوریا: "South Korea",
  ملائیشیا: "Malaysia", دبئی: "United Arab Emirates", امارات: "United Arab Emirates", سعودی: "Saudi Arabia", سعودیہ: "Saudi Arabia",
  قطر: "Qatar", کویت: "Kuwait", عمان: "Oman", بحرین: "Bahrain", اٹلی: "Italy", اسپین: "Spain", سویڈن: "Sweden", ناروے: "Norway",
  ڈنمارک: "Denmark", فن‌لینڈ: "Finland", فنلینڈ: "Finland", آئرلینڈ: "Ireland", ہالینڈ: "Netherlands", ہنگری: "Hungary", پولینڈ: "Poland",
  روس: "Russia", آذربائیجان: "Azerbaijan", بھارت: "India", سنگاپور: "Singapore", نیوزی‌لینڈ: "New Zealand", یورپ: "Europe", پاکستان: "Pakistan",
  امریکه: "United States", جرمني: "Germany",
};
const ROMAN_COUNTRIES: Record<string, string> = {
  saudia: "Saudi Arabia", saudiarabia: "Saudi Arabia", amrika: "United States", america: "United States", england: "United Kingdom",
  dubai: "United Arab Emirates", amarat: "United Arab Emirates", turki: "Turkey", korea: "South Korea", jarmani: "Germany", germani: "Germany",
};

const ABROAD_WORDS = new Set(["abroad", "overseas", "foreign", "international", "bahar", "bahir", "bairon", "بیرون", "باہر", "بیرونی", "بهرنی", "بهر"]);
const PAKISTAN_WORDS = new Set(["pakistan", "pakistani", "domestic", "local", "پاکستان", "پاکستانی"]);
const REMOTE_WORDS = new Set(["remote", "wfh", "online", "freelance", "freelancing", "ریموٹ", "آنلائن"]);
const FULL_FUNDING_PHRASES = [/fully[\s-]*funded/, /full(?:y)?[\s-]*(?:funding|scholarship|tuition)/, /مکمل\s*(?:فنڈ|وظیفہ|اسکالرشپ)/];
const FREE_WORDS = new Set(["free", "gratis", "mufat", "مفت", "فری", "وړیا"]);

const STOPWORDS = new Set([
  "a", "an", "the", "for", "in", "on", "at", "of", "to", "and", "or", "with", "me", "my", "i", "am", "is", "are", "any", "there", "find", "show",
  "need", "want", "looking", "please", "best", "latest", "new", "available", "open", "apply", "get", "some", "all", "from", "about", "can", "do",
  "ke", "ki", "ka", "mein", "main", "mujhe", "chahiye", "hai", "hain", "kya", "koi", "aur", "ya", "se", "par", "wale", "wali",
  "اور", "کے", "کی", "کا", "میں", "کو", "سے", "پر", "ہے", "ہیں", "چاہیے", "چاہئیں", "مجھے", "براہ", "مہربانی", "دکھائیں", "بتائیں", "کوئی", "یا", "لیے", "کیلئے", "کےلئے",
  "ما", "ته", "په", "او", "د", "دی", "ده", "غواړم",
]);

const SOON_PHRASES: Array<[RegExp, number]> = [
  [/closing soon|deadline soon|last chance|urgent|ending soon|this week|آخری تاریخ قریب|جلد بند/i, 7],
  [/this month|اس ماہ/i, 30],
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[“”"'`’‘()[\]{}<>!?,;:/\\|+*=^~@#$%&_–—-]+/g, " ")
    .replace(/[۔،؟]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function interpretQuery(raw: string): ParsedQuery {
  const text = raw.trim();
  const parsed: ParsedQuery = { terms: [] };
  if (!text) return parsed;

  const kinds = new Set<OpportunityKind>();
  let lowered = text.toLowerCase();

  for (const [pattern, days] of SOON_PHRASES) {
    if (pattern.test(lowered)) {
      parsed.deadlineWithinDays = Math.min(parsed.deadlineWithinDays ?? days, days);
      lowered = lowered.replace(pattern, " ");
    }
  }
  lowered = lowered.replace(/فری\s*لانس(?:نگ)?/g, " freelance ").replace(/گھر\s*بیٹھے/g, " remote ");
  if (FULL_FUNDING_PHRASES.some((pattern) => pattern.test(lowered))) {
    parsed.funding = "full";
    for (const pattern of FULL_FUNDING_PHRASES) lowered = lowered.replace(pattern, " ");
  }
  if (/\b(?:100\s*%\s*off|free\s+(?:udemy|course|courses|coupon))\b/.test(lowered)) {
    parsed.funding ??= "free";
  }
  const words = tokenize(lowered);
  const residual: string[] = [];
  let sawGovernment = false;

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const next = words[index + 1];
    if (/^20\d{2}$/.test(word) || /^\d+$/.test(word)) continue; // years / numbers narrow too much

    // two-word countries ("south korea", "saudi arabia", "united kingdom", "new zealand", "sri lanka")
    if (next) {
      const pair = countryFromWord(`${word} ${next}`);
      if (pair) {
        parsed.country ??= pair;
        index += 1;
        continue;
      }
      if (word === "پی" && next === "ایچ") {
        parsed.level ??= "phd";
        index += 2;
        continue;
      }
      if ((word === "ایم" && next === "فل") || (word === "ایم" && next === "ایس")) {
        parsed.level ??= "masters";
        index += 1;
        continue;
      }
    }

    if (word === "sarkari" || word === "سرکاری" || word === "govt" || word === "government") {
      // "Government" is a real search term (it is in the tags of public-sector listings);
      // the Pakistani words for it also tell us the person means jobs in Pakistan.
      residual.push("government");
      if (word !== "government" && word !== "govt") parsed.scope ??= "pakistan";
      else sawGovernment = true;
      continue;
    }

    const kind = KIND_BY_WORD.get(word);
    if (kind) {
      kinds.add(kind);
      continue;
    }
    const level = LEVEL_BY_WORD.get(word);
    if (level) {
      parsed.level ??= level;
      continue;
    }
    const country = URDU_COUNTRIES[word] ?? ROMAN_COUNTRIES[word] ?? countryFromWord(word);
    if (country) {
      if (country === "Pakistan") parsed.scope ??= "pakistan";
      else parsed.country ??= country;
      continue;
    }
    if (ABROAD_WORDS.has(word)) {
      parsed.scope ??= "international";
      continue;
    }
    if (PAKISTAN_WORDS.has(word)) {
      parsed.scope ??= "pakistan";
      continue;
    }
    if (REMOTE_WORDS.has(word)) {
      parsed.remote ??= true;
      if (word === "freelance" || word === "freelancing") residual.push("freelance");
      continue;
    }
    if (FREE_WORDS.has(word)) {
      parsed.funding ??= "free";
      continue;
    }
    if (STOPWORDS.has(word) || word.length < 2) continue;
    residual.push(word);
  }

  // "government jobs" almost always means Pakistan's public sector; "government scholarship" can be anywhere.
  if (sawGovernment && kinds.has("job")) parsed.scope ??= "pakistan";
  // A country that is the destination implies "abroad" unless the user said Pakistan explicitly.
  if (parsed.country && !parsed.scope) parsed.scope = "international";
  if (kinds.size > 0) parsed.kinds = [...kinds];
  parsed.terms = [...new Set(residual)];
  return parsed;
}
