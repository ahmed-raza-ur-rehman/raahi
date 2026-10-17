import { createHash, createHmac } from "node:crypto";
import { isIP } from "node:net";

/**
 * Who is the client, as far as rate limiting is concerned?
 *
 * `X-Forwarded-For` is only trustworthy for the hops we operate. With N trusted proxies the real client address is
 * the Nth entry from the RIGHT (each trusted proxy appends the address it saw); anything further left can be forged by
 * the client. N = 0 means "do not use the header at all" (local development). IPv6 clients are bucketed by /64
 * because a single subscriber usually controls the whole prefix.
 */

function expandIpv6(address: string): number[] | undefined {
  let text = address.toLowerCase();
  const zone = text.indexOf("%");
  if (zone >= 0) text = text.slice(0, zone);
  const mapped = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (mapped) {
    const octets = mapped[2].split(".").map(Number);
    if (octets.some((octet) => !(octet >= 0 && octet <= 255))) return undefined;
    text = `${mapped[1]}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return undefined;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return undefined;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail].map((group) => parseInt(group, 16));
  return groups.length === 8 && groups.every((group) => Number.isInteger(group) && group >= 0 && group <= 0xffff) ? groups : undefined;
}

/** Canonical bucket for an address: IPv4 as is, IPv4-mapped IPv6 as IPv4, other IPv6 as its /64. */
export function normaliseIp(address: string): string | undefined {
  const trimmed = address.trim().replace(/^\[|\]$/g, "");
  const version = isIP(trimmed);
  if (version === 4) return trimmed;
  if (version !== 6) return undefined;
  const groups = expandIpv6(trimmed);
  if (!groups) return undefined;
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
  }
  return `${groups.slice(0, 4).map((group) => group.toString(16)).join(":")}::/64`;
}

export function clientIp(headers: Headers, trustedProxies: number): string | undefined {
  if (trustedProxies <= 0) return undefined;
  const forwarded = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(-10);
  if (forwarded.length > 0) {
    const entry = forwarded[Math.max(0, forwarded.length - trustedProxies)];
    const normalised = normaliseIp(entry);
    if (normalised) return normalised;
  }
  const real = headers.get("x-real-ip");
  return real ? normaliseIp(real) : undefined;
}

/** A short keyed hash so raw addresses never reach rate-limit keys, metrics or logs. */
export function anonymiseIp(ip: string | undefined, salt: Uint8Array): string {
  if (!ip) return "unknown";
  return createHmac("sha256", salt).update(ip).digest("base64url").slice(0, 16);
}

export function ipSalt(secretMaterial: Uint8Array | undefined, processRandom: Uint8Array): Uint8Array {
  return secretMaterial ? createHash("sha256").update("raahi-ip-salt").update(secretMaterial).digest() : processRandom;
}
