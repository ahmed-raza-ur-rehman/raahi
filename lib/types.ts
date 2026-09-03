export type Language = "en" | "ur" | "ps";

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
  createdAt: string;
  updatedAt: string;
}
