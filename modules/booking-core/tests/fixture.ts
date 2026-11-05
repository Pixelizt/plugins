// Shared test fixture (not a test file): a simple booking type, env with fake keys, and a fetch stub.
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { vi } from "vitest";
import { validateConfig } from "../../../kit/config/load.ts";
import { BookingCoreConfig, intOf, type BookingType } from "../lib/schema.ts";
import type { BookingCtx } from "../server/book.ts";

const raw = parse(readFileSync("client.yaml", "utf8"));
// fixed business facts for the tests (whatever the demo brief says)
raw.client.timezone = "Europe/London";
raw.client.domain = "demo.example.com";
export const cfg = validateConfig(raw);
export const NOW = new Date("2026-11-05T10:00:00Z"); // Thursday, GMT
export const SECRET = "test-secret-".padEnd(40, "x");
export const env = {
  PUBLIC_SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "svc", PUBLIC_SUPABASE_ANON_KEY: "anon",
  RESEND_API_KEY: "re_test", EMAIL_FROM: "Demo <a@b.com>", BOOKINGS_EMAIL_TO: "team@demo.com", BOOKING_TOKEN_SECRET: SECRET,
};

/** A covers-model table type: 10 seats, 90-minute bookings, 30-minute slots, 12:00-21:00 every day but Sunday. */
export function fakeType(mode: "auto" | "approve" = "auto"): BookingType {
  return {
    kind: "table", label: "Table", configured: true,
    resolve(ask, opts = {}) {
      const party = intOf(ask.party);
      if (party === null || party < 1) return { ok: false, error: "Choose guests", field: "party" };
      if (party > 8 && !opts.staff) return { ok: false, error: "For more than 8 guests, please send us an enquiry.", field: "party", enquiry: "/contact" };
      return {
        ok: true,
        rules: { hours: { "mon-sat": "12:00-21:00", sun: "closed" }, slot_minutes: 30, lead_time_minutes: 60, max_days_ahead: 30, blackout_dates: ["2026-11-10"], fit: "start" },
        duration: 90, candidates: [{ id: "table:covers", kind: "table", name: "Covers", capacity: 10, buffer_minutes: 0 }],
        units: party, party_size: party, mode, hold_minutes: 120, facts: [["Guests", String(party)]], fields: {},
      };
    },
    describe: () => ({ kind: "table", label: "Table", slot_minutes: 30, party: { min: 1, max: 8 }, spaces: null }),
  };
}

export const ctx = (o: Partial<BookingCtx> = {}): BookingCtx => ({
  cfg, conf: BookingCoreConfig.parse({}), types: { table: fakeType() }, region: "GB", env, now: NOW, ...o,
});

export interface Call { url: string; method: string; body: any; headers: Record<string, string> }

/** Routes fetch by URL. Each handler returns a Response; unknown URLs throw. */
export function stubFetch(routes: [RegExp, (c: Call) => Response | Promise<Response>][]) {
  const calls: Call[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const c: Call = { url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined, headers: (init?.headers ?? {}) as Record<string, string> };
    calls.push(c);
    for (const [re, fn] of routes) if (re.test(url)) return fn(c);
    throw new Error("unexpected fetch " + url);
  });
  return calls;
}

export const mails = (calls: Call[]) => calls.filter((c) => c.url.includes("api.resend.com")).map((c) => c.body);
export const resend: [RegExp, () => Response] = [/api\.resend\.com/, () => Response.json({ id: "m" })];
export const patchOk: [RegExp, (c: Call) => Response] = [/bookings\?id=eq\./, () => new Response(null, { status: 204 })];

export const bookReq = (body: unknown) =>
  new Request("https://demo.example.com/api/bookings/book", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": "1.2.3.4" } });

export const good = {
  type: "table", date: "2026-11-06", time: "19:00", party: 4,
  details: { name: "Ann <b>Evil</b>", email: "ann@example.com", phone: "+44 20 7946 0958", notes: "Visit http://spam.example" },
};
