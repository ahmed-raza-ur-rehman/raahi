/**
 * Typed access to the Web Speech API.
 *
 * `SpeechRecognition` is not in TypeScript's DOM lib (it is still a draft spec
 * and ships vendor-prefixed in Chromium), so every consumer needs these shapes.
 * Keeping them in one place stops each component from re-declaring them — or
 * worse, reaching for `any`.
 */

export interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence?: number;
}

export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

export interface SpeechRecognitionErrorEventLike {
  error?: string;
  message?: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

/** Returns the browser's SpeechRecognition constructor, if it has one. */
export function recognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}

/** True when this browser can do on-device speech-to-text. */
export function speechRecognitionSupported(): boolean {
  return recognitionConstructor() !== undefined;
}

/** BCP-47 tag Raahi asks the recogniser for in a given UI language. */
export function speechLanguageTag(language: string): string {
  switch (language) {
    case "en":
      return "en-PK";
    case "ps":
      return "ps-AF";
    case "hkp":
      // No Hindko recognition model exists anywhere; Urdu is the closest
      // match a Pakistani Hindko speaker's device will have installed.
      return "ur-PK";
    default:
      return "ur-PK";
  }
}
