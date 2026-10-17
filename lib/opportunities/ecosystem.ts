import type { Language } from "@/lib/types";
import type { OpportunityKind } from "./types";

/**
 * The RAAHI family of apps and how they connect. Descriptions are taken from each project's own
 * README/landing page so the cross-links never promise more than the apps actually do.
 */

type Text = Record<Language, string>;

export interface EcosystemApp {
  id: "neuroprep" | "mdcat-prepmaster" | "cognitive-fitness";
  name: string;
  nameUr: string;
  url: string;
  repo: string;
  tagline: Text;
  /** Button label in the context where it is recommended. */
  cta: Text;
  /** Honest limits shown next to the recommendation. */
  boundary?: Text;
  routes?: Array<{ label: Text; path: string }>;
}

export const ECOSYSTEM: EcosystemApp[] = [
  {
    id: "neuroprep",
    name: "NeuroPrep",
    nameUr: "نیوروپریپ",
    url: "https://psc-ajk.vercel.app/",
    repo: "https://github.com/ahmed-raza-ur-rehman/PSC_ajk",
    tagline: {
      en: "CSS · PMS · FPSC · PPSC · AJK PSC exam preparation — 21,000+ MCQs with spaced repetition and an eyes-free mode.",
      ur: "سی ایس ایس، پی ایم ایس، ایف پی ایس سی، پی پی ایس سی اور اے جے کے پی ایس سی کی تیاری — 21,000+ سوالات، دہرائی کا نظام اور بغیر اسکرین موڈ۔",
      ps: "د CSS، PMS، FPSC، PPSC او AJK PSC امتحانونو چمتووالی — 21,000+ پوښتنې، تکرار سیستم او پرته له سکرین حالت.",
    },
    cta: { en: "Practise for the screening test", ur: "اسکریننگ ٹیسٹ کی مشق کریں", ps: "د ازموینې تمرین وکړئ" },
  },
  {
    id: "mdcat-prepmaster",
    name: "MDCAT PrepMaster",
    nameUr: "ایم ڈی کیٹ پریپ ماسٹر",
    url: "https://mdcat-prep-beta.vercel.app/",
    repo: "https://github.com/ahmed-raza-ur-rehman/MDCAT-prep",
    tagline: {
      en: "MDCAT preparation: quizzes, biology/chemistry/physics notes, formulas, diagrams and a leaderboard.",
      ur: "ایم ڈی کیٹ کی تیاری: کوئز، حیاتیات، کیمیا اور طبیعیات کے نوٹس، فارمولے اور ڈائیگرام۔",
      ps: "د MDCAT چمتووالی: کوئزونه، د بیولوژي، کیمیا او فزیک نوټونه، فورمولونه او ډیاګرامونه.",
    },
    cta: { en: "Prepare for MDCAT", ur: "ایم ڈی کیٹ کی تیاری کریں", ps: "د MDCAT لپاره چمتو شئ" },
  },
  {
    id: "cognitive-fitness",
    name: "Cognitive Fitness",
    nameUr: "کوگنیٹو فٹنس",
    url: "https://cognitive-fitness-blond.vercel.app/",
    repo: "https://github.com/ahmed-raza-ur-rehman/cognitive-fitness-human-development",
    tagline: {
      en: "An evidence-informed learning space: plain-language concepts, guided journeys and untimed practice for focus, memory and study habits.",
      ur: "شواہد پر مبنی سیکھنے کی جگہ: آسان زبان میں تصورات، رہنمائی والے سفر اور توجہ، یادداشت اور مطالعے کی عادات کی مشق۔",
      ps: "د شواهدو پر بنسټ د زده کړې ځای: ساده مفاهیم، لارښود سفرونه او د پام، حافظې او مطالعې عادتونو تمرین.",
    },
    cta: { en: "Build better study habits", ur: "مطالعے کی بہتر عادات بنائیں", ps: "د مطالعې ښه عادتونه جوړ کړئ" },
    boundary: {
      en: "Educational self-development tool — not medical advice or a validated curriculum.",
      ur: "تعلیمی خود ترقی کا ذریعہ — طبی مشورہ یا تصدیق شدہ نصاب نہیں۔",
      ps: "د زده کړې د ځان پرمختګ وسیله — طبي مشوره یا تایید شوی نصاب نه دی.",
    },
    routes: [
      { label: { en: "Explore concepts", ur: "تصورات دیکھیں", ps: "مفاهیم وګورئ" }, path: "explore" },
      { label: { en: "Guided journeys", ur: "رہنمائی والے سفر", ps: "لارښود سفرونه" }, path: "journeys" },
      { label: { en: "Practice lab", ur: "مشق کی لیب", ps: "د تمرین لابراتوار" }, path: "lab" },
    ],
  },
];

