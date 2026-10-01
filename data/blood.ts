import type { BloodBank } from "@/lib/types";
import { L } from "@/lib/i18n";
import { VERIFIED_ON, source } from "./helpers";

/**
 * Blood donation network.
 *
 * RAAHI lists organisations and the process, not private phone numbers of
 * individuals. Donor contact details are stored per-session in the citizen's own
 * request record and never published.
 */

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

// Re-exported: these live in ./blood-basics so the blood screen (a client
// component) can use them without the blood bank corpus.
export {
  BLOOD_COMPATIBILITY,
  BLOOD_GROUPS,
  bloodDonationSteps,
  bloodRequestSteps,
  compatibleDonors,
  donorEligibility,
} from "./blood-basics";
