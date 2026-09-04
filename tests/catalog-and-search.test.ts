import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

process.env.RAAHI_DB_PATH = join(process.cwd(), "data", "raahi.test.db");

import { catalogRecordCount, organizations, services } from "@/data/catalog";
import { seedDatabase } from "@/lib/db/seed";
import { searchServices, searchServicesHybrid } from "@/lib/rag/search";

seedDatabase();

test("catalog contains at least sixty active source-cited services", () => {
  assert.ok(organizations.length >= 22);

  for (const service of services) {
    assert.ok(service.active);
    assert.match(service.sourceUrl, /^https:\/\//);
    assert.ok(service.sourceTitle.length > 0);
    assert.ok(service.sourceAuthorityTier >= 1 && service.sourceAuthorityTier <= 5);
    assert.match(service.lastVerified, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("retrieves a cited route for every demo journey", () => {
  const journeys = [
    { query: "مجھے اسکول کی فیس کے لیے مدد چاہیے", expected: "pbm-education-route" },
    { query: "I need a domicile certificate", expected: "cfc-kp-domicile" },
    { query: "زما پلار ته dialysis پکار ده", expected: "sundas-dialysis-enquiry" },
    { query: "مجھے BISP میں رجسٹریشن کرنی ہے", expected: "bisp-registration-route" },
    { query: "سیلاب سے گھر متاثر ہوا ہے", expected: "ndma-damage-guidance" },
  ];

  for (const journey of journeys) {
    const results = searchServices({ query: journey.query, limit: 5 });
    assert.ok(results.some((result) => result.service.id === journey.expected), journey.query);
    assert.ok(results.every((result) => result.citation.sourceUrl.startsWith("https://")));
  }
});

test("applies domain and provincial facets", () => {
  const results = searchServices({
    query: "domicile certificate",
    domain: "documentation",
    province: "Khyber Pakhtunkhwa",
    limit: 5,
  });

  assert.equal(results[0]?.service.id, "cfc-kp-domicile");
  assert.ok(results.every((result) => result.service.domain === "documentation"));
});

test("hybrid retrieval falls back to the local cited index without a DashScope key", async () => {
  const configuredKey = process.env.DASHSCOPE_API_KEY;
  delete process.env.DASHSCOPE_API_KEY;

  try {
    const results = await searchServicesHybrid({
      query: "مجھے BISP میں رجسٹریشن کرنی ہے",
      limit: 5,
    });

    assert.ok(results.some((result) => result.service.id === "bisp-registration-route"));
    assert.ok(results.every((result) => result.citation.sourceUrl.startsWith("https://")));
  } finally {
    if (configuredKey) {
      process.env.DASHSCOPE_API_KEY = configuredKey;
    }
  }
});
