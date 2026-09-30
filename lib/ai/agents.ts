import { searchKnowledge } from "@/lib/knowledge";
import { listContacts } from "@/lib/knowledge";
import { pick } from "@/lib/i18n";
import { detectSafetySignals } from "@/lib/safety/detect";
import { appendDomainSafetyDisclaimer } from "@/lib/safety/guardrails";
import { getDashScopeClient, isDashScopeConfigured } from "./client";
import { detectIntent, type VoiceIntent } from "./voice";
import type {
  AgentResponse,
  AgentTraceStep,
  ApplicationDocumentState,
  ApplicationKind,
  ApplicationStage,
  CitizenProfile,
  ContactRef,
  KnowledgeEntityType,
  Language,
  Localized,
} from "@/lib/types";

/* ────────────────────────────────────────────────────────────────
 * Agent registry — the "multi-model agentic system"
 *
 * Each specialist agent owns a slice of the knowledge base and knows how to
 * turn a hit into (a) plain steps, (b) the contacts that unblock the citizen,
 * and (c) a draft application the citizen can track. The router picks one or
 * more agents; their outputs are merged into one answer.
 * ──────────────────────────────────────────────────────────────── */

export type AgentId =
  | "scholarship"
  | "documents"
  | "tests"
  | "dates"
  | "jobs"
  | "health"
  | "blood"
  | "disaster"
  | "legal"
  | "aid"
  | "contacts"
  | "general";

export interface AgentDefinition {
  id: AgentId;
  name: Localized;
  icon: string;
  entityTypes: KnowledgeEntityType[];
  intents: VoiceIntent[];
  keywords: RegExp;
  route: string;
}

export const AGENTS: AgentDefinition[] = [
  {
    id: "scholarship",
    name: { en: "Scholarship agent", ur: "سکالرشپ ایجنٹ", ps: "د بورس استازی" },
    icon: "🎓",
    entityTypes: ["opportunity"],
    intents: ["scholarship"],
    keywords: /scholarship|scot|wazeefa|بورس|وظیفہ|سکالرشپ|فیس|tuition/,
    route: "/scholarships",
  },
  {
    id: "documents",
    name: { en: "Document agent", ur: "دستاویز ایجنٹ", ps: "د اسنادو استازی" },
    icon: "📄",
    entityTypes: ["document"],
    intents: ["documents"],
    keywords: /document|cnic|domicile|certificate|passport|attest|شناختی|ڈومیسائل|سرٹیفکیٹ|دستاویز|سند|تصدیق/,
    route: "/documents",
  },
  {
    id: "tests",
    name: { en: "Test & preparation agent", ur: "ٹیسٹ اور تیاری ایجنٹ", ps: "د ازموینې استازی" },
    icon: "📝",
    entityTypes: ["test"],
    intents: ["tests"],
    keywords: /ielts|toefl|mdcat|ecat|css|test|prep|ٹیسٹ|امتحان|آئیلٹس|تیاری/,
    route: "/tests",
  },
  {
    id: "dates",
    name: { en: "Deadline agent", ur: "تاریخ ایجنٹ", ps: "د نېټې استازی" },
    icon: "🗓️",
    entityTypes: ["opportunity", "test"],
    intents: ["dates"],
    keywords: /date|deadline|calendar|when|تاریخ|آخری تاریخ|کب/,
    route: "/dates",
  },
  {
    id: "jobs",
    name: { en: "Jobs & skills agent", ur: "روزگار اور ہنر ایجنٹ", ps: "د دندې استازی" },
    icon: "💼",
    entityTypes: ["opportunity"],
    intents: ["jobs"],
    keywords: /job|internship|employment|training|skill|نوکری|روزگار|انٹرنشپ|ہنر/,
    route: "/opportunities",
  },
  {
    id: "health",
    name: { en: "Health agent", ur: "صحت ایجنٹ", ps: "د روغتیا استازی" },
    icon: "🏥",
    entityTypes: ["camp", "disease", "medical_procedure"],
    intents: ["health"],
    keywords: /doctor|hospital|ill|fever|camp|disease|medical|علاج|ہسپتال|ڈاکٹر|بیمار|بخار|صحت/,
    route: "/health",
  },
  {
    id: "blood",
    name: { en: "Blood network agent", ur: "خون کے نیٹ ورک کا ایجنٹ", ps: "د وینې شبکې استازی" },
    icon: "🩸",
    entityTypes: ["blood_bank"],
    intents: ["blood"],
    keywords: /blood|donor|platelet|خون|عطیہ|وینه/,
    route: "/blood",
  },
  {
    id: "disaster",
    name: { en: "Disaster agent", ur: "آفات ایجنٹ", ps: "د آفتونو استازی" },
    icon: "🚨",
    entityTypes: ["disaster_channel", "disaster_guide"],
    intents: ["disaster"],
    keywords: /flood|earthquake|relief|disaster|storm|سیلاب|زلزلہ|ریلیف|آفت/,
    route: "/disaster",
  },
  {
    id: "legal",
    name: { en: "Legal guidance agent", ur: "قانونی رہنمائی ایجنٹ", ps: "د قانوني لارښوونې استازی" },
    icon: "⚖️",
    entityTypes: ["legal_topic"],
    intents: ["legal"],
    keywords: /lawyer|court|legal|police|fir|وکیل|عدالت|قانونی|ایف آئی آر/,
    route: "/legal",
  },
  {
    id: "aid",
    name: { en: "Social aid agent", ur: "فلاحی امداد ایجنٹ", ps: "د ټولنیزې مرستې استازی" },
    icon: "💰",
    entityTypes: ["service"],
    intents: ["aid"],
    keywords: /bisp|8171|bait|zakat|kafalat|aid|کفالت|زکوٰۃ|بیت المال|امداد/,
    route: "/programs",
  },
  {
    id: "contacts",
    name: { en: "Helpline agent", ur: "ہیلپ لائن ایجنٹ", ps: "د مرستې کرښې استازی" },
    icon: "📞",
    entityTypes: ["contact"],
    intents: ["contacts"],
    keywords: /number|helpline|contact|call|phone|نمبر|ہیلپ لائن|رابطہ|فون/,
    route: "/contacts",
  },
  {
    id: "general",
    name: { en: "Guide agent", ur: "رہنمائی ایجنٹ", ps: "د لارښوونې استازی" },
    icon: "🧭",
    entityTypes: ["service", "opportunity", "document"],
    intents: ["general"],
    keywords: /.*/,
    route: "/ask",
  },
];

