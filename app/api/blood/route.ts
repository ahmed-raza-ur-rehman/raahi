import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { getSessionId } from "@/lib/web/session";
import { donorEligibility, bloodDonationSteps, bloodRequestSteps } from "@/data/blood";
import {
  createBloodRequest,
  findBloodBanks,
  listBloodRequests,
  listDonorsFor,
  listMyDonorRegistrations,
  matchingRequests,
  publicDonorView,
  registerDonor,
  setDonorAvailability,
  validateBloodRequest,
  validateDonor,
} from "@/lib/community";

const requestSchema = z.object({
  patientName: z.string().min(2).max(80),
  bloodGroup: z.string().min(2).max(3),
  units: z.number().int().min(1).max(20),
  city: z.string().min(2).max(60),
  hospital: z.string().min(2).max(120),
  neededBy: z.string().min(4).max(30),
  contactNumber: z.string().min(7).max(24),
  notes: z.string().max(500).optional(),
});

const donorSchema = z.object({
  fullName: z.string().min(2).max(80),
  bloodGroup: z.string().min(2).max(3),
  city: z.string().min(2).max(60),
  phone: z.string().min(7).max(24),
  lastDonation: z.string().max(30).optional(),
  notes: z.string().max(300).optional(),
});

export async function GET(request: Request) {
  ensureDatabaseSeeded();
  const sessionId = await getSessionId();
  const url = new URL(request.url);
  const bloodGroup = url.searchParams.get("group") ?? undefined;
  const city = url.searchParams.get("city") ?? undefined;
  const mode = url.searchParams.get("mode");

  if (mode === "donors" && bloodGroup) {
    return NextResponse.json({
      donors: listDonorsFor(bloodGroup, city).map((donor) => publicDonorView(donor, sessionId)),
    });
  }

  return NextResponse.json({
    banks: findBloodBanks(city, bloodGroup),
    requests: (bloodGroup ? matchingRequests(bloodGroup, city) : listBloodRequests({ ...(city ? { city } : {}) })).map((item) => ({
      ...item,
      contactNumber: item.sessionId === sessionId ? item.contactNumber : item.contactNumber.replace(/\d(?=\d{3})/g, "*"),
    })),
    myRegistrations: listMyDonorRegistrations(sessionId).map((donor) => publicDonorView(donor, sessionId)),
    eligibility: donorEligibility,
    howToDonate: bloodDonationSteps,
    howToRequest: bloodRequestSteps,
  });
}

export async function POST(request: Request) {
  ensureDatabaseSeeded();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Send the details as JSON." }, { status: 400 });
  }

  const sessionId = await getSessionId();
  const action = (body as { action?: string }).action ?? "request";

  if (action === "register_donor") {
    const parsed = donorSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Please check the donor details." }, { status: 400 });
    const invalid = validateDonor(parsed.data);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    const donor = registerDonor({ sessionId, ...parsed.data });
    return NextResponse.json({ donor: publicDonorView(donor, sessionId), matching: matchingRequests(donor.bloodGroup, donor.city).length }, { status: 201 });
  }

  if (action === "set_availability") {
    const { id, available } = body as { id?: string; available?: boolean };
    if (!id || typeof available !== "boolean") return NextResponse.json({ error: "Missing details." }, { status: 400 });
    const donor = setDonorAvailability(id, available, sessionId);
    return donor ? NextResponse.json({ donor: publicDonorView(donor, sessionId) }) : NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Please check the request details." }, { status: 400 });
  const invalid = validateBloodRequest(parsed.data);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const created = createBloodRequest({ sessionId, ...parsed.data });
  return NextResponse.json(
    {
      request: created,
      banks: findBloodBanks(created.city),
      donors: listDonorsFor(created.bloodGroup, created.city).map((donor) => publicDonorView(donor, sessionId)),
    },
    { status: 201 },
  );
}
