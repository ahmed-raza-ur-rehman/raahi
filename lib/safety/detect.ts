export interface SafetySignal {
  emergency: boolean;
  medical: boolean;
  legal: boolean;
  /** Someone may harm themselves — always show support resources first. */
  selfHarm: boolean;
  reason?: string;
}

const emergencyPatterns = [
  /chest pain|cannot breathe|can't breathe|breathing difficulty|choking|suffocating|bleeding|unconscious|suicide|fire|violence|earthquake|flood|ایمرجنسی|سینے میں درد|سانس نہیں|دم گھٹ|گلا بند|خون بہہ|بے ہوش|خودکشی|آگ|تشدد|زلزلہ|سیلاب|بیړنی|ساه نه|ستونی بند|ایمرجینسی|سینے وچ درد/, 
];

export function detectSafetySignals(query: string): SafetySignal {
  const value = query.toLocaleLowerCase();
  const emergency = emergencyPatterns.some((pattern) => pattern.test(value));
  return {
    emergency,
    medical: /dialysis|hospital|doctor|treatment|medicine|camp|disease|fever|علاج|ہسپتال|ڈاکٹر|دوا|روغتون|ډایلېسز|کیمپ|بیمار/.test(value),
    legal: /lawyer|court|legal|police case|وکیل|عدالت|قانونی|قضیه|محکمه/.test(value),
    selfHarm: /suicide|kill myself|end my life|خودکشی|خود کشی|جان دینا|مرنا چاہتا|خان وژنه/.test(value),
    reason: emergency ? "Immediate danger may be present." : undefined,
  };
}