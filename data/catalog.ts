import { z } from "zod";

import type {
  EligibilityRule,
  OrganizationRecord,
  ServiceRecord,
} from "@/lib/types";

const verifiedOn = "2026-09-03";

const organizationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  nameUr: z.string().min(1),
  type: z.enum(["government", "ngo", "hospital"]),
  sourceUrl: z.url(),
  authorityTier: z.number().int().min(1).max(5),
});

const eligibilityValueSchema = z.union([
  z.boolean(),
  z.number(),
  z.string(),
  z.array(z.string()),
  z.tuple([z.number(), z.number()]),
]);

const serviceSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  domain: z.enum(["welfare", "education", "health", "documentation", "disaster", "legal", "employment"]),
  name: z.string().min(1),
  nameUr: z.string().min(1),
  namePs: z.string().min(1),
  description: z.string().min(1),
  descriptionUr: z.string().min(1),
  aliases: z.array(z.string()).min(1),
  coverage: z.array(z.string()).min(1),
  applicationMethod: z.enum(["online", "in_person", "phone", "sms", "mixed"]),
  sourceUrl: z.url(),
  sourceTitle: z.string().min(1),
  sourceAuthorityTier: z.number().int().min(1).max(5),
  lastVerified: z.string().date(),
  eligibilityRules: z.array(
    z.object({
      field: z.enum([
        "province",
        "district",
        "householdIncome",
        "householdSize",
        "gender",
        "age",
        "hasCnic",
        "isBispBeneficiary",
        "isEnrolled",
        "educationLevel",
        "pmtScore",
        "specialConditions",
      ]),
      operator: z.enum(["lt", "lte", "gt", "gte", "eq", "in", "exists", "between"]),
      value: eligibilityValueSchema,
      description: z.string().min(1),
      mandatory: z.boolean(),
    }),
  ),
  requiredDocuments: z.array(
    z.object({
      type: z.string().min(1),
      label: z.string().min(1),
      labelUr: z.string().min(1),
      mandatory: z.boolean(),
    }),
  ),
  procedure: z.array(
    z.object({
      order: z.number().int().positive(),
      title: z.string().min(1),
      titleUr: z.string().min(1),
      description: z.string().min(1),
      descriptionUr: z.string().min(1),
      channel: z.enum(["online", "in_person", "phone", "sms"]),
      url: z.url().optional(),
    }),
  ).min(1),
  active: z.boolean(),
});

export const organizations = organizationSchema.array().parse([
  { id: "bisp", name: "Benazir Income Support Programme", nameUr: "بینظیر انکم سپورٹ پروگرام", type: "government", sourceUrl: "https://bisp.gov.pk/", authorityTier: 1 },
  { id: "nadra", name: "National Database and Registration Authority", nameUr: "نادرا", type: "government", sourceUrl: "https://www.nadra.gov.pk/", authorityTier: 1 },
  { id: "hec", name: "Higher Education Commission", nameUr: "ہائر ایجوکیشن کمیشن", type: "government", sourceUrl: "https://www.hec.gov.pk/", authorityTier: 1 },
  { id: "pbm", name: "Pakistan Bait-ul-Mal", nameUr: "پاکستان بیت المال", type: "government", sourceUrl: "https://www.pbm.gov.pk/", authorityTier: 1 },
  { id: "navttc", name: "National Vocational and Technical Training Commission", nameUr: "قومی پیشہ ورانہ و تکنیکی تربیتی کمیشن", type: "government", sourceUrl: "https://navttc.gov.pk/", authorityTier: 1 },
  { id: "digiskills", name: "DigiSkills Pakistan", nameUr: "ڈیجی اسکلز پاکستان", type: "government", sourceUrl: "https://digiskills.pk/", authorityTier: 1 },
  { id: "banoqabil", name: "Bano Qabil", nameUr: "بانو قابل", type: "ngo", sourceUrl: "https://banoqabil.pk/", authorityTier: 3 },
  { id: "sehat-card-kp", name: "Sehat Card Plus KP", nameUr: "صحت کارڈ پلس خیبر پختونخوا", type: "government", sourceUrl: "https://sehatsahulat.com.pk/", authorityTier: 1 },
  { id: "phimc", name: "Punjab Health Initiative Management Company", nameUr: "پنجاب ہیلتھ انیشی ایٹو مینجمنٹ کمپنی", type: "government", sourceUrl: "https://phimc.punjab.gov.pk/", authorityTier: 1 },
  { id: "sundas", name: "Sundas Foundation", nameUr: "سندس فاؤنڈیشن", type: "ngo", sourceUrl: "https://sundas.org/", authorityTier: 3 },
  { id: "indus", name: "Indus Hospital and Health Network", nameUr: "انڈس ہسپتال اور ہیلتھ نیٹ ورک", type: "hospital", sourceUrl: "https://indushospital.org.pk/", authorityTier: 2 },
  { id: "alkhidmat", name: "Alkhidmat Foundation Pakistan", nameUr: "الخدمت فاؤنڈیشن پاکستان", type: "ngo", sourceUrl: "https://alkhidmat.org/", authorityTier: 3 },
  { id: "edhi", name: "Edhi Foundation", nameUr: "ایدھی فاؤنڈیشن", type: "ngo", sourceUrl: "https://edhi.org/", authorityTier: 3 },
  { id: "ndma", name: "National Disaster Management Authority", nameUr: "نیشنل ڈیزاسٹر مینجمنٹ اتھارٹی", type: "government", sourceUrl: "https://www.ndma.gov.pk/", authorityTier: 1 },
  { id: "pdma-kp", name: "Provincial Disaster Management Authority Khyber Pakhtunkhwa", nameUr: "صوبائی ڈیزاسٹر مینجمنٹ اتھارٹی خیبر پختونخوا", type: "government", sourceUrl: "https://www.pdma.gov.pk/", authorityTier: 1 },
  { id: "pdma-punjab", name: "Provincial Disaster Management Authority Punjab", nameUr: "صوبائی ڈیزاسٹر مینجمنٹ اتھارٹی پنجاب", type: "government", sourceUrl: "https://pdma.punjab.gov.pk/", authorityTier: 1 },
  { id: "pdma-sindh", name: "Provincial Disaster Management Authority Sindh", nameUr: "صوبائی ڈیزاسٹر مینجمنٹ اتھارٹی سندھ", type: "government", sourceUrl: "https://pdma.gos.pk/", authorityTier: 1 },
  { id: "prcs", name: "Pakistan Red Crescent Society", nameUr: "پاکستان ریڈ کریسنٹ سوسائٹی", type: "ngo", sourceUrl: "https://prcs.org.pk/", authorityTier: 3 },
  { id: "dgip", name: "Directorate General Immigration and Passports", nameUr: "ڈائریکٹوریٹ جنرل امیگریشن اینڈ پاسپورٹس", type: "government", sourceUrl: "https://www.dgip.gov.pk/", authorityTier: 1 },
  { id: "cfc-kp", name: "KP Citizen Facilitation Center", nameUr: "خیبر پختونخوا سٹیزن فسیلیٹیشن سینٹر", type: "government", sourceUrl: "https://cfc.kp.gov.pk/", authorityTier: 1 },
  { id: "dastak", name: "Punjab Dastak", nameUr: "پنجاب دستک", type: "government", sourceUrl: "https://dastak.punjab.gov.pk/", authorityTier: 1 },
  { id: "punjab-land-records", name: "Punjab Land Records Authority", nameUr: "پنجاب لینڈ ریکارڈز اتھارٹی", type: "government", sourceUrl: "https://www.punjab-zameen.gov.pk/", authorityTier: 1 },
]);

