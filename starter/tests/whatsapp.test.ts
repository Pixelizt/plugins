import { describe, expect, it } from "vitest";
import { alertBody, alertsEnabled, sendBookingAlert, waMe } from "../src/kit/whatsapp.ts";

describe("WhatsApp", () => {
  it("builds a wa.me link and ignores a blank or short number", () => {
    expect(waMe("+44 7700 900123")).toBe("https://wa.me/447700900123");
    expect(waMe("")).toBe("");
    expect(waMe("123")).toBe("");
  });

  it("stays off unless the module flag and env vars are all set", async () => {
    expect(alertsEnabled({})).toBe(false);
    expect(alertsEnabled({ whatsapp: {} })).toBe(false);
    expect(alertsEnabled({ whatsapp: { booking_alerts: true } })).toBe(true);
    expect(await sendBookingAlert("hi", {})).toBe("off");
  });

  it("posts to the Cloud API and does not put the token in the URL", async () => {
    let url = "";
    let auth = "";
    const status = await sendBookingAlert(alertBody({ reference: "AB12", label: "Table", when: "Monday, 12:00 to 13:30", status: "confirmed", name: "Ada", phone: "+44 20" }), {
      WHATSAPP_TOKEN: "secret-token",
      WHATSAPP_PHONE_NUMBER_ID: "123",
      WHATSAPP_TO: "+1 555 000 1111",
    }, (async (input, init) => {
      url = String(input);
      auth = (init?.headers as { Authorization: string }).Authorization;
      return new Response("{}", { status: 200 });
    }) as typeof fetch);
    expect(status).toBe("ok");
    expect(url).toBe("https://graph.facebook.com/v26.0/123/messages");
    expect(url).not.toContain("secret-token");
    expect(auth).toBe("Bearer secret-token");
    expect(alertBody({ reference: "AB12", label: "Table", when: "Monday", status: "pending", name: "Ada" })).not.toMatch(/notes/i);
  });
});
