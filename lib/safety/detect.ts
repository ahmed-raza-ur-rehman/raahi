export interface SafetySignal {
  emergency: boolean;
  medical: boolean;
  legal: boolean;
  reason?: string;
}

const emergencyPatterns = [
  /chest pain|cannot breathe|can't breathe|breathing difficulty|choking|suffocating|bleeding|unconscious|suicide|fire|violence|earthquake|flood|ایمرجنسی|سینے میں درد|سانس نہیں|دم گھٹ|گلا بند|خون بہہ|بے ہوش|خودکشی|آگ|تشدد|زلزلہ|سیلاب|بیړنی|ساه نه|ستونی بند/, 
];

export function detectSafetySignals(query: string): SafetySignal {
  const value = query.toLocaleLowerCase();
  const emergency = emergencyPatterns.some((pattern) => pattern.test(value));
  return {
    emergency,
    medical: /dialysis|hospital|doctor|treatment|medicine|علاج|ہسپتال|ڈاکٹر|دوا|روغتون|ډایلېسز/.test(value),
    legal: /lawyer|court|legal|police case|وکیل|عدالت|قانونی|قضیه|محکمه/.test(value),
    reason: emergency ? "Immediate danger may be present." : undefined,
  };
}