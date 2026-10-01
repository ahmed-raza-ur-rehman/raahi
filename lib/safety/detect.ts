export interface SafetySignal {
  emergency: boolean;
  medical: boolean;
  legal: boolean;
  /** Someone may harm themselves — always show support resources first. */
  selfHarm: boolean;
  reason?: string;
}

/**
 * Life-threatening situations, in the three languages Raahi listens to.
 *
 * These patterns short-circuit everything else: a match hides the ordinary
 * answer and shows emergency numbers instead. That makes false positives
 * expensive, so every entry is a specific emergency phrase rather than a
 * common word. Deliberately absent:
 *   - "help" / "مدد" — Raahi is a help app, so it is in half of all queries.
 *   - "حملہ" (attack) — in Urdu it is one letter from "حمل" (pregnancy).
 *   - "درد" (pain) on its own — far too common to mean an emergency.
 */
const emergencyPatterns = [
  // Breathing & airway
  /chest pain|cannot breathe|can't breathe|can't breath|breathing difficulty|choking|suffocating|not breathing/i,
  /سانس نہیں|سانس نہيں|دم گھٹ|گلا بند|ساه نه|ستونی بند/i,
  // Chest pain, which reads very differently across the local languages.
  /سینے میں درد|سینے وچ درد|سينه درد|سينې درد/i,

  // Circulation & brain
  /heart attack|cardiac arrest|cardiac|stroke|seizure|convulsion|fitting|collapsed|unconscious|fainted/i,
  /دل کا دورہ|دل کا دورہ پڑ|فالج|مرگی|دورہ پڑ|بے ہوش|بې هوښ/i,

  // Blood & injury
  /bleeding|bleed to death|haemorrhage|hemorrhage|stabbed|gunshot|shot by|deep wound|head injury/i,
  /خون بہہ|خون بہ|گولی لگی|چاقو مارا|وینه بهیږي/i,

  // Water & heights
  /drowning|drown|sinking in water|fell from|fallen from|fell off/i,
  /ڈوب رہا|ڈوب رہی|ڈوب گیا|پانی میں ڈوب|ډوبېږي/i,

  // Trauma
  /accident|road traffic|car crash|crashed|trapped|buried|under the rubble|rubble/i,
  /حادثہ|حادثه|ٹکر|ملبے تلے|پھنس گیا|پھنس گئ/i,

  // Burns, bites, poisoning, electrocution
  /electric shock|electrocuted|poisoning|poisoned|snake bite|dog bite|burnt|burning|on fire/i,
  /بجلی کا جھٹکا|برقی جھٹکا|زہر|زهر|سانپ نے کاٹا|کتیا نے کاٹا|جل رہا|جل گیا|سوځل/i,

  /**
   * Disaster & violence. Bare "fire", "flood" and "earthquake" are deliberately
   * NOT matched: Raahi also teaches preparedness, and "how to prepare for a
   * flood" is a question, not an emergency. Only the urgent forms match.
   */
  /on fire|caught fire|house fire|building fire|fire emergency/i,
  /flooded|flood water|flood warning|flash flood|flood emergency|water is rising|water entering/i,
  /earthquake emergency|building collapsed|trapped|buried|under the rubble|rubble/i,
  /violence|terrorist|bomb blast|being attacked/i,
  /زلزلہ|زلزله|سیلاب|آگ لگی|آگ لگ|اور لگ|تشدد|ایمرجنسی|ایمرجینسی|بیړنی/i,

  /**
   * Roman Urdu. Most people type emergency phrases in Latin script with
   * English spelling habits, so matching only the Arabic script would miss
   * the majority of real messages. Spellings are given room to vary.
   */
  /doob raha|doob rahi|doob gaya|doob gayi|dub raha|dub rahi|pani me doob|doobne/i,
  /dil ka doura|dil ka daura|dil ka dorha|dil ka dora/i,
  /saans nahi|sans nahi|saans nhi|dam ghut|saans nahi aa|saans ni aa/i,
  /khoon beh|khoon bah|khoon nikal|behosh|behoshi/i,
  /hadsa|hadsay|accident ho gaya|road accident/i,
  /jal raha|jal gaya|jal gayi|aag lag|zehar kha|zahar pi|bijli ka jhatka|current lag gaya/i,
];

/** Self-harm and suicide — handled before anything else, with care. */
const selfHarmPatterns = [
  /suicide|kill myself|kill me|end my life|end it all|want to die|wanna die|better off dead|no reason to live|take my life|self[- ]harm/i,
  /marna chahta|marna chahti|marna chahte|mar jana chahta|mar jana chahti|mar jaoon|zindagi se tang|khudkushi|khud koshi/i,
  /خودکشی|خود کشی|جان دینا|مرنا چاہتا|مرنا چاہتی|مرنا چاہوں|مر جاؤں|زندگی سے تنگ|ځان وژنه|خان وژنه/i,
];

const medicalPatterns =
  /dialysis|hospital|doctor|treatment|medicine|camp|disease|fever|علاج|ہسپتال|ڈاکٹر|دوا|روغتون|ډایلېسز|کیمپ|بیمار/i;

const legalPatterns = /lawyer|court|legal|police case|وکیل|عدالت|قانونی|قضیه|محکمه/i;

export function detectSafetySignals(query: string): SafetySignal {
  const value = query.toLocaleLowerCase();

  const selfHarm = selfHarmPatterns.some((pattern) => pattern.test(value));
  const emergency = selfHarm || emergencyPatterns.some((pattern) => pattern.test(value));

  return {
    emergency,
    medical: medicalPatterns.test(value),
    legal: legalPatterns.test(value),
    selfHarm,
    reason: emergency ? "Immediate danger may be present." : undefined,
  };
}
