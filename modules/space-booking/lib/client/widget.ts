// Browser side of the space-booking section (vanilla). The shared flow lives in booking-core's lib/client/ui.ts.
import { bookingWidget, type WidgetConf } from "../../../booking-core/lib/client/ui.ts";

export type SpaceWidgetConf = WidgetConf & {
  spaces: { id: string; capacity: number; min_guests: number; durations: { value: number; label: string }[] }[];
};

export function mountSpace(root: HTMLElement) {
  const conf = JSON.parse(root.dataset.conf!) as SpaceWidgetConf;
  const form = root.querySelector<HTMLFormElement>("form[data-booking-form]")!;
  const duration = form.querySelector<HTMLSelectElement>('select[name="duration"]')!;
  const guests = form.querySelector<HTMLInputElement>('input[name="party"]')!;
  const guestsError = document.getElementById(`${conf.prefix}-party-error`);
  const occasion = form.querySelector<HTMLSelectElement>('select[name="occasion"]');
  const chosen = () => conf.spaces.find((s) => s.id === form.querySelector<HTMLInputElement>('input[name="space"]:checked')?.value);

  const guestsProblem = () => {
    const s = chosen();
    const n = Number(guests.value);
    if (!s) return "";
    if (!guests.value) return "Please enter the number of guests.";
    if (!Number.isInteger(n) || n < s.min_guests) return `Please enter at least ${s.min_guests}.`;
    if (n > s.capacity) return `This space holds up to ${s.capacity} guests. For a bigger group, please send us an enquiry.`;
    return "";
  };
  const markGuests = () => {
    const p = guestsProblem();
    guests.setAttribute("aria-invalid", p ? "true" : "false");
    if (guestsError) guestsError.textContent = p;
    return !p;
  };

  // the guest count is checked before the shared submit handler runs (registered first, capture phase)
  form.addEventListener("submit", (e) => {
    if (!markGuests()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      guests.focus();
    }
  }, { capture: true });

  const w = bookingWidget(root, conf, {
    query: () => {
      const s = chosen();
      if (!s) return "Choose a space.";
      return { space: s.id, duration: duration.value };
    },
    extra: () => ({
      space: chosen()?.id,
      duration: Number(duration.value),
      party: guests.value,
      occasion: occasion?.value ?? "",
      addons: [...form.querySelectorAll<HTMLInputElement>('input[name="addons"]:checked')].map((x) => x.value),
    }),
  });

  const fillSpace = () => {
    const s = chosen();
    if (!s) return;
    const keep = Number(duration.value);
    duration.replaceChildren(...s.durations.map((d) => new Option(d.label, String(d.value), false, d.value === keep)));
    guests.min = String(s.min_guests);
    guests.max = String(s.capacity);
    if (guests.value) markGuests();
  };
  for (const r of form.querySelectorAll<HTMLInputElement>('input[name="space"]')) r.addEventListener("change", () => { fillSpace(); void w.refresh(); });
  duration.addEventListener("change", () => void w.refresh());
  guests.addEventListener("blur", markGuests);
  fillSpace();
}
