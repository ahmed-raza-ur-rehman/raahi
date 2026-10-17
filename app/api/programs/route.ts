import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { listActiveServices, pendingSubmissionCount, submitService, MAX_PENDING_SUBMISSIONS } from "@/lib/db/repositories/services";
import { guardLegacy, type LegacyLimit } from "@/lib/platform/legacy";
import { SAFE_TEXT } from "@/lib/api/v1/schemas";

/** A public https URL: no credentials, no IP literals, no localhost / internal names. */
export function isPublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password) return false;
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) return false;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":") || host.startsWith("[")) return false;
    return true;
  } catch {
    return false;
  }
}

const text = (max: number, min = 1) => z.string().trim().min(min).max(max).regex(SAFE_TEXT, "contains control characters");
const httpsUrl = z.string().trim().max(500).refine(isPublicHttpsUrl, "must be a public https URL");

const submissionSchema = z.object({
  organizationId: z.string().trim().min(2).max(64).regex(/^[A-Za-z0-9_-]+$/),
  domain: z.enum(["welfare", "education", "health", "documentation", "disaster", "legal", "employment"]),
  name: text(160, 2),
  nameUr: text(160, 2),
  namePs: text(160, 0).optional().default(""),
  description: text(4000, 5),
  descriptionUr: text(4000, 5),
  aliases: z.array(text(80)).max(20).default([]),
  coverage: z.array(text(60)).max(10).default(["Pakistan"]),
  applicationMethod: z.enum(["online", "in_person", "phone", "sms", "mixed"]).default("in_person"),
  sourceUrl: httpsUrl,
  sourceTitle: text(160, 2),
  lastVerified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
  eligibilityRules: z
    .array(
      z.object({
        field: z.enum(["province", "district", "householdIncome", "householdSize", "gender", "age", "hasCnic", "isBispBeneficiary", "isEnrolled", "educationLevel", "pmtScore", "specialConditions"]),
        operator: z.enum(["lt", "lte", "gt", "gte", "eq", "in", "exists", "between"]),
        value: z.union([z.string().max(200), z.number(), z.boolean(), z.tuple([z.number(), z.number()]), z.array(z.string().max(80)).max(20)]),
        description: text(300),
        mandatory: z.boolean(),
      }),
    )
    .max(20)
    .default([]),
  requiredDocuments: z.array(z.object({ type: text(60), label: text(160), labelUr: text(160), mandatory: z.boolean() })).max(20).default([]),
  procedure: z
    .array(z.object({ order: z.number().int().min(1).max(50), title: text(160), titleUr: text(160), description: text(600), descriptionUr: text(600), channel: z.enum(["online", "in_person", "phone", "sms"]), url: httpsUrl.optional() }))
    .max(30)
    .default([]),
});

const readLimits: LegacyLimit[] = [{ policy: "read", by: "ip" }];
const submitLimits: LegacyLimit[] = [
  { policy: "submit", by: "ip" },
  { policy: "submit", by: "session" },
];

export const GET = guardLegacy(
  async (request) => {
    ensureDatabaseSeeded();
    const url = new URL(request.url);
    const domain = url.searchParams.get("domain");
    const province = url.searchParams.get("province");
    const search = url.searchParams.get("q")?.slice(0, 200).toLowerCase();

    let services = listActiveServices();
    if (domain) services = services.filter((s) => s.domain === domain);
    if (province) services = services.filter((s) => s.coverage.includes("Pakistan") || s.coverage.includes(province));
    if (search) {
      services = services.filter(
        (s) =>
          s.name.toLowerCase().includes(search) ||
          s.nameUr.includes(search) ||
          s.description.toLowerCase().includes(search) ||
          s.descriptionUr.includes(search) ||
          s.aliases.some((a) => a.toLowerCase().includes(search)),
      );
    }
    return NextResponse.json({ results: services });
  },
  { name: "listPrograms", limits: readLimits },
);

/**
 * Partner submission. NEVER publishes: the service is stored inactive, at the lowest authority tier, under a
 * server-generated id (it cannot overwrite anything), and waits for an administrator to approve it
 * (`/api/v1/admin/submissions`). Whatever `id`, `active` or tier the client sends is ignored.
 */
export const POST = guardLegacy(
  async (request) => {
    ensureDatabaseSeeded();
    const parsed = submissionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid service details.", details: parsed.error.issues.slice(0, 10).map((issue) => ({ path: issue.path.join("."), message: issue.message })) },
        { status: 400 },
      );
    }
    const id = submitService(parsed.data);
    if (!id) {
      return NextResponse.json({ error: `The review queue is full (${pendingSubmissionCount()}/${MAX_PENDING_SUBMISSIONS}). Please try again later.` }, { status: 503 });
    }
    return NextResponse.json(
      { status: "pending_review", id, message: "Thank you. Your service was received and will appear after a RAAHI administrator verifies it." },
      { status: 202 },
    );
  },
  { name: "submitProgram", limits: submitLimits, maxBodyBytes: 64 * 1024 },
);