const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));
type OrganizationId = (typeof organizations)[number]["id"];

type ServiceInput = Omit<
  ServiceRecord,
  | "sourceUrl"
  | "sourceTitle"
  | "sourceAuthorityTier"
  | "lastVerified"
  | "description"
  | "descriptionUr"
  | "procedure"
  | "active"
> & {
  organizationId: OrganizationId;
  description?: string;
  descriptionUr?: string;
  procedure?: ServiceRecord["procedure"];
  sourceUrl?: string;
  sourceTitle?: string;
  sourceAuthorityTier?: number;
};

function channelFor(method: ServiceRecord["applicationMethod"]): "online" | "in_person" | "phone" | "sms" {
  return method === "mixed" ? "online" : method;
}

function service(input: ServiceInput): ServiceRecord {
  const organization = organizationById.get(input.organizationId);
  if (!organization) {
    throw new Error(`Unknown organization: ${input.organizationId}`);
  }

  const sourceUrl = input.sourceUrl ?? organization.sourceUrl;
  return {
    ...input,
    description:
      input.description ??
      `Use this verified ${organization.name} resource to review current service information and contact the issuing authority before acting.`,
    descriptionUr:
      input.descriptionUr ??
      `موجودہ معلومات اور اگلا درست قدم جاننے کے لیے ${organization.nameUr} کے تصدیق شدہ ذریعے کو استعمال کریں اور ادارے سے براہِ راست تصدیق کریں۔`,
    sourceUrl,
    sourceTitle: input.sourceTitle ?? organization.name,
    sourceAuthorityTier: input.sourceAuthorityTier ?? organization.authorityTier,
    lastVerified: verifiedOn,
    procedure: input.procedure ?? [
      {
        order: 1,
        title: "Open the verified source",
        titleUr: "تصدیق شدہ ذریعہ کھولیں",
        description: "Review the official service page and confirm the current process with the provider.",
        descriptionUr: "سرکاری یا ادارہ جاتی صفحہ دیکھیں اور موجودہ طریقہ کار کی ادارے سے تصدیق کریں۔",
        channel: channelFor(input.applicationMethod),
        url: sourceUrl,
      },
    ],
    active: true,
  };
}

const cnicDocument = { type: "cnic", label: "CNIC", labelUr: "شناختی کارڈ", mandatory: true };
const schoolDocument = { type: "school_enrollment", label: "School enrollment evidence", labelUr: "اسکول میں داخلے کا ثبوت", mandatory: true };
const incomeDocument = { type: "income_proof", label: "Income information if requested", labelUr: "اگر طلب ہو تو آمدن کی معلومات", mandatory: false };
const cnicRule: EligibilityRule = { field: "hasCnic", operator: "eq", value: true, description: "A valid CNIC is available.", mandatory: true };

