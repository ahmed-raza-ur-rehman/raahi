import { addDays, diffDays, todayInPakistan } from "./dates";
import { clockNow } from "./clock";
import type { Opportunity, OpportunityKind } from "./types";

/**
 * Deadline planner: turns "deadline = 14 Nov" into dated steps counted backwards from it, and a
 * documents checklist. Templates are generic good practice; the official advertisement always wins.
 */

interface Template {
  id: string;
  daysBefore: number;
  en: string;
  ur: string;
}

export interface PlanStep {
  id: string;
  en: string;
  ur: string;
  /** ISO date this step should be done by (never earlier than today). */
  due?: string;
  /** True when the ideal date has already passed and the step is compressed into "do it now". */
  late: boolean;
}

const SCHOLARSHIP: Template[] = [
  { id: "eligibility", daysBefore: 75, en: "Read the official eligibility rules and confirm you qualify (degree, grades, age, English score, experience, nationality).", ur: "سرکاری اہلیت کی شرائط پڑھیں اور تصدیق کریں کہ آپ اہل ہیں (ڈگری، گریڈ، عمر، انگریزی اسکور، تجربہ، شہریت)۔" },
  { id: "documents", daysBefore: 60, en: "Order transcripts and degree certificates; start HEC degree attestation / IBCC equivalence if the programme needs them.", ur: "ٹرانسکرپٹس اور ڈگری سرٹیفکیٹ منگوائیں؛ اگر پروگرام کو ضرورت ہو تو ایچ ای سی ڈگری تصدیق / آئی بی سی سی equivalence شروع کریں۔" },
  { id: "english-test", daysBefore: 55, en: "Book the English test the programme accepts (IELTS, TOEFL, Duolingo…) or confirm that you qualify for a waiver.", ur: "پروگرام کا قبول کردہ انگریزی ٹیسٹ (آئیلٹس، ٹوئفل، ڈولنگو…) بک کریں یا استثنا کی تصدیق کریں۔" },
  { id: "referees", daysBefore: 45, en: "Ask two referees now; send them your CV, the programme link and the deadline.", ur: "ابھی دو ریفری سے درخواست کریں؛ انہیں اپنا سی وی، پروگرام کا لنک اور آخری تاریخ بھیجیں۔" },
  { id: "statement", daysBefore: 35, en: "Write a first draft of your statement of purpose / motivation letter and get feedback from a teacher or mentor.", ur: "اپنے مقصد کے بیان / تحریک نامے کا پہلا مسودہ لکھیں اور کسی استاد یا رہنما سے رائے لیں۔" },
  { id: "passport", daysBefore: 30, en: "Check that your passport and CNIC/B-form are valid; start renewal if not.", ur: "چیک کریں کہ آپ کا پاسپورٹ اور شناختی کارڈ/ب فارم درست ہیں؛ نہ ہوں تو تجدید شروع کریں۔" },
  { id: "form", daysBefore: 14, en: "Fill in the online application and save a draft; upload final documents.", ur: "آن لائن درخواست بھریں اور مسودہ محفوظ کریں؛ حتمی دستاویزات اپ لوڈ کریں۔" },
  { id: "submit", daysBefore: 5, en: "Final check and submit — portals slow down in the last days.", ur: "آخری جانچ کریں اور جمع کرائیں — آخری دنوں میں پورٹل سست ہو جاتے ہیں۔" },
  { id: "confirm", daysBefore: 1, en: "Keep the confirmation email or number and check your spam folder.", ur: "تصدیقی ای میل یا نمبر محفوظ رکھیں اور اسپیم فولڈر دیکھیں۔" },
];

