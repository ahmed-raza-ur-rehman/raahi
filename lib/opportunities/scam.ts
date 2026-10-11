/**
 * Offline, explainable red-flag checker for job, visa, scholarship and admission offers.
 *
 * It never says an offer is "safe" or names a person or company as a fraudster: it lists the warning
 * signs it found, explains why each matters, and points to the OFFICIAL way to verify (BE&OE licence
 * list, complaints, FIA). The absence of red flags is not proof of legitimacy.
 */

export type RiskLevel = "high" | "medium" | "low" | "none";

interface Rule {
  id: string;
  weight: number;
  pattern: RegExp;
  en: string;
  ur: string;
}

const RULES: Rule[] = [
  {
    id: "advance-fee",
    weight: 30,
    pattern: /\b(?:processing|registration|application|visa|medical|protector|security|booking|file|document|service|courier|insurance|training|clearance)\s*(?:fee|fees|charges?|payment|deposit)\b|\badvance\s+(?:payment|fee|money|amount)\b|\bpay\s+(?:first|before|in advance)\b|\b(?:send|deposit|transfer)\s+(?:the\s+)?(?:money|amount|rs\.?|pkr)\b|پیشگی|ایڈوانس|رقم جمع|فیس جمع/i,
    en: "Asks for money up front. Legitimate employers and government scholarships do not charge you to give you a job, visa or award.",
    ur: "پیشگی رقم مانگی جا رہی ہے۔ جائز آجر اور سرکاری وظائف نوکری، ویزا یا وظیفہ دینے کے لیے آپ سے پیسے نہیں لیتے۔",
  },
  {
    id: "guaranteed",
    weight: 30,
    pattern: /100\s*%\s*(?:guarantee|guaranteed|sure|confirm|visa|job)|\bguaranteed\s+(?:job|visa|admission|scholarship|selection|placement|approval)\b|\b(?:visa|job)\s+(?:is\s+)?(?:ready|confirmed|guaranteed)\b|\bno\s+(?:rejection|refusal)\b|یقینی\s*(?:ویزا|ملازمت|داخلہ)|گارنٹی/i,
    en: "Promises a guaranteed result. Nobody can guarantee a visa, job, admission or scholarship — the decision belongs to the employer, embassy or committee.",
    ur: "یقینی نتیجے کا وعدہ۔ ویزا، نوکری، داخلہ یا وظیفے کی ضمانت کوئی نہیں دے سکتا — فیصلہ آجر، سفارت خانے یا کمیٹی کا ہوتا ہے۔",
  },
  {
    id: "no-requirements",
    weight: 20,
    pattern: /\b(?:no|without)\s+(?:experience|degree|qualification|interview|ielts|test|exam|language)\s*(?:needed|required|necessary)?\b|بغیر\s*(?:انٹرویو|تجربہ|آئیلٹس|ٹیسٹ)/i,
    en: "Says no interview, test, experience or language score is needed. Real jobs and scholarships assess candidates.",
    ur: "کہا جا رہا ہے کہ انٹرویو، ٹیسٹ، تجربہ یا زبان کا اسکور درکار نہیں۔ اصل نوکریاں اور وظائف امیدوار کو پرکھتے ہیں۔",
  },
  {
    id: "messaging-only",
    weight: 15,
    pattern: /\bwhats\s*app\b|\bwhatsapp\b|\btelegram\b|\bsignal\b|\bdm\s+me\b|\binbox\b|\bmessenger\b|واٹس\s*ایپ|ٹیلیگرام/i,
    en: "Moves the conversation to WhatsApp/Telegram/DMs. Agents may use these, but real employers and institutions also have official websites, email domains and offices.",
    ur: "بات چیت واٹس ایپ/ٹیلیگرام/ان باکس پر لے جائی جا رہی ہے۔ ایجنٹ یہ استعمال کر سکتے ہیں، مگر اصل ادارے کی سرکاری ویب سائٹ، ای میل اور دفتر بھی ہوتا ہے۔",
  },
  {
    id: "free-email",
    weight: 15,
    pattern: /@(?:gmail|yahoo|hotmail|outlook|ymail|live)\.com\b/i,
    en: "Uses a free personal email address (Gmail/Yahoo/Hotmail…) for an organisation. Check the official domain yourself.",
    ur: "ادارے کے لیے مفت ذاتی ای میل (جی میل/یاہو…) استعمال ہو رہی ہے۔ سرکاری ڈومین خود چیک کریں۔",
  },
  {
    id: "risky-payment",
    weight: 25,
    pattern: /\b(?:jazz\s*cash|easy\s*paisa|western\s*union|money\s*gram|binance|usdt|crypto|bitcoin|gift\s*card|sadapay|nayapay|raast)\b|\b(?:personal|my)\s+(?:bank\s+)?account\b|\baccount\s+title\b|ذاتی\s*اکاؤنٹ/i,
    en: "Payment to a personal account, mobile wallet, crypto or gift card. Official fees are paid to the organisation's own account through the channel it publishes.",
    ur: "ذاتی اکاؤنٹ، موبائل والیٹ، کرپٹو یا گفٹ کارڈ میں ادائیگی۔ سرکاری فیس ادارے کے اپنے اکاؤنٹ میں اس کے شائع کردہ طریقے سے ادا ہوتی ہے۔",
  },
  {
    id: "urgency",
    weight: 15,
    pattern: /\blimited\s+(?:seats|slots|visas|time)\b|\bhurry\b|\burgent(?:ly)?\b|\blast\s+(?:chance|few\s+(?:seats|slots))\b|\bonly\s+\d+\s+(?:seats|slots|visas)\b|\btoday\s+only\b|\bapply\s+(?:now|today)\s+or\b|فوراً|جلدی کریں|محدود\s*(?:نشستیں|سیٹیں)/i,
    en: "Pressure to decide or pay quickly. Scammers rush you so you do not verify.",
    ur: "جلدی فیصلے یا ادائیگی کا دباؤ۔ دھوکہ باز آپ کو جلدی میں رکھتے ہیں تاکہ آپ تصدیق نہ کریں۔",
  },
  {
    id: "easy-money",
    weight: 20,
    pattern: /\bearn\s+(?:up\s+to\s+)?(?:rs\.?|pkr|\$|usd|aed|sar)?\s*\d[\d,]*\s*(?:per|a|every|\/)\s*(?:day|week)\b|\bdaily\s+(?:income|payment|earning)\b|\bwork\s+from\s+home\b[^.]{0,40}\bearn\b|گھر\s*بیٹھے\s*کمائیں|روزانہ\s*کمائی/i,
    en: "Unrealistic earnings for little work. Be especially careful with 'daily income' or 'task' jobs that ask you to pay or recruit others.",
    ur: "کم کام پر غیر حقیقی کمائی۔ 'روزانہ آمدنی' یا 'ٹاسک' والی نوکریوں سے خاص احتیاط کریں جو پیسے یا لوگ لانے کو کہیں۔",
  },
  {
    id: "prize",
    weight: 35,
    pattern: /\byou\s+have\s+been\s+selected\b|\bcongratulations\b[^.]{0,60}\b(?:selected|won|winner|scholarship|prize)\b|\blucky\s+draw\b|\blottery\b|\bclaim\s+your\s+(?:prize|reward|scholarship|visa)\b|لاٹری|انعام\s*نکلا|کامیاب\s*قرار/i,
    en: "Unsolicited 'you have been selected / you won' message. You cannot win or be selected for something you never applied for.",
    ur: "بن مانگے 'آپ منتخب ہو گئے / جیت گئے' کا پیغام۔ جس کے لیے آپ نے درخواست ہی نہیں دی اس میں منتخب ہونا ممکن نہیں۔",
  },
  {
    id: "secrets",
    weight: 40,
    pattern: /\b(?:otp|one[- ]time\s+(?:password|code)|pin\s*code|atm\s*pin|password|cvv)\b|او\s*ٹی\s*پی|پاس\s*ورڈ/i,
    en: "Asks for an OTP, PIN or password. No employer, embassy or scholarship ever needs these — sharing them can empty your bank or wallet.",
    ur: "او ٹی پی، پن یا پاس ورڈ مانگا جا رہا ہے۔ کسی آجر، سفارت خانے یا وظیفے کو یہ درکار نہیں ہوتے — انہیں بتانے سے آپ کا اکاؤنٹ یا والیٹ خالی ہو سکتا ہے۔",
  },
  {
    id: "documents-by-chat",
    weight: 12,
    pattern: /\b(?:send|share|provide|upload)\s+(?:me\s+)?(?:your\s+)?(?:cnic|passport|id\s*card|bank\s+(?:details|statement)|selfie)\b|شناختی\s*کارڈ[^.]{0,20}بھیجیں|پاسپورٹ[^.]{0,20}بھیجیں/i,
    en: "Asks you to send CNIC/passport/bank details over chat. Share documents only on the organisation's official portal.",
    ur: "چیٹ پر شناختی کارڈ/پاسپورٹ/بینک تفصیل بھیجنے کو کہا جا رہا ہے۔ دستاویزات صرف ادارے کے سرکاری پورٹل پر دیں۔",
  },
  {
    id: "impersonation",
    weight: 25,
    pattern: /\bofficial\s+(?:partner|agent|representative)\s+of\s+(?:the\s+)?(?:chevening|fulbright|daad|embassy|high\s+commission|beoe|oec|hec|erasmus|commonwealth)\b|\b(?:embassy|high\s+commission|consulate|ministry)\b[^.]{0,50}\b(?:whatsapp|gmail|personal\s+account|fee)\b/i,
    en: "Claims to represent an embassy, ministry or famous scholarship. Those bodies do not sell access through agents — check their official website.",
    ur: "سفارت خانے، وزارت یا مشہور وظیفے کے نمائندے ہونے کا دعویٰ۔ یہ ادارے ایجنٹس کے ذریعے رسائی فروخت نہیں کرتے — ان کی سرکاری ویب سائٹ دیکھیں۔",
  },
  {
    id: "fast-visa",
    weight: 20,
    pattern: /\b(?:visa|work\s*permit|permit)\b[^.]{0,40}\b(?:in\s+)?(?:\d+|one|two|three|seven|ten|fifteen)\s*(?:working\s+)?(?:days?|weeks?)\b|فوری\s*ویزا|ویزا[^.]{0,30}دن\s*میں/i,
    en: "Promises a visa or work permit in a few days. Real processing times are set by the destination country, not the agent.",
    ur: "چند دن میں ویزا یا ورک پرمٹ کا وعدہ۔ اصل پروسیسنگ وقت منزل والے ملک کا ہوتا ہے، ایجنٹ کا نہیں۔",
  },
  {
    id: "no-licence",
    weight: 30,
    pattern: /\bno\s+(?:oep|licen[cs]e)\b|\bwithout\s+(?:an?\s+)?(?:oep|licen[cs]e)\b|\blicen[cs]e\s+(?:is\s+)?not\s+(?:needed|required)\b|لائسنس\s*(?:نہیں|ضرورت نہیں)/i,
    en: "Says a licence is not needed. In Pakistan, recruiting people for overseas jobs requires a BE&OE-licensed promoter (OEP).",
    ur: "کہا جا رہا ہے کہ لائسنس ضروری نہیں۔ پاکستان میں بیرون ملک ملازمت کی بھرتی کے لیے بی ای او ای کا لائسنس یافتہ پروموٹر (او ای پی) ہونا لازمی ہے۔",
  },
  {
    id: "visit-visa-work",
    weight: 35,
    pattern: /\b(?:visit|tourist|visitor)\s+visa\b[^.]{0,60}\b(?:work|job|employment|convert|then)\b|\b(?:work|job)\b[^.]{0,40}\b(?:visit|tourist)\s+visa\b|\bwithout\s+protector\b|\bno\s+(?:need\s+(?:of|for)\s+)?protector\b|وزٹ\s*ویزا[^.]{0,30}(?:نوکری|ملازمت|کام)/i,
    en: "Suggests working abroad on a visit/tourist visa or skipping the protector. This is a common route to exploitation and trafficking and leaves you without legal protection.",
    ur: "وزٹ/ٹورسٹ ویزے پر بیرون ملک کام یا پروٹیکٹر چھوڑنے کی تجویز۔ یہ استحصال اور انسانی سمگلنگ کا عام راستہ ہے اور آپ کو قانونی تحفظ سے محروم کر دیتا ہے۔",
  },
  {
    id: "scholarship-fee",
    weight: 25,
    pattern: /\b(?:scholarship|admission)\b[^.]{0,40}\b(?:guaranteed|confirmed)\b[^.]{0,40}\b(?:without|no)\s+(?:ielts|test|interview)\b|\bdirect\s+admission\b[^.]{0,30}\bscholarship\b|\bfully\s+funded\b[^.]{0,50}\b(?:fee|payment|deposit)\b/i,
    en: "Scholarship or admission 'guaranteed' with a fee or without tests. Government scholarships such as Chevening, DAAD, Fulbright or GKS do not charge to apply or to reserve a place.",
    ur: "فیس کے ساتھ یا ٹیسٹ کے بغیر وظیفے/داخلے کی 'ضمانت'۔ چیونگ، ڈی اے اے ڈی، فل برائٹ یا جی کے ایس جیسے سرکاری وظائف درخواست یا نشست محفوظ کرنے کی فیس نہیں لیتے۔",
  },
];

