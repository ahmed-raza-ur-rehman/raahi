import type { Language, Localized } from "@/lib/types";

/** Language fallback chain. Hindko falls back to Urdu, Pashto falls back to Urdu, everything to English. */
const FALLBACKS: Record<Language, Language[]> = {
  en: ["en", "ur", "ps", "hkp"],
  ur: ["ur", "en", "ps", "hkp"],
  ps: ["ps", "ur", "en", "hkp"],
  hkp: ["hkp", "ur", "en", "ps"],
};

/** Resolve a `Localized` value for a language, walking the fallback chain. */
export function pick(value: Localized | string | undefined, language: Language = "ur"): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  for (const candidate of FALLBACKS[language]) {
    const found = value[candidate];
    if (found && found.trim().length > 0) return found;
  }
  return value.en ?? "";
}

export function localize(value: Localized | string | undefined, language: Language = "ur"): string {
  return pick(value, language);
}

/** RTL layouts for every language except English. */
export function direction(language: Language): "rtl" | "ltr" {
  return language === "en" ? "ltr" : "rtl";
}

export function isRtl(language: Language): boolean {
  return direction(language) === "rtl";
}

/* ────────────────────────────────────────────────────────────────
 * UI dictionary
 * ──────────────────────────────────────────────────────────────── */

type Dictionary = Record<string, Partial<Record<Language, string>>>;

