import { randomUUID } from "node:crypto";

import { getSqlite } from "@/lib/db/client";
import { bloodBanks, compatibleDonors } from "@/data/blood";
import { disasterChannels, HAZARDS } from "@/data/disaster";
import type { BloodRequestRecord, DonorRegistration, ReliefRequest } from "@/lib/types";

/**
 * Community services: blood donor network and disaster relief requests.
 *
 * Personal contact numbers are stored for coordination but are always masked
 * when shown to anyone other than the session that created them.
 */

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `${digits.slice(0, 4)}${"*".repeat(Math.max(0, digits.length - 7))}${digits.slice(-3)}`;
}

/* ─────────────────── Blood ─────────────────── */

type BloodRow = {
  id: string;
  session_id: string;
  patient_name: string;
  blood_group: string;
  units: number;
  city: string;
  hospital: string;
  needed_by: string;
  contact_number: string;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

function parseBlood(row: BloodRow): BloodRequestRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    patientName: row.patient_name,
    bloodGroup: row.blood_group,
    units: row.units,
    city: row.city,
    hospital: row.hospital,
    neededBy: row.needed_by,
    contactNumber: row.contact_number,
    status: row.status as BloodRequestRecord["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.notes ? { notes: row.notes } : {}),
  };
}

export interface CreateBloodRequestInput {
  sessionId: string;
  patientName: string;
  bloodGroup: string;
  units: number;
  city: string;
  hospital: string;
  neededBy: string;
  contactNumber: string;
  notes?: string;
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

export function validateBloodRequest(input: Partial<CreateBloodRequestInput>): string | undefined {
  if (!input.patientName || input.patientName.trim().length < 2) return "Write the patient's name.";
  if (!input.bloodGroup || !BLOOD_GROUPS.includes(input.bloodGroup)) return "Select a valid blood group.";
  if (!input.units || input.units < 1 || input.units > 20) return "Units must be between 1 and 20.";
  if (!input.city || input.city.trim().length < 2) return "Write the city.";
  if (!input.hospital || input.hospital.trim().length < 2) return "Write the hospital name.";
  if (!input.contactNumber || !/^[\d+()\-\s]{7,20}$/.test(input.contactNumber)) return "Write a phone number the hospital can reach.";
  if (input.neededBy && Number.isNaN(Date.parse(input.neededBy))) return "That date does not look right.";
  return undefined;
}

export function createBloodRequest(input: CreateBloodRequestInput): BloodRequestRecord {
  const now = new Date().toISOString();
  const id = `blood-${randomUUID().slice(0, 8)}`;
  getSqlite()
    .prepare(
      `INSERT INTO blood_requests (
        id, session_id, patient_name, blood_group, units, city, hospital, needed_by,
        contact_number, notes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
    )
    .run(
      id,
      input.sessionId,
      input.patientName.trim(),
      input.bloodGroup,
      Math.min(20, Math.max(1, Math.round(input.units))),
      input.city.trim(),
      input.hospital.trim(),
      input.neededBy,
      input.contactNumber.trim(),
      input.notes ?? null,
      now,
      now,
    );
  return getBloodRequest(id)!;
}

export function getBloodRequest(id: string): BloodRequestRecord | undefined {
  const row = getSqlite().prepare("SELECT * FROM blood_requests WHERE id = ?").get(id) as BloodRow | undefined;
  return row ? parseBlood(row) : undefined;
}

export function listBloodRequests(filter: { bloodGroup?: string; city?: string; status?: string } = {}): BloodRequestRecord[] {
  const clauses: string[] = ["status = 'open'"];
  const params: unknown[] = [];
  if (filter.bloodGroup) {
    clauses.push("blood_group = ?");
    params.push(filter.bloodGroup);
  }
  if (filter.city) {
    clauses.push("LOWER(city) LIKE ?");
    params.push(`%${filter.city.toLowerCase()}%`);
  }
  const rows = getSqlite()
    .prepare(`SELECT * FROM blood_requests WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT 50`)
    .all(...params) as BloodRow[];
  return rows.map(parseBlood);
}

/** Requests whose blood group can be served by this donor. */
export function matchingRequests(bloodGroup: string, city?: string) {
  const compatible = compatibleDonors(bloodGroup);
  return listBloodRequests({ ...(city ? { city } : {}) }).filter((request) => compatible.includes(request.bloodGroup));
}

export function updateBloodRequestStatus(
  id: string,
  status: BloodRequestRecord["status"],
  sessionId?: string,
): BloodRequestRecord | undefined {
  const database = getSqlite();
  const existing = getBloodRequest(id);
  if (!existing) return undefined;
  if (sessionId && existing.sessionId !== sessionId) return undefined;
  database.prepare("UPDATE blood_requests SET status = ?, updated_at = ? WHERE id = ?").run(status, new Date().toISOString(), id);
  return getBloodRequest(id);
}

/* ── Donors ── */

type DonorRow = {
  id: string;
  session_id: string;
  full_name: string;
  blood_group: string;
  city: string;
  phone: string;
  last_donation: string | null;
  available: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export interface CreateDonorInput {
  sessionId: string;
  fullName: string;
  bloodGroup: string;
  city: string;
  phone: string;
  lastDonation?: string;
  notes?: string;
}

export function validateDonor(input: Partial<CreateDonorInput>): string | undefined {
  if (!input.fullName || input.fullName.trim().length < 2) return "Write your name.";
  if (!input.bloodGroup || !BLOOD_GROUPS.includes(input.bloodGroup)) return "Select a valid blood group.";
  if (!input.city || input.city.trim().length < 2) return "Write your city.";
  if (!input.phone || !/^[\d+()\-\s]{7,20}$/.test(input.phone)) return "Write a contact number.";
  if (input.lastDonation && Number.isNaN(Date.parse(input.lastDonation))) return "That date does not look right.";
  return undefined;
}

function parseDonor(row: DonorRow): DonorRegistration {
  return {
    id: row.id,
    sessionId: row.session_id,
    fullName: row.full_name,
    bloodGroup: row.blood_group,
    city: row.city,
    phone: row.phone,
    available: row.available === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.last_donation ? { lastDonation: row.last_donation } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
  };
}

export function registerDonor(input: CreateDonorInput): DonorRegistration {
  const now = new Date().toISOString();
  const id = `donor-${randomUUID().slice(0, 8)}`;
  getSqlite()
    .prepare(
      `INSERT INTO donor_registrations (
        id, session_id, full_name, blood_group, city, phone, last_donation, available, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    )
    .run(
      id,
      input.sessionId,
      input.fullName.trim(),
      input.bloodGroup,
      input.city.trim(),
      input.phone.trim(),
      input.lastDonation ?? null,
      input.notes ?? null,
      now,
      now,
    );
  return getDonor(id)!;
}

export function getDonor(id: string): DonorRegistration | undefined {
  const row = getSqlite().prepare("SELECT * FROM donor_registrations WHERE id = ?").get(id) as DonorRow | undefined;
  return row ? parseDonor(row) : undefined;
}

export function listDonorsFor(group: string, city?: string): DonorRegistration[] {
  const compatible = compatibleDonors(group);
  const placeholders = compatible.map(() => "?").join(", ");
  const clauses = [`blood_group IN (${placeholders})`, "available = 1"];
  const params: unknown[] = [...compatible];
  if (city) {
    clauses.push("LOWER(city) LIKE ?");
    params.push(`%${city.toLowerCase()}%`);
  }
  const rows = getSqlite()
    .prepare(`SELECT * FROM donor_registrations WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT 50`)
    .all(...params) as DonorRow[];
  return rows.map(parseDonor);
}

export function listMyDonorRegistrations(sessionId: string): DonorRegistration[] {
  const rows = getSqlite()
    .prepare("SELECT * FROM donor_registrations WHERE session_id = ? ORDER BY created_at DESC")
    .all(sessionId) as DonorRow[];
  return rows.map(parseDonor);
}

/** Public view: never exposes another person's phone number in full. */
export function publicDonorView(donor: DonorRegistration, ownerSessionId?: string) {
  return {
    id: donor.id,
    fullName: donor.fullName,
    bloodGroup: donor.bloodGroup,
    city: donor.city,
    available: donor.available,
    lastDonation: donor.lastDonation,
    phone: donor.sessionId === ownerSessionId ? donor.phone : maskPhone(donor.phone),
  };
}

export function setDonorAvailability(id: string, available: boolean, sessionId?: string) {
  const existing = getDonor(id);
  if (!existing) return undefined;
  if (sessionId && existing.sessionId !== sessionId) return undefined;
  getSqlite()
    .prepare("UPDATE donor_registrations SET available = ?, updated_at = ? WHERE id = ?")
    .run(available ? 1 : 0, new Date().toISOString(), id);
  return getDonor(id);
}

/* ─────────────────── Blood banks ─────────────────── */

export function findBloodBanks(city?: string, group?: string) {
  return bloodBanks
    .filter((bank) => !city || bank.city.toLowerCase().includes(city.toLowerCase()) || bank.city === "Multiple")
    .filter((bank) => !group || bank.components.length > 0)
    .map((bank) => ({
      id: bank.id,
      name: bank.name,
      city: bank.city,
      province: bank.province,
      type: bank.type,
      services: bank.services,
      hours: bank.hours,
      contact: bank.contact,
    }));
}

/* ─────────────────── Disaster relief ─────────────────── */

type ReliefRow = {
  id: string;
  session_id: string;
  hazard: string;
  district: string;
  families: number;
  needs: string;
  location_note: string | null;
  contact_number: string;
  status: string;
  routed_to: string;
  created_at: string;
  updated_at: string;
};

export interface CreateReliefInput {
  sessionId: string;
  hazard: string;
  district: string;
  families: number;
  needs: string[];
  contactNumber: string;
  locationNote?: string;
}

export const RELIEF_NEEDS = [
  { id: "shelter", label: { en: "Shelter / tents", ur: "پناہ / خیمے" } },
  { id: "food", label: { en: "Food / ration", ur: "خوراک / راشن" } },
  { id: "water", label: { en: "Clean water", ur: "صاف پانی" } },
  { id: "medicine", label: { en: "Medicine", ur: "ادویات" } },
  { id: "rescue", label: { en: "Rescue / evacuation", ur: "ریسکیو / نکالنا" } },
  { id: "documents", label: { en: "Lost documents", ur: "گمشدہ دستاویزات" } },
  { id: "livelihood", label: { en: "Livelihood support", ur: "روزگار کی بحالی" } },
];

export function validateRelief(input: Partial<CreateReliefInput>): string | undefined {
  if (!input.hazard || !HAZARDS.some((hazard) => hazard.id === input.hazard)) return "Select the type of disaster.";
  if (!input.district || input.district.trim().length < 2) return "Write your district.";
  if (!input.families || input.families < 1 || input.families > 5000) return "Number of families must be between 1 and 5000.";
  if (!input.needs || input.needs.length === 0) return "Select at least one need.";
  if (!input.contactNumber || !/^[\d+()\-\s]{7,20}$/.test(input.contactNumber)) return "Write a contact number.";
  return undefined;
}

/** Route the request to the channels that actually handle this hazard. */
export function routeRelief(hazard: string, district: string): { id: string; name: string; numbers: string[] }[] {
  const always = disasterChannels.filter((channel) => channel.priority <= 2);
  const hazardSpecific = disasterChannels.filter((channel) => channel.priority > 2);
  return [...always, ...hazardSpecific].map((channel) => ({
    id: channel.id,
    name: typeof channel.name === "string" ? channel.name : channel.name.en,
    numbers: channel.numbers.filter((number) => number.length > 0),
  }));
}

function parseRelief(row: ReliefRow): ReliefRequest {
  let needs: string[] = [];
  let routed: string[] = [];
  try {
    needs = JSON.parse(row.needs) as string[];
  } catch {
    needs = [row.needs];
  }
  try {
    routed = JSON.parse(row.routed_to) as string[];
  } catch {
    routed = row.routed_to ? [row.routed_to] : [];
  }
  return {
    id: row.id,
    sessionId: row.session_id,
    hazard: row.hazard,
    district: row.district,
    families: row.families,
    needs,
    contactNumber: row.contact_number,
    status: row.status as ReliefRequest["status"],
    routedTo: routed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.location_note ? { locationNote: row.location_note } : {}),
  };
}

export function createReliefRequest(input: CreateReliefInput): ReliefRequest {
  const now = new Date().toISOString();
  const id = `relief-${randomUUID().slice(0, 8)}`;
  const routed = routeRelief(input.hazard, input.district).map((channel) => channel.id);

  getSqlite()
    .prepare(
      `INSERT INTO relief_requests (
        id, session_id, hazard, district, families, needs, location_note, contact_number, status, routed_to, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?)`,
    )
    .run(
      id,
      input.sessionId,
      input.hazard,
      input.district.trim(),
      Math.min(5000, Math.max(1, Math.round(input.families))),
      JSON.stringify(input.needs),
      input.locationNote ?? null,
      input.contactNumber.trim(),
      JSON.stringify(routed),
      now,
      now,
    );
  return getReliefRequest(id)!;
}

export function getReliefRequest(id: string): ReliefRequest | undefined {
  const row = getSqlite().prepare("SELECT * FROM relief_requests WHERE id = ?").get(id) as ReliefRow | undefined;
  return row ? parseRelief(row) : undefined;
}

export function listReliefRequests(sessionId?: string): ReliefRequest[] {
  const rows = sessionId
    ? (getSqlite().prepare("SELECT * FROM relief_requests WHERE session_id = ? ORDER BY created_at DESC LIMIT 50").all(sessionId) as ReliefRow[])
    : (getSqlite().prepare("SELECT * FROM relief_requests ORDER BY created_at DESC LIMIT 50").all() as ReliefRow[]);
  return rows.map(parseRelief);
}

export function updateReliefStatus(id: string, status: ReliefRequest["status"]): ReliefRequest | undefined {
  const database = getSqlite();
  if (!getReliefRequest(id)) return undefined;
  database.prepare("UPDATE relief_requests SET status = ?, updated_at = ? WHERE id = ?").run(status, new Date().toISOString(), id);
  return getReliefRequest(id);
}
