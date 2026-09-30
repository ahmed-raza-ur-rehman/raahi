export type Language = "en" | "ur" | "ps" | "hkp";

export const LANGUAGES: Language[] = ["en", "ur", "ps", "hkp"];

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  ur: "اردو",
  ps: "پښتو",
  hkp: "ہندکو",
};

/** A human-readable string available in several languages. `en` is always present. */
export type Localized = { en: string } & Partial<Record<Language, string>>;

export type Domain =
  | "welfare"
  | "education"
  | "health"
  | "documentation"
  | "disaster"
  | "legal"
  | "employment";

export type EligibilityField =
  | "province"
  | "district"
  | "householdIncome"
  | "householdSize"
  | "gender"
  | "age"
  | "hasCnic"
  | "isBispBeneficiary"
  | "isEnrolled"
  | "educationLevel"
  | "pmtScore"
  | "specialConditions";

export type EligibilityOperator = "lt" | "lte" | "gt" | "gte" | "eq" | "in" | "exists" | "between";

export interface EligibilityRule {
  field: EligibilityField;
  operator: EligibilityOperator;
  value: boolean | number | string | string[] | [number, number];
  description: string;
  mandatory: boolean;
}

export interface DocumentRequirement {
  type: string;
  label: string;
  labelUr: string;
  mandatory: boolean;
}

export interface ProcedureStep {
  order: number;
  title: string;
  titleUr: string;
  description: string;
  descriptionUr: string;
  channel: "online" | "in_person" | "phone" | "sms";
  url?: string;
}

export interface OrganizationRecord {
  id: string;
  name: string;
  nameUr: string;
  type: "government" | "ngo" | "hospital";
  sourceUrl: string;
  authorityTier: number;
}

export interface ServiceRecord {
  id: string;
  organizationId: string;
  domain: Domain;
  name: string;
  nameUr: string;
  namePs: string;
  description: string;
  descriptionUr: string;
  aliases: string[];
  coverage: string[];
  applicationMethod: "online" | "in_person" | "phone" | "sms" | "mixed";
  sourceUrl: string;
  sourceTitle: string;
  sourceAuthorityTier: number;
  lastVerified: string;
  eligibilityRules: EligibilityRule[];
  requiredDocuments: DocumentRequirement[];
  procedure: ProcedureStep[];
  active: boolean;
}

export interface CitizenProfile {
  province?: string;
  district?: string;
  householdIncome?: number;
  householdSize?: number;
  gender?: string;
  age?: number;
  hasCnic?: boolean;
  isBispBeneficiary?: boolean;
  isEnrolled?: boolean;
  educationLevel?: string;
  pmtScore?: number;
  specialConditions?: string[];
  /** New: goals and capability signals used by the recommendation engine. */
  goals?: string[];
  skills?: string[];
  educationLevelDetail?: string;
  gpa?: number;
  englishLevel?: "none" | "basic" | "intermediate" | "advanced";
  wantsToStudyAbroad?: boolean;
  hasPassport?: boolean;
  disability?: boolean;
}

export interface EligibilityResult {
  status: "likely" | "possible" | "unlikely" | "unknown";
  matchedRules: string[];
  unmatchedRules: string[];
  missingInfo: string[];
  missingDocuments: string[];
  confidenceReason: string;
}

export interface Citation {
  sourceUrl: string;
  sourceTitle: string;
  authorityTier: number;
  lastVerified: string;
}

export interface CaseAction {
  id: string;
  label: string;
  labelUr: string;
  completed: boolean;
  serviceId?: string;
}

export interface CaseDocument {
  id: string;
  caseId: string;
  documentType: string;
  label: string;
  ocrData?: Record<string, string>;
  verified: boolean;
  createdAt: string;
}

export interface CitizenCase {
  id: string;
  sessionId: string;
  title: string;
  titleUr: string;
  domain: Domain;
  summary: string;
  status: "active" | "resolved" | "escalated";
  serviceIds: string[];
  actions: CaseAction[];
  documents?: CaseDocument[];
  createdAt: string;
  updatedAt: string;
}

/* ────────────────────────────────────────────────────────────────
 * PHASE 2 — Knowledge platform types
 * ──────────────────────────────────────────────────────────────── */