const UI: Dictionary = {
  /* Navigation */
  navHome: { en: "Home", ur: "گھر", ps: "کور", hkp: "گھر" },
  navAsk: { en: "Ask", ur: "پوچھیں", ps: "پوښتنه", hkp: "پچھو" },
  navTrack: { en: "My Applications", ur: "میری درخواستیں", ps: "زما غوښتنې", hkp: "میریاں درخواستاں" },
  navContacts: { en: "Helplines", ur: "ہیلپ لائنز", ps: "مرستې کرښې", hkp: "مدد لائنز" },
  navMore: { en: "More", ur: "مزید", ps: "نور", hkp: "ہور" },

  /* Home tiles */
  tileScholarship: { en: "Scholarships", ur: "سکالرشپ", ps: "بورسونه", hkp: "سکالرشپ" },
  tileScholarshipSub: {
    en: "National & international, with fees, documents and deadlines",
    ur: "ملکی و غیر ملکی — فیس، دستاویزات اور آخری تاریخیں",
    ps: "کورني او بهرني — فیس، اسناد او وروستۍ نېټې",
    hkp: "دیسی تے بدیسی — فیس، کاغذ تے آخری تاریخاں",
  },
  tileDocuments: { en: "Documents", ur: "دستاویزات", ps: "اسناد", hkp: "کاغذات" },
  tileDocumentsSub: {
    en: "How to get every certificate and get it attested",
    ur: "ہر سرٹیفکیٹ بنوانے اور تصدیق کروانے کا طریقہ",
    ps: "د هر سند د جوړولو او تصدیق کولو لاره",
    hkp: "ہر سرٹیفکیٹ بنوان تے تصدیق کروان دا طریقہ",
  },
  tileTests: { en: "Tests & Prep", ur: "ٹیسٹ اور تیاری", ps: "ازموینې او چمتووالی", hkp: "ٹیسٹ تے تیاری" },
  tileTestsSub: {
    en: "IELTS, entry tests, competitive exams and study plans",
    ur: "آئیلٹس، داخلہ ٹیسٹ اور مقابلے کے امتحان",
    ps: "آیلټس، د داخلې ازموینې او سیالي ازموینې",
    hkp: "آئیلٹس، داخلہ ٹیسٹ تے مقابلے دے امتحان",
  },
  tileDates: { en: "Important Dates", ur: "اہم تاریخیں", ps: "مهمې نېټې", hkp: "اہم تاریخاں" },
  tileDatesSub: {
    en: "Admissions, tests, jobs and scholarship deadlines",
    ur: "داخلے، ٹیسٹ، نوکریوں اور سکالرشپ کی تاریخیں",
    ps: "داخلې، ازموینې، دندې او بورس نېټې",
    hkp: "داخلے، ٹیسٹ، نوکریاں تے سکالرشپ دیاں تاریخاں",
  },
  tileJobs: { en: "Jobs & Internships", ur: "روزگار اور انٹرنشپ", ps: "دندې او انټرنشپ", hkp: "روزگار تے انٹرنشپ" },
  tileJobsSub: {
    en: "Government jobs, internships and skill training",
    ur: "سرکاری نوکریاں، انٹرنشپ اور ہنر مندی کی تربیت",
    ps: "دولتي دندې، انټرنشپ او د مهارتونو روزنه",
    hkp: "سرکاری نوکریاں، انٹرنشپ تے ہنر دی تربیت",
  },
  tileHealth: { en: "Health & Camps", ur: "صحت اور کیمپ", ps: "روغتیا او کمپونه", hkp: "صحت تے کیمپ" },
  tileHealthSub: {
    en: "Free medical camps, treatment routes and early warning signs",
    ur: "مفت طبی کیمپ، علاج کے راستے اور بیماری کی ابتدائی علامات",
    ps: "وړیا طبي کمپونه، د درملنې لارې او د ناروغۍ لومړنۍ نښې",
    hkp: "مفت طبی کیمپ، علاج دے رستے تے بیماری دیاں نشانیاں",
  },
  tileBlood: { en: "Blood Network", ur: "خون کا نیٹ ورک", ps: "د وینې شبکه", hkp: "خون دا نیٹ ورک" },
  tileBloodSub: {
    en: "Find donors and blood banks, or request blood",
    ur: "خون کے عطیہ دہندگان تلاش کریں یا خون طلب کریں",
    ps: "د وینې ورکوونکي ومومئ یا وینه وغواړئ",
    hkp: "خون دین والے لبھو یا خون منگو",
  },
  tileDisaster: { en: "Disaster Relief", ur: "آفتی امداد", ps: "د آفت مرستې", hkp: "آفتی امداد" },
  tileDisasterSub: {
    en: "Request help, safety steps and free trainings",
    ur: "امداد طلب کریں، حفاظتی اقدامات اور مفت تربیت",
    ps: "مرسته وغواړئ، خوندیتوب ګامونه او وړیا روزنه",
    hkp: "امداد منگو، بچاؤ دے طریقے تے مفت تربیت",
  },
  tileLegal: { en: "Legal Help", ur: "قانونی مدد", ps: "قانوني مرسته", hkp: "قانونی مدد" },
  tileLegalSub: {
    en: "Free legal guidance, helplines and step-by-step routes",
    ur: "مفت قانونی رہنمائی، ہیلپ لائنز اور مرحلہ وار طریقہ",
    ps: "وړیا قانوني لارښوونه، مرستې کرښې او ګام په ګام لاره",
    hkp: "مفت قانونی رہنمائی، مدد لائنز تے قدم بہ قدم طریقہ",
  },

  /* Voice */
  speakNow: { en: "Tap and speak", ur: "دبائیں اور بولیں", ps: "فشار ورکړئ او خبرې وکړئ", hkp: "دباؤ تے بولو" },
  listening: { en: "Listening…", ur: "سن رہا ہے…", ps: "اورېدل کېږي…", hkp: "سنیا پیا اے…" },
  tapToStop: { en: "Tap to stop", ur: "روکنے کے لیے دبائیں", ps: "د درولو لپاره فشار ورکړئ", hkp: "روکن لئی دباؤ" },
  readAloud: { en: "Read aloud", ur: "آواز میں سنیں", ps: "په غږ یې واورئ", hkp: "آواز وچ سنو" },
  stopAudio: { en: "Stop", ur: "روکیں", ps: "ودروئ", hkp: "روکو" },
  typeInstead: { en: "Type instead", ur: "لکھ کر پوچھیں", ps: "ولیکئ", hkp: "لکھ تے پچھو" },
  listeningNotSupported: {
    en: "Voice typing is not supported in this browser — please type instead.",
    ur: "اس براؤزر میں آواز کی سہولت موجود نہیں — براہ کرم لکھیں۔",
    ps: "په دې براوزر کې غږیزه اسانتیا نشته — مهرباني وکړئ ولیکئ.",
    hkp: "اس براؤزر وچ آواز دی سہولت نہیں — لکھ تے پچھو۔",
  },

  /* Common actions */
  search: { en: "Search", ur: "تلاش", ps: "لټون", hkp: "لبھو" },
  searchPlaceholder: {
    en: "Scholarship, CNIC, blood, flood relief…",
    ur: "سکالرشپ، شناختی کارڈ، خون، سیلابی امداد…",
    ps: "بورس، پېژندپاڼه، وینه، د سېلاب مرسته…",
    hkp: "سکالرشپ، شناختی کارڈ، خون، سیلابی امداد…",
  },
  filter: { en: "Filter", ur: "فلٹر", ps: "فلټر", hkp: "فلٹر" },
  all: { en: "All", ur: "سب", ps: "ټول", hkp: "سارے" },
  national: { en: "National", ur: "ملکی", ps: "کورني", hkp: "دیسی" },
  international: { en: "International", ur: "غیر ملکی", ps: "بهرني", hkp: "بدیسی" },
  province: { en: "Province", ur: "صوبہ", ps: "ولایت", hkp: "صوبہ" },
  district: { en: "District", ur: "ضلع", ps: "ضلع", hkp: "ضلع" },
  city: { en: "City", ur: "شہر", ps: "ښار", hkp: "شہر" },
  level: { en: "Level", ur: "سطح", ps: "کچه", hkp: "سطح" },
  fee: { en: "Application fee", ur: "درخواست فیس", ps: "د غوښتنې فیس", hkp: "درخواست فیس" },
  free: { en: "Free — no fee", ur: "مفت — کوئی فیس نہیں", ps: "وړیا — هېڅ فیس نشته", hkp: "مفت — کوئی فیس نہیں" },
  deadline: { en: "Deadline", ur: "آخری تاریخ", ps: "وروستۍ نېټه", hkp: "آخری تاریخ" },
  eligibility: { en: "Who can apply", ur: "کون درخواست دے سکتا ہے", ps: "څوک غوښتنه کولی شي", hkp: "کون درخواست دے سکدا اے" },
  documents: { en: "Documents", ur: "دستاویزات", ps: "اسناد", hkp: "کاغذات" },
  procedure: { en: "How to apply", ur: "درخواست کا طریقہ", ps: "د غوښتنې لاره", hkp: "درخواست دا طریقہ" },
  steps: { en: "Steps", ur: "مراحل", ps: "ګامونه", hkp: "مرحلے" },
  contact: { en: "Contact", ur: "رابطہ", ps: "اړیکه", hkp: "رابطہ" },
  call: { en: "Call", ur: "کال کریں", ps: "زنګ ووهئ", hkp: "کال کرو" },
  source: { en: "Verified source", ur: "تصدیق شدہ ذریعہ", ps: "تایید شوې سرچینه", hkp: "تصدیق شدہ ذریعہ" },
  lastVerified: { en: "Last verified", ur: "آخری تصدیق", ps: "وروستۍ تایید", hkp: "آخری تصدیق" },
  confirmWithSource: {
    en: "Always confirm fees and dates on the official source before you pay or travel.",
    ur: "کوئی فیس ادا کرنے یا سفر کرنے سے پہلے سرکاری ذریعے سے فیس اور تاریخوں کی تصدیق ضرور کریں۔",
    ps: "د فیس ورکولو یا سفر کولو دمخه د رسمي سرچینې څخه نېټې او فیس تایید کړئ.",
    hkp: "کوئی فیس دین یا سفر کرن توں پہلاں سرکاری ذریعے توں فیس تے تاریخاں دی تصدیق کرو۔",
  },
  noResults: {
    en: "Nothing matched. Try a simpler word, or ask Raahi in your own words.",
    ur: "کچھ نہیں ملا۔ آسان لفظ استعمال کریں یا اپنی بات راہی کو بتائیں۔",
    ps: "هېڅ ونه موندل شول. آسان کلیمه وکاروئ یا خپله خبره راہي ته ووایاست.",
    hkp: "کجھ نہیں لبیا۔ سوکھا لفظ ورتو یا اپنی گل راہی نوں دسو۔",
  },
  loading: { en: "Loading…", ur: "لوڈ ہو رہا ہے…", ps: "بار کېږي…", hkp: "لوڈ ہو ریا اے…" },
  save: { en: "Save", ur: "محفوظ کریں", ps: "خوندي کړئ", hkp: "محفوظ کرو" },
  cancel: { en: "Cancel", ur: "منسوخ", ps: "لغوه", hkp: "منسوخ" },
  next: { en: "Next", ur: "اگلا", ps: "بل", hkp: "اگلا" },
  back: { en: "Back", ur: "واپس", ps: "شاته", hkp: "واپس" },
  done: { en: "Done", ur: "مکمل", ps: "بشپړ", hkp: "مکمل" },
  optional: { en: "Optional", ur: "اختیاری", ps: "اختیاري", hkp: "اختیاری" },
  mandatory: { en: "Required", ur: "لازمی", ps: "اړین", hkp: "لازمی" },
  moreInfo: { en: "More information", ur: "مزید معلومات", ps: "نور معلومات", hkp: "ہور معلومات" },

  /* Application tracker */
  startApplication: {
    en: "Start this application",
    ur: "اس درخواست کا آغاز کریں",
    ps: "دا غوښتنه پیل کړئ",
    hkp: "اس درخواست دا آغاز کرو",
  },
  myApplications: { en: "My applications", ur: "میری درخواستیں", ps: "زما غوښتنې", hkp: "میریاں درخواستاں" },
  progress: { en: "Progress", ur: "پیش رفت", ps: "پرمختګ", hkp: "ترقی" },
  addNote: { en: "Add a note", ur: "نوٹ شامل کریں", ps: "یاداښت زیات کړئ", hkp: "نوٹ پاؤ" },
  markDone: { en: "Mark done", ur: "مکمل قرار دیں", ps: "بشپړ یې نښه کړئ", hkp: "مکمل قرار دیو" },
  haveIt: { en: "I have it", ur: "میرے پاس ہے", ps: "زما سره ده", hkp: "میرے کول اے" },
  needHelp: { en: "Help me get it", ur: "بنوانے میں مدد", ps: "د جوړولو مرسته", hkp: "بنوان وچ مدد" },
  uploadPhoto: { en: "Upload photo", ur: "تصویر اپ لوڈ", ps: "انځور پورته کړئ", hkp: "تصویر اپ لوڈ" },
  takePhoto: { en: "Take a photo", ur: "تصویر لیں", ps: "انځور واخلئ", hkp: "تصویر لوو" },
  archive: { en: "Archive", ur: "آرکائیو", ps: "آرشیف", hkp: "آرکائیو" },
  delete: { en: "Delete", ur: "حذف کریں", ps: "ړنګ کړئ", hkp: "مٹاؤ" },
  emptyTracker: {
    en: "No applications yet. Open a scholarship, job or document and press “Start this application”.",
    ur: "ابھی کوئی درخواست نہیں۔ کسی سکالرشپ، نوکری یا دستاویز پر “درخواست کا آغاز کریں” دبائیں۔",
    ps: "لا کومه غوښتنه نشته. د بورس، دندې یا سند په پاڼه کې «دا غوښتنه پیل کړئ» فشار ورکړئ.",
    hkp: "حالے کوئی درخواست نہیں۔ کسے سکالرشپ، نوکری یا کاغذ تے «درخواست دا آغاز کرو» دباؤ۔",
  },

  /* Corrections */
  reportCorrection: { en: "Report a correction", ur: "درستی کی نشاندہی", ps: "اصلاح راپور کړئ", hkp: "درستی دی نشاندہی" },
  notFound: { en: "Not found", ur: "نہیں ملا", ps: "ونه موندل شو", hkp: "نہیں لبیا" },
  contacts: { en: "Contacts & helplines", ur: "رابطے اور ہیلپ لائنز", ps: "اړیکې او مرستې کرښې", hkp: "رابطے تے مدد لائنز" },
  officialSource: { en: "Official source", ur: "سرکاری ذریعہ", ps: "رسمي سرچینه", hkp: "سرکاری ذریعہ" },
  addApplication: { en: "New application", ur: "نئی درخواست", ps: "نوې غوښتنه", hkp: "نوی درخواست" },
  noApplications: {
    en: "No applications yet. Open a scholarship, job or document and press “Start this application”.",
    ur: "ابھی کوئی درخواست نہیں۔ کسی سکالرشپ، نوکری یا دستاویز پر «درخواست کا آغاز کریں» دبائیں۔",
    ps: "لا کومه غوښتنه نشته. د بورس، دندې یا سند په پاڼه کې «دا غوښتنه پیل کړئ» فشار ورکړئ.",
    hkp: "حالے کوئی درخواست نہیں۔ کسے سکالرشپ، نوکری یا کاغذ تے «درخواست دا آغاز کرو» دباؤ۔",
  },
  notes: { en: "Notes", ur: "نوٹس", ps: "یاداښتونه", hkp: "نوٹس" },
  attestation: { en: "Attestation", ur: "تصدیق", ps: "تصدیق", hkp: "تصدیق" },
  englishTest: { en: "English test needed", ur: "انگریزی ٹیسٹ درکار", ps: "د انګلیسي ازموینه", hkp: "انگریزی ٹیسٹ درکار" },
  webSearch: { en: "Official web search", ur: "سرکاری ویب تلاش", ps: "رسمي ویب لټون", hkp: "سرکاری ویب لبھو" },
  knowledgeBase: { en: "Knowledge base", ur: "معلومات کا ذخیرہ", ps: "د معلوماتو زېرمه", hkp: "معلومات دا ذخیرہ" },
  correctionThanks: {
    en: "Thank you. Our reviewers will verify it against the official source.",
    ur: "شکریہ۔ ہمارے جائزہ نگار اسے سرکاری ذریعے سے تصدیق کریں گے۔",
    ps: "مننه. زموږ کتونکي به یې د رسمي سرچینې سره تایید کړي.",
    hkp: "شکریہ۔ ساڈے جائزہ کار اینوں سرکاری ذریعے توں تصدیق کرن گے۔",
  },
};