/** Deterministic router: keyword score → agent. Cheap, instant and testable. */
export function routeAgents(query: string, language?: Language): { agent: AgentDefinition; score: number }[] {
  const intent = detectIntent(query, language);
  const value = query.toLowerCase();

  const scored = AGENTS.map((agent) => {
    let score = 0;
    if (agent.id !== "general" && agent.keywords.test(value)) score += 0.6;
    if (agent.intents.includes(intent) && agent.id !== "general") score += 0.5;
    if (agent.id === "general") score = 0.2;
    return { agent, score };
  })
    .filter((entry) => entry.score > 0.15)
    .sort((a, b) => b.score - a.score);

  return scored.length > 0 ? scored.slice(0, 3) : [{ agent: AGENTS.find((a) => a.id === "general")!, score: 0.2 }];
}

/* ────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────── */

const now = () => new Date().toISOString();

function trace(agent: string, action: string, detail: string): AgentTraceStep {
  return { agent, action, detail, at: now() };
}

function text(en: string, ur: string, ps?: string): Localized {
  return { en, ur, ps: ps ?? ur };
}

/** Wrap a string already written in `language` so `pick()` resolves it everywhere. */
function localizedAnswer(value: string, language: Language): Localized {
  const localized: Localized = { en: "", ur: "", ps: "" };
  localized[language] = value;
  return localized;
}

function emergencyContacts(language: Language): ContactRef[] {
  return [
    { label: text("Rescue / Ambulance", "ریسکیو / ایمبولینس", "ژغورنه"), phone: "1122" },
    { label: text("Edhi Ambulance", "ایدھی ایمبولینس", "ایدهي امبولانس"), phone: "115" },
    { label: text("Police", "پولیس", "پولیس"), phone: "15" },
  ];
}