const GOVT_JOB: Template[] = [
  { id: "read-ad", daysBefore: 14, en: "Read the whole advertisement: qualification, age limit and relaxation, domicile, experience and how to apply.", ur: "پورا اشتہار پڑھیں: تعلیمی قابلیت، عمر کی حد اور رعایت، ڈومیسائل، تجربہ اور درخواست کا طریقہ۔" },
  { id: "documents", daysBefore: 10, en: "Prepare attested copies: CNIC, domicile, degrees and transcripts, experience letters, photographs.", ur: "تصدیق شدہ نقول تیار کریں: شناختی کارڈ، ڈومیسائل، ڈگریاں و ٹرانسکرپٹس، تجربے کے خطوط، تصاویر۔" },
  { id: "fee", daysBefore: 7, en: "Pay the application fee only through the bank challan or online channel named in the advertisement.", ur: "درخواست کی فیس صرف اشتہار میں بتائے گئے بینک چالان یا آن لائن ذریعے سے جمع کریں۔" },
  { id: "submit", daysBefore: 3, en: "Submit on time and keep proof of submission.", ur: "وقت پر جمع کرائیں اور جمع کرانے کا ثبوت رکھیں۔" },
  { id: "prepare", daysBefore: 0, en: "Start preparing for the test or interview — practise past-paper style questions.", ur: "ٹیسٹ یا انٹرویو کی تیاری شروع کریں — پرانے پرچوں کی طرز پر مشق کریں۔" },
];

const ADMISSION: Template[] = [
  { id: "read", daysBefore: 21, en: "Read the prospectus or admission notice: eligibility, programmes, merit formula, entry test, seats and fee.", ur: "پراسپیکٹس یا داخلہ نوٹس پڑھیں: اہلیت، پروگرام، میرٹ کا فارمولا، داخلہ ٹیسٹ، نشستیں اور فیس۔" },
  { id: "test", daysBefore: 18, en: "Check whether an entry test is required (NTS, NET, MDCAT or the university's own) and book or prepare for it.", ur: "دیکھیں کہ داخلہ ٹیسٹ درکار ہے یا نہیں (این ٹی ایس، نیٹ، ایم ڈی کیٹ یا جامعہ کا اپنا) اور اس کی تیاری یا بکنگ کریں۔" },
  { id: "documents", daysBefore: 12, en: "Prepare attested copies of your certificates and mark sheets, CNIC or B-Form, domicile and photographs.", ur: "اپنے سرٹیفکیٹ اور نمبروں کی فہرست، شناختی کارڈ یا ب فارم، ڈومیسائل اور تصاویر کی تصدیق شدہ نقول تیار کریں۔" },
  { id: "fee", daysBefore: 7, en: "Pay the form fee only through the bank challan or online channel on the university's own notice.", ur: "فارم کی فیس صرف جامعہ کے اپنے نوٹس میں بتائے گئے بینک چالان یا آن لائن ذریعے سے ادا کریں۔" },
  { id: "submit", daysBefore: 3, en: "Submit the form and keep the receipt, application number and roll-number slip.", ur: "فارم جمع کرائیں اور رسید، درخواست نمبر اور رول نمبر سلپ محفوظ رکھیں۔" },
];

const INTERNSHIP: Template[] = [
  { id: "cv", daysBefore: 14, en: "Update your CV and keep it to one page.", ur: "اپنا سی وی اپ ڈیٹ کریں اور ایک صفحے تک رکھیں۔" },
  { id: "letter", daysBefore: 10, en: "Write a short cover letter that matches the role.", ur: "عہدے کے مطابق مختصر کور لیٹر لکھیں۔" },
  { id: "documents", daysBefore: 8, en: "Collect transcript, student ID and any recommendation.", ur: "ٹرانسکرپٹ، طالب علم شناختی کارڈ اور سفارش جمع کریں۔" },
  { id: "submit", daysBefore: 3, en: "Apply through the official page and note the date.", ur: "سرکاری صفحے سے درخواست دیں اور تاریخ نوٹ کریں۔" },
];

const COMPETITION: Template[] = [
  { id: "rules", daysBefore: 14, en: "Read the rules: who can enter, team size, judging and prizes.", ur: "قواعد پڑھیں: کون حصہ لے سکتا ہے، ٹیم کا سائز، جانچ اور انعامات۔" },
  { id: "team", daysBefore: 12, en: "Register and form your team.", ur: "رجسٹر کریں اور ٹیم بنائیں۔" },
  { id: "build", daysBefore: 4, en: "Have a working version ready; leave time for a demo video or write-up.", ur: "کام کرنے والا ورژن تیار رکھیں؛ ڈیمو ویڈیو یا تحریر کے لیے وقت رکھیں۔" },
  { id: "submit", daysBefore: 1, en: "Submit well before the cut-off time.", ur: "آخری وقت سے خاصا پہلے جمع کرائیں۔" },
];