export function getApp(id: EcosystemApp["id"]): EcosystemApp {
  return ECOSYSTEM.find((app) => app.id === id) as EcosystemApp;
}

/** Link into a sibling app, tagged so its owner can see traffic coming from RAAHI. */
export function appUrl(app: EcosystemApp, path = "", medium = "opportunities"): string {
  const base = app.url.replace(/\/$/, "");
  const url = new URL(path ? `${base}/${path.replace(/^\//, "")}` : `${base}/`);
  url.searchParams.set("utm_source", "raahi");
  url.searchParams.set("utm_medium", medium);
  return url.toString();
}

export interface Recommendation {
  app: EcosystemApp;
  reason: Text;
}

export interface RecommendationInput {
  kind: OpportunityKind;
  title: string;
  organization?: string;
  summary?: string;
  tags?: string[];
  jobType?: string;
}

const PSC_PATTERN = /\b(css|pms|fpsc|ppsc|kppsc|spsc|bpsc|ajk ?psc|ajkpsc|public service commission|competitive examination|cce|screening test|recruitment test|nts|ots|pts|etea)\b/i;
const MDCAT_PATTERN = /\b(mdcat|mbbs|bds|medical (?:and dental )?(?:college|admission|entry test)|dental college|pmdc|uhs|nursing admission)\b/i;
const TEST_PATTERN = /\b(ielts|toefl|gre|gmat|sat|act|duolingo english|entrance (?:test|exam)|admission test|aptitude|proficiency test)\b/i;

/** Which sibling apps genuinely help with this opportunity? Returns at most two, most relevant first. */
export function recommendPrep(input: RecommendationInput): Recommendation[] {
  const text = `${input.title} ${input.organization ?? ""} ${input.summary ?? ""} ${(input.tags ?? []).join(" ")}`;
  const picks: Recommendation[] = [];

  if (MDCAT_PATTERN.test(text)) {
    picks.push({
      app: getApp("mdcat-prepmaster"),
      reason: {
        en: "Medical and dental admission goes through MDCAT.",
        ur: "طب اور دندان سازی کے داخلے ایم ڈی کیٹ کے ذریعے ہوتے ہیں۔",
        ps: "د طب او غاښونو داخلې د MDCAT له لارې کیږي.",
      },
    });
  }

  const publicSector = PSC_PATTERN.test(text) || (input.kind === "job" && input.jobType?.toLowerCase() === "regular" && /government|njp/i.test(text));
  if (publicSector) {
    picks.push({
      app: getApp("neuroprep"),
      reason: {
        en: "Public-service posts usually begin with a written or MCQ screening test.",
        ur: "سرکاری آسامیاں عموماً تحریری یا ایم سی کیو اسکریننگ ٹیسٹ سے شروع ہوتی ہیں۔",
        ps: "دولتي دندې معمولاً د لیکلې یا MCQ ازموینې سره پیل کیږي.",
      },
    });
  }

  if (input.kind === "course" || input.kind === "coupon" || input.kind === "training" || TEST_PATTERN.test(text)) {
    picks.push({
      app: getApp("cognitive-fitness"),
      reason: TEST_PATTERN.test(text)
        ? {
            en: "Test preparation goes better with good study habits and untimed practice.",
            ur: "ٹیسٹ کی تیاری اچھی مطالعاتی عادات اور بغیر وقت کی مشق سے بہتر ہوتی ہے۔",
            ps: "د ازموینې چمتووالی د مطالعې ښو عادتونو او پرته له وخت تمرین سره ښه کیږي.",
          }
        : {
            en: "Finishing an online course is easier with a learning plan and focus practice.",
            ur: "آن لائن کورس مکمل کرنا سیکھنے کے منصوبے اور توجہ کی مشق سے آسان ہوتا ہے۔",
            ps: "د آنلاین کورس بشپړول د زده کړې پلان او د پام تمرین سره اسانه کیږي.",
          },
    });
  }

  return picks.slice(0, 2);
}

/** For the chat tool: apps relevant to a free-text topic (no opportunity attached). */
export function recommendForTopic(topic: string): Recommendation[] {
  return recommendPrep({ kind: "job", title: topic });
}
