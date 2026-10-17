import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

process.env.RAAHI_DB_PATH = join(process.cwd(), "data", "raahi.safety.test.db");

import { seedDatabase } from "@/lib/db/seed";
import { createCase, findCase, addDocument, deleteDocument } from "@/lib/db/repositories/cases";

seedDatabase();

test("adds and hydrates documents with OCR metadata on a citizen case", () => {
  const sessionId = "doc-test-session";
  const caseItem = createCase({
    sessionId,
    title: "CNIC Verification Case",
    titleUr: "شناختی تصدیق کیس",
    domain: "documentation",
    summary: "Testing OCR document attachment",
    serviceIds: ["nadra-cnic-new"],
    actions: [{ label: "Upload CNIC", labelUr: "شناختی کارڈ اپلوڈ کریں" }],
  });

  assert.ok(caseItem.id);

  // Add document with OCR metadata
  const doc = addDocument({
    caseId: caseItem.id,
    sessionId,
    documentType: "cnic",
    label: "National Identity Card",
    ocrData: {
      "CNIC Number": "17301-1234567-1",
      "Full Name": "Ali Ahmad",
      "Issue Date": "2024-01-15",
    },
    verified: true,
  });

  assert.ok(doc);
  assert.equal(doc.documentType, "cnic");
  assert.equal(doc.verified, true);
  assert.equal(doc.ocrData?.["CNIC Number"], "17301-1234567-1");

  // Verify hydration through findCase
  const hydrated = findCase(caseItem.id, sessionId);
  assert.ok(hydrated);
  assert.ok(hydrated.documents);
  assert.equal(hydrated.documents.length, 1);
  assert.equal(hydrated.documents[0].ocrData?.["Full Name"], "Ali Ahmad");

  // Test deletion
  assert.equal(deleteDocument(doc.id, caseItem.id, "someone-else").changes, 0, "another session cannot delete the document");
  assert.equal(findCase(caseItem.id, sessionId)?.documents?.length, 1);
  deleteDocument(doc.id, caseItem.id, sessionId);
  const afterDelete = findCase(caseItem.id, sessionId);
  assert.equal(afterDelete?.documents?.length, 0);
});