const OVERSEAS_JOB: Template[] = [
  { id: "verify", daysBefore: 21, en: "Verify the recruiter: find the BE&OE licence number on the official list; do not pay anything yet.", ur: "بھرتی کرنے والے کی تصدیق کریں: بی ای او ای کی سرکاری فہرست میں لائسنس نمبر دیکھیں؛ ابھی کوئی ادائیگی نہ کریں۔" },
  { id: "contract", daysBefore: 14, en: "Read the full employment contract: salary, hours, housing, return ticket, who pays what.", ur: "پورا ملازمت کا معاہدہ پڑھیں: تنخواہ، اوقات، رہائش، واپسی کا ٹکٹ، کون کیا ادا کرے گا۔" },
  { id: "documents", daysBefore: 10, en: "Prepare passport, CNIC, certificates, photographs and any trade-test or medical required.", ur: "پاسپورٹ، شناختی کارڈ، اسناد، تصاویر اور مطلوبہ ٹریڈ ٹیسٹ یا میڈیکل تیار کریں۔" },
  { id: "protector", daysBefore: 5, en: "Register for emigrant protection (e-Protector) through the official BE&OE route.", ur: "بی ای او ای کے سرکاری طریقے سے ایمیگرنٹ پروٹیکشن (ای پروٹیکٹر) کے لیے رجسٹر کریں۔" },
  { id: "pay-official", daysBefore: 3, en: "Pay only the official fees to official accounts and keep every receipt.", ur: "صرف سرکاری فیس سرکاری اکاؤنٹ میں ادا کریں اور ہر رسید رکھیں۔" },
];

const LEARNING: Template[] = [
  { id: "enrol", daysBefore: 0, en: "Enrol now — coupons and enrolment windows can close without notice.", ur: "ابھی اندراج کریں — کوپن اور اندراج کی مدت بغیر اطلاع ختم ہو سکتی ہے۔" },
];

function templatesFor(item: Pick<Opportunity, "kind" | "scope" | "tags" | "country">): Template[] {
  const kind: OpportunityKind = item.kind;
  if (kind === "scholarship" || kind === "fellowship" || kind === "grant") return SCHOLARSHIP;
  if (kind === "admission") return ADMISSION;
  if (kind === "internship") return INTERNSHIP;
  if (kind === "competition") return COMPETITION;
  if (kind === "course" || kind === "coupon" || kind === "training") return LEARNING;
  if (kind === "job") {
    if (item.scope === "pakistan" && (item.tags.includes("government") || item.tags.includes("njp"))) return GOVT_JOB;
    if (item.scope === "international" && !item.tags.includes("remote")) return OVERSEAS_JOB;
    return INTERNSHIP; // generic application steps for private/remote jobs
  }
  return INTERNSHIP;
}

export function buildApplicationPlan(item: Pick<Opportunity, "kind" | "scope" | "tags" | "country" | "deadline">, now: Date = clockNow()): PlanStep[] {
  const today = todayInPakistan(now);
  const templates = templatesFor(item);
  const deadline = item.deadline;

  return templates.map((template) => {
    if (!deadline) return { id: template.id, en: template.en, ur: template.ur, due: undefined, late: false };
    const ideal = addDays(deadline, -template.daysBefore);
    const late = diffDays(today, ideal) < 0;
    return { id: template.id, en: template.en, ur: template.ur, due: late ? today : ideal, late };
  });
}

export interface ChecklistItem {
  en: string;
  ur: string;
}