export type UiKey = keyof typeof UI;

export function t(key: keyof typeof UI | string, language: Language = "ur"): string {
  const entry = UI[key as keyof typeof UI];
  if (!entry) return String(key);
  return entry[language] ?? entry.ur ?? entry.en ?? String(key);
}

/** Build a `Localized` value quickly: `L("Fee", "فیس")`. */
export function L(en: string, ur: string, ps?: string, hkp?: string): Localized {
  return { en, ur, ps: ps ?? ur, hkp: hkp ?? ur };
}

/* ────────────────────────────────────────────────────────────────
 * Formatting
 * ──────────────────────────────────────────────────────────────── */

export function formatMoney(amount: number | null, currency: string, language: Language = "ur"): string {
  if (amount === null) return t("free", language);
  const formatted = new Intl.NumberFormat("en-PK").format(amount);
  const symbol = currency === "PKR" ? "روپے" : currency === "USD" ? "$" : currency === "GBP" ? "£" : currency;
  return currency === "PKR" ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
}

export function formatDate(value: string | undefined, language: Language = "ur"): string {
  if (!value) return "";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(parsed));
}

export function daysUntil(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return undefined;
  return Math.ceil((parsed - Date.now()) / 86_400_000);
}

export function deadlineLabel(info: { kind: string; date?: string; window?: [string, string]; note?: Localized }, language: Language = "ur"): string {
  if (info.kind === "rolling") {
    return pick(info.note ?? L("Applications are accepted throughout the year.", "سال بھر درخواستیں قبول کی جاتی ہیں۔"), language);
  }
  if (info.date) {
    const days = daysUntil(info.date);
    const dateText = formatDate(info.date, language);
    if (days === undefined) return dateText;
    if (days < 0) return `${dateText} (${language === "en" ? "closed" : "اختتام ہو گیا"})`;
    const countdown =
      language === "en"
        ? `${days} day${days === 1 ? "" : "s"} left`
        : `${days} دن باقی`;
    return `${dateText} · ${countdown}`;
  }
  if (info.window) {
    return `${formatDate(info.window[0], language)} — ${formatDate(info.window[1], language)}`;
  }
  return pick(info.note ?? L("Confirm on the official source.", "سرکاری ذریعے سے تصدیق کریں۔"), language);
}
