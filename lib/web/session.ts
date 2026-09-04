import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

export async function getSessionId() {
  const store = await cookies();
  const existing = store.get("raahi_session")?.value;
  if (existing) return existing;
  const id = randomUUID();
  store.set("raahi_session", id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 180, path: "/" });
  return id;
}