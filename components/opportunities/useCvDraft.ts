"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export interface CvEducation {
  degree: string;
  institute: string;
  years: string;
  result: string;
}

export interface CvExperience {
  role: string;
  organization: string;
  years: string;
  /** One achievement or duty per line. */
  points: string;
}

export interface CvDraft {
  name: string;
  headline: string;
  phone: string;
  email: string;
  city: string;
  links: string;
  summary: string;
  education: CvEducation[];
  experience: CvExperience[];
  /** Comma-separated. */
  skills: string;
  languages: string;
  /** One per line. */
  certifications: string;
  /** One per line: awards, volunteering, publications. */
  extra: string;
}

export const MAX_ENTRIES = 8;
export const EMPTY_EDUCATION: CvEducation = { degree: "", institute: "", years: "", result: "" };
export const EMPTY_EXPERIENCE: CvExperience = { role: "", organization: "", years: "", points: "" };
export const EMPTY_CV: CvDraft = {
  name: "",
  headline: "",
  phone: "",
  email: "",
  city: "",
  links: "",
  summary: "",
  education: [{ ...EMPTY_EDUCATION }],
  experience: [{ ...EMPTY_EXPERIENCE }],
  skills: "",
  languages: "",
  certifications: "",
  extra: "",
};

const KEY = "raahi-cv-draft-v1";
const listeners = new Set<() => void>();

const text = (value: unknown, max = 1200): string => (typeof value === "string" ? value.slice(0, max) : "");

function entries<T extends object>(value: unknown, make: (row: Record<string, unknown>) => T, fallback: T): T[] {
  if (!Array.isArray(value)) return [{ ...fallback }];
  const rows = value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object").slice(0, MAX_ENTRIES).map(make);
  return rows.length > 0 ? rows : [{ ...fallback }];
}

/** Whatever is in storage, shaped into a valid draft: wrong types and oversized values are dropped, never trusted. */
export function parseCvDraft(raw: string): CvDraft {
  if (!raw) return EMPTY_CV;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== "object") return EMPTY_CV;
    return {
      name: text(value.name, 120),
      headline: text(value.headline, 160),
      phone: text(value.phone, 40),
      email: text(value.email, 120),
      city: text(value.city, 80),
      links: text(value.links, 300),
      summary: text(value.summary, 1200),
      education: entries(value.education, (row) => ({ degree: text(row.degree, 160), institute: text(row.institute, 160), years: text(row.years, 40), result: text(row.result, 80) }), EMPTY_EDUCATION),
      experience: entries(value.experience, (row) => ({ role: text(row.role, 160), organization: text(row.organization, 160), years: text(row.years, 40), points: text(row.points, 1500) }), EMPTY_EXPERIENCE),
      skills: text(value.skills, 600),
      languages: text(value.languages, 200),
      certifications: text(value.certifications, 1000),
      extra: text(value.extra, 1000),
    };
  } catch {
    return EMPTY_CV;
  }
}

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function write(draft: CvDraft | undefined) {
  try {
    if (draft) localStorage.setItem(KEY, JSON.stringify(draft));
    else localStorage.removeItem(KEY);
  } catch {
    return; // storage full or disabled: the draft simply is not remembered
  }
  listeners.forEach((listener) => listener());
}

/** The CV draft lives only in this browser's localStorage — nothing typed here is sent anywhere. */
export function useCvDraft() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "");
  const draft = useMemo(() => parseCvDraft(raw), [raw]);
  const update = useCallback((patch: Partial<CvDraft>) => write({ ...parseCvDraft(readRaw()), ...patch }), []);
  const reset = useCallback(() => write(undefined), []);
  return { draft, update, reset, saved: raw !== "" };
}
