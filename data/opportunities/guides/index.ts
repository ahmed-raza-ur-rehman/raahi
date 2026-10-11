import type { Guide } from "@/lib/opportunities/guides";
import { abroadGuides } from "./abroad";
import { careerGuides } from "./careers";
import { studyGuides } from "./study";

/**
 * Curated order: what most people need first. Urdu text was written for this release and is flagged for review by
 * a native editor (see the README); English is the reference text.
 */
export const GUIDES: Guide[] = [
  ...studyGuides.filter((guide) => guide.id === "after-matric-intermediate"),
  ...careerGuides.filter((guide) => guide.id === "apply-government-job"),
  ...abroadGuides.filter((guide) => guide.id === "work-abroad-safely" || guide.id === "spot-fake-offers"),
  ...studyGuides.filter((guide) => guide.id === "study-abroad-roadmap"),
  ...abroadGuides.filter((guide) => guide.id === "documents-attestation"),
  ...careerGuides.filter((guide) => guide.id === "css-pms-prep"),
  ...studyGuides.filter((guide) => guide.id === "mdcat-roadmap" || guide.id === "english-tests" || guide.id === "cv-cover-sop"),
  ...careerGuides.filter((guide) => ["internship-playbook", "freelancing-start", "learn-free-90-days"].includes(guide.id)),
];