/** Every knowledge record carries a verifiable source. Nothing is asserted without one. */
export interface SourceRef {
  url: string;
  title: string;
  /** 1 = federal/official, 2 = institutional/university, 3 = NGO/partner, 4 = media, 5 = community */
  tier: number;
  lastVerified: string;
}

export interface MoneyNote {
  /** `null` means free of cost. */
  amount: number | null;
  currency: string;
  note: Localized;
}

export interface ContactRef {
  label: Localized;
  phone?: string;
  sms?: string;
  whatsapp?: string;
  email?: string;
  url?: string;
  hours?: string;
}

export type DateKind = "fixed" | "rolling" | "recurring" | "unknown";

export interface DeadlineInfo {
  kind: DateKind;
  /** ISO date when a single confirmed date is known. */
  date?: string;
  /** Inclusive [start, end] window for recurring or announced periods. */
  window?: [string, string];
  /** Repeats every year roughly in this month range, e.g. [8, 10] for Aug–Oct. */
  recurringMonths?: [number, number];
  note: Localized;
  source: SourceRef;
}

export type ImportantDateCategory =
  | "test"
  | "admission"
  | "scholarship"
  | "job"
  | "internship"
  | "training"
  | "document";

export interface ImportantDate {
  id: string;
  category: ImportantDateCategory;
  title: Localized;
  /** Parent record (test id, opportunity id, …) for deep links. */
  refType: "test" | "opportunity" | "document" | "general";
  refId: string;
  kind: DateKind;
  date?: string;
  window?: [string, string];
  recurringMonths?: [number, number];
  note?: Localized;
  source: SourceRef;
}

/* ── Opportunities: scholarships, grants, jobs, internships, admissions ── */

export type OpportunityKind =
  | "scholarship"
  | "grant"
  | "job"
  | "internship"
  | "admission"
  | "training"
  | "fellowship";

export interface OpportunityCriterion {
  id: string;
  label: Localized;
  mandatory: boolean;
  /** Machine-checkable rule when the criterion maps to a profile field. */
  rule?: EligibilityRuleShape;
  hint?: Localized;
}

/** A looser rule shape so criteria can reference non-profile facts too. */
export interface EligibilityRuleShape {
  field: string;
  operator: EligibilityOperator | "includes";
  value: boolean | number | string | string[];
}

export interface OpportunityRecord {
  id: string;
  kind: OpportunityKind;
  scope: "national" | "international" | "provincial" | "local";
  title: Localized;
  provider: string;
  providerLocal?: string;
  country: string;
  /** Study levels this applies to: matric, intermediate, undergraduate, masters, phd, postdoc, any */
  levels: string[];
  fields: string[];
  /** What the beneficiary receives. */
  benefit: Localized;
  applicationFee: MoneyNote;
  eligibility: OpportunityCriterion[];
  requiredDocuments: DocumentRequirement[];
  procedure: ProcedureStep[];
  deadline: DeadlineInfo;
  contact: ContactRef[];
  source: SourceRef;
  officialUrl: string;
  tags: string[];
  active: boolean;
}

/* ── Documents: how to acquire, attest and verify ── */

export interface AttestationLevel {
  authority: string;
  who: Localized;
  where: Localized;
  fee: Localized;
  note: Localized;
}

export interface AttestationInfo {
  required: boolean;
  summary: Localized;
  levels: AttestationLevel[];
  /** For use abroad: HEC / IBCC / MOFA / embassy routes. */
  foreign: { authority: string; note: Localized; url: string }[];
}

export interface DocumentRecipe {
  id: string;
  type: string;
  name: Localized;
  purpose: Localized;
  issuingAuthority: string;
  fee: MoneyNote;
  processingTime: Localized;
  validity: Localized;
  prerequisites: string[];
  steps: ProcedureStep[];
  onlineChannel?: { url: string; label: Localized; note?: Localized };
  attestation: AttestationInfo;
  commonMistakes: Localized[];
  contact: ContactRef[];
  source: SourceRef;
  tags: string[];
}

/* ── Tests & preparation ── */

export type TestCategory =
  | "english"
  | "admission"
  | "competitive"
  | "professional"
  | "aptitude";

export interface PrepWeek {
  week: number;
  focus: Localized;
  tasks: Localized[];
}

export interface PrepResource {
  title: Localized;
  kind: "official" | "free" | "paid" | "community";
  url: string;
  note?: Localized;
}

