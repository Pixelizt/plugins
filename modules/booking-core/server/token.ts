// Customer self-service links (no accounts). The token in a cancel link is HMAC-SHA256(secret, booking id), so the
// server can rebuild it for later emails (the reminder) without storing it. The row keeps only SHA-256(token):
// a leaked table gives no working links, a changed secret retires every old link, and clearing the hash revokes one.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cleanEnv } from "../../../kit/email/send.ts";

export const MIN_SECRET = 32;

/** The secret from BOOKING_TOKEN_SECRET, or "" when unset or too short (then emails carry no cancel link). */
export function tokenSecret(env: Record<string, string | undefined>): string {
  const s = cleanEnv(env.BOOKING_TOKEN_SECRET);
  return s.length >= MIN_SECRET ? s : "";
}

export const cancelToken = (secret: string, id: string) => createHmac("sha256", secret).update(`kit-booking-cancel:${id}`).digest("base64url");
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** True only when the token was made for this booking with this secret AND matches the hash stored on the row. */
export function verifyCancelToken(secret: string, id: string, token: unknown, storedHash: string | null | undefined): boolean {
  if (!secret || typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token) || !storedHash) return false;
  return same(cancelToken(secret, id), token) && same(tokenHash(token), storedHash);
}

export const cancelUrl = (siteUrl: string, id: string, token: string) => `${siteUrl}/bookings/cancel?id=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}`;
