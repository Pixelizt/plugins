import { describe, expect, it } from "vitest";
import { checkField, emailOk, phoneOk, validateForm } from "../lib/validate.ts";
import { FormDef, FormsDoc } from "../lib/schema.ts";
import seed from "../seed/forms.json";

describe("forms validation", () => {
  it("validates phones for the client's region and international numbers", () => {
    expect(phoneOk("020 7946 0958", "GB")).toBe(true);
    expect(phoneOk("+971 50 123 4567", "GB")).toBe(true);
    expect(phoneOk("00971 50 123 4567", "GB")).toBe(true);
    expect(phoneOk("050 123 4567", "AE")).toBe(true);
    expect(phoneOk("٠٥٠ ١٢٣ ٤٥٦٧", "AE")).toBe(true); // Arabic-Indic digits
    expect(phoneOk("0000000000", "GB")).toBe(false);
    expect(phoneOk("12", "GB")).toBe(false);
    expect(phoneOk("call me", "GB")).toBe(false);
  });
  it("catches bad emails and common .com typos", () => {
    expect(emailOk("ann@example.com")).toBe(true);
    expect(emailOk("ann@gmail.con")).toBe(false);
    expect(emailOk("ann..b@example.com")).toBe(false);
    expect(emailOk("ann@-example.com")).toBe(false);
  });
  it("checks selects, numbers, dates and lengths", () => {
    const sel = FormDef.parse({ name: "x", success: "y", fields: [{ key: "a", label: "A", type: "select", options: ["One"] }] }).fields[0]!;
    expect(checkField(sel, "One", "GB")).toEqual({ value: "One" });
    expect(checkField(sel, "Two", "GB").problem).toBe("invalid");
    const num = { key: "n", label: "Guests", type: "number", required: true, min: 1, max: 10, full: false } as const;
    expect(checkField(num, "4", "GB")).toEqual({ value: "4" });
    expect(checkField(num, "11", "GB").problem).toBe("invalid");
    expect(checkField(num, "", "GB").problem).toBe("required");
    expect(checkField({ ...num, type: "text", required: false }, "x".repeat(301), "GB").problem).toBe("too_long");
    expect(checkField({ ...num, type: "date" }, "2026-13-45", "GB").problem).toBe("invalid");
  });
  it("keeps only defined keys and strips control characters", () => {
    const def = FormsDoc.parse(seed).contact!;
    const r = validateForm(def, { name: "Ann\u0007", email: "ann@example.com", message: "Hi\nthere", is_admin: "yes" }, "GB");
    expect(r.ok).toBe(true);
    expect(r.fields).toEqual({ name: "Ann", email: "ann@example.com", message: "Hi\nthere" });
  });
  it("rejects definitions with duplicate keys or selects without options", () => {
    expect(FormDef.safeParse({ name: "x", success: "y", fields: [{ key: "a", label: "A" }, { key: "a", label: "B" }] }).success).toBe(false);
    expect(FormDef.safeParse({ name: "x", success: "y", fields: [{ key: "a", label: "A", type: "select" }] }).success).toBe(false);
  });
  it("ships valid seed definitions", () => {
    expect(FormsDoc.safeParse(seed).success).toBe(true);
  });
});