export interface TestRecord {
  id: string;
  category: TestCategory;
  name: Localized;
  shortName: string;
  conductingBody: string;
  purpose: Localized;
  eligibility: Localized[];
  fee: MoneyNote;
  format: Localized;
  duration: Localized;
  resultValidity: Localized;
  registration: ProcedureStep[];
  dates: ImportantDate[];
  prep: { recommendedWeeks: number; plan: PrepWeek[]; resources: PrepResource[] };
  contact: ContactRef[];
  source: SourceRef;
  officialUrl: string;
  tags: string[];
}

/* ── Health ── */

export interface MedicalCamp {
  id: string;
  provider: string;
  providerLocal?: string;
  name: Localized;
  campTypes: string[];
  services: Localized[];
  districts: string[];
  /** How often camps are announced, e.g. "weekly", "monthly", "seasonal". */
  cadence: Localized;
  cost: Localized;
  howToConfirm: ProcedureStep[];
  contact: ContactRef[];
  source: SourceRef;
  tags: string[];
}

export interface DiseaseSignal {
  id: string;
  name: Localized;
  /** Plain-language signs a community member can notice. Never diagnostic. */
  signs: Localized[];
  whenToSeekCare: Localized;
  prevention: Localized[];
  /** Where an unusual cluster should be reported. */
  reportTo: ContactRef[];
  source: SourceRef;
  severity: "watch" | "urgent" | "emergency";
  tags: string[];
}

export interface MedicalProcedure {
  id: string;
  condition: Localized;
  summary: Localized;
  pathway: ProcedureStep[];
  documents: DocumentRequirement[];
  supportRoutes: { name: Localized; detail: Localized; url?: string; phone?: string }[];
  contact: ContactRef[];
  source: SourceRef;
  tags: string[];
  disclaimer: Localized;
}

/* ── Blood ── */

export interface DonorEligibilityRule {
  rule: Localized;
  blocking: boolean;
}

export interface BloodBank {
  id: string;
  name: Localized;
  city: string;
  province: string;
  type: "hospital" | "ngo" | "public" | "private";
  services: Localized[];
  components: string[];
  hours: string;
  contact: ContactRef[];
  source: SourceRef;
  tags: string[];
}

export interface BloodRequestRecord {
  id: string;
  sessionId: string;
  patientName: string;
  bloodGroup: string;
  units: number;
  city: string;
  hospital: string;
  neededBy: string;
  contactNumber: string;
  notes?: string;
  status: "open" | "fulfilled" | "closed";
  createdAt: string;
  updatedAt: string;
}

