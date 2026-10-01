import type { Domain, Language, Localized } from "@/lib/types";

/**
 * The module registry: every capability RAAHI has, declared in one place.
 *
 * This is what makes the platform flexible rather than fixed. A deployment
 * switches modules on and off with an environment variable, and everything
 * follows automatically: the bottom navigation, the More grid, the sitemap,
 * the API routes and the command palette. Turning a module off removes it
 * everywhere at once, because everywhere asks this file what exists.
 *
 * Adding a capability means adding one entry here and one route — not editing
 * six files and hoping you found them all.
 */

export type ModuleId =
  | "ask"
  | "chat"
  | "scholarships"
  | "documents"
  | "tests"
  | "dates"
  | "opportunities"
  | "health"
  | "blood"
  | "disaster"
  | "legal"
  | "contacts"
  | "emergency"
  | "track"
  | "kb"
  | "programs"
  | "portal"
  | "classic";

export type ModuleGroup = "start" | "learn" | "life" | "emergency" | "manage";

export interface ModuleDefinition {
  id: ModuleId;
  /** Emoji, so it renders identically on every device with no font to load. */
  icon: string;
  href: string;
  title: Localized;
  /** One short line, shown under the title in search results. */
  blurb: Localized;
  /**
   * What someone might type or say to find this. Deliberately includes the
   * words people actually use, including Roman Urdu, because the palette has
   * to match "sarkari naukri" as readily as "jobs".
   */
  keywords: Partial<Record<Language, string[]>>;
  group: ModuleGroup;
  /**
   * Core modules cannot be switched off. The home screen and the emergency
   * numbers stay, because a citizen in trouble must always land somewhere
   * useful.
   */
  core?: boolean;
  /** Shown in the bottom navigation bar. Keep this to five or fewer. */
  inNav?: boolean;
  /** Accent used for the tile on the More screen. */
  accent?: "forest" | "sky" | "purple" | "amber" | "rose";
  /** API prefixes owned by this module; blocked when the module is off. */
  api?: string[];
  /** Knowledge domains this module owns, used to filter search results. */
  domains?: Domain[];
  /**
   * Knowledge-base entity types this module can open. The command palette uses
   * this to send a search result to the right screen — and to skip results
   * from modules this deployment has switched off.
   */
  entityTypes?: string[];
  /**
   * When two modules can open the same kind of record ("opportunity" covers
   * both scholarships and jobs), this says which records each one handles. The
   * palette reads the record's own `kind` and sends it to the module that can
   * actually show it.
   */
  entityKinds?: Record<string, string[]>;
  /** Extra routes guarded by this module beyond `href`. */
  routes?: string[];
}

