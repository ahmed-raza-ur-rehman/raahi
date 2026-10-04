import type { Language } from "@/lib/types";

export type ContrastMode = "standard" | "high";
export type TextScale = "standard" | "large" | "xlarge";
export type MotionMode = "full" | "reduced";
export type DensityMode = "comfortable" | "compact";

export interface RaahiPreferences {
  language: Language;
  contrast: ContrastMode;
  textScale: TextScale;
  motion: MotionMode;
  density: DensityMode;
  reduceData: boolean;
  preferredProvince: string;
}

export const DEFAULT_PREFERENCES: RaahiPreferences = {
  language: "ur",
  contrast: "standard",
  textScale: "standard",
  motion: "full",
  density: "comfortable",
  reduceData: false,
  preferredProvince: "Punjab",
};

const COOKIE_NAME = "raahi-preferences";
const CHANNEL_NAME = "raahi-preferences";
const MAX_COOKIE_AGE = 60 * 60 * 24 * 365;

const isLanguage = (value: unknown): value is Language => value === "en" || value === "ur" || value === "ps";
const isContrast = (value: unknown): value is ContrastMode => value === "standard" || value === "high";
const isTextScale = (value: unknown): value is TextScale => value === "standard" || value === "large" || value === "xlarge";
const isMotion = (value: unknown): value is MotionMode => value === "full" || value === "reduced";
const isDensity = (value: unknown): value is DensityMode => value === "comfortable" || value === "compact";

export function sanitizePreferences(input: unknown): RaahiPreferences {
  if (!input || typeof input !== "object") return DEFAULT_PREFERENCES;
  const value = input as Partial<RaahiPreferences>;
  return {
    language: isLanguage(value.language) ? value.language : DEFAULT_PREFERENCES.language,
    contrast: isContrast(value.contrast) ? value.contrast : DEFAULT_PREFERENCES.contrast,
    textScale: isTextScale(value.textScale) ? value.textScale : DEFAULT_PREFERENCES.textScale,
    motion: isMotion(value.motion) ? value.motion : DEFAULT_PREFERENCES.motion,
    density: isDensity(value.density) ? value.density : DEFAULT_PREFERENCES.density,
    reduceData: value.reduceData === true,
    preferredProvince: typeof value.preferredProvince === "string" && value.preferredProvince.length < 80 ? value.preferredProvince : DEFAULT_PREFERENCES.preferredProvince,
  };
}

export function readPreferences(): RaahiPreferences {
  if (typeof document === "undefined") return DEFAULT_PREFERENCES;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  if (!match) return DEFAULT_PREFERENCES;
  try {
    return sanitizePreferences(JSON.parse(decodeURIComponent(match[1])));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writePreferences(preferences: RaahiPreferences): void {
  if (typeof document === "undefined") return;
  const safe = sanitizePreferences(preferences);
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(safe))}; max-age=${MAX_COOKIE_AGE}; path=/; SameSite=Lax`;
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ preferences: safe });
    channel.close();
  }
}

export function subscribeToPreferences(onChange: (preferences: RaahiPreferences) => void): () => void {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return () => undefined;
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const onMessage = (event: MessageEvent<{ preferences?: unknown; language?: Language }>) => {
    if (event.data.preferences) onChange(sanitizePreferences(event.data.preferences));
    else if (event.data.language) onChange({ ...readPreferences(), language: event.data.language });
  };
  channel.addEventListener("message", onMessage);
  return () => {
    channel.removeEventListener("message", onMessage);
    channel.close();
  };
}

export function applyPreferenceAttributes(preferences: RaahiPreferences): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.contrast = preferences.contrast;
  root.dataset.textScale = preferences.textScale;
  root.dataset.motion = preferences.motion;
  root.dataset.density = preferences.density;
}

export function preferenceLabel(preferences: RaahiPreferences): string {
  const parts = [preferences.contrast === "high" ? "high contrast" : "standard contrast"];
  if (preferences.textScale !== "standard") parts.push("larger text");
  if (preferences.motion === "reduced") parts.push("reduced motion");
  return parts.join(", ");
}

export const LANGUAGE_LABELS: Record<Language, string> = { en: "English", ur: "اردو", ps: "پښتو" };
export const PROVINCE_OPTIONS = ["Punjab", "Khyber Pakhtunkhwa", "Sindh", "Balochistan", "Islamabad"];

export function getDirection(language: Language): "ltr" | "rtl" {
  return language === "en" ? "ltr" : "rtl";
}

export function mergePreferences(current: RaahiPreferences, patch: Partial<RaahiPreferences>): RaahiPreferences {
  return sanitizePreferences({ ...current, ...patch });
}

export function createPreferenceSnapshot(preferences: RaahiPreferences): string {
  return JSON.stringify(sanitizePreferences(preferences));
}

export function preferencesEqual(left: RaahiPreferences, right: RaahiPreferences): boolean {
  return createPreferenceSnapshot(left) === createPreferenceSnapshot(right);
}

export function getTextScaleMultiplier(scale: TextScale): number {
  if (scale === "xlarge") return 1.18;
  if (scale === "large") return 1.08;
  return 1;
}

export function getAccessibleSummary(preferences: RaahiPreferences): string {
  return `${LANGUAGE_LABELS[preferences.language]}; ${preferenceLabel(preferences)}; ${preferences.density} spacing`;
}

export function clearPreferenceCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=; max-age=0; path=/; SameSite=Lax`;
}

export function exportPreferences(preferences: RaahiPreferences): Blob {
  return new Blob([createPreferenceSnapshot(preferences)], { type: "application/json" });
}

export async function importPreferences(file: File): Promise<RaahiPreferences> {
  const text = await file.text();
  return sanitizePreferences(JSON.parse(text));
}

export function getPreferenceCss(preferences: RaahiPreferences): Record<string, string> {
  return {
    "--raahi-text-scale": String(getTextScaleMultiplier(preferences.textScale)),
    "--raahi-content-density": preferences.density === "compact" ? "0.88" : "1",
  };
}

export function isValidLanguage(value: string): value is Language {
  return isLanguage(value);
}

export function normalizeLanguage(value: unknown): Language {
  return isLanguage(value) ? value : DEFAULT_PREFERENCES.language;
}

export function safelyDecodeCookie(value: string): unknown {
  try { return JSON.parse(decodeURIComponent(value)); } catch { return null; }
}

export const PREFERENCE_STORAGE_VERSION = 1;

export function serializeVersionedPreferences(preferences: RaahiPreferences): string {
  return JSON.stringify({ version: PREFERENCE_STORAGE_VERSION, preferences: sanitizePreferences(preferences) });
}

export function parseVersionedPreferences(value: unknown): RaahiPreferences {
  if (!value || typeof value !== "object") return DEFAULT_PREFERENCES;
  const record = value as { version?: unknown; preferences?: unknown };
  return sanitizePreferences(record.preferences ?? value);
}

export function getPreferenceAnnouncement(preferences: RaahiPreferences): string {
  return `Preferences updated: ${getAccessibleSummary(preferences)}.`;
}

export function toggleBooleanPreference(preferences: RaahiPreferences, key: "reduceData"): RaahiPreferences {
  return mergePreferences(preferences, { [key]: !preferences[key] });
}

export function resetPreferences(): RaahiPreferences {
  const reset = { ...DEFAULT_PREFERENCES };
  writePreferences(reset);
  applyPreferenceAttributes(reset);
  return reset;
}

export function getCookieName(): string { return COOKIE_NAME; }
export function getChannelName(): string { return CHANNEL_NAME; }

export default DEFAULT_PREFERENCES;
