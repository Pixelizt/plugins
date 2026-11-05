// One validation rule for the browser and the server (rule 1). Pure.
import { isValidPhoneNumber, type CountryCode } from "libphonenumber-js/min";
import { HM_24, isIsoDate } from "../../../kit/lib/time.ts";
import type { FieldDef, FormDef } from "./schema.ts";

const MAX_TEXT = 300;
const MAX_AREA = 4000;

/** Arabic-Indic and Persian digits → ASCII, so a number typed on another keyboard still validates. */
export const asciiDigits = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

export function phoneOk(v: string, region: string): boolean {
  const s = asciiDigits(v).trim();
  if (!/^\+?[0-9(][0-9\s().-]*[0-9]$/.test(s) || s.length > 30) return false;
  const n = s.replace(/\D/g, "");
  if (/^(\d)\1+$/.test(n)) return false;
  return isValidPhoneNumber(s.replace(/^00/, "+"), region as CountryCode);
}

const COM_TYPO = /\.(con|cmo|ocm|comm|cm)$/i;
export function emailOk(v: string): boolean {
  const s = String(v ?? "").trim();
  if (s.length > 254 || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}$/.test(s)) return false;
  const [local, domain] = s.split("@") as [string, string];
  if (/^\.|\.$|\.\./.test(local) || /(^|\.)-|-(\.|$)/.test(domain)) return false;
  return !COM_TYPO.test(domain);
}

export type Problem = "required" | "invalid" | "too_long";

export function checkField(f: FieldDef, raw: unknown, region: string): { value?: string; problem?: Problem } {
  let v = typeof raw === "number" ? String(raw) : typeof raw === "boolean" ? (raw ? "yes" : "") : typeof raw === "string" ? raw : "";
  // control characters out (keep newlines in textareas)
  v = v.replace(f.type === "textarea" ? /[\u0000-\u0008\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, " ").trim();
  if (f.type === "checkbox") v = v && v !== "false" && v !== "off" ? "yes" : "";
  if (!v) return f.required ? { problem: "required" } : {};
  if (v.length > (f.type === "textarea" ? MAX_AREA : MAX_TEXT)) return { problem: "too_long" };
  const ok = (() => {
    switch (f.type) {
      case "email": return emailOk(v);
      case "tel": return phoneOk(v, region);
      case "url": return /^https?:\/\/[^\s]+$/i.test(v);
      case "date": return isIsoDate(v);
      case "time": return HM_24.test(v);
      case "number": {
        const n = Number(asciiDigits(v));
        return /^\d{1,6}$/.test(asciiDigits(v)) && (f.min === undefined || n >= f.min) && (f.max === undefined || n <= f.max);
      }
      case "select": return (f.options ?? []).includes(v);
      default: return true;
    }
  })();
  if (!ok) return { problem: "invalid" };
  return { value: f.type === "number" ? String(Number(asciiDigits(v))) : v };
}

/** Only keys the form defines are kept; anything else in the input is dropped. */
export function validateForm(def: FormDef, input: Record<string, unknown>, region: string) {
  const fields: Record<string, string> = {};
  const problems: Record<string, Problem> = {};
  for (const f of def.fields) {
    const r = checkField(f, Object.hasOwn(input, f.key) ? input[f.key] : "", region);
    if (r.problem) problems[f.key] = r.problem;
    else if (r.value !== undefined) fields[f.key] = r.value;
  }
  return { fields, problems, ok: Object.keys(problems).length === 0 };
}

export const MESSAGES: Record<Problem, (f: FieldDef) => string> = {
  required: (f) => `Please fill in ${f.label.toLowerCase()}.`,
  too_long: () => "That's too long.",
  invalid: (f) =>
    f.type === "email" ? "Please check the email address." :
    f.type === "tel" ? "Please check the phone number (include the country code if it's not local)." :
    f.type === "select" ? "Please choose one of the options." :
    f.type === "number" ? `Please enter a number${f.min !== undefined ? ` from ${f.min}` : ""}${f.max !== undefined ? ` to ${f.max}` : ""}.` :
    "Please check this field.",
};
