// The browser side shared by the booking widgets (vanilla, bundled by Astro: strict CSP, no inline scripts).
// Data comes from data-* attributes; rules come from the same libs the server uses (rule 1).
import type { FieldDef } from "../../../forms/lib/schema.ts";
import { detailFields } from "../schema.ts";
import { addDays, todayIn } from "../../../../kit/lib/time.ts";

export interface WidgetConf {
  type: "table" | "space";
  prefix: string;
  tz: string;
  region: string;
  phoneRequired: boolean;
  maxDaysAhead: number;
  copy: { confirmed: string; pending: string };
}

export interface WidgetHooks {
  /** Extra availability params (party, space, duration…), or a message saying what to choose first. */
  query(): Record<string, string> | string;
  /** Extra booking payload. */
  extra(): Record<string, unknown>;
}

// the phone validator carries number data (~45 kB gz): load it on first interaction, like the forms module
let validator: Promise<typeof import("../../../forms/lib/validate.ts")> | null = null;
const loadValidator = () => (validator ??= import("../../../forms/lib/validate.ts"));

const smooth = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth") as ScrollBehavior;

export function bookingWidget(root: HTMLElement, conf: WidgetConf, hooks: WidgetHooks) {
  const form = root.querySelector<HTMLFormElement>("form[data-booking-form]")!;
  const done = root.querySelector<HTMLElement>("[data-booking-done]")!;
  const fallback = root.querySelector<HTMLElement>("[data-booking-fallback]");
  const date = form.querySelector<HTMLInputElement>('input[name="date"]')!;
  const list = form.querySelector<HTMLElement>("[data-time-list]")!;
  const tpl = form.querySelector<HTMLTemplateElement>("template[data-time-tpl]")!;
  const timesStatus = form.querySelector<HTMLElement>("[data-times-status]")!;
  const timeError = document.getElementById(`${conf.prefix}-time-error`);
  const status = form.querySelector<HTMLElement>("[data-status]")!;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const fields: FieldDef[] = detailFields({ phoneRequired: conf.phoneRequired });

  // JS is on: swap the static fallback ("call us") for the widget
  form.hidden = false;
  if (fallback) fallback.hidden = true;
  const today = todayIn(conf.tz, Date.now());
  date.min = today;
  date.max = addDays(today, conf.maxDaysAhead);

  let pending: AbortController | null = null;
  const refresh = async () => {
    pending?.abort();
    list.replaceChildren();
    if (timeError) timeError.textContent = "";
    if (!date.value) { timesStatus.textContent = "Choose a date first."; return; }
    const q = hooks.query();
    if (typeof q === "string") { timesStatus.textContent = q; return; }
    const ctrl = (pending = new AbortController());
    timesStatus.textContent = "Checking free times…";
    try {
      const params = new URLSearchParams({ type: conf.type, date: date.value, ...q });
      const res = await fetch(`/api/bookings/availability?${params}`, { signal: ctrl.signal });
      const out = (await res.json()) as { ok: boolean; slots?: { time: string }[]; message?: string; error?: string };
      if (ctrl.signal.aborted) return;
      if (!out.ok) { timesStatus.textContent = out.error ?? "Couldn't check free times. Please try again."; return; }
      const slots = out.slots ?? [];
      if (!slots.length) { timesStatus.textContent = out.message ?? "No free times that day. Please try another date."; return; }
      for (const s of slots) {
        const node = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
        const radio = node.querySelector("input")!;
        radio.value = s.time;
        radio.id = `${conf.prefix}-t-${s.time.replace(":", "")}`;
        node.querySelector("span")!.textContent = s.time;
        list.append(node);
      }
      timesStatus.textContent = `${slots.length} free ${slots.length === 1 ? "time" : "times"}. Choose one.`;
    } catch (e) {
      if ((e as Error).name !== "AbortError") timesStatus.textContent = "Couldn't check free times. Check your connection and try again.";
    }
  };

  const markField = (f: FieldDef, msg: string) => {
    const el = form.elements.namedItem(f.key) as HTMLElement | null;
    el?.setAttribute("aria-invalid", msg ? "true" : "false");
    const note = document.getElementById(`${conf.prefix}-${f.key}-error`);
    if (note) note.textContent = msg;
  };
  const value = (key: string) => (form.elements.namedItem(key) as HTMLInputElement | null)?.value ?? "";
  const check = async (f: FieldDef) => {
    const { checkField, MESSAGES } = await loadValidator();
    const r = checkField(f, value(f.key), conf.region);
    markField(f, r.problem ? MESSAGES[r.problem](f) : "");
    return !r.problem;
  };
  form.addEventListener("focusin", () => void loadValidator(), { once: true });
  for (const f of fields) (form.elements.namedItem(f.key) as HTMLElement | null)?.addEventListener("blur", () => void check(f));
  date.addEventListener("change", () => void refresh());

  const focusOn = (el: HTMLElement | null) => {
    el?.scrollIntoView({ behavior: smooth(), block: "center" });
    el?.focus({ preventScroll: true });
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "";
    const time = form.querySelector<HTMLInputElement>('input[name="time"]:checked')?.value ?? "";
    const ok = await Promise.all(fields.map(check));
    if (!date.value || !time) {
      if (timeError) timeError.textContent = date.value ? "Please choose a time." : "Please choose a date and a time.";
      focusOn(date.value ? list.querySelector("input") ?? date : date);
      return;
    }
    const bad = fields.find((_, i) => !ok[i]);
    if (bad) return focusOn(form.elements.namedItem(bad.key) as HTMLElement | null);
    const payload = {
      type: conf.type, date: date.value, time, ...hooks.extra(),
      details: Object.fromEntries(fields.map((f) => [f.key, value(f.key)])),
      _gotcha: value("_gotcha"),
    };
    button.disabled = true;
    status.textContent = "Booking…";
    try {
      const res = await fetch("/api/bookings/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const out = (await res.json()) as { ok: boolean; status?: string; reference?: string; error?: string; code?: string; fields?: Record<string, string>; enquiry?: string };
      if (out.ok) {
        form.hidden = true;
        done.hidden = false;
        done.querySelector("[data-done-text]")!.textContent = out.status === "confirmed" ? conf.copy.confirmed : conf.copy.pending;
        const ref = done.querySelector<HTMLElement>("[data-done-ref]");
        if (ref) ref.textContent = out.reference ? `Your reference: ${out.reference}` : "";
        done.scrollIntoView({ behavior: smooth(), block: "center" });
        done.focus({ preventScroll: true });
        return;
      }
      if (out.fields) {
        const { MESSAGES } = await loadValidator();
        for (const [k, p] of Object.entries(out.fields)) {
          const f = fields.find((x) => x.key === k);
          if (f) markField(f, MESSAGES[p as keyof typeof MESSAGES](f));
        }
      }
      status.textContent = out.error ?? "Something went wrong. Please try again.";
      if (out.code === "full" || out.code === "unavailable") await refresh();
    } catch {
      status.textContent = "Couldn't send. Check your connection and try again.";
    } finally {
      button.disabled = false;
    }
  });

  return { refresh };
}