function contactsForCategory(category: string, language: Language, limit = 3): ContactRef[] {
  return listContacts(category)
    .slice(0, limit)
    .map((contact) => ({
      label: contact.name,
      phone: contact.numbers[0],
      ...(contact.sms ? { sms: contact.sms } : {}),
      ...(contact.url ? { url: contact.url } : {}),
      hours: contact.hours,
    }));
}

/* ────────────────────────────────────────────────────────────────
 * Deterministic specialised planners
 * ──────────────────────────────────────────────────────────────── */

function scholarshipStages(
  record: {
    procedure: { order: number; title: string; titleUr: string }[];
    requiredDocuments: { type: string; label: string; labelUr: string; mandatory: boolean }[];
  },
): ApplicationStage[] {
  const stages: ApplicationStage[] = record.procedure.map((step) => ({
    id: `stage-${step.order}`,
    title: { en: step.title, ur: step.titleUr },
    status: "todo" as const,
  }));

  stages.push({
    id: "stage-documents",
    title: text("Collect and attest every document", "تمام دستاویزات جمع اور تصدیق کروائیں"),
    detail: text(
      "Use the document agent for each item — it shows where to go, the fee and who attests it.",
      "ہر دستاویز کے لیے دستاویز ایجنٹ استعمال کریں — یہ بتاتا ہے کہ کہاں جانا ہے، فیس کیا ہے اور تصدیق کون کرے گا۔",
    ),
    status: "todo",
    requiresDocuments: record.requiredDocuments.map((doc) => doc.type),
  });

  return stages;
}

function documentStates(
  required: { type: string; label: string; labelUr: string }[],
): ApplicationDocumentState[] {
  const stamp = now();
  return required.map((doc) => ({
    id: `doc-${doc.type}`,
    documentType: doc.type,
    label: { en: doc.label, ur: doc.labelUr },
    status: "missing" as const,
    updatedAt: stamp,
  }));
}

/* ────────────────────────────────────────────────────────────────
 * The main workflow
 * ──────────────────────────────────────────────────────────────── */

export interface RunAgentInput {
  query: string;
  language?: Language;
  profile?: CitizenProfile;
  sessionId?: string;
}

const LEAD: Record<AgentId, Localized> = {
  scholarship: text(
    "Here are the scholarships and grants that match what you told me.",
    "آپ کی بات کے مطابق یہ وظائف اور گرانٹس ملے ہیں۔",
    "ستاسو د خبرو سره سم بورسونه دي.",
  ),
  documents: text(
    "Here is how to get this document and have it attested.",
    "یہ دستاویز بنوانے اور اس کی تصدیق کروانے کا مکمل طریقہ ہے۔",
    "دا د سند د جوړولو او تصدیق لاره ده.",
  ),
  tests: text(
    "Here is the test, its dates and a preparation plan.",
    "یہ ٹیسٹ، اس کی تاریخیں اور تیاری کا منصوبہ ہے۔",
    "دا ازموینه، نېټې او د چمتووالي پلان دی.",
  ),
  dates: text("These are the dates you should not miss.", "یہ وہ تاریخیں ہیں جن سے محروم نہ ہوں۔", "دا هغه نېټې دي چې باید له لاسه ورنکړئ."),
  jobs: text("Here are job, internship and training routes.", "روزگار، انٹرنشپ اور تربیت کے یہ راستے ہیں۔", "د دندې، انټرنشپ او روزنې لارې."),
  health: text("Here is free or affordable care near you.", "قریب ترین مفت یا سستی سہولت یہ ہے۔", "نږدې وړیا یا ارزانه درملنه."),
  blood: text("Here is how to find blood donors and blood banks.", "خون کے عطیہ دہندگان اور بلڈ بینک تلاش کرنے کا طریقہ یہ ہے۔", "د وینې ورکوونکو موندلو لاره."),
  disaster: text("If anyone is in danger call 1122 first. Here is the relief route.", "اگر کوئی خطرے میں ہے تو پہلے 1122 کال کریں۔ امداد کا راستہ یہ ہے۔", "که څوک په خطر کې وي لومړی 1122 ته زنګ ووهئ."),
  legal: text("Here is the procedure. This is guidance, not legal advice.", "یہ طریقہ کار ہے۔ یہ رہنمائی ہے، قانونی مشورہ نہیں۔", "دا لارښوونه ده، قانوني مشوره نه ده."),
  aid: text("Here are the aid programmes that may fit your situation.", "آپ کی صورتحال کے مطابق یہ امدادی پروگرام ہیں۔", "ستاسو د وضعیت سره سم مرستې."),
  contacts: text("Here are the direct numbers you can call.", "یہ وہ نمبر ہیں جن پر براہِ راست کال کی جا سکتی ہے۔", "دا هغه شمېرې دي چې تاسو یې زنګ وهلی شئ."),
  general: text("Here is what I found for you.", "میں نے آپ کے لیے یہ تلاش کیا ہے۔", "ما ستاسو لپاره دا وموندل."),
};

