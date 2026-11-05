// Send one email through Resend (D19). Never throws: returns a delivery status string for the row (rule 20).
// Recipients for team emails come from env vars only, never from the request (rule 10). Kit code.
import { oneLine } from "../lib/text.ts";

export interface Mail { to: string[]; subject: string; html: string; text: string; replyTo?: string }

/** Strip invisible characters that pasted env values pick up (rule 24). */
export const cleanEnv = (v: string | undefined) => (v ?? "").replace(/[ ​-‍⁠﻿]/g, " ").trim();

export const listEnv = (v: string | undefined) => cleanEnv(v).split(/[,\s]+/).filter(Boolean);

export async function sendMail(m: Mail, env: Record<string, string | undefined> = process.env): Promise<string> {
  const key = cleanEnv(env.RESEND_API_KEY);
  const from = cleanEnv(env.EMAIL_FROM);
  if (!key) return "off";
  if (!from) return "error: EMAIL_FROM is not set";
  if (!m.to.length) return "none";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: m.to, subject: m.subject, html: m.html, text: m.text, ...(m.replyTo ? { reply_to: m.replyTo } : {}) }),
    });
    if (res.ok) return "ok";
    return `error: Resend ${res.status} ${(await res.text()).slice(0, 120)}`;
  } catch (e) {
    return `error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** Run one delivery step (sheet, email...) and turn a failure into the status string saved on the row (rule 20). Never throws. */
export async function attempt(scope: string, name: string, fn: () => Promise<string>): Promise<string> {
  try {
    return await fn();
  } catch (e) {
    console.error(`${scope}: ${name} failed: ${(e as Error).message}`);
    return `error: ${oneLine((e as Error).message)}`;
  }
}