export const services = serviceSchema.array().parse([
  service({ id: "bisp-kafaalat", organizationId: "bisp", domain: "welfare", name: "Benazir Kafaalat information", nameUr: "بینظیر کفالت معلومات", namePs: "د بینظیر کفالت معلومات", aliases: ["BISP", "کفالت", "8171", "financial support", "مالی مدد"], coverage: ["Pakistan"], applicationMethod: "mixed", eligibilityRules: [cnicRule, { field: "gender", operator: "eq", value: "female", description: "Kafaalat is assessed for an eligible woman in the household.", mandatory: true }, { field: "pmtScore", operator: "exists", value: true, description: "An official assessment is required to determine the household's status.", mandatory: true }], requiredDocuments: [cnicDocument], procedure: [{ order: 1, title: "Check through 8171", titleUr: "8171 کے ذریعے جانچیں", description: "Use the official 8171 portal to review the current status of a CNIC.", descriptionUr: "شناختی کارڈ کی موجودہ حیثیت کے لیے سرکاری 8171 پورٹل استعمال کریں۔", channel: "online", url: "https://8171.bisp.gov.pk/" }, { order: 2, title: "Follow official instructions", titleUr: "سرکاری ہدایات پر عمل کریں", description: "Follow the instructions shown by BISP or visit the office it identifies.", descriptionUr: "BISP کی دکھائی گئی ہدایات پر عمل کریں یا بتائے گئے دفتر جائیں۔", channel: "in_person", url: "https://bisp.gov.pk/" }] }),
  service({ id: "bisp-taleemi-wazaif", organizationId: "bisp", domain: "education", name: "Benazir Taleemi Wazaif", nameUr: "بینظیر تعلیمی وظائف", namePs: "د بینظیر تعلیمي وظیفې", aliases: ["Taleemi Wazaif", "تعلیمی وظائف", "school fee", "school support", "وظیفہ"], coverage: ["Pakistan"], applicationMethod: "mixed", sourceUrl: "https://bisp.gov.pk/Detail/YzNlY2Q2ZGYtNjIwZS00MjNiLWFhMmEtZGM5NWNkMjZhMjQ3", sourceTitle: "BISP Taleemi Wazaif", eligibilityRules: [{ field: "isBispBeneficiary", operator: "eq", value: true, description: "The household is an active BISP beneficiary.", mandatory: true }, { field: "isEnrolled", operator: "eq", value: true, description: "The child is enrolled in school or college.", mandatory: true }, { field: "age", operator: "between", value: [4, 22], description: "The student age is within the programme's published range.", mandatory: true }], requiredDocuments: [cnicDocument, schoolDocument] }),
  service({ id: "bisp-nashonuma", organizationId: "bisp", domain: "welfare", name: "Benazir Nashonuma information", nameUr: "بینظیر نشوونما معلومات", namePs: "د بینظیر نشوونما معلومات", aliases: ["Nashonuma", "نشوونما", "nutrition", "pregnant", "بچہ", "nutrition support"], coverage: ["Pakistan"], applicationMethod: "mixed", sourceUrl: "https://bisp.gov.pk/Detail/YjAyMjI5ZDQtMTVkOC00YTNlLWE5NjctMjA1NTYwN2JhOTE3", sourceTitle: "Benazir Nashonuma Programme", eligibilityRules: [{ field: "isBispBeneficiary", operator: "eq", value: true, description: "The household is an active BISP beneficiary.", mandatory: true }, { field: "specialConditions", operator: "in", value: ["pregnant", "lactating", "child_under_two"], description: "The household has a published Nashonuma condition.", mandatory: true }], requiredDocuments: [cnicDocument] }),
  service({ id: "bisp-registration-route", organizationId: "bisp", domain: "welfare", name: "BISP registration guidance", nameUr: "BISP رجسٹریشن رہنمائی", namePs: "د BISP نوم‌لیکنې لارښود", aliases: ["BISP registration", "BISP register", "BISP رجسٹریشن", "NSER", "8171 registration"], coverage: ["Pakistan"], applicationMethod: "in_person", sourceUrl: "https://bisp.gov.pk/", sourceTitle: "Benazir Income Support Programme", eligibilityRules: [], requiredDocuments: [cnicDocument] }),
  service({ id: "bisp-8171-status", organizationId: "bisp", domain: "welfare", name: "BISP 8171 status check", nameUr: "BISP 8171 اسٹیٹس چیک", namePs: "د BISP 8171 حالت کتنه", aliases: ["8171", "BISP status", "اہلیت چیک", "BISP check"], coverage: ["Pakistan"], applicationMethod: "online", sourceUrl: "https://8171.bisp.gov.pk/", sourceTitle: "BISP 8171 web portal", eligibilityRules: [cnicRule], requiredDocuments: [cnicDocument] }),
  service({ id: "pbm-individual-assistance", organizationId: "pbm", domain: "welfare", name: "Pakistan Bait-ul-Mal assistance route", nameUr: "پاکستان بیت المال امداد کا راستہ", namePs: "د پاکستان بیت المال مرستې لاره", aliases: ["Bait ul Mal", "PBM", "financial assistance", "بیت المال", "مالی امداد"], coverage: ["Pakistan"], applicationMethod: "mixed", sourceUrl: "https://www.pbm.gov.pk/Forms.html", sourceTitle: "Pakistan Bait-ul-Mal assistance information", eligibilityRules: [], requiredDocuments: [cnicDocument, incomeDocument] }),
  service({ id: "pbm-medical-assistance", organizationId: "pbm", domain: "health", name: "Pakistan Bait-ul-Mal medical assistance route", nameUr: "پاکستان بیت المال طبی امداد کا راستہ", namePs: "د پاکستان بیت المال طبي مرستې لاره", aliases: ["PBM medical", "medical aid", "hospital cost", "طبی امداد", "علاج کی مدد"], coverage: ["Pakistan"], applicationMethod: "mixed", sourceUrl: "https://www.pbm.gov.pk/Forms.html", sourceTitle: "Pakistan Bait-ul-Mal assistance information", eligibilityRules: [], requiredDocuments: [cnicDocument, { type: "medical_referral", label: "Medical referral or estimate if requested", labelUr: "اگر طلب ہو تو طبی ریفرل یا تخمینہ", mandatory: false }] }),
  service({ id: "pbm-scholarships", organizationId: "pbm", domain: "education", name: "Pakistan Bait-ul-Mal scholarships", nameUr: "پاکستان بیت المال وظائف", namePs: "د پاکستان بیت المال بورسونه", aliases: ["PBM scholarship", "Bait ul Mal scholarship", "تعلیمی مدد", "scholarship"], coverage: ["Pakistan"], applicationMethod: "mixed", sourceUrl: "https://www.pbm.gov.pk/Project-Scholarships.html", sourceTitle: "Pakistan Bait-ul-Mal scholarships", eligibilityRules: [{ field: "isEnrolled", operator: "eq", value: true, description: "The applicant is enrolled in an educational institution.", mandatory: true }], requiredDocuments: [cnicDocument, schoolDocument, incomeDocument] }),
  service({ id: "pbm-sweet-homes-info", organizationId: "pbm", domain: "welfare", name: "Pakistan Bait-ul-Mal child support information", nameUr: "پاکستان بیت المال بچوں کی معاونت معلومات", namePs: "د پاکستان بیت المال د ماشومانو مرستې معلومات", aliases: ["PBM child support", "orphan support", "بچوں کی مدد", "یتیم"], coverage: ["Pakistan"], applicationMethod: "mixed", eligibilityRules: [{ field: "specialConditions", operator: "in", value: ["orphan"], description: "The child has an orphan-support condition to discuss with PBM.", mandatory: true }], requiredDocuments: [cnicDocument] }),
  service({ id: "alkhidmat-financial-support", organizationId: "alkhidmat", domain: "welfare", name: "Alkhidmat community support enquiry", nameUr: "الخدمت کمیونٹی معاونت معلومات", namePs: "د الخدمت ټولنیزې مرستې پوښتنه", aliases: ["Alkhidmat support", "الخدمت امداد", "community help", "financial support"], coverage: ["Pakistan"], applicationMethod: "mixed", eligibilityRules: [], requiredDocuments: [cnicDocument, incomeDocument] }),
  service({ id: "edhi-welfare-enquiry", organizationId: "edhi", domain: "welfare", name: "Edhi welfare support enquiry", nameUr: "ایدھی فلاحی معاونت معلومات", namePs: "د ایدهي فلاحي مرستې پوښتنه", aliases: ["Edhi help", "ایدھی مدد", "welfare support", "community aid"], coverage: ["Pakistan"], applicationMethod: "phone", eligibilityRules: [], requiredDocuments: [] }),
  service({ id: "bisp-complaint-route", organizationId: "bisp", domain: "welfare", name: "BISP complaint and escalation guidance", nameUr: "BISP شکایت اور رہنمائی", namePs: "د BISP شکایت او لارښود", aliases: ["BISP complaint", "BISP payment issue", "BISP شکایت", "8171 complaint"], coverage: ["Pakistan"], applicationMethod: "mixed", eligibilityRules: [cnicRule], requiredDocuments: [cnicDocument] }),

  service({ id: "nadra-cnic", organizationId: "nadra", domain: "documentation", name: "CNIC service information", nameUr: "شناختی کارڈ کی معلومات", namePs: "د پېژندپاڼې معلومات", aliases: ["CNIC", "ID card", "شناختی کارڈ", "شناختی", "تذکره"], coverage: ["Pakistan"], applicationMethod: "mixed", sourceUrl: "https://www.nadra.gov.pk/identityDocument/cnic", sourceTitle: "NADRA Computerised National Identity Card", eligibilityRules: [], requiredDocuments: [] }),
  service({ id: "nadra-smart-cnic", organizationId: "nadra", domain: "documentation", name: "Smart CNIC information", nameUr: "سمارٹ شناختی کارڈ کی معلومات", namePs: "د سمارټ پېژندپاڼې معلومات", aliases: ["Smart CNIC", "smart card", "سمارٹ کارڈ", "شناختی کارڈ"], coverage: ["Pakistan"], applicationMethod: "mixed", sourceUrl: "https://www.nadra.gov.pk/identityDocument/cnic", sourceTitle: "NADRA Computerised National Identity Card", eligibilityRules: [], requiredDocuments: [] }),
  service({ id: "nadra-pakid", organizationId: "nadra", domain: "documentation", name: "PakID mobile application", nameUr: "پاک آئی ڈی موبائل ایپ", namePs: "د پاک آی ډي موبایل اپلېکېشن", aliases: ["PakID", "Pak ID", "NADRA online", "پاک آئی ڈی", "آن لائن شناختی کارڈ"], coverage: ["Pakistan", "Overseas"], applicationMethod: "online", sourceUrl: "https://www.nadra.gov.pk/aboutPakID", sourceTitle: "NADRA PakID mobile application", eligibilityRules: [], requiredDocuments: [] }),
  service({ id: "nadra-family-registration", organizationId: "nadra", domain: "documentation", name: "Family registration information", nameUr: "فیملی رجسٹریشن کی معلومات", namePs: "د کورنۍ نوم‌لیکنې معلومات", aliases: ["FRC", "family registration", "فیملی رجسٹریشن", "خاندانی رجسٹریشن"], coverage: ["Pakistan"], applicationMethod: "mixed", sourceUrl: "https://www.nadra.gov.pk/aboutPakID", sourceTitle: "NADRA PakID mobile application", eligibilityRules: [], requiredDocuments: [] }),
  service({ id: "nadra-verification", organizationId: "nadra", domain: "documentation", name: "NADRA verification services", nameUr: "نادرا تصدیقی خدمات", namePs: "د نادرا د تصدیق خدمتونه", aliases: ["NADRA verification", "identity verification", "تصدیق", "شناخت کی تصدیق"], coverage: ["Pakistan"], applicationMethod: "mixed", sourceUrl: "https://www.nadra.gov.pk/verification", sourceTitle: "NADRA Verification Services", eligibilityRules: [], requiredDocuments: [] }),
  service({ id: "dgip-new-passport", organizationId: "dgip", domain: "documentation", name: "New passport application process", nameUr: "نئے پاسپورٹ کی درخواست کا طریقہ", namePs: "د نوي پاسپورټ د غوښتنې بهیر", aliases: ["new passport", "passport apply", "پاسپورٹ", "نیا پاسپورٹ"], coverage: ["Pakistan"], applicationMethod: "in_person", sourceUrl: "https://dgip.gov.pk/passport/process.php", sourceTitle: "DGI&P Passport Application Process", eligibilityRules: [cnicRule], requiredDocuments: [cnicDocument] }),
  service({ id: "dgip-passport-renewal", organizationId: "dgip", domain: "documentation", name: "Passport renewal information", nameUr: "پاسپورٹ تجدید کی معلومات", namePs: "د پاسپورټ د نوي کولو معلومات", aliases: ["passport renewal", "renew passport", "پاسپورٹ تجدید", "پاسپورٹ رینیو"], coverage: ["Pakistan", "Overseas"], applicationMethod: "mixed", sourceUrl: "https://www.dgip.gov.pk/updates/online-passport-renewal.php", sourceTitle: "DGI&P online passport renewal", eligibilityRules: [cnicRule], requiredDocuments: [cnicDocument] }),
  service({ id: "cfc-kp-domicile", organizationId: "cfc-kp", domain: "documentation", name: "Khyber Pakhtunkhwa domicile certificate", nameUr: "خیبر پختونخوا ڈومیسائل سرٹیفکیٹ", namePs: "د خېبر پښتونخوا د استوګنې سند", aliases: ["KP domicile", "KPK domicile", "domicile", "ڈومیسائل", "استوګنې سند"], coverage: ["Khyber Pakhtunkhwa"], applicationMethod: "mixed", sourceUrl: "https://cfc.kp.gov.pk/Application/Application/CheckList?a=uqo9gqEr5NICnLZK0EfxpA%3D%3D", sourceTitle: "KP CFC Domicile Certificate", eligibilityRules: [{ field: "province", operator: "eq", value: "Khyber Pakhtunkhwa", description: "The applicant needs a Khyber Pakhtunkhwa domicile route.", mandatory: true }], requiredDocuments: [cnicDocument], procedure: [{ order: 1, title: "Review the CFC checklist", titleUr: "CFC کی فہرست دیکھیں", description: "Open the official KP CFC checklist for the current requirements.", descriptionUr: "موجودہ تقاضوں کے لیے سرکاری KP CFC فہرست کھولیں۔", channel: "online", url: "https://cfc.kp.gov.pk/Application/Application/CheckList?a=uqo9gqEr5NICnLZK0EfxpA%3D%3D" }, { order: 2, title: "Use the CFC service route", titleUr: "CFC سروس کا راستہ استعمال کریں", description: "Use the CFC portal or the office route it specifies.", descriptionUr: "CFC پورٹل یا اس کے بتائے گئے دفتر کا راستہ استعمال کریں۔", channel: "in_person", url: "https://cfc.kp.gov.pk/" }] }),
  service({ id: "dastak-punjab-domicile", organizationId: "dastak", domain: "documentation", name: "Punjab domicile certificate", nameUr: "پنجاب ڈومیسائل سرٹیفکیٹ", namePs: "د پنجاب د استوګنې سند", aliases: ["Punjab domicile", "domicile certificate", "ڈومیسائل", "پنجاب ڈومیسائل"], coverage: ["Punjab"], applicationMethod: "mixed", sourceUrl: "https://dastak.punjab.gov.pk/citizen/services", sourceTitle: "Punjab Dastak services", eligibilityRules: [{ field: "province", operator: "eq", value: "Punjab", description: "The applicant needs a Punjab domicile route.", mandatory: true }], requiredDocuments: [cnicDocument] }),
  service({ id: "dastak-birth-certificate", organizationId: "dastak", domain: "documentation", name: "Punjab birth certificate service route", nameUr: "پنجاب برتھ سرٹیفکیٹ سروس", namePs: "د پنجاب د زېږون سند خدمت", aliases: ["birth certificate", "birth registration", "پیدائش سرٹیفکیٹ", "برتھ سرٹیفکیٹ"], coverage: ["Punjab"], applicationMethod: "mixed", sourceUrl: "https://dastak.punjab.gov.pk/citizen/services", sourceTitle: "Punjab Dastak services", eligibilityRules: [{ field: "province", operator: "eq", value: "Punjab", description: "The applicant needs a Punjab service route.", mandatory: true }], requiredDocuments: [] }),
  service({ id: "dastak-marriage-certificate", organizationId: "dastak", domain: "documentation", name: "Punjab marriage certificate service route", nameUr: "پنجاب میرج سرٹیفکیٹ سروس", namePs: "د پنجاب د واده سند خدمت", aliases: ["marriage certificate", "marriage registration", "نکاح رجسٹریشن", "شادی سرٹیفکیٹ"], coverage: ["Punjab"], applicationMethod: "mixed", sourceUrl: "https://dastak.punjab.gov.pk/citizen/services", sourceTitle: "Punjab Dastak services", eligibilityRules: [{ field: "province", operator: "eq", value: "Punjab", description: "The applicant needs a Punjab service route.", mandatory: true }], requiredDocuments: [] }),
  service({ id: "dastak-driving-license", organizationId: "dastak", domain: "documentation", name: "Punjab driving licence service route", nameUr: "پنجاب ڈرائیونگ لائسنس سروس", namePs: "د پنجاب د موټر چلولو جواز خدمت", aliases: ["driving licence", "driving license", "ڈرائیونگ لائسنس", "لائسنس"], coverage: ["Punjab"], applicationMethod: "mixed", sourceUrl: "https://dastak.punjab.gov.pk/citizen/services", sourceTitle: "Punjab Dastak services", eligibilityRules: [{ field: "province", operator: "eq", value: "Punjab", description: "The applicant needs a Punjab service route.", mandatory: true }], requiredDocuments: [cnicDocument] }),
  service({ id: "punjab-land-records", organizationId: "punjab-land-records", domain: "documentation", name: "Punjab land records information", nameUr: "پنجاب لینڈ ریکارڈز کی معلومات", namePs: "د پنجاب د ځمکو د ریکارډونو معلومات", aliases: ["land record", "property record", "پٹواری", "زمین ریکارڈ", "انتقال"], coverage: ["Punjab"], applicationMethod: "mixed", eligibilityRules: [{ field: "province", operator: "eq", value: "Punjab", description: "The applicant needs a Punjab land-record service route.", mandatory: true }], requiredDocuments: [cnicDocument] }),
  service({ id: "nadra-digital-identity", organizationId: "nadra", domain: "documentation", name: "NADRA digital identity information", nameUr: "نادرا ڈیجیٹل شناخت کی معلومات", namePs: "د نادرا ډیجیټل پېژندنې معلومات", aliases: ["digital identity", "NADRA login", "ڈیجیٹل شناخت", "نادرا آن لائن"], coverage: ["Pakistan"], applicationMethod: "online", sourceUrl: "https://www.nadra.gov.pk/digitalIdentity/sso", sourceTitle: "Sign in with PakID", eligibilityRules: [], requiredDocuments: [] }),

  service({ id: "hec-need-based-scholarships", organizationId: "hec", domain: "education", name: "HEC Need Based Scholarships", nameUr: "HEC ضرورت پر مبنی وظائف", namePs: "د HEC د اړتیا پر بنسټ بورسونه", aliases: ["HEC scholarship", "need based scholarship", "university fee", "HEC وظائف", "یونیورسٹی فیس"], coverage: ["Pakistan"], applicationMethod: "in_person", sourceUrl: "https://www.hec.gov.pk/english/scholarshipsgrants/NBS/Pages/Eligibility-Criteria.aspx", sourceTitle: "HEC Need Based Scholarships Eligibility Criteria", eligibilityRules: [{ field: "isEnrolled", operator: "eq", value: true, description: "The applicant is enrolled at a participating institution.", mandatory: true }], requiredDocuments: [cnicDocument, incomeDocument] }),
  service({ id: "hec-scholarships-directory", organizationId: "hec", domain: "education", name: "HEC scholarships directory", nameUr: "HEC وظائف ڈائریکٹری", namePs: "د HEC د بورسونو لارښود", aliases: ["HEC scholarships", "HEC financial aid", "HEC وظائف", "scholarship search"], coverage: ["Pakistan"], applicationMethod: "online", sourceUrl: "https://www.hec.gov.pk/site/scholarships", sourceTitle: "HEC Scholarships Home", eligibilityRules: [], requiredDocuments: [] }),
  service({ id: "hec-need-based-application", organizationId: "hec", domain: "education", name: "HEC Need Based Scholarship application guidance", nameUr: "HEC ضرورت پر مبنی وظیفہ درخواست رہنمائی", namePs: "د HEC د اړتیا پر بنسټ بورس غوښتنلیک لارښود", aliases: ["HEC apply", "NBS application", "HEC درخواست", "scholarship application"], coverage: ["Pakistan"], applicationMethod: "in_person", sourceUrl: "https://www.hec.gov.pk/english/scholarshipsgrants/NBS/Pages/How-To-Apply.aspx", sourceTitle: "HEC Need Based Scholarships How To Apply", eligibilityRules: [{ field: "isEnrolled", operator: "eq", value: true, description: "The applicant is enrolled at a participating institution.", mandatory: true }], requiredDocuments: [cnicDocument, incomeDocument] }),
  service({ id: "hec-foreign-scholarships", organizationId: "hec", domain: "education", name: "HEC learning opportunities abroad", nameUr: "HEC بیرون ملک تعلیمی مواقع", namePs: "د HEC بهرني زده‌کړیز فرصتونه", aliases: ["foreign scholarship", "HEC abroad", "بیرون ملک وظیفہ", "HEC overseas"], coverage: ["Pakistan"], applicationMethod: "online", sourceUrl: "https://www.hec.gov.pk/english/scholarshipsgrants/lao/pages/default.aspx", sourceTitle: "HEC Learning Opportunities Abroad", eligibilityRules: [], requiredDocuments: [] }),
  service({ id: "navttc-training-programmes", organizationId: "navttc", domain: "education", name: "NAVTTC training programmes", nameUr: "NAVTTC تربیتی پروگرام", namePs: "د NAVTTC روزنیز پروګرامونه", aliases: ["NAVTTC", "skills training", "technical training", "ہنر سیکھیں", "تربیت"], coverage: ["Pakistan"], applicationMethod: "online", eligibilityRules: [], requiredDocuments: [cnicDocument] }),
  service({ id: "navttc-digital-marketing", organizationId: "navttc", domain: "education", name: "NAVTTC digital marketing course information", nameUr: "NAVTTC ڈیجیٹل مارکیٹنگ کورس معلومات", namePs: "د NAVTTC ډیجیټل مارکیټینګ کورس معلومات", aliases: ["digital marketing", "NAVTTC course", "ڈیجیٹل مارکیٹنگ", "SEO course"], coverage: ["Pakistan"], applicationMethod: "online", sourceUrl: "https://navttc.gov.pk/wp-content/uploads/2026/08/LessonPlans/6Months/SEODigitalMarketing.pdf", sourceTitle: "NAVTTC Digital Marketing and SEO course outline", eligibilityRules: [], requiredDocuments: [cnicDocument] }),
  service({ id: "digiskills-online-training", organizationId: "digiskills", domain: "education", name: "DigiSkills online training", nameUr: "ڈیجی اسکلز آن لائن تربیت", namePs: "د ډیجي سکلز آنلاین روزنه", aliases: ["DigiSkills", "freelancing", "online course", "ڈیجی اسکلز", "فری لانس"], coverage: ["Pakistan"], applicationMethod: "online", eligibilityRules: [], requiredDocuments: [] }),
  service({ id: "banoqabil-it-training", organizationId: "banoqabil", domain: "education", name: "Bano Qabil IT training enquiry", nameUr: "بانو قابل آئی ٹی تربیت معلومات", namePs: "د بانو قابل آی ټي روزنې پوښتنه", aliases: ["Bano Qabil", "IT training KP", "بانو قابل", "آئی ٹی تربیت", "پښتونخوا کورس"], coverage: ["Khyber Pakhtunkhwa"], applicationMethod: "online", eligibilityRules: [{ field: "province", operator: "eq", value: "Khyber Pakhtunkhwa", description: "The applicant is looking for a Khyber Pakhtunkhwa route.", mandatory: true }], requiredDocuments: [] }),
  service({ id: "alkhidmat-education-support", organizationId: "alkhidmat", domain: "education", name: "Alkhidmat education support enquiry", nameUr: "الخدمت تعلیمی معاونت معلومات", namePs: "د الخدمت د زده‌کړې مرستې پوښتنه", aliases: ["Alkhidmat scholarship", "education support", "الخدمت وظیفہ", "فیس مدد"], coverage: ["Pakistan"], applicationMethod: "mixed", eligibilityRules: [{ field: "isEnrolled", operator: "eq", value: true, description: "The learner is currently enrolled.", mandatory: true }], requiredDocuments: [schoolDocument, incomeDocument] }),
  service({ id: "pbm-education-route", organizationId: "pbm", domain: "education", name: "Pakistan Bait-ul-Mal education assistance route", nameUr: "پاکستان بیت المال تعلیمی مدد کا راستہ", namePs: "د پاکستان بیت المال د زده‌کړې مرستې لاره", aliases: ["PBM education", "education fee", "تعلیمی فیس", "بیت المال وظیفہ"], coverage: ["Pakistan"], applicationMethod: "mixed", sourceUrl: "https://www.pbm.gov.pk/Project-Scholarships.html", sourceTitle: "Pakistan Bait-ul-Mal scholarships", eligibilityRules: [{ field: "isEnrolled", operator: "eq", value: true, description: "The learner is currently enrolled.", mandatory: true }], requiredDocuments: [cnicDocument, schoolDocument, incomeDocument] }),
  service({ id: "hec-scholarship-introduction", organizationId: "hec", domain: "education", name: "HEC Need Based Scholarship information", nameUr: "HEC ضرورت پر مبنی وظیفہ معلومات", namePs: "د HEC د اړتیا پر بنسټ بورس معلومات", aliases: ["HEC NBS", "need based", "HEC support", "ضرورت پر مبنی وظیفہ"], coverage: ["Pakistan"], applicationMethod: "in_person", sourceUrl: "https://www.hec.gov.pk/english/scholarshipsgrants/NBS/Pages/default.aspx", sourceTitle: "HEC Need Based Scholarships Introduction", eligibilityRules: [{ field: "isEnrolled", operator: "eq", value: true, description: "The applicant is enrolled at a participating institution.", mandatory: true }], requiredDocuments: [cnicDocument, incomeDocument] }),

  service({ id: "sehat-card-kp", organizationId: "sehat-card-kp", domain: "health", name: "Sehat Card Plus KP information", nameUr: "صحت کارڈ پلس خیبر پختونخوا معلومات", namePs: "د صحت کارډ پلس خېبر پښتونخوا معلومات", aliases: ["Sehat Card", "Sehat Sahulat", "health card", "صحت کارڈ", "علاج کارڈ", "dialysis"], coverage: ["Khyber Pakhtunkhwa"], applicationMethod: "mixed", eligibilityRules: [{ field: "province", operator: "eq", value: "Khyber Pakhtunkhwa", description: "The person needs a Khyber Pakhtunkhwa health coverage route.", mandatory: true }, cnicRule], requiredDocuments: [cnicDocument] }),
  service({ id: "phimc-health-coverage", organizationId: "phimc", domain: "health", name: "Punjab health coverage information", nameUr: "پنجاب ہیلتھ کوریج معلومات", namePs: "د پنجاب د روغتیا پوښښ معلومات", aliases: ["Punjab health card", "health coverage", "Punjab treatment", "پنجاب علاج", "صحت کارڈ"], coverage: ["Punjab"], applicationMethod: "mixed", eligibilityRules: [{ field: "province", operator: "eq", value: "Punjab", description: "The person needs a Punjab health route.", mandatory: true }, cnicRule], requiredDocuments: [cnicDocument] }),
  service({ id: "sundas-dialysis-enquiry", organizationId: "sundas", domain: "health", name: "Sundas Foundation dialysis support enquiry", nameUr: "سندس فاؤنڈیشن ڈائلیسز معاونت معلومات", namePs: "د سندس بنسټ د ډایلېسز مرستې پوښتنه", aliases: ["dialysis", "kidney dialysis", "سندس", "ڈائلیسز", "گردہ", "د پښتورګو ډایلېسز"], coverage: ["Punjab", "Khyber Pakhtunkhwa"], applicationMethod: "phone", eligibilityRules: [], requiredDocuments: [cnicDocument, { type: "medical_referral", label: "Medical referral if requested", labelUr: "اگر طلب ہو تو طبی ریفرل", mandatory: false }] }),
  service({ id: "sundas-blood-support", organizationId: "sundas", domain: "health", name: "Sundas Foundation blood disorder support enquiry", nameUr: "سندس فاؤنڈیشن خون کے امراض معاونت معلومات", namePs: "د سندس بنسټ د وینې ناروغیو مرستې پوښتنه", aliases: ["blood support", "thalassemia", "سندس", "خون کی بیماری"], coverage: ["Punjab", "Khyber Pakhtunkhwa"], applicationMethod: "phone", eligibilityRules: [], requiredDocuments: [] }),
  service({ id: "indus-treatment-enquiry", organizationId: "indus", domain: "health", name: "Indus Hospital treatment enquiry", nameUr: "انڈس ہسپتال علاج کی معلومات", namePs: "د انډس روغتون د درملنې پوښتنه", aliases: ["Indus Hospital", "hospital treatment", "انڈس ہسپتال", "مفت علاج"], coverage: ["Sindh", "Pakistan"], applicationMethod: "phone", eligibilityRules: [], requiredDocuments: [cnicDocument] }),
  service({ id: "alkhidmat-health-enquiry", organizationId: "alkhidmat", domain: "health", name: "Alkhidmat health services enquiry", nameUr: "الخدمت صحت خدمات معلومات", namePs: "د الخدمت روغتیايي خدمتونو پوښتنه", aliases: ["Alkhidmat health", "medical camp", "الخدمت علاج", "صحت مدد"], coverage: ["Pakistan"], applicationMethod: "mixed", eligibilityRules: [], requiredDocuments: [] }),
  service({ id: "edhi-ambulance-route", organizationId: "edhi", domain: "health", name: "Edhi ambulance contact route", nameUr: "ایدھی ایمبولینس رابطہ", namePs: "د ایدهي امبولانس اړیکه", aliases: ["Edhi ambulance", "ambulance", "ایدھی ایمبولینس", "ایمبولینس"], coverage: ["Pakistan"], applicationMethod: "phone", eligibilityRules: [], requiredDocuments: [] }),
  service({ id: "edhi-medical-navigation", organizationId: "edhi", domain: "health", name: "Edhi medical support enquiry", nameUr: "ایدھی طبی معاونت معلومات", namePs: "د ایدهي د طبي مرستې پوښتنه", aliases: ["Edhi medical", "medical help", "ایدھی علاج", "طبی مدد"], coverage: ["Pakistan"], applicationMethod: "phone", eligibilityRules: [], requiredDocuments: [] }),
  service({ id: "pbm-medical-treatment-route", organizationId: "pbm", domain: "health", name: "Pakistan Bait-ul-Mal treatment assistance guidance", nameUr: "پاکستان بیت المال علاج معاونت رہنمائی", namePs: "د پاکستان بیت المال د درملنې مرستې لارښود", aliases: ["treatment assistance", "PBM treatment", "علاج کی امداد", "بیت المال علاج"], coverage: ["Pakistan"], applicationMethod: "mixed", sourceUrl: "https://www.pbm.gov.pk/Forms.html", sourceTitle: "Pakistan Bait-ul-Mal assistance information", eligibilityRules: [], requiredDocuments: [cnicDocument, { type: "medical_referral", label: "Medical referral or estimate if requested", labelUr: "اگر طلب ہو تو طبی ریفرل یا تخمینہ", mandatory: false }] }),
  service({ id: "bisp-nutrition-route", organizationId: "bisp", domain: "health", name: "BISP nutrition support information", nameUr: "BISP غذائی معاونت معلومات", namePs: "د BISP د تغذیې مرستې معلومات", aliases: ["nutrition support", "BISP nutrition", "نشوونما", "غذائیت"], coverage: ["Pakistan"], applicationMethod: "mixed", sourceUrl: "https://bisp.gov.pk/Detail/YjAyMjI5ZDQtMTVkOC00YTNlLWE5NjctMjA1NTYwN2JhOTE3", sourceTitle: "Benazir Nashonuma Programme", eligibilityRules: [{ field: "isBispBeneficiary", operator: "eq", value: true, description: "The household is an active BISP beneficiary.", mandatory: true }], requiredDocuments: [cnicDocument] }),
  service({ id: "health-emergency-1122", organizationId: "ndma", domain: "health", name: "Medical emergency response guidance", nameUr: "طبی ایمرجنسی رہنمائی", namePs: "د طبي بیړني حالت لارښود", aliases: ["emergency", "medical emergency", "1122", "ایمرجنسی", "فوری مدد"], coverage: ["Pakistan"], applicationMethod: "phone", sourceUrl: "https://www.ndma.gov.pk/", sourceTitle: "National Disaster Management Authority", eligibilityRules: [], requiredDocuments: [], procedure: [{ order: 1, title: "Call emergency services", titleUr: "ایمرجنسی سروس کو کال کریں", description: "If there is immediate danger, call 1122 or the local emergency service now.", descriptionUr: "فوری خطرہ ہو تو ابھی 1122 یا مقامی ایمرجنسی سروس کو کال کریں۔", channel: "phone" }] }),
  service({ id: "health-care-navigation", organizationId: "sehat-card-kp", domain: "health", name: "Healthcare navigation route", nameUr: "صحت کی خدمات کا راستہ", namePs: "د روغتیايي خدمتونو لاره", aliases: ["doctor", "hospital", "treatment", "علاج", "ہسپتال", "ڈاکٹر"], coverage: ["Pakistan"], applicationMethod: "mixed", eligibilityRules: [], requiredDocuments: [] }),

  service({ id: "ndma-disaster-alerts", organizationId: "ndma", domain: "disaster", name: "NDMA disaster alerts", nameUr: "NDMA آفات الرٹس", namePs: "د NDMA د ناورینونو خبرتیاوې", aliases: ["NDMA", "disaster alert", "flood alert", "سیلاب الرٹ", "آفت"], coverage: ["Pakistan"], applicationMethod: "online", eligibilityRules: [], requiredDocuments: [] }),
  service({ id: "ndma-flood-preparedness", organizationId: "ndma", domain: "disaster", name: "NDMA flood preparedness information", nameUr: "NDMA سیلاب تیاری معلومات", namePs: "د NDMA د سېلاب چمتووالي معلومات", aliases: ["flood preparation", "flood safety", "سیلاب", "سیلاب سے حفاظت"], coverage: ["Pakistan"], applicationMethod: "online", eligibilityRules: [], requiredDocuments: [] }),
  service({ id: "ndma-damage-guidance", organizationId: "ndma", domain: "disaster", name: "NDMA disaster damage guidance", nameUr: "NDMA آفت نقصانات رہنمائی", namePs: "د NDMA د ناورین زیان لارښود", aliases: ["flood damage", "damage report", "سیلاب نقصان", "گھر نقصان"], coverage: ["Pakistan"], applicationMethod: "mixed", eligibilityRules: [{ field: "specialConditions", operator: "in", value: ["flood_affected", "disaster_affected"], description: "The household reports a disaster impact.", mandatory: true }], requiredDocuments: [cnicDocument] }),
  service({ id: "pdma-kp-relief-information", organizationId: "pdma-kp", domain: "disaster", name: "KP disaster relief information", nameUr: "خیبر پختونخوا آفتی امداد معلومات", namePs: "د خېبر پښتونخوا د ناورین مرستې معلومات", aliases: ["KP flood relief", "PDMA KP", "خیبر پختونخوا سیلاب مدد", "آفتی امداد"], coverage: ["Khyber Pakhtunkhwa"], applicationMethod: "mixed", eligibilityRules: [{ field: "province", operator: "eq", value: "Khyber Pakhtunkhwa", description: "The household is seeking a KP disaster route.", mandatory: true }, { field: "specialConditions", operator: "in", value: ["flood_affected", "disaster_affected"], description: "The household reports a disaster impact.", mandatory: true }], requiredDocuments: [cnicDocument] }),
  service({ id: "pdma-punjab-relief-information", organizationId: "pdma-punjab", domain: "disaster", name: "Punjab disaster relief information", nameUr: "پنجاب آفتی امداد معلومات", namePs: "د پنجاب د ناورین مرستې معلومات", aliases: ["Punjab flood relief", "PDMA Punjab", "پنجاب سیلاب مدد", "آفتی امداد"], coverage: ["Punjab"], applicationMethod: "mixed", eligibilityRules: [{ field: "province", operator: "eq", value: "Punjab", description: "The household is seeking a Punjab disaster route.", mandatory: true }, { field: "specialConditions", operator: "in", value: ["flood_affected", "disaster_affected"], description: "The household reports a disaster impact.", mandatory: true }], requiredDocuments: [cnicDocument] }),
  service({ id: "pdma-sindh-relief-information", organizationId: "pdma-sindh", domain: "disaster", name: "Sindh disaster relief information", nameUr: "سندھ آفتی امداد معلومات", namePs: "د سند د ناورین مرستې معلومات", aliases: ["Sindh flood relief", "PDMA Sindh", "سندھ سیلاب مدد", "دادو سیلاب", "آفتی امداد"], coverage: ["Sindh"], applicationMethod: "mixed", eligibilityRules: [{ field: "province", operator: "eq", value: "Sindh", description: "The household is seeking a Sindh disaster route.", mandatory: true }, { field: "specialConditions", operator: "in", value: ["flood_affected", "disaster_affected"], description: "The household reports a disaster impact.", mandatory: true }], requiredDocuments: [cnicDocument] }),
  service({ id: "prcs-emergency-support", organizationId: "prcs", domain: "disaster", name: "Pakistan Red Crescent emergency support enquiry", nameUr: "پاکستان ریڈ کریسنٹ ایمرجنسی معاونت معلومات", namePs: "د پاکستان سرې میاشتې د بیړنۍ مرستې پوښتنه", aliases: ["Red Crescent", "emergency shelter", "relief supplies", "ریڈ کریسنٹ", "شیلٹر مدد"], coverage: ["Pakistan"], applicationMethod: "phone", eligibilityRules: [{ field: "specialConditions", operator: "in", value: ["flood_affected", "disaster_affected"], description: "The household reports a disaster impact.", mandatory: true }], requiredDocuments: [] }),
  service({ id: "alkhidmat-disaster-relief", organizationId: "alkhidmat", domain: "disaster", name: "Alkhidmat disaster relief enquiry", nameUr: "الخدمت آفتی امداد معلومات", namePs: "د الخدمت د ناورین مرستې پوښتنه", aliases: ["Alkhidmat flood relief", "Alkhidmat disaster", "الخدمت سیلاب مدد", "ریلیف"], coverage: ["Pakistan"], applicationMethod: "mixed", eligibilityRules: [{ field: "specialConditions", operator: "in", value: ["flood_affected", "disaster_affected"], description: "The household reports a disaster impact.", mandatory: true }], requiredDocuments: [] }),
  service({ id: "edhi-disaster-relief", organizationId: "edhi", domain: "disaster", name: "Edhi emergency relief enquiry", nameUr: "ایدھی ایمرجنسی ریلیف معلومات", namePs: "د ایدهي د بیړنۍ مرستې پوښتنه", aliases: ["Edhi flood relief", "Edhi emergency", "ایدھی سیلاب مدد", "ریلیف"], coverage: ["Pakistan"], applicationMethod: "phone", eligibilityRules: [{ field: "specialConditions", operator: "in", value: ["flood_affected", "disaster_affected"], description: "The household reports a disaster impact.", mandatory: true }], requiredDocuments: [] }),
  service({ id: "bisp-disaster-status", organizationId: "bisp", domain: "disaster", name: "BISP status check during emergencies", nameUr: "ایمرجنسی میں BISP اسٹیٹس چیک", namePs: "په بېړنیو حالاتو کې د BISP حالت کتنه", aliases: ["BISP emergency", "8171 flood", "BISP سیلاب", "ایمرجنسی کیش"], coverage: ["Pakistan"], applicationMethod: "online", sourceUrl: "https://8171.bisp.gov.pk/", sourceTitle: "BISP 8171 web portal", eligibilityRules: [cnicRule], requiredDocuments: [cnicDocument] }),
  service({ id: "ndma-emergency-contacts", organizationId: "ndma", domain: "disaster", name: "Disaster emergency contact guidance", nameUr: "آفت ایمرجنسی رابطہ رہنمائی", namePs: "د ناورین بیړنیو اړیکو لارښود", aliases: ["flood emergency", "disaster emergency", "سیلاب ایمرجنسی", "ریسکیو"], coverage: ["Pakistan"], applicationMethod: "phone", eligibilityRules: [], requiredDocuments: [], procedure: [{ order: 1, title: "Call emergency services", titleUr: "ایمرجنسی سروس کو کال کریں", description: "If people are in immediate danger from flooding or another disaster, call 1122 or the local emergency service now.", descriptionUr: "اگر سیلاب یا کسی اور آفت سے فوری خطرہ ہو تو ابھی 1122 یا مقامی ایمرجنسی سروس کو کال کریں۔", channel: "phone" }, { order: 2, title: "Monitor official alerts", titleUr: "سرکاری الرٹس دیکھیں", description: "Check NDMA updates for current official information.", descriptionUr: "موجودہ سرکاری معلومات کے لیے NDMA اپ ڈیٹس دیکھیں۔", channel: "online", url: "https://www.ndma.gov.pk/" }] }),
]);

export const catalogRecordCount = services.length;

export function assertCatalogIntegrity() {
  const organizationIds = new Set(organizations.map((organization) => organization.id));
  const invalidServices = services.filter((item) => !organizationIds.has(item.organizationId));

  if (invalidServices.length > 0) {
    throw new Error(`Services reference unknown organizations: ${invalidServices.map((item) => item.id).join(", ")}`);
  }

  if (services.length < 60) {
    throw new Error(`Expected at least 60 services, found ${services.length}.`);
  }
}

assertCatalogIntegrity();

export type CatalogOrganization = OrganizationRecord;
export type CatalogService = ServiceRecord;
