import type { CitizenProfile, EligibilityOperator, EligibilityRule, EligibilityResult } from "@/lib/types";

import type { EligibilityCheckInput, EligibilityEngine, RuleValue } from "./types";

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== "";
}

function compare(
  actual: CitizenProfile[keyof CitizenProfile],
  operator: EligibilityOperator,
  expected: RuleValue,
) {
  switch (operator) {
    case "exists":
      return expected === false ? !hasValue(actual) : hasValue(actual);
    case "eq":
      return actual === expected;
    case "lt":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "lte":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;
    case "gt":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "gte":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "between":
      return (
        typeof actual === "number" &&
        Array.isArray(expected) &&
        expected.length === 2 &&
        typeof expected[0] === "number" &&
        typeof expected[1] === "number" &&
        actual >= expected[0] &&
        actual <= expected[1]
      );
    case "in":
      if (!Array.isArray(expected)) {
        return false;
      }

      const expectedValues = expected as string[];
      if (Array.isArray(actual)) {
        return actual.some((value) => expectedValues.includes(value));
      }

      return typeof actual === "string" && expectedValues.includes(actual);
  }
}

function isProfileFieldMissing(profile: CitizenProfile, rule: EligibilityRule) {
  return !hasValue(profile[rule.field]);
}

export const eligibilityEngine: EligibilityEngine = {
  compare,
  evaluate({ service, profile, providedDocumentTypes = [] }: EligibilityCheckInput): EligibilityResult {
    const matchedRules: string[] = [];
    const unmatchedRules: string[] = [];
    const missingInfo: string[] = [];

    for (const rule of service.eligibilityRules) {
      if (isProfileFieldMissing(profile, rule)) {
        if (rule.mandatory) {
          missingInfo.push(rule.description);
        }
        continue;
      }

      if (compare(profile[rule.field], rule.operator, rule.value)) {
        matchedRules.push(rule.description);
      } else if (rule.mandatory) {
        unmatchedRules.push(rule.description);
      }
    }

    const provided = new Set(providedDocumentTypes);
    const missingDocuments = service.requiredDocuments
      .filter((document) => document.mandatory && !provided.has(document.type))
      .map((document) => document.label);

    const hasAssessmentRule = service.eligibilityRules.some(
      (rule) => rule.field === "pmtScore" || rule.description.toLowerCase().includes("official assessment"),
    );

    let status: EligibilityResult["status"];
    let confidenceReason: string;

    if (unmatchedRules.length > 0) {
      status = "unlikely";
      confidenceReason = "Some required criteria do not match the supplied information.";
    } else if (missingInfo.length > 0) {
      status = "possible";
      confidenceReason = "More information is needed before the issuing authority can assess eligibility.";
    } else if (service.eligibilityRules.length === 0 || hasAssessmentRule) {
      status = "possible";
      confidenceReason = hasAssessmentRule
        ? "An official assessment is still required."
        : "This is a service route; confirm availability and eligibility with the provider.";
    } else {
      status = "likely";
      confidenceReason = "The supplied information matches the recorded criteria; the issuing authority makes the final decision.";
    }

    return {
      status,
      matchedRules,
      unmatchedRules,
      missingInfo,
      missingDocuments,
      confidenceReason,
    };
  },
};
