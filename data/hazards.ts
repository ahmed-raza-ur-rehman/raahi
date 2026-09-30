import { L } from "@/lib/i18n";

/**
 * The hazard list, in its own leaf module.
 *
 * The disaster screen is a client component. Importing this from ./disaster
 * would drag in every channel and guide along with it.
 */
export const HAZARDS = [
  { id: "flood", label: L("Flood", "سیلاب", "سېلاب") },
  { id: "earthquake", label: L("Earthquake", "زلزلہ", "زلزله") },
  { id: "fire", label: L("Fire", "آگ", "اور") },
  { id: "storm", label: L("Storm / heavy rain", "طوفان / تیز بارش", "توفان") },
  { id: "landslide", label: L("Landslide", "لینڈ سلائیڈنگ", "د ځمکې ښوېدنه") },
  { id: "drought", label: L("Drought", "قحط سالی", "وچکالي") },
];
