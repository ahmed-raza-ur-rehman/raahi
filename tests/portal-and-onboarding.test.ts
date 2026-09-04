import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

process.env.RAAHI_DB_PATH = join(process.cwd(), "data", "raahi.safety.test.db");

import { seedDatabase } from "@/lib/db/seed";
import {
  listOrganizations,
  createOrganization,
  createService,
  findServiceById,
} from "@/lib/db/repositories/services";

seedDatabase();

test("onboards an organization and creates a multi-step service with rules", () => {
  const orgId = "test-ngo-foundation";
  createOrganization({
    id: orgId,
    name: "Test Relief Foundation",
    nameUr: "ٹیسٹ ریلیف فاؤنڈیشن",
    type: "ngo",
    sourceUrl: "https://relief.example.org",
    authorityTier: 3,
  });

  const orgs = listOrganizations();
  const foundOrg = orgs.find((o) => o.id === orgId);
  assert.ok(foundOrg);
  assert.equal(foundOrg.name, "Test Relief Foundation");

  const serviceId = "test-ration-grant";
  createService({
    id: serviceId,
    organizationId: orgId,
    domain: "welfare",
    name: "Emergency Ration Grant",
    nameUr: "ہنگامی راشن گرانٹ",
    namePs: "د بیړني راشن مرسته",
    description: "Monthly food ration support for vulnerable families",
    descriptionUr: "مستحق خاندانوں کے لیے ماہانہ راشن امداد",
    aliases: ["ration", "food grant"],
    coverage: ["Punjab", "KP"],
    applicationMethod: "online",
    sourceUrl: "https://relief.example.org/ration",
    sourceTitle: "Official Ration Scheme",
    sourceAuthorityTier: 3,
    lastVerified: "2026-09-04",
    active: true,
    eligibilityRules: [
      {
        field: "householdIncome",
        operator: "lte",
        value: 30000,
        description: "Monthly income <= 30,000",
        mandatory: true,
      },
    ],
    requiredDocuments: [
      {
        type: "cnic",
        label: "CNIC Copy",
        labelUr: "شناختی کارڈ",
        mandatory: true,
      },
    ],
    procedure: [
      {
        order: 1,
        title: "Fill Registration Form",
        titleUr: "فارم پر کریں",
        description: "Visit portal and enter CNIC",
        descriptionUr: "پورٹل پر جا کر شناختی کارڈ درج کریں",
        channel: "online",
        url: "https://relief.example.org/apply",
      },
    ],
  });

  const svc = findServiceById(serviceId);
  assert.ok(svc);
  assert.equal(svc.name, "Emergency Ration Grant");
  assert.equal(svc.eligibilityRules.length, 1);
  assert.equal(svc.requiredDocuments.length, 1);
  assert.equal(svc.procedure.length, 1);
  assert.equal(svc.procedure[0].channel, "online");
});
