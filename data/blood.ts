import type { BloodBank, DonorEligibilityRule } from "@/lib/types";
import { L } from "@/lib/i18n";
import { VERIFIED_ON, source, step } from "./helpers";

/**
 * Blood donation network.
 *
 * RAAHI lists organisations and the process, not private phone numbers of
 * individuals. Donor contact details are stored per-session in the citizen's own
 * request record and never published.
 */
export const donorEligibility: DonorEligibilityRule[] = [
  { rule: L("Age usually 18 to 60 years (centres may differ)", "عمر عموماً 18 سے 60 سال (مرکز کے لحاظ سے فرق ہو سکتا ہے)"), blocking: true },
  { rule: L("Weight usually at least 50 kg", "وزن عموماً کم از کم 50 کلوگرام"), blocking: true },
  { rule: L("Haemoglobin at or above the centre's minimum (checked on the spot)", "ہیموگلوبن مرکز کی کم از کم حد کے برابر یا زیادہ (مقام پر چیک ہوتا ہے)"), blocking: true },
  { rule: L("At least 8–12 weeks since your last whole-blood donation", "گزشتہ خون دینے کے کم از کم 8 سے 12 ہفتے بعد"), blocking: true },
  { rule: L("Not pregnant or breastfeeding", "حاملہ یا دودھ پلانے والی نہ ہوں"), blocking: true },
  { rule: L("No fever, infection or antibiotics in the last few days", "گزشتہ چند دنوں میں بخار، انفیکشن یا اینٹی بایوٹک نہ ہوئی ہو"), blocking: true },
  { rule: L("No major surgery or blood transfusion in the last 6–12 months", "گزشتہ 6 سے 12 ماہ میں بڑی سرجری یا خون کی منتقلی نہ ہوئی ہو"), blocking: true },
  { rule: L("No uncontrolled diabetes, heart disease, hepatitis B/C, HIV or malaria history", "غیر کنٹرولڈ ذیابیطس، دل کی بیماری، ہیپاٹائٹس بی/سی، ایچ آئی وی یا ملیریا کی تاریخ نہ ہو"), blocking: true },
  { rule: L("Eat a normal meal and drink water before donating — do not come fasting", "خون دینے سے پہلے معمول کا کھانا کھائیں اور پانی پئیں — بھوکے نہ آئیں"), blocking: false },
  { rule: L("Bring your CNIC so the centre can keep a safe record", "محفوظ ریکارڈ کے لیے اپنا شناختی کارڈ ساتھ لائیں"), blocking: false },
];

