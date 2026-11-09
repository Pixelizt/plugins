// Click-to-chat link and an optional WhatsApp Cloud API alert. No SDK. Off unless configured.
// The token is an Authorization header, never part of a URL or a log line.
import { cleanEnv } from "./email/send.ts";

/** https://wa.me link, or "" when the number is missing or not a plausible E.164 length. */
export function waMe(raw: string | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return "";
  return `https://wa.me/${digits}`;
}

export interface AlertFacts {
  reference: string;
  label: string;
  when: string;
  status: string;
  name?: string;
  phone?: string;
}

/** Team ping. Notes are left out: the email already has them, and this stays a short alert. */
export function alertBody(f: AlertFacts): string {
  return [`${f.label} booking ${f.status}`, `Ref ${f.reference}`, f.when, f.name ?? "", f.phone ?? ""].map((line) => line.trim()).filter(Boolean).join("\n");
}

export function alertsEnabled(modules: Record<string, unknown> | undefined): boolean {
  const block = modules?.whatsapp;
  if (!block || typeof block !== "object") return false;
  return (block as { booking_alerts?: boolean }).booking_alerts === true;
}

/**
 * Send one text to WHATSAPP_TO. Returns a delivery status, same shape as email.
 * "off" when the flag or any env var is missing. Never throws.
 */
export async function sendBookingAlert(body: string, env: Record<string, string | undefined>, fetchImpl: typeof fetch = fetch): Promise<string> {
  const token = cleanEnv(env.WHATSAPP_TOKEN);
  const phoneId = cleanEnv(env.WHATSAPP_PHONE_NUMBER_ID).replace(/\D/g, "");
  const to = (env.WHATSAPP_TO ?? "").replace(/\D/g, "");
  if (!token || !phoneId || !to) return "off";
  try {
    const res = await fetchImpl(`https://graph.facebook.com/v26.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { preview_url: false, body } }),
    });
    if (res.ok) return "ok";
    return `error: WhatsApp ${res.status}`;
  } catch (e) {
    return `error: ${e instanceof Error ? e.message : String(e)}`;
  }
}
