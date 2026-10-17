/**
 * Age-limit arithmetic for job advertisements ("upper age limit 28 years as on the closing date").
 *
 * The same sentence is read two ways in practice, so both are reported and the advertisement's own wording decides:
 *  - by completed years: you are within a limit of N if you have not yet had your (N+1)th birthday — the usual reading
 *    of "not exceeding N years";
 *  - to the day: you are within it only up to N years, 0 months, 0 days.
 * A 29 February birthday is counted on 1 March in other years (the same convention the arithmetic below uses); if a
 * department's rules differ by that one day, ask the department.
 *
 * Pure date arithmetic on calendar days (no time zones, no "now"): everything is passed in.
 */

export interface AgeParts {
  years: number;
  months: number;
  days: number;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

interface Ymd {
  y: number;
  m: number;
  d: number;
}

function parse(iso: string): Ymd | undefined {
  const match = ISO.exec(iso);
  if (!match) return undefined;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? { y, m, d } : undefined;
}

const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
const daysInMonth = (year: number, month: number) => [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
const toIso = ({ y, m, d }: Ymd) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function addDays(iso: string, days: number): string {
  const [y, m, d] = [Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10))];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const diffDays = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** The date of the birthday in `year`; a 29 February birthday falls on 1 March in a year that has no 29 February. */
function birthday(dob: Ymd, year: number): string {
  if (dob.m === 2 && dob.d === 29 && !isLeap(year)) return toIso({ y: year, m: 3, d: 1 });
  return toIso({ y: year, m: dob.m, d: dob.d });
}

/**
 * The date reached by adding `months` whole months to the birth date: the day is kept, or clamped to the end of a
 * shorter month (31 January + 1 month = 28/29 February). Whole years from a 29 February birthday land on 1 March in a
 * year without a 29 February, matching `birthday()`.
 */
function addMonths(born: Ymd, months: number): string {
  const index = born.m - 1 + months;
  const y = born.y + Math.floor(index / 12);
  const m = (index % 12) + 1;
  if (born.m === 2 && born.d === 29 && months % 12 === 0 && !isLeap(y)) return toIso({ y, m: 3, d: 1 });
  return toIso({ y, m, d: Math.min(born.d, daysInMonth(y, m)) });
}

/** Completed years, months and days between two ISO dates; undefined for an invalid date or a birth date after the reference date. */
export function ageOn(dob: string, asOn: string): AgeParts | undefined {
  const born = parse(dob);
  const ref = parse(asOn);
  if (!born || !ref || dob > asOn) return undefined;
  let totalMonths = (ref.y - born.y) * 12 + (ref.m - born.m);
  if (addMonths(born, totalMonths) > asOn) totalMonths -= 1;
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12, days: diffDays(addMonths(born, totalMonths), asOn) };
}

export interface AgeCheckInput {
  /** Date of birth, YYYY-MM-DD. */
  dob: string;
  /** The date the age is counted on — normally the closing date of the advertisement. */
  asOn: string;
  /** The upper age limit stated in the advertisement, in years. */
  maxYears?: number;
  /** Extra years of relaxation the advertisement grants to the person's category. */
  relaxationYears?: number;
  minYears?: number;
}

export interface AgeCheck {
  age: AgeParts;
  /** The limit after relaxation, in years. */
  limit?: number;
  /** Not yet past the (limit + 1)th birthday: the usual reading of "not exceeding N years". */
  withinByCompletedYears?: boolean;
  /** At most N years 0 months 0 days: the strict reading. */
  withinToTheDay?: boolean;
  meetsMinimum?: boolean;
  /** Last date on which each reading still holds. */
  lastDayByCompletedYears?: string;
  lastDayToTheDay?: string;
}

export function checkAge(input: AgeCheckInput): AgeCheck | undefined {
  const age = ageOn(input.dob, input.asOn);
  const born = parse(input.dob);
  if (!age || !born) return undefined;
  const result: AgeCheck = { age };

  if (input.maxYears !== undefined && Number.isFinite(input.maxYears) && input.maxYears >= 0) {
    const limit = input.maxYears + Math.max(0, input.relaxationYears ?? 0);
    result.limit = limit;
    result.withinByCompletedYears = age.years <= limit;
    result.withinToTheDay = age.years < limit || (age.years === limit && age.months === 0 && age.days === 0);
    result.lastDayByCompletedYears = addDays(birthday(born, born.y + limit + 1), -1);
    result.lastDayToTheDay = birthday(born, born.y + limit);
  }
  if (input.minYears !== undefined && Number.isFinite(input.minYears) && input.minYears >= 0) result.meetsMinimum = age.years >= input.minYears;
  return result;
}

/** Days from `today` to `date` (negative once it has passed). Convenience for the "how long do I have" line. */
export function daysFrom(today: string, date: string): number {
  return diffDays(today, date);
}
