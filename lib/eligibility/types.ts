import type {
  CitizenProfile,
  EligibilityOperator,
  EligibilityRule,
  EligibilityResult,
  ServiceRecord,
} from "@/lib/types";

export type EligibilityStatus = EligibilityResult["status"];

export interface EligibilityCheckInput {
  service: Pick<
    ServiceRecord,
    "eligibilityRules" | "requiredDocuments" | "sourceTitle"
  >;
  profile: CitizenProfile;
  providedDocumentTypes?: string[];
}

export interface RuleEvaluation {
  rule: EligibilityRule;
  state: "matched" | "unmatched" | "unknown";
}

export type RuleValue = EligibilityRule["value"];

export interface EligibilityEngine {
  compare(
    actual: CitizenProfile[keyof CitizenProfile],
    operator: EligibilityOperator,
    expected: RuleValue,
  ): boolean;
  evaluate(input: EligibilityCheckInput): EligibilityResult;
}