export async function runAgentWorkflow(input: RunAgentInput): Promise<AgentResponse> {
  const language: Language = input.language ?? "ur";
  const query = input.query ?? "";
  const traceLog: AgentTraceStep[] = [];
  const safety = detectSafetySignals(query);

  traceLog.push(trace("router", "routed query", `language=${language}`));

  if (safety.emergency || safety.selfHarm) {
    return {
      answer: text(
        "If anyone is in immediate danger, call 1122 (rescue) or 15 (police) right now. Once you are safe, come back and I will help with the next step.",
        "اگر کوئی فوری خطرے میں ہے تو ابھی 1122 (ریسکیو) یا 15 (پولیس) پر کال کریں۔ محفوظ ہونے کے بعد واپس آئیں، میں اگلا قدم بتاؤں گا۔",
        "که څوک په بيړني خطر کې وي، همدا اوس 1122 یا 15 ته زنګ ووهئ.",
      ),
      steps: [
        text("Call 1122 or 15 now.", "ابھی 1122 یا 15 کال کریں۔"),
        text("Move to a safe place.", "محفوظ جگہ پر جائیں۔"),
        text("Tell a trusted family member or neighbour.", "کسی قابلِ اعتماد فرد کو بتائیں۔"),
      ],
      hits: [],
      contacts: emergencyContacts(language),
      trace: [...traceLog, trace("safety", "emergency detected", safety.reason ?? "immediate danger")],
      followUps: [text("Are you safe now?", "کیا اب آپ محفوظ ہیں؟")],
      emergency: true,
      disclaimer: text("In an emergency always call the emergency services first.", "ایمرجنسی میں ہمیشہ پہلے ایمرجنسی سروسز کو کال کریں۔"),
    };
  }

  const routed = routeAgents(query, language);
  const primary = routed[0].agent;
  traceLog.push(trace("router", "selected agent", `${primary.id} (${routed[0].score.toFixed(2)})`));

  const hits = searchKnowledge({
    query,
    types: primary.entityTypes,
    province: input.profile?.province,
    limit: 6,
  });
  traceLog.push(trace(primary.id, "searched knowledge base", `${hits.length} verified results`));

  const top = hits[0];
  const steps: Localized[] = [];
  const followUps: Localized[] = [];
  let draftApplication: AgentResponse["draftApplication"];
  let contacts: ContactRef[] = [];

  if (!top) {
    const broad = searchKnowledge({ query, limit: 3 });
    return {
      answer: text(
        "I could not find a verified answer in the knowledge base. Do not pay anyone on the basis of an unverified tip — use the official channels below.",
        "مجھے تصدیق شدہ معلومات نہیں ملیں۔ غیر تصدیق شدہ بات پر کسی کو رقم نہ دیں — نیچے دیے گئے سرکاری ذرائع استعمال کریں۔",
        "تایید شوې معلومات ونه موندل شوې.",
      ),
      steps: [
        text("Ask the relevant government office directly.", "متعلقہ سرکاری دفتر سے براہِ راست پوچھیں۔"),
        text("Use the helplines on the Contacts page.", "رابطہ صفحے پر دی گئی ہیلپ لائنز استعمال کریں۔"),
      ],
      hits: broad,
      contacts: contactsForCategory("emergency", language, 3),
      trace: traceLog,
      followUps: [text("Would you like me to check another programme?", "کیا میں کوئی اور پروگرام چیک کروں؟")],
      disclaimer: text("RAAHI only reports verified information.", "راہی صرف تصدیق شدہ معلومات دیتا ہے۔"),
    };
  }

  /* ── Specialised responses ── */
  if (primary.id === "scholarship" || primary.id === "jobs") {
    const record = top.record as {
      id: string;
      kind: string;
      title: Localized;
      benefit: Localized;
      applicationFee: { amount: number | null; currency: string; note: Localized };
      deadline: { kind: string; note: Localized; date?: string };
      procedure: { order: number; title: string; titleUr: string }[];
      requiredDocuments: { type: string; label: string; labelUr: string; mandatory: boolean }[];
      officialUrl: string;
      source: { url: string };
    };

    steps.push(
      ...record.procedure.map((step) => ({
        en: `Step ${step.order}: ${step.title}`,
        ur: `مرحلہ ${step.order}: ${step.titleUr}`,
      })),
    );
    steps.push(
      text(
        `Application fee: ${record.applicationFee.amount === null ? "No fee — free to apply" : `${record.applicationFee.amount} ${record.applicationFee.currency}`}`,
        record.applicationFee.amount === null
          ? "درخواست فیس: کوئی فیس نہیں — مفت"
          : `درخواست فیس: ${record.applicationFee.amount} ${record.applicationFee.currency}`,
      ),
    );
    steps.push(text(`Deadline: ${pick(record.deadline.note, language)}`, `آخری تاریخ: ${pick(record.deadline.note, language)}`));
    steps.push(
      text(
        "Documents you will need: " + record.requiredDocuments.map((doc) => doc.label).join(", "),
        "درکار دستاویزات: " + record.requiredDocuments.map((doc) => doc.labelUr).join("، "),
      ),
    );

    draftApplication = {
      kind: (record.kind === "job" ? "job" : record.kind === "internship" ? "internship" : record.kind === "training" ? "training" : "scholarship") as ApplicationKind,
      title: record.title,
      refId: record.id,
      stages: scholarshipStages(record),
      documents: documentStates(record.requiredDocuments),
      ...(record.deadline.date ? { deadline: record.deadline.date } : {}),
      deadlineNote: pick(record.deadline.note, language),
      feeNote: pick(record.applicationFee.note, language),
    };

    followUps.push(
      text("Shall I make a document plan for this application?", "کیا اس درخواست کے لیے دستاویزات کا منصوبہ بناؤں؟"),
      text("Do you want tests you may need, such as IELTS?", "کیا آپ کو مطلوبہ ٹیسٹ بتاؤں، جیسے آئیلٹس؟"),
    );
    traceLog.push(trace(primary.id, "built application draft", `${draftApplication?.stages.length ?? 0} stages`));
  }

  if (primary.id === "documents") {
    const record = top.record as {
      id: string;
      name: Localized;
      issuingAuthority: string;
      steps: { order: number; title: string; titleUr: string }[];
      fee: { amount: number | null; currency: string; note: Localized };
      attestation: { summary: Localized; levels: { authority: string }[] };
    };
    steps.push(text(`Issued by: ${record.issuingAuthority}`, `جاری کرنے والا ادارہ: ${record.issuingAuthority}`));
    steps.push(...record.steps.map((step) => ({ en: `Step ${step.order}: ${step.title}`, ur: `مرحلہ ${step.order}: ${step.titleUr}` })));
    steps.push(text(`Fee: ${pick(record.fee.note, language)}`, `فیس: ${pick(record.fee.note, language)}`));
    steps.push(text(`Attestation: ${pick(record.attestation.summary, language)}`, `تصدیق: ${pick(record.attestation.summary, language)}`));
    draftApplication = {
      kind: "document",
      title: record.name,
      refId: record.id,
      stages: record.steps.map((step) => ({ id: `stage-${step.order}`, title: { en: step.title, ur: step.titleUr }, status: "todo" as const })),
      documents: [{ id: `doc-${record.id}`, documentType: "target_document", label: record.name, status: "missing" as const, updatedAt: now() }],
    };
    followUps.push(text("Do you need it attested for use abroad?", "کیا آپ کو یہ بیرونِ ملک کے لیے تصدیق شدہ چاہیے؟"));
  }

  if (primary.id === "tests") {
    const record = top.record as {
      id: string;
      name: Localized;
      shortName: string;
      prep: { recommendedWeeks: number; plan: { week: number; focus: Localized; tasks: Localized[] }[] };
      officialUrl: string;
    };
    steps.push(text(`Recommended preparation: ${record.prep.recommendedWeeks} weeks`, `تجویز کردہ تیاری: ${record.prep.recommendedWeeks} ہفتے`));
    steps.push(...record.prep.plan.slice(0, 3).map((week) => ({ en: `Week ${week.week}: ${pick(week.focus, "en")}`, ur: `ہفتہ ${week.week}: ${pick(week.focus, "ur")}` })));
    draftApplication = {
      kind: "test",
      title: record.name,
      refId: record.id,
      stages: record.prep.plan.slice(0, 4).map((week) => ({
        id: `week-${week.week}`,
        title: { en: `Week ${week.week}: ${pick(week.focus, "en")}`, ur: `ہفتہ ${week.week}: ${pick(week.focus, "ur")}` },
        detail: week.tasks[0],
        status: "todo" as const,
      })),
      documents: [],
    };
    followUps.push(text("Do you want a week-by-week study plan?", "کیا آپ ہفتہ وار مطالعہ کا منصوبہ چاہتے ہیں؟"));
  }

  if (primary.id === "health") {
    contacts = contactsForCategory("health", language, 3);
    const record = top.record as { procedure?: { order: number; title: string; titleUr: string }[]; steps?: { order: number; title: string; titleUr: string }[]; howToConfirm?: { order: number; title: string; titleUr: string }[] };
    const path = record.procedure ?? record.steps ?? record.howToConfirm ?? [];
    steps.push(...path.map((step) => ({ en: `Step ${step.order}: ${step.title}`, ur: `مرحلہ ${step.order}: ${step.titleUr}` })));
    followUps.push(text("Would you like the emergency numbers?", "کیا آپ ایمرجنسی نمبر چاہتے ہیں؟"));
  }

  if (primary.id === "blood") {
    contacts = [
      { label: text("Edhi Ambulance / emergency", "ایدھی ایمبولینس"), phone: "115" },
      { label: text("Rescue 1122", "ریسکیو 1122"), phone: "1122" },
    ];
    steps.push(
      text("Ask the hospital blood bank first — it is usually the fastest route.", "پہلے ہسپتال کے بلڈ بینک سے پوچھیں — یہ سب سے تیز راستہ ہے۔"),
      text("Share only the city, hospital, blood group and one contact number.", "صرف شہر، ہسپتال، بلڈ گروپ اور ایک رابطہ نمبر شیئر کریں۔"),
      text("A donor can give blood again after 8 to 12 weeks.", "ڈونر 8 سے 12 ہفتے بعد دوبارہ خون دے سکتا ہے۔"),
    );
    followUps.push(text("Do you want to register as a donor?", "کیا آپ بطور ڈونر رجسٹر ہونا چاہتے ہیں؟"), text("Do you need to request blood now?", "کیا آپ کو ابھی خون درکار ہے؟"));
  }

  if (primary.id === "disaster") {
    contacts = [...emergencyContacts(language), ...contactsForCategory("disaster", language, 3)];
    const record = top.record as { howToRequest?: { order: number; title: string; titleUr: string }[]; steps?: { order: number; title: string; titleUr: string }[] };
    const path = record.howToRequest ?? record.steps ?? [];
    steps.unshift(text("If anyone is trapped or injured, call 1122 first.", "اگر کوئی پھنسا یا زخمی ہے تو پہلے 1122 کال کریں۔"));
    steps.push(...path.map((step) => ({ en: `Step ${step.order}: ${step.title}`, ur: `مرحلہ ${step.order}: ${step.titleUr}` })));
    followUps.push(text("Shall I start a relief request for your area?", "کیا میں آپ کے علاقے کے لیے ریلیف درخواست شروع کروں؟"));
  }

  if (primary.id === "legal") {
    contacts = contactsForCategory("legal", language, 3);
    const record = top.record as { steps: { order: number; title: string; titleUr: string }[]; rights: Localized[] };
    steps.push(...record.steps.map((step) => ({ en: `Step ${step.order}: ${step.title}`, ur: `مرحلہ ${step.order}: ${step.titleUr}` })));
    steps.push(...record.rights.slice(0, 2).map((right) => right));
    followUps.push(text("Would you like the free legal aid number?", "کیا آپ مفت قانونی امداد کا نمبر چاہتے ہیں؟"));
  }

  if (primary.id === "contacts") {
    contacts = hits.slice(0, 5).map((hit) => {
      const record = hit.record as { name: Localized; numbers: string[]; url?: string };
      return { label: record.name, phone: record.numbers[0], ...(record.url ? { url: record.url } : {}) };
    });
    steps.push(text("Tap a number on the Contacts page to call directly.", "رابطہ صفحے پر کسی نمبر پر ٹیپ کر کے براہِ راست کال کریں۔"));
  }

  if (steps.length === 0) {
    steps.push(text("Open the verified source below and confirm the current details.", "نیچے دیا گیا تصدیق شدہ ذریعہ کھولیں اور موجودہ تفصیلات کی تصدیق کریں۔"));
  }

  steps.push(
    text(
      "Always confirm fees and dates on the official source before you pay or travel.",
      "کوئی فیس ادا کرنے یا سفر کرنے سے پہلے سرکاری ذریعے سے فیس اور تاریخوں کی تصدیق ضرور کریں۔",
    ),
  );

  let answer = pick(LEAD[primary.id], language);

  /* ── Optional model upgrade ── */
  if (isDashScopeConfigured()) {
    const polished = await polishWithModel(query, language, hits.slice(0, 4));
    if (polished) {
      answer = polished;
      traceLog.push(trace("qwen", "polished the answer", "model generated a grounded reply"));
    }
  }

  if (primary.id === "health" || primary.id === "legal") {
    answer = appendDomainSafetyDisclaimer(answer, primary.id === "health" ? "health" : "legal", language);
  }

  return {
    answer: localizedAnswer(answer, language),
    steps,
    hits,
    contacts,
    trace: traceLog,
    followUps,
    ...(draftApplication ? { draftApplication } : {}),
    disclaimer: text(
      "RAAHI reports verified procedures only. Final decisions rest with the issuing authority.",
      "راہی صرف تصدیق شدہ طریقے بتاتا ہے۔ حتمی فیصلہ متعلقہ ادارہ کرتا ہے۔",
    ),
  };
}

/** Grounded model rewrite: the model may re-word, never add facts. */
async function polishWithModel(
  query: string,
  language: Language,
  hits: { title: string; summary: string; source: { url: string; lastVerified: string } }[],
): Promise<string | undefined> {
  if (!isDashScopeConfigured()) return undefined;
  try {
    const client = getDashScopeClient();
    const context = hits
      .map((hit, index) => `[${index + 1}] ${hit.title}\n${hit.summary}\nSource: ${hit.source.url} (verified ${hit.source.lastVerified})`)
      .join("\n\n");

    const response = await client?.chat.completions.create({
      model: "qwen-plus",
      temperature: 0.2,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content: `You are RAAHI, a Pakistani citizen service guide. Write in ${language === "en" ? "English" : language === "ps" ? "Pashto" : "Urdu"} at a 10-year-old's reading level. Use ONLY the verified context. Never invent a fee, date, phone number or requirement. If something is missing, say to confirm on the official source. Reply with 2-4 short sentences and no markdown.`,
        },
        { role: "user", content: `Question: ${query}\n\nVerified context:\n${context}` },
      ],
    });
    const content = response?.choices?.[0]?.message?.content?.trim();
    return content && content.length > 0 ? content : undefined;
  } catch {
    return undefined;
  }
}
