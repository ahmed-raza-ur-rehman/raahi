import { NextResponse } from "next/server";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { listLegalTopics } from "@/lib/knowledge";
import { contacts } from "@/data/contacts";

export async function GET(request: Request) {
  ensureDatabaseSeeded();
  const category = new URL(request.url).searchParams.get("category") ?? undefined;
  return NextResponse.json({
    results: listLegalTopics(category),
    helplines: contacts
      .filter((contact) => ["legal", "women", "child", "complaint"].includes(contact.category))
      .map((contact) => ({ id: contact.id, name: contact.name, purpose: contact.purpose, numbers: contact.numbers, url: contact.url })),
    disclaimer:
      "This is procedural guidance, not legal advice. Free legal aid: Legal Aid Society 0800-70806.",
  });
}
