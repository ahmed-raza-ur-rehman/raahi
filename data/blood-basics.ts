import type { DonorEligibilityRule } from "@/lib/types";
import { L } from "@/lib/i18n";
import { step } from "./helpers";

/**
 * The parts of the blood module a browser needs, in their own leaf.
 *
 * The blood screen is a client component. Importing these from ./blood would
 * drag every blood bank record into the bundle along with the compatible-donor
 * table and the step lists.
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