/** Documents people commonly need. Always follow the specific call for applications. */
export function documentChecklist(item: Pick<Opportunity, "kind" | "scope" | "tags">): ChecklistItem[] {
  const base: ChecklistItem[] = [
    { en: "CNIC (and B-form for under-18 applicants)", ur: "شناختی کارڈ (اور 18 سال سے کم عمر کے لیے ب فارم)" },
    { en: "Recent passport-size photographs", ur: "حالیہ پاسپورٹ سائز تصاویر" },
    { en: "Updated CV / résumé", ur: "تازہ ترین سی وی / ریزیومے" },
  ];
  const academic: ChecklistItem[] = [
    { en: "Degree certificates and transcripts (HEC-attested if the call requires it)", ur: "ڈگری سرٹیفکیٹ اور ٹرانسکرپٹس (اگر درکار ہو تو ایچ ای سی سے تصدیق شدہ)" },
    { en: "Matric/Intermediate certificates with IBCC equivalence if you studied abroad or took O/A levels", ur: "میٹرک/انٹرمیڈیٹ سرٹیفکیٹ؛ بیرون ملک یا او/اے لیول کی صورت میں آئی بی سی سی equivalence" },
  ];
  if (item.kind === "scholarship" || item.kind === "fellowship" || item.kind === "grant") {
    return [
      ...base,
      ...academic,
      { en: "Valid passport (check the validity the programme asks for)", ur: "درست پاسپورٹ (پروگرام کی مطلوبہ میعاد دیکھیں)" },
      { en: "English test result or waiver letter, if required", ur: "انگریزی ٹیسٹ کا نتیجہ یا استثنا کا خط، اگر درکار ہو" },
      { en: "Two recommendation letters", ur: "دو سفارشی خطوط" },
      { en: "Statement of purpose / motivation letter", ur: "مقصد کا بیان / تحریک نامہ" },
      { en: "Research proposal (PhD and some master's programmes)", ur: "تحقیقی تجویز (پی ایچ ڈی اور بعض ماسٹرز پروگرام)" },
    ];
  }
  if (item.kind === "admission") {
    return [
      ...base.filter((entry) => !/CV/.test(entry.en)),
      ...academic,
      { en: "Domicile certificate", ur: "ڈومیسائل سرٹیفکیٹ" },
      { en: "Entry-test result or roll-number slip, if the university requires one", ur: "داخلہ ٹیسٹ کا نتیجہ یا رول نمبر سلپ، اگر جامعہ مانگے" },
      { en: "Fee challan or receipt", ur: "فیس چالان یا رسید" },
    ];
  }
  if (item.kind === "job" && item.scope === "pakistan") {
    return [
      ...base,
      ...academic,
      { en: "Domicile certificate", ur: "ڈومیسائل سرٹیفکیٹ" },
      { en: "Experience certificates / service record", ur: "تجربے کے سرٹیفکیٹ / سروس ریکارڈ" },
      { en: "Fee challan or receipt, if the advertisement requires one", ur: "فیس چالان یا رسید، اگر اشتہار میں مطلوب ہو" },
      { en: "No-objection certificate if you already work for the government", ur: "اگر آپ پہلے سے سرکاری ملازم ہیں تو اعتراض نہ ہونے کا سرٹیفکیٹ" },
    ];
  }
  if (item.kind === "job" && item.scope === "international" && !item.tags.includes("remote")) {
    return [
      ...base,
      { en: "Passport with enough validity", ur: "مناسب میعاد والا پاسپورٹ" },
      { en: "Attested degrees and experience letters", ur: "تصدیق شدہ ڈگریاں اور تجربے کے خطوط" },
      { en: "Written employment contract and visa — read both before travelling", ur: "تحریری ملازمت کا معاہدہ اور ویزا — سفر سے پہلے دونوں پڑھیں" },
      { en: "BE&OE licence number of the recruiter and your e-Protector registration", ur: "بھرتی کرنے والے کا بی ای او ای لائسنس نمبر اور آپ کی ای پروٹیکٹر رجسٹریشن" },
    ];
  }
  if (item.kind === "internship") {
    return [...base, { en: "Latest transcript and student ID", ur: "تازہ ٹرانسکرپٹ اور طالب علم شناختی کارڈ" }, { en: "Short cover letter", ur: "مختصر کور لیٹر" }];
  }
  return base;
}