export const bloodBanks: BloodBank[] = [
  {
    id: "blood-edhi",
    name: L("Edhi Blood Bank", "ایدھی بلڈ بینک", "د ایدهي د وینې بانک"),
    city: "Karachi",
    province: "Sindh",
    type: "ngo",
    services: [
      L("Whole blood and components", "مکمل خون اور اجزاء"),
      L("Emergency supply for thalassemia and accident patients", "تھیلیسیمیا اور حادثات کے مریضوں کے لیے ہنگامی فراہمی"),
    ],
    components: ["whole_blood", "platelets", "plasma", "rbc"],
    hours: "24/7 at major centres",
    contact: [
      { label: L("Edhi emergency line", "ایدھی ایمرجنسی"), phone: "115" },
      { label: L("Edhi Foundation", "ایدھی فاؤنڈیشن"), url: "https://edhi.org/" },
    ],
    source: source("https://edhi.org/", "Edhi Foundation", 3, VERIFIED_ON),
    tags: ["24_7", "ngo", "emergency"],
  },
  {
    id: "blood-fatmeed",
    name: L("Fatmeed Foundation (Thalassemia & Blood Services)", "فاطمید فاؤنڈیشن", "د فاطمید ټولنه"),
    city: "Multiple",
    province: "Sindh",
    type: "ngo",
    services: [
      L("Free blood and blood components for thalassemia patients", "تھیلیسیمیا کے مریضوں کے لیے مفت خون"),
      L("Donor registration and screening", "عطیہ دہندگان کی رجسٹریشن اور اسکریننگ"),
    ],
    components: ["whole_blood", "rbc", "platelets"],
    hours: "Published centre hours",
    contact: [{ label: L("Fatmeed Foundation", "فاطمید فاؤنڈیشن"), url: "https://fatmeed.org/" }],
    source: source("https://fatmeed.org/", "Fatmeed Foundation", 3, VERIFIED_ON),
    tags: ["thalassemia", "free", "donor_registry"],
  },
  {
    id: "blood-sundas",
    name: L("Sundas Foundation (Thalassemia & Blood Diseases)", "سندس فاؤنڈیشن", "د سندس ټولنه"),
    city: "Lahore",
    province: "Punjab",
    type: "ngo",
    services: [
      L("Free or subsidised blood and chelation therapy for thalassemia patients", "تھیلیسیمیا کے مریضوں کے لیے مفت یا کم لاگت خون اور علاج"),
      L("Regular transfusion support programme", "باقاعدہ خون کی فراہمی کا پروگرام"),
    ],
    components: ["whole_blood", "rbc"],
    hours: "Published centre hours",
    contact: [{ label: L("Sundas Foundation", "سندس فاؤنڈیشن"), url: "https://sundas.org/" }],
    source: source("https://sundas.org/", "Sundas Foundation", 3, VERIFIED_ON),
    tags: ["thalassemia", "punjab", "free"],
  },
  {
    id: "blood-indus",
    name: L("Indus Hospital Blood Bank", "انڈس ہسپتال بلڈ بینک", "د انډس روغتون د وینې بانک"),
    city: "Karachi",
    province: "Sindh",
    type: "hospital",
    services: [
      L("Hospital blood bank with component separation", "ہسپتال بلڈ بینک مع اجزاء کی علیحدگی"),
      L("Support for cancer, surgery and thalassemia patients", "کینسر، سرجری اور تھیلیسیمیا کے مریضوں کی معاونت"),
    ],
    components: ["whole_blood", "platelets", "plasma", "cryo"],
    hours: "24/7 hospital service",
    contact: [{ label: L("Indus Hospital", "انڈس ہسپتال"), url: "https://indushospital.org.pk/" }],
    source: source("https://indushospital.org.pk/", "Indus Hospital & Health Network", 2, VERIFIED_ON),
    tags: ["hospital", "24_7", "components"],
  },
  {
    id: "blood-prcs",
    name: L("Pakistan Red Crescent Blood Transfusion Service", "ریڈ کریسنٹ بلڈ ٹرانسفیوژن سروس", "د سرې میاشتې د وینې خدمت"),
    city: "Multiple",
    province: "Pakistan",
    type: "public",
    services: [
      L("Voluntary blood donation and blood banking", "رضاکارانہ خون کا عطیہ اور بینکنگ"),
      L("Disaster-time blood mobilisation", "آفات کے وقت خون کی فراہمی"),
    ],
    components: ["whole_blood", "plasma", "platelets"],
    hours: "Published branch hours",
    contact: [{ label: L("Pakistan Red Crescent", "پاکستان ریڈ کریسنٹ"), url: "https://prcs.org.pk/" }],
    source: source("https://prcs.org.pk/", "Pakistan Red Crescent Society", 3, VERIFIED_ON),
    tags: ["public", "disaster", "voluntary"],
  },
  {
    id: "blood-provincial-authority",
    name: L("Provincial Blood Transfusion Authorities", "صوبائی بلڈ ٹرانسفیوژن اتھارٹیز", "د صوبې د وینې ادارې"),
    city: "Multiple",
    province: "Pakistan",
    type: "public",
    services: [
      L("Licensing and standards for blood banks", "بلڈ بینکوں کے لائسنس اور معیار"),
      L("Lists of registered blood banks in the province", "صوبے میں رجسٹرڈ بلڈ بینکوں کی فہرست"),
    ],
    components: ["whole_blood"],
    hours: "Government office hours",
    contact: [{ label: L("Punjab Blood Transfusion Authority", "پنجاب بلڈ ٹرانسفیوژن اتھارٹی"), url: "https://pbta.punjab.gov.pk/" }],
    source: source("https://pbta.punjab.gov.pk/", "Punjab Blood Transfusion Authority", 1, VERIFIED_ON),
    tags: ["public", "registry", "standards"],
  },
  {
    id: "blood-alkhidmat",
    name: L("Alkhidmat Blood Donation Network", "الخدمت خون کا نیٹ ورک", "د الخدمت د وینې شبکه"),
    city: "Multiple",
    province: "Pakistan",
    type: "ngo",
    services: [
      L("Blood donation camps and donor registry", "خون دینے کے کیمپ اور ڈونر رجسٹری"),
      L("Emergency matching for patients in need", "ضرورت مند مریضوں کے لیے ہنگامی میچنگ"),
    ],
    components: ["whole_blood"],
    hours: "Camp and office hours",
    contact: [{ label: L("Alkhidmat Foundation", "الخدمت فاؤنڈیشن"), url: "https://alkhidmat.org/" }],
    source: source("https://alkhidmat.org/", "Alkhidmat Foundation Pakistan", 3, VERIFIED_ON),
    tags: ["ngo", "camps", "donor_registry"],
  },
  {
    id: "blood-public-hospital",
    name: L("Government Teaching Hospital Blood Banks", "سرکاری ٹیچنگ ہسپتال بلڈ بینک", "د دولتي روغتون د وینې بانک"),
    city: "Multiple",
    province: "Pakistan",
    type: "hospital",
    services: [
      L("Free or low-cost blood for admitted patients", "داخل مریضوں کے لیے مفت یا کم لاگت خون"),
      L("Replacement donation coordination", "ریپلیسمنٹ ڈونیشن کی ہم آہنگی"),
    ],
    components: ["whole_blood", "rbc", "plasma"],
    hours: "24/7 at major teaching hospitals",
    contact: [{ label: L("Nearest government hospital", "قریبی سرکاری ہسپتال") }],
    source: source("https://www.nih.org.pk/", "National Institute of Health", 1, VERIFIED_ON),
    tags: ["hospital", "public", "24_7"],
  },
];