export const ANSWER_KEYS = [
  "askedToPay",
  "paymentToPersonalAccount",
  "contactOnlyMessaging",
  "noInterview",
  "noLicenceNumber",
  "pressureToDecide",
  "guaranteedResult",
  "visitVisaForWork",
  "askedForOtpOrPassword",
  "verifiedOnOfficialSite",
] as const;
export type AnswerKey = (typeof ANSWER_KEYS)[number];

const ANSWER_WEIGHTS: Record<AnswerKey, { weight: number; en: string; ur: string }> = {
  askedToPay: { weight: 30, en: "You were asked to pay before getting the job, visa or award.", ur: "نوکری، ویزا یا وظیفہ ملنے سے پہلے آپ سے ادائیگی مانگی گئی۔" },
  paymentToPersonalAccount: { weight: 25, en: "Payment is requested to a personal account or wallet.", ur: "ادائیگی ذاتی اکاؤنٹ یا والیٹ میں مانگی گئی۔" },
  contactOnlyMessaging: { weight: 12, en: "The only contact is WhatsApp, Telegram or social media.", ur: "رابطہ صرف واٹس ایپ، ٹیلیگرام یا سوشل میڈیا پر ہے۔" },
  noInterview: { weight: 20, en: "No interview, test or qualification check.", ur: "کوئی انٹرویو، ٹیسٹ یا اہلیت کی جانچ نہیں۔" },
  noLicenceNumber: { weight: 25, en: "No BE&OE licence number given, or it does not match the official list.", ur: "بی ای او ای کا لائسنس نمبر نہیں دیا گیا یا سرکاری فہرست سے نہیں ملتا۔" },
  pressureToDecide: { weight: 15, en: "You are being pressured to decide quickly.", ur: "آپ پر جلد فیصلے کا دباؤ ہے۔" },
  guaranteedResult: { weight: 25, en: "A guaranteed visa, job or admission is promised.", ur: "یقینی ویزا، نوکری یا داخلے کا وعدہ کیا گیا ہے۔" },
  visitVisaForWork: { weight: 35, en: "You would travel on a visit visa or skip the protector.", ur: "آپ وزٹ ویزے پر جائیں گے یا پروٹیکٹر چھوڑا جائے گا۔" },
  askedForOtpOrPassword: { weight: 40, en: "You were asked for an OTP, PIN or password.", ur: "آپ سے او ٹی پی، پن یا پاس ورڈ مانگا گیا۔" },
  verifiedOnOfficialSite: { weight: -30, en: "You verified the agent or organisation on the official website.", ur: "آپ نے ایجنٹ یا ادارے کی سرکاری ویب سائٹ پر تصدیق کر لی ہے۔" },
};