export const MODULES: ModuleDefinition[] = [
  {
    id: "ask",
    icon: "🧭",
    href: "/ask",
    title: {
      en: "Ask a question",
      ur: "سوال پوچھیں",
      ps: "پوښتنه وکړئ",
      hkp: "سوال پچھو",
    },
    blurb: {
      en: "Ask in your own words and get a verified answer with its source.",
      ur: "اپنی زبان میں پوچھیں اور تصدیق شدہ جواب اس کے ذریعے کے ساتھ پائیں۔",
      ps: "په خپله ژبه پوښتنه وکړئ او د سرچینې سره تایید شوی ځواب ترلاسه کړئ.",
      hkp: "اپݨی زبان وچ پچھو تے تصدیق شدہ جواب اوہدے ذریعے نال لؤ۔",
    },
    keywords: {
      en: ["ask", "question", "help", "search", "find", "guide", "what", "how"],
      ur: ["سوال", "پوچھیں", "مدد", "رہنمائی", "کیسے", "معلومات"],
      ps: ["پوښتنه", "مرسته", "لارښوونه"],
      hkp: ["سوال", "مدد", "رہنمائی", "کیویں"],
    },
    group: "start",
    core: true,
    inNav: true,
    accent: "forest",
    api: ["/api/ask", "/api/navigate", "/api/recommend"],
  },
  {
    id: "chat",
    icon: "💬",
    href: "/chat",
    title: {
      en: "Advisor chat",
      ur: "مشیر سے بات",
      ps: "له سلاکار سره خبرې",
      hkp: "مشیر نال گل",
    },
    blurb: {
      en: "Talk it through with the assistant, by voice or text.",
      ur: "معاون کے ساتھ بات چیت کریں — بول کر یا لکھ کر۔",
      ps: "د مرستیال سره په غږ یا لیکلو خبرې وکړئ.",
      hkp: "معاون نال گل بات کرو — بول کے یا لکھ کے۔",
    },
    keywords: {
      en: ["chat", "talk", "advisor", "conversation", "bot"],
      ur: ["بات", "گفتگو", "مشورہ", "مشیر"],
      ps: ["خبرې", "مشوره"],
      hkp: ["گل بات", "مشورہ"],
    },
    group: "start",
    inNav: false,
    accent: "forest",
    api: ["/api/chat"],
  },
  {
    id: "scholarships",
    icon: "🎓",
    href: "/scholarships",
    title: {
      en: "Scholarships",
      ur: "سکالرشپس",
      ps: "بورسونه",
      hkp: "سکالرشپس",
    },
    blurb: {
      en: "Fees, eligibility, documents and how to apply — national and international.",
      ur: "فیس، اہلیت، دستاویزات اور درخواست کا طریقہ — ملکی اور غیر ملکی۔",
      ps: "فیص، وړتیا، اسناد او د غوښتنې طریقه — کورني او بهرني.",
      hkp: "فیس، اہلیت، دستاویزات تے درخواست دا طریقہ — ملکی تے غیر ملکی۔",
    },
    keywords: {
      en: [
        "scholarship",
        "bursary",
        "grant",
        "fee",
        "student",
        "university",
        "study",
        "education",
      ],
      ur: [
        "سکالرشپ",
        "وظیفہ",
        "تعلیم",
        "یونیورسٹی",
        "فیس",
        "طالب علم",
        "گرانٹ",
      ],
      ps: ["بورس", "زده کړه", "پوهنتون", "فیص"],
      hkp: ["سکالرشپ", "وظیفہ", "تعلیم", "یونیورسٹی"],
    },
    group: "learn",
    inNav: false,
    accent: "forest",
    api: ["/api/scholarships"],
    domains: ["education"],
    entityTypes: ["opportunity"],
    entityKinds: { opportunity: ["scholarship"] },
    routes: ["/scholarships/[id]"],
  },
  {
    id: "documents",
    icon: "📄",
    href: "/documents",
    title: { en: "Documents", ur: "دستاویزات", ps: "اسناد", hkp: "دستاویزات" },
    blurb: {
      en: "How to get each document made, and who attests it.",
      ur: "ہر دستاویز کہاں اور کیسے بنتی ہے، اور تصدیق کون کرتا ہے۔",
      ps: "هر سند چیرته او څنګه جوړېږي، او تایید یې څوک کوي.",
      hkp: "ہر دستاویز کتھے تے کیویں بندی اے، تے تصدیق کون کردا اے۔",
    },
    keywords: {
      en: [
        "document",
        "cnic",
        "certificate",
        "attestation",
        "domicile",
        "passport",
        "birth",
        "frc",
      ],
      ur: ["دستاویز", "شناختی کارڈ", "سرٹیفیکیٹ", "تصدیق", "ڈومیسائل", "فارم"],
      ps: ["سند", "تذکره", "تصدیق", "سرټفیکیټ"],
      hkp: ["دستاویز", "شناختی کارڈ", "سرٹیفیکیٹ", "تصدیق"],
    },
    group: "life",
    inNav: false,
    accent: "sky",
    api: ["/api/documents", "/api/procedures"],
    domains: ["documentation"],
    entityTypes: ["document"],
    routes: ["/documents/[id]", "/procedure/[id]"],
  },
  {
    id: "tests",
    icon: "📝",
    href: "/tests",
    title: {
      en: "Tests & prep",
      ur: "ٹیسٹ اور تیاری",
      ps: "ازموینې او چمتووالی",
      hkp: "ٹیسٹ تے تیاری",
    },
    blurb: {
      en: "Competitive exams, IELTS and admissions tests, with how to prepare.",
      ur: "مقابلے کے امتحانات، IELTS اور داخلہ ٹیسٹ — تیاری کے ساتھ۔",
      ps: "سیالي ازموینې، IELTS او د داخلې ازموینې — د چمتووالي سره.",
      hkp: "مقابلے دے امتحان، IELTS تے داخلہ ٹیسٹ — تیاری نال۔",
    },
    keywords: {
      en: [
        "test",
        "exam",
        "ielts",
        "css",
        "preparation",
        "entry test",
        "admission",
      ],
      ur: ["ٹیسٹ", "امتحان", "تیاری", "داخلہ", "آئیلٹس"],
      ps: ["ازموینه", "امتحان", "چمتووالی"],
      hkp: ["ٹیسٹ", "امتحان", "تیاری", "داخلہ"],
    },
    group: "learn",
    inNav: false,
    accent: "purple",
    api: ["/api/tests"],
    domains: ["education"],
    entityTypes: ["test"],
    routes: ["/tests/[id]"],
  },
  {
    id: "dates",
    icon: "🗓️",
    href: "/dates",
    title: {
      en: "Important dates",
      ur: "اہم تاریخیں",
      ps: "مهمې نېټې",
      hkp: "اہم تاریخاں",
    },
    blurb: {
      en: "Deadlines for exams, admissions, jobs and internships.",
      ur: "امتحانات، داخلوں، ملازمتوں اور انٹرن شپ کی آخری تاریخیں۔",
      ps: "د ازموینو، داخلې، دندو او انټرنشپ وروستۍ نېټې.",
      hkp: "امتحاناں، داخلے، نوکریاں تے انٹرن شپ دیاں آخری تاریخاں۔",
    },
    keywords: {
      en: ["dates", "deadline", "calendar", "when", "last date", "schedule"],
      ur: ["تاریخ", "آخری تاریخ", "ڈیڈ لائن", "کیلنڈر"],
      ps: ["نېټه", "وروستۍ نېټه", "کالنډر"],
      hkp: ["تاریخ", "آخری تاریخ", "کیلنڈر"],
    },
    group: "learn",
    inNav: false,
    accent: "amber",
    api: ["/api/dates"],
  },
  {
    id: "opportunities",
    icon: "💼",
    href: "/opportunities",
    title: {
      en: "Jobs & training",
      ur: "ملازمتیں اور تربیت",
      ps: "دندې او روزنه",
      hkp: "نوکریاں تے تربیت",
    },
    blurb: {
      en: "Government jobs, internships and free training programmes.",
      ur: "سرکاری ملازمتیں، انٹرن شپ اور مفت تربیتی پروگرام۔",
      ps: "دولتي دندې، انټرنشپ او وړیا روزنیز پروګرامونه.",
      hkp: "سرکاری نوکریاں، انٹرن شپ تے مفت تربیتی پروگرام۔",
    },
    keywords: {
      en: [
        "job",
        "vacancy",
        "career",
        "internship",
        "training",
        "employment",
        "naukri",
        "sarkari naukri",
      ],
      ur: ["ملازمت", "نوکری", "سرکاری نوکری", "انٹرن شپ", "تربیت", "روزگار"],
      ps: ["دنده", "نوکري", "روزنه", "روزګار"],
      hkp: ["نوکری", "ملازمت", "تربیت", "روزگار"],
    },
    group: "learn",
    inNav: false,
    accent: "forest",
    api: ["/api/opportunities"],
    domains: ["employment"],
    entityTypes: ["opportunity"],
    // Everything that is not a scholarship: jobs, internships,
    // admissions, training, grants and fellowships live here.
    entityKinds: {
      opportunity: [
        "job",
        "internship",
        "admission",
        "training",
        "grant",
        "fellowship",
      ],
    },
  },
  {
    id: "health",
    icon: "🏥",
    href: "/health",
    title: { en: "Health", ur: "صحت", ps: "روغتیا", hkp: "صحت" },
    blurb: {
      en: "Free medical camps, procedures, and early outbreak warnings.",
      ur: "مفت طبی کیمپ، طریقہ کار، اور بیماریوں کی ابتدائی وارننگ۔",
      ps: "وړیا طبي کمپونه، کړنلارې او د ناروغیو لومړني خبرداري.",
      hkp: "مفت طبی کیمپ، طریقہ کار، تے بیماریاں دی ابتدائی وارننگ۔",
    },
    keywords: {
      en: [
        "health",
        "medical",
        "camp",
        "doctor",
        "hospital",
        "disease",
        "vaccine",
        "treatment",
        "outbreak",
      ],
      ur: ["صحت", "طبی", "کیمپ", "ڈاکٹر", "ہسپتال", "بیماری", "علاج", "ٹیکہ"],
      ps: ["روغتیا", "کمپ", "ډاکټر", "روغتون", "ناروغي", "درملنه"],
      hkp: ["صحت", "طبی", "کیمپ", "ڈاکٹر", "ہسپتال", "بیماری"],
    },
    group: "life",
    inNav: false,
    accent: "rose",
    api: ["/api/camps", "/api/diseases", "/api/medical-procedures"],
    domains: ["health"],
    entityTypes: ["camp", "disease", "medical_procedure"],
  },
  {
    id: "blood",
    icon: "🩸",
    href: "/blood",
    title: {
      en: "Blood donation",
      ur: "خون کا عطیہ",
      ps: "د وینې ورکړه",
      hkp: "خون دا عطیہ",
    },
    blurb: {
      en: "Find a blood bank or donor, or ask for help finding one.",
      ur: "بلڈ بینک یا عطیہ دہندہ تلاش کریں، یا مدد طلب کریں۔",
      ps: "د وینې بانک یا ورکوونکی ومومئ، یا مرسته وغواړئ.",
      hkp: "بلڈ بینک یا عطیہ دہندہ لبھو، یا مدد منگو۔",
    },
    keywords: {
      en: ["blood", "donor", "donate", "transfusion", "bank", "khun"],
      ur: ["خون", "بلڈ", "عطیہ", "ڈونر", "خون کا بینک"],
      ps: ["وینه", "وینه ورکوونکی", "بانک"],
      hkp: ["خون", "بلڈ", "عطیہ"],
    },
    group: "emergency",
    inNav: false,
    accent: "rose",
    api: ["/api/blood"],
    domains: ["health"],
    entityTypes: ["blood_bank"],
  },
  {
    id: "disaster",
    icon: "🌊",
    href: "/disaster",
    title: {
      en: "Disaster help",
      ur: "آفات میں مدد",
      ps: "د ناورین مرسته",
      hkp: "آفات وچ مدد",
    },
    blurb: {
      en: "What to do, who to call, and how to ask for relief.",
      ur: "کیا کرنا ہے، کس سے رابطہ کرنا ہے، اور امداد کیسے مانگنی ہے۔",
      ps: "څه وکړو، له چا سره اړیکه ونیسو، او مرسته څنګه وغواړو.",
      hkp: "کیا کرنا اے، کس نال رابطہ کرنا اے، تے امداد کیویں منگنی اے۔",
    },
    keywords: {
      en: [
        "disaster",
        "flood",
        "earthquake",
        "relief",
        "emergency",
        "rescue",
        "fire",
        "storm",
      ],
      ur: ["سیلاب", "زلزلہ", "آفت", "امداد", "ریسکیو", "طوفان"],
      ps: ["سېلاب", "زلزله", "ناورین", "مرسته", "ژغورنه"],
      hkp: ["سیلاب", "زلزلہ", "آفت", "امداد"],
    },
    group: "emergency",
    inNav: false,
    accent: "amber",
    api: ["/api/disaster"],
    domains: ["disaster"],
    entityTypes: ["disaster_channel", "disaster_guide"],
  },
  {
    id: "legal",
    icon: "⚖️",
    href: "/legal",
    title: {
      en: "Legal guidance",
      ur: "قانونی رہنمائی",
      ps: "حقوقي لارښوونه",
      hkp: "قانونی رہنمائی",
    },
    blurb: {
      en: "Your rights in plain words, and where to get free help.",
      ur: "آپ کے حقوق سادہ الفاظ میں، اور مفت مدد کہاں ملتی ہے۔",
      ps: "ستاسو حقوق په ساده الفاظو، او وړیا مرسته چیرته موندل کېږي.",
      hkp: "تہاڈے حقوق سادہ لفظاں وچ، تے مفت مدد کتھے ملدی اے۔",
    },
    keywords: {
      en: [
        "legal",
        "law",
        "rights",
        "lawyer",
        "court",
        "police",
        "free legal aid",
      ],
      ur: ["قانون", "حقوق", "وکیل", "عدالت", "قانونی مدد"],
      ps: ["قانون", "حقوق", "وکیل", "محکمه"],
      hkp: ["قانون", "حقوق", "وکیل", "عدالت"],
    },
    group: "life",
    inNav: false,
    accent: "purple",
    api: ["/api/legal"],
    domains: ["legal"],
    entityTypes: ["legal_topic"],
  },
  {
    id: "contacts",
    icon: "📞",
    href: "/contacts",
    title: {
      en: "Helplines",
      ur: "ہیلپ لائنز",
      ps: "مرستې کرښې",
      hkp: "مدد لائنز",
    },
    blurb: {
      en: "Direct numbers for the office that can actually help.",
      ur: "اُس دفتر کے براہ راست نمبر جو واقعی مدد کر سکتا ہے۔",
      ps: "د هغه دفتر مستقیم نمبرونه چې واقعي مرسته کولای شي.",
      hkp: "اوس دفتر دے براہ راست نمبر جیہڑا واقعی مدد کر سکدا اے۔",
    },
    keywords: {
      en: [
        "contact",
        "phone",
        "number",
        "helpline",
        "call",
        "office",
        "complaint",
      ],
      ur: ["رابطہ", "فون", "نمبر", "ہیلپ لائن", "دفتر", "شکایت"],
      ps: ["اړیکه", "ټیلیفون", "نمبر", "دفتر"],
      hkp: ["رابطہ", "فون", "نمبر", "دفتر"],
    },
    group: "life",
    inNav: true,
    accent: "rose",
    api: ["/api/contacts"],
    entityTypes: ["contact"],
  },
  {
    id: "emergency",
    icon: "🚨",
    href: "/emergency",
    title: {
      en: "Emergency numbers",
      ur: "ایمرجنسی نمبر",
      ps: "بېړني نمبرونه",
      hkp: "ایمرجنسی نمبر",
    },
    blurb: {
      en: "Rescue, ambulance, police and fire — one tap to call.",
      ur: "ریسکیو، ایمبولینس، پولیس اور فائر — ایک ٹیپ پر کال کریں۔",
      ps: "ژغورنه، امبولانس، پولیس او اور وژنه — په یوه ټپ زنګ ووهئ.",
      hkp: "ریسکیو، ایمبولینس، پولیس تے فائر — اک ٹیپ تے کال کرو۔",
    },
    keywords: {
      en: [
        "emergency",
        "1122",
        "ambulance",
        "police",
        "fire",
        "rescue",
        "urgent",
        "accident",
      ],
      ur: ["ایمرجنسی", "ریسکیو", "پولیس", "امبولینس", "حادثہ"],
      ps: ["بېړني", "ژغورنه", "پولیس", "امبولانس"],
      hkp: ["ایمرجنسی", "ریسکیو", "پولیس", "امبولینس"],
    },
    group: "emergency",
    core: true,
    inNav: false,
    accent: "rose",
  },
  {
    id: "track",
    icon: "📂",
    href: "/track",
    title: {
      en: "My applications",
      ur: "میری درخواستیں",
      ps: "زما غوښتنې",
      hkp: "میریاں درخواستاں",
    },
    blurb: {
      en: "Keep every application you started, and see what is next.",
      ur: "اپنی شروع کی ہوئی ہر درخواست محفوظ رکھیں، اور دیکھیں کہ آگے کیا ہے۔",
      ps: "هر هغه غوښتنه چې پیل کړې مو ده خوندي کړئ، او وګورئ چې بل څه دي.",
      hkp: "اپݨیاں شروع کیتیاں ہوئیاں درخواستاں محفوظ رکھو، تے ویکھو کہ اگے کیا اے۔",
    },
    keywords: {
      en: [
        "track",
        "application",
        "progress",
        "saved",
        "status",
        "my",
        "continue",
      ],
      ur: ["درخواست", "ٹریک", "پیش رفت", "محفوظ", "میری درخواستیں"],
      ps: ["غوښتنه", "پرمختګ", "خوندي"],
      hkp: ["درخواست", "پیش رفت", "محفوظ"],
    },
    group: "manage",
    inNav: true,
    accent: "sky",
    api: ["/api/applications"],
  },
  {
    id: "kb",
    icon: "🔎",
    href: "/kb",
    title: {
      en: "Knowledge base",
      ur: "معلومات کا ذخیرہ",
      ps: "د معلوماتو زېرمه",
      hkp: "معلومات دا ذخیرہ",
    },
    blurb: {
      en: "Search everything we know, and tell us when something is wrong.",
      ur: "ہماری ہر معلومات تلاش کریں، اور بتائیں اگر کچھ غلط ہو۔",
      ps: "زموږ ټول معلومات ولټوئ، او که څه غلط وي راته ووایئ.",
      hkp: "ساڈی ہر معلومات لبھو، تے دسو جے کجھ غلط ہووے۔",
    },
    keywords: {
      en: [
        "knowledge",
        "search",
        "source",
        "correct",
        "mistake",
        "report",
        "review",
      ],
      ur: ["تلاش", "معلومات", "ذخیرہ", "غلظی", "درستی", "رپورٹ"],
      ps: ["لټون", "معلومات", "تېروتنه", "سمونه"],
      hkp: ["تلاش", "معلومات", "غلظی", "درستی"],
    },
    group: "manage",
    inNav: false,
    accent: "forest",
    api: ["/api/knowledge", "/api/corrections", "/api/search"],
  },
  {
    id: "programs",
    icon: "🏛️",
    href: "/programs",
    title: {
      en: "Government programmes",
      ur: "سرکاری پروگرام",
      ps: "دولتي پروګرامونه",
      hkp: "سرکاری پروگرام",
    },
    blurb: {
      en: "Welfare schemes and what you qualify for.",
      ur: "فلاحی پروگرام اور آپ کس کے اہل ہیں۔",
      ps: "فلاحي پروګرامونه او تاسو د څه وړ یئ.",
      hkp: "فلاحی پروگرام تے تساں کس دے اہل او۔",
    },
    keywords: {
      en: [
        "programme",
        "scheme",
        "welfare",
        "bisp",
        "ehsaas",
        "eligibility",
        "benefit",
      ],
      ur: ["پروگرام", "اسکیم", "فلاحی", "بے نظیر", "احساس", "اہلیت"],
      ps: ["پروګرام", "سکیم", "فلاحي", "وړتیا"],
      hkp: ["پروگرام", "اسکیم", "فلاحی", "اہلیت"],
    },
    group: "manage",
    inNav: false,
    accent: "sky",
    api: ["/api/programs", "/api/eligibility"],
    domains: ["welfare"],
    entityTypes: ["service"],
  },
  {
    id: "portal",
    icon: "🗂️",
    href: "/portal",
    title: {
      en: "Service portal",
      ur: "سروس پورٹل",
      ps: "خدماتو پورټل",
      hkp: "سروس پورٹل",
    },
    blurb: {
      en: "Open a case with a volunteer and follow it through.",
      ur: "رضاکار کے ساتھ کیس کھولیں اور اس کی پیروی کریں۔",
      ps: "د رضاکار سره قضیه پرانیزئ او تعقیب یې کړئ.",
      hkp: "رضاکار نال کیس کھولو تے اوہدی پیروی کرو۔",
    },
    keywords: {
      en: ["portal", "case", "volunteer", "assisted", "agent", "follow up"],
      ur: ["پورٹل", "کیس", "رضاکار", "مددگار"],
      ps: ["پورټل", "قضیه", "رضاکار"],
      hkp: ["پورٹل", "کیس", "رضاکار"],
    },
    group: "manage",
    inNav: false,
    accent: "purple",
    api: ["/api/cases"],
    routes: ["/cases", "/cases/[id]"],
  },
  {
    id: "classic",
    icon: "🧭",
    href: "/classic",
    title: {
      en: "Classic guide",
      ur: "کلاسک رہنمائی",
      ps: "کلاسیک لارښوونه",
      hkp: "کلاسک رہنمائی",
    },
    blurb: {
      en: "The step-by-step guided walkthrough, one screen at a time.",
      ur: "قدم بہ قدم رہنمائی — ایک وقت میں ایک سکرین۔",
      ps: "ګام په ګام لارښوونه — په یوه وخت کې یوه پرده.",
      hkp: "قدم بقدم رہنمائی — اک وقت وچ اک سکرین۔",
    },
    keywords: {
      en: ["classic", "navigator", "wizard", "steps", "walkthrough"],
      ur: ["کلاسک", "رہنمائی", "مرحلہ", "قدم"],
      ps: ["کلاسیک", "لارښوونه", "ګامونه"],
      hkp: ["کلاسک", "رہنمائی", "قدم"],
    },
    group: "start",
    inNav: false,
    accent: "amber",
  },
];

/**
 * The detail page for a module, if it has one: "/scholarships" pairs with
 * "/scholarships/[id]". Lets a search result open the thing itself rather than
 * the list it lives in.
 */
export function detailRoute(module: ModuleDefinition): string | undefined {
  return routesFor(module).find((route) => route === `${module.href}/[id]`);
}

export const MODULE_BY_ID = new Map<ModuleId, ModuleDefinition>(
  MODULES.map((module) => [module.id, module]),
);

/** How many capabilities RAAHI has in total, however many this deployment runs. */
export const ALL_MODULE_COUNT = MODULES.length;

/** Route prefixes a module owns, used to guard pages as well as APIs. */
export function routesFor(module: ModuleDefinition): string[] {
  return [module.href, ...(module.routes ?? [])];
}