/** Who can safely receive from whom. Used by the matching helper. */
export const BLOOD_COMPATIBILITY: Record<string, string[]> = {
  "O-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
  "O+": ["O+", "A+", "B+", "AB+"],
  "A-": ["A-", "A+", "AB-", "AB+"],
  "A+": ["A+", "AB+"],
  "B-": ["B-", "B+", "AB-", "AB+"],
  "B+": ["B+", "AB+"],
  "AB-": ["AB-", "AB+"],
  "AB+": ["AB+"],
};

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

/** Who can donate to a given recipient — the reverse of the map above. */
export function compatibleDonors(recipientGroup: string): string[] {
  return BLOOD_GROUPS.filter((group) => BLOOD_COMPATIBILITY[group]?.includes(recipientGroup));
}

export const bloodRequestSteps = [
  step(1, "Confirm the requirement in writing", "ضرورت تحریری طور پر تصدیق کروائیں",
    "Ask the hospital for the blood group, the number of units and the component (whole blood, platelets, plasma).",
    "ہسپتال سے بلڈ گروپ، یونٹوں کی تعداد اور مطلوبہ جزو تحریراً لیں۔",
    "in_person"),
  step(2, "Ask the hospital blood bank first", "پہلے ہسپتال کے بلڈ بینک سے پوچھیں",
    "Teaching hospitals keep stock and run replacement donation; this is usually the fastest route.",
    "ٹیچنگ ہسپتالوں میں اسٹاک اور ریپلیسمنٹ کا نظام موجود ہے۔",
    "in_person"),
  step(3, "Post your need with a real contact number", "اپنی ضرورت درست نمبر کے ساتھ درج کروائیں",
    "Only share the patient's city, hospital, blood group and one contact number — never publish a CNIC.",
    "صرف شہر، ہسپتال، بلڈ گروپ اور ایک رابطہ نمبر دیں — شناختی کارڈ کبھی شیئر نہ کریں۔",
    "online"),
  step(4, "Call donors back and confirm", "ڈونرز کو واپس کال کریں اور تصدیق کریں",
    "Confirm who is coming and when, and thank them when the donation is done.",
    "تصدیق کریں کہ کون کب آ رہا ہے اور عطیہ دینے کے بعد شکریہ ادا کریں۔",
    "phone"),
  step(5, "Record the donation date", "خون دینے کی تاریخ درج کریں",
    "A donor cannot give again for 8–12 weeks — keep the record to protect their health.",
    "ڈونر 8 سے 12 ہفتے تک دوبارہ خون نہیں دے سکتا — ریکارڈ رکھیں۔",
    "in_person"),
];

export const bloodDonationSteps = [
  step(1, "Eat and drink water", "کھانا کھائیں اور پانی پئیں",
    "Never donate on an empty stomach.",
    "خالی پیٹ خون نہ دیں۔",
    "in_person"),
  step(2, "Screening at the centre", "مرکز پر اسکریننگ",
    "A short health questionnaire, haemoglobin check and blood group test are done free.",
    "مختصر سوالنامہ، ہیموگلوبن اور بلڈ گروپ ٹیسٹ مفت ہوتے ہیں۔",
    "in_person"),
  step(3, "Donate — it takes about 10 minutes", "خون دینا — تقریباً 10 منٹ",
    "The actual donation is quick; rest and refreshments follow.",
    "اصل عمل جلدی ختم ہو جاتا ہے اور اس کے بعد آرام اور کھانا دیا جاتا ہے۔",
    "in_person"),
  step(4, "After-care", "بعد میں دیکھ بھال",
    "Drink extra fluids, avoid heavy work for a few hours and press the site if it bleeds.",
    "زیادہ پانی پئیں، چند گھنٹے بھاری کام نہ کریں۔",
    "in_person"),
];

export const bloodBanksById = new Map(bloodBanks.map((record) => [record.id, record]));
