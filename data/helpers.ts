import type { DocumentRequirement, ProcedureStep, SourceRef } from "@/lib/types";

/** Shorthand builders so the curated knowledge files stay readable. */
export function step(
  order: number,
  titleEn: string,
  titleUr: string,
  descriptionEn: string,
  descriptionUr: string,
  channel: ProcedureStep["channel"],
  url?: string,
): ProcedureStep {
  return {
    order,
    title: titleEn,
    titleUr,
    description: descriptionEn,
    descriptionUr,
    channel,
    ...(url ? { url } : {}),
  };
}

export function doc(type: string, label: string, labelUr: string, mandatory = true): DocumentRequirement {
  return { type, label, labelUr, mandatory };
}

export function source(url: string, title: string, tier: number, lastVerified: string): SourceRef {
  return { url, title, tier, lastVerified };
}

export const VERIFIED_ON = "2026-09-03";