export interface DonorRegistration {
  id: string;
  sessionId: string;
  fullName: string;
  bloodGroup: string;
  city: string;
  phone: string;
  lastDonation?: string;
  available: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/* ── Disaster ── */

export interface DisasterChannel {
  id: string;
  name: Localized;
  authority: string;
  scope: string[];
  numbers: string[];
  whatTheyDo: Localized;
  howToRequest: ProcedureStep[];
  source: SourceRef;
  priority: number;
}

export interface DisasterGuide {
  id: string;
  phase: "before" | "during" | "after";
  hazard: string;
  title: Localized;
  steps: ProcedureStep[];
  kit: Localized[];
  trainings: { name: Localized; provider: string; note: Localized; url?: string }[];
  source: SourceRef;
}

export interface ReliefRequest {
  id: string;
  sessionId: string;
  hazard: string;
  district: string;
  families: number;
  needs: string[];
  contactNumber: string;
  locationNote?: string;
  status: "submitted" | "triaged" | "in_progress" | "resolved";
  routedTo: string[];
  createdAt: string;
  updatedAt: string;
}

/* ── Legal ── */

export interface LegalTopic {
  id: string;
  category:
    | "family"
    | "criminal"
    | "property"
    | "labour"
    | "consumer"
    | "identity"
    | "gender_violence"
    | "tenant";
  title: Localized;
  summary: Localized;
  steps: ProcedureStep[];
  documents: DocumentRequirement[];
  authorities: { name: Localized; role: Localized; contact: ContactRef[] }[];
  rights: Localized[];
  timeline: Localized;
  source: SourceRef;
  disclaimer: Localized;
  tags: string[];
}

/* ── Contacts directory ── */

export interface ContactRecord {
  id: string;
  name: Localized;
  authority: string;
  category:
    | "emergency"
    | "health"
    | "welfare"
    | "education"
    | "documentation"
    | "legal"
    | "disaster"
    | "women"
    | "child"
    | "labour"
    | "complaint";
  numbers: string[];
  sms?: string;
  whatsapp?: string;
  email?: string;
  url?: string;
  coverage: string[];
  hours: string;
  purpose: Localized;
  /** Used when RAAHI cannot guarantee a published number — route to the official page instead. */
  note?: Localized;
  source: SourceRef;
  tier: number;
}

/* ── Application tracker ── */

export type ApplicationKind =
  | "scholarship"
  | "job"
  | "internship"
  | "admission"
  | "training"
  | "document"
  | "test"
  | "aid"
  | "relief"
  | "legal";

export type ApplicationStatus =
  | "planning"
  | "collecting_documents"
  | "preparing"
  | "ready_to_submit"
  | "submitted"
  | "awaiting_result"
  | "accepted"
  | "rejected"
  | "abandoned";

export interface ApplicationStage {
  id: string;
  title: Localized;
  detail?: Localized;
  status: "todo" | "in_progress" | "done" | "blocked" | "skipped";
  /** Document types needed to clear this stage. */
  requiresDocuments?: string[];
  dueDate?: string;
  /** Link back into the knowledge base. */
  refType?: "opportunity" | "document" | "test" | "service" | "contact";
  refId?: string;
}

/** Status values a citizen can set on a tracked document. */
export type DocumentStateValue = "missing" | "have" | "attested" | "uploaded";

export interface ApplicationDocumentState {
  id: string;
  documentType: string;
  label: Localized;
  status: DocumentStateValue;
  /** Optional OCR/vision extraction result. */
  extraction?: Record<string, string>;
  updatedAt: string;
}

export interface ApplicationProgressEvent {
  id: string;
  applicationId: string;
  at: string;
  kind: "created" | "stage" | "document" | "note" | "status" | "reminder";
  message: string;
}

export interface ApplicationRecord {
  id: string;
  sessionId: string;
  kind: ApplicationKind;
  refId?: string;
  title: Localized;
  status: ApplicationStatus;
  stages: ApplicationStage[];
  documents: ApplicationDocumentState[];
  notes: { id: string; at: string; text: string }[];
  deadline?: string;
  deadlineNote?: string;
  feeNote?: string;
  reminders: { id: string; at: string; channel: string; sent: boolean }[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ── Knowledge corrections & review ── */

export type CorrectionStatus = "pending" | "in_review" | "accepted" | "rejected";

export interface CorrectionRecord {
  id: string;
  sessionId: string;
  entityType: string;
  entityId: string;
  field: string;
  reportedValue?: string;
  suggestedValue: string;
  reason?: string;
  evidenceUrl?: string;
  reporterContact?: string;
  status: CorrectionStatus;
  reviewerNote?: string;
  votes: number;
  createdAt: string;
  updatedAt: string;
}

/* ── Web search / scraping ── */

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  /** Official-domain boost used for ranking. */
  official: boolean;
  score: number;
}

export interface FetchedPage {
  url: string;
  status: number;
  title: string;
  text: string;
  fetchedAt: string;
  fromCache: boolean;
}

/* ── Unified knowledge search ── */

export type KnowledgeEntityType =
  | "service"
  | "opportunity"
  | "document"
  | "test"
  | "camp"
  | "disease"
  | "medical_procedure"
  | "blood_bank"
  | "disaster_channel"
  | "disaster_guide"
  | "legal_topic"
  | "contact";

export interface KnowledgeHit<T = unknown> {
  entityType: KnowledgeEntityType;
  entityId: string;
  score: number;
  reasons: string[];
  title: string;
  summary: string;
  source: SourceRef;
  record: T;
}

export interface AgentTraceStep {
  agent: string;
  action: string;
  detail: string;
  at: string;
}

export interface AgentResponse {
  answer: Localized;
  steps: Localized[];
  hits: KnowledgeHit[];
  contacts: ContactRef[];
  trace: AgentTraceStep[];
  followUps: Localized[];
  emergency?: boolean;
  disclaimer?: Localized;
  /** Suggested application/tracker payload when the user is ready to act. */
  draftApplication?: {
    kind: ApplicationKind;
    title: Localized;
    refId?: string;
    stages: ApplicationStage[];
    documents: ApplicationDocumentState[];
    deadline?: string;
    deadlineNote?: string;
    feeNote?: string;
  };
}
