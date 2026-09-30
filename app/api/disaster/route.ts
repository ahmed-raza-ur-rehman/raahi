import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { getSessionId } from "@/lib/web/session";
import { listDisasterChannels, listDisasterGuides } from "@/lib/knowledge";
import { HAZARDS } from "@/data/disaster";
import { createReliefRequest, listReliefRequests, routeRelief, validateRelief, RELIEF_NEEDS } from "@/lib/community";

const reliefSchema = z.object({
  hazard: z.string().min(2).max(40),
  district: z.string().min(2).max(60),
  families: z.number().int().min(1).max(5000),
  needs: z.array(z.string().min(1).max(40)).min(1).max(10),
  contactNumber: z.string().min(7).max(24),
  locationNote: z.string().max(300).optional(),
});

export async function GET(request: Request) {
  ensureDatabaseSeeded();
  const sessionId = await getSessionId();
  const hazard = new URL(request.url).searchParams.get("hazard") ?? undefined;

  return NextResponse.json({
    channels: listDisasterChannels(),
    guides: listDisasterGuides(hazard),
    hazards: HAZARDS,
    needs: RELIEF_NEEDS,
    myRequests: listReliefRequests(sessionId),
  });
}

export async function POST(request: Request) {
  ensureDatabaseSeeded();
  const parsed = reliefSchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "Please check the relief request details." }, { status: 400 });

  const invalid = validateRelief(parsed.data);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const sessionId = await getSessionId();
  const created = createReliefRequest({ sessionId, ...parsed.data });

  return NextResponse.json(
    {
      request: created,
      routedTo: routeRelief(created.hazard),
      guides: listDisasterGuides(created.hazard),
      emergency: [
        { label: "Rescue 1122", number: "1122" },
        { label: "Edhi Ambulance", number: "115" },
        { label: "Police", number: "15" },
      ],
    },
    { status: 201 },
  );
}