export interface DetectedOep {
  raw: string;
  number: string;
  city: string;
}

/** "OEPL No. 2401/LHR", "OEP 1328/KAR", "0912/RWP" — the licence format BE&OE uses in its notices. */
export function extractOepLicences(text: string): DetectedOep[] {
  const found: DetectedOep[] = [];
  for (const match of text.matchAll(/(?:\boepl?\.?\s*(?:no\.?|number|#)?\s*[:\-]?\s*)?\b(\d{3,5})\s*\/\s*([A-Za-z]{3})\b/gi)) {
    const number = match[1];
    const city = match[2].toUpperCase();
    if (!found.some((entry) => entry.number === number && entry.city === city)) found.push({ raw: match[0].trim(), number, city });
  }
  return found;
}

export interface Signal {
  id: string;
  weight: number;
  en: string;
  ur: string;
  /** "text" = found in the message, "answer" = from the checklist. */
  source: "text" | "answer";
}

export interface Advice {
  en: string;
  ur: string;
  url?: string;
  label?: { en: string; ur: string };
}

export interface ScamAnalysis {
  score: number;
  level: RiskLevel;
  signals: Signal[];
  oepLicences: DetectedOep[];
  advice: Advice[];
  headline: { en: string; ur: string };
  disclaimer: { en: string; ur: string };
}

const BEOE_LIST = "https://beoe.gov.pk/list-of-oeps?show=active";

export function analyzeOffer(input: { text?: string; answers?: Partial<Record<AnswerKey, boolean>> }): ScamAnalysis {
  const text = (input.text ?? "").slice(0, 6000);
  const signals: Signal[] = [];

  for (const rule of RULES) {
    if (rule.pattern.test(text)) signals.push({ id: rule.id, weight: rule.weight, en: rule.en, ur: rule.ur, source: "text" });
  }
  for (const key of ANSWER_KEYS) {
    if (input.answers?.[key]) {
      const answer = ANSWER_WEIGHTS[key];
      // The checklist adds to, but never double counts, what the text already showed.
      const overlaps = (key === "askedToPay" && signals.some((s) => s.id === "advance-fee")) || (key === "askedForOtpOrPassword" && signals.some((s) => s.id === "secrets"));
      if (!overlaps) signals.push({ id: `answer:${key}`, weight: answer.weight, en: answer.en, ur: answer.ur, source: "answer" });
    }
  }

  const oepLicences = extractOepLicences(text);
  const mentionsOverseas = /\b(?:visa|overseas|abroad|manpower|agent|gulf|dubai|saudi|qatar|kuwait|oman|bahrain|europe|malaysia|korea|work\s*permit)\b|ویزا|بیرون\s*ملک|دبئی|سعودی|قطر|کویت|یورپ/i.test(text);
  const mentionsScholarship = /\b(?:scholarship|admission|fellowship|university)\b|وظیفہ|اسکالرشپ|داخلہ/i.test(text);

  const raw = signals.reduce((sum, signal) => sum + signal.weight, 0);
  // Stacking independent warning signs is worse than the sum of its parts.
  const textSignals = signals.filter((s) => s.source === "text").length;
  const score = Math.max(0, Math.min(100, raw + (textSignals >= 3 ? 10 : 0)));
  const level: RiskLevel = score >= 60 ? "high" : score >= 30 ? "medium" : score >= 10 ? "low" : "none";

  const advice: Advice[] = [];
  if (level === "high" || level === "medium") {
    advice.push({
      en: "Do not pay anything and do not share OTPs, passwords or document photos until you have verified the offer through an official channel.",
      ur: "جب تک سرکاری ذریعے سے تصدیق نہ کر لیں، کوئی رقم نہ دیں اور او ٹی پی، پاس ورڈ یا دستاویزات کی تصاویر شیئر نہ کریں۔",
    });
  }
  if (mentionsOverseas) {
    advice.push({
      en: oepLicences.length > 0
        ? `Look up licence ${oepLicences.map((l) => `${l.number}/${l.city}`).join(", ")} on the official BE&OE list and check that the company name, address and city code match exactly.`
        : "Ask the agent for their BE&OE licence number (OEPL No. 1234/LHR style) and check it on the official list before paying or handing over documents.",
      ur: oepLicences.length > 0
        ? `لائسنس ${oepLicences.map((l) => `${l.number}/${l.city}`).join("، ")} کو بی ای او ای کی سرکاری فہرست میں دیکھیں اور کمپنی کا نام، پتہ اور شہر کا کوڈ بالکل ملائیں۔`
        : "ایجنٹ سے بی ای او ای لائسنس نمبر (جیسے OEPL No. 1234/LHR) مانگیں اور ادائیگی یا دستاویزات دینے سے پہلے سرکاری فہرست میں چیک کریں۔",
      url: BEOE_LIST,
      label: { en: "Open the BE&OE licensed-agent list", ur: "بی ای او ای کی لائسنس یافتہ ایجنٹس کی فہرست کھولیں" },
    });
    advice.push({
      en: "Travel for work only with a work visa and emigrant protection (e-Protector). Never work abroad on a visit visa.",
      ur: "کام کے لیے صرف ورک ویزا اور ایمیگرنٹ پروٹیکشن (ای پروٹیکٹر) کے ساتھ جائیں۔ وزٹ ویزے پر بیرون ملک کام نہ کریں۔",
      url: "https://beoe.gov.pk/online-emigrant-registration-delta",
      label: { en: "BE&OE e-Protector registration", ur: "بی ای او ای ای پروٹیکٹر رجسٹریشن" },
    });
  }
  if (mentionsScholarship) {
    advice.push({
      en: "Find the scholarship on the awarding body's own website (not through an agent's link) and apply there. If you cannot find it there, treat it as unverified.",
      ur: "وظیفہ دینے والے ادارے کی اپنی ویب سائٹ پر تلاش کریں (ایجنٹ کے لنک سے نہیں) اور وہیں درخواست دیں۔ وہاں نہ ملے تو اسے غیر تصدیق شدہ سمجھیں۔",
    });
  }
  if (level === "high" || level === "medium") {
    advice.push({
      en: "If you already paid or shared documents, keep every receipt and chat, stop paying, and report it to the FIA and the BE&OE.",
      ur: "اگر آپ رقم دے چکے یا دستاویزات دے چکے ہیں تو تمام رسیدیں اور چیٹس محفوظ رکھیں، مزید ادائیگی بند کریں اور ایف آئی اے اور بی ای او ای کو اطلاع دیں۔",
      url: "https://beoe.gov.pk/complaints",
      label: { en: "BE&OE complaints", ur: "بی ای او ای شکایات" },
    });
    advice.push({ en: "FIA — report fraud and trafficking.", ur: "ایف آئی اے — فراڈ اور انسانی سمگلنگ کی اطلاع دیں۔", url: "https://www.fia.gov.pk/", label: { en: "FIA website", ur: "ایف آئی اے کی ویب سائٹ" } });
  }
  if (advice.length === 0) {
    advice.push({
      en: "Verify who is offering this: find the organisation's official website yourself and apply there, never through a link or number sent to you.",
      ur: "تصدیق کریں کہ پیشکش کون کر رہا ہے: ادارے کی سرکاری ویب سائٹ خود تلاش کریں اور وہیں درخواست دیں، بھیجے گئے لنک یا نمبر کے ذریعے نہیں۔",
    });
  }

  const headline = {
    high: { en: "High risk — several serious warning signs", ur: "زیادہ خطرہ — کئی سنگین انتباہی علامات" },
    medium: { en: "Medium risk — warning signs found", ur: "درمیانہ خطرہ — انتباہی علامات ملیں" },
    low: { en: "Some caution needed", ur: "کچھ احتیاط درکار ہے" },
    none: { en: "No obvious red flags found — but this is not proof it is genuine", ur: "کوئی واضح خطرے کی علامت نہیں ملی — مگر یہ اس کے جائز ہونے کا ثبوت نہیں" },
  }[level];

  return {
    score,
    level,
    signals: signals.sort((a, b) => b.weight - a.weight),
    oepLicences,
    advice,
    headline,
    disclaimer: {
      en: "This check looks for common warning signs only. It cannot confirm that an offer is genuine and does not accuse anyone. Always verify through the official website or office.",
      ur: "یہ جانچ صرف عام انتباہی علامات دیکھتی ہے۔ یہ پیشکش کے جائز ہونے کی تصدیق نہیں کر سکتی اور کسی پر الزام نہیں لگاتی۔ ہمیشہ سرکاری ویب سائٹ یا دفتر سے تصدیق کریں۔",
    },
  };
}
