import { L } from "@/lib/i18n";

/**
 * Emergency numbers, in their own leaf module.
 *
 * The home screen is a client component and shows these on every visit.
 * Importing them from `./contacts` would pull the whole contact corpus into
 * the browser bundle for four numbers.
 */
export const EMERGENCY_NUMBERS = [
  { label: L("Rescue / Ambulance", "ریسکیو / ایمبولینس", "ژغورنه"), number: "1122" },
  { label: L("Edhi Ambulance", "ایدھی ایمبولینس", "ایدهي امبولانس"), number: "115" },
  { label: L("Police", "پولیس", "پولیس"), number: "15" },
  { label: L("Fire Brigade", "فائر بریگیڈ", "د اور وژنه"), number: "16" },
];
