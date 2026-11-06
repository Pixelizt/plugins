import {
  BUSINESS_TYPES,
  MOTION_LEVELS,
  RADII,
  SHADOWS,
  TIERS,
  buildBrief,
  contrastWarnings,
  fieldErrors,
  slugify,
  type BriefInput,
  type BusinessType,
  type ListName,
} from "../lib/brief.ts";

const STEP_FIELDS: Record<number, string[]> = {
  1: ["name", "slug", "type", "vibe"],
  2: ["domain", "email", "phone", "address", "timezone", "currency", "phoneRegion", "hoursWeekday", "hoursWeekend", "instagram", "staffEmail"],
  3: ["fonts", "color-primary", "color-secondary", "color-accent", "color-background", "color-foreground", "color-muted"],
  4: ["lists"],
  5: [],
};

function value(form: HTMLFormElement, name: string): string {
  const field = form.elements.namedItem(name);
  if (field instanceof RadioNodeList) return field.value;
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) return field.value;
  return "";
}

function checked(form: HTMLFormElement, name: string, expected: string): boolean {
  return [...form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)].some((input) => input.checked && input.value === expected);
}

function checkedValues(form: HTMLFormElement, name: string): string[] {
  return [...form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)].filter((input) => input.checked).map((input) => input.value);
}

function colorsFrom(form: HTMLFormElement): BriefInput["colors"] {
  const read = (key: keyof BriefInput["colors"]) => value(form, key).trim();
  return {
    primary: read("primary"),
    secondary: read("secondary"),
    accent: read("accent"),
    background: read("background"),
    foreground: read("foreground"),
    muted: read("muted"),
  };
}

function oneOf<T extends string>(list: readonly T[], value: string, fallback: T): T {
  return (list as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function readBrief(form: HTMLFormElement): BriefInput {
  const font = form.querySelector<HTMLInputElement>('input[name="fonts"]:checked');
  const region = value(form, "phoneRegion");
  const phoneRegion = region === "OTHER" ? value(form, "phoneRegionOther").trim().toUpperCase() : region.trim().toUpperCase();
  const listsOn = checked(form, "module", "content-lists");
  return {
    name: value(form, "name").trim(),
    slug: value(form, "slug").trim(),
    domain: value(form, "domain").trim(),
    domainPending: checked(form, "domainPending", "on") || form.querySelector<HTMLInputElement>('input[name="domainPending"]')?.checked === true,
    type: oneOf(BUSINESS_TYPES, value(form, "type"), "" as BusinessType),
    vibe: value(form, "vibe").trim(),
    currency: value(form, "currency").trim().toUpperCase(),
    timezone: value(form, "timezone").trim(),
    email: value(form, "email").trim(),
    phone: value(form, "phone").trim(),
    whatsapp: value(form, "whatsapp").trim(),
    address: value(form, "address").trim(),
    hoursWeekday: value(form, "hoursWeekday").trim(),
    hoursWeekend: value(form, "hoursWeekend").trim(),
    instagram: value(form, "instagram").trim(),
    specialties: value(form, "specialties").trim(),
    staffEmail: value(form, "staffEmail").trim(),
    phoneRegion,
    colors: colorsFrom(form),
    headingFont: font?.dataset.heading ?? "",
    bodyFont: font?.dataset.body ?? "",
    radius: oneOf(RADII, value(form, "radius"), "md"),
    shadow: oneOf(SHADOWS, value(form, "shadow"), "soft"),
    motion: oneOf(MOTION_LEVELS, value(form, "motion"), "expressive"),
    tier: oneOf(TIERS, value(form, "tier"), "free"),
    menu: checked(form, "module", "menu") || checked(form, "module", "meal-plans"),
    menuTags: checkedValues(form, "menuTag"),
    listsOn,
    lists: (listsOn ? checkedValues(form, "list") : []) as ListName[],
    tableBooking: checked(form, "module", "table-booking"),
    spaceBooking: checked(form, "module", "space-booking"),
    mealPlans: checked(form, "module", "meal-plans"),
    whatsappAlerts: checked(form, "module", "whatsapp"),
  };
}

function showErrors(form: HTMLFormElement, errors: Record<string, string>, fields: string[]) {
  let first: HTMLElement | null = null;
  for (const name of fields) {
    const slot = form.querySelector<HTMLElement>(`[data-error-for="${name}"]`);
    const message = errors[name] ?? "";
    if (slot) slot.textContent = message;
    const control = form.querySelector<HTMLElement>(`[name="${name}"]`);
    if (control) control.setAttribute("aria-invalid", message ? "true" : "false");
    if (message && !first) first = control ?? slot;
  }
  first?.focus();
  return fields.some((name) => errors[name]);
}

function paintPreview(form: HTMLFormElement) {
  const preview = document.querySelector<HTMLElement>("#look-preview");
  const button = document.querySelector<HTMLElement>("#look-preview-btn");
  const note = document.querySelector<HTMLElement>("#contrast-note");
  if (!preview || !button || !note) return;
  const colors = colorsFrom(form);
  preview.style.background = colors.background;
  preview.style.color = colors.foreground;
  button.style.background = colors.primary;
  button.style.color = colors.background;
  const warnings = contrastWarnings({ ...readBrief(form), colors });
  note.hidden = warnings.length === 0;
  note.textContent = warnings.length ? "Some of these colours are hard to read." : "";
}

export function mountStart() {
  const form = document.querySelector<HTMLFormElement>("#brief-form");
  if (!form) return;
  const steps = [...form.querySelectorAll<HTMLElement>("[data-step]")];
  const nav = [...form.querySelectorAll<HTMLButtonElement>("[data-goto]")];
  const name = form.querySelector<HTMLInputElement>('input[name="name"]');
  const slug = form.querySelector<HTMLInputElement>('input[name="slug"]');
  let slugTouched = false;
  let step = location.hash === "#plugins" ? 4 : 1;
  let yaml = "";

  const show = (next: number) => {
    step = next;
    for (const panel of steps) panel.hidden = panel.dataset.step !== String(step);
    for (const button of nav) button.setAttribute("aria-current", button.dataset.goto === String(step) ? "step" : "false");
    document.getElementById("review")?.toggleAttribute("hidden", false);
    document.getElementById("done")?.setAttribute("hidden", "");
  };

  const validateStep = (n: number) => {
    const errors = fieldErrors(readBrief(form));
    return !showErrors(form, errors, STEP_FIELDS[n] ?? []);
  };

  name?.addEventListener("input", () => {
    if (!slug || slugTouched) return;
    slug.value = slugify(name.value);
  });
  slug?.addEventListener("input", () => {
    slugTouched = true;
  });

  const domain = form.querySelector<HTMLInputElement>('input[name="domain"]');
  const pending = form.querySelector<HTMLInputElement>('input[name="domainPending"]');
  pending?.addEventListener("change", () => {
    if (!domain) return;
    domain.disabled = pending.checked;
    if (pending.checked) domain.value = "";
  });

  const region = form.querySelector<HTMLSelectElement>('select[name="phoneRegion"]');
  const regionOther = form.querySelector<HTMLElement>("[data-region-other]");
  region?.addEventListener("change", () => {
    if (regionOther) regionOther.hidden = region.value !== "OTHER";
  });

  for (const button of form.querySelectorAll<HTMLButtonElement>("[data-vibe]")) {
    button.addEventListener("click", () => {
      const vibe = form.querySelector<HTMLInputElement>('input[name="vibe"]');
      if (vibe) vibe.value = button.dataset.vibe ?? "";
    });
  }

  const syncColor = (key: string, hex: string) => {
    const picker = form.querySelector<HTMLInputElement>(`input[data-color="${key}"]`);
    const text = form.querySelector<HTMLInputElement>(`input[data-color-text="${key}"]`);
    if (/^#[0-9a-fA-F]{6}$/.test(hex) && picker) picker.value = hex;
    if (text && text.value !== hex) text.value = hex;
  };
  for (const picker of form.querySelectorAll<HTMLInputElement>("input[data-color]")) {
    picker.addEventListener("input", () => {
      const key = picker.dataset.color ?? "";
      syncColor(key, picker.value);
      paintPreview(form);
    });
  }
  for (const text of form.querySelectorAll<HTMLInputElement>("input[data-color-text]")) {
    text.addEventListener("input", () => {
      const key = text.dataset.colorText ?? "";
      if (/^#[0-9a-fA-F]{6}$/.test(text.value.trim())) syncColor(key, text.value.trim());
      paintPreview(form);
    });
  }
  for (const palette of form.querySelectorAll<HTMLButtonElement>("[data-palette]")) {
    palette.addEventListener("click", () => {
      const colors = JSON.parse(palette.dataset.palette ?? "{}") as Record<string, string>;
      for (const [key, hex] of Object.entries(colors)) syncColor(key, hex);
      for (const button of form.querySelectorAll<HTMLButtonElement>("[data-palette]")) button.setAttribute("aria-pressed", button === palette ? "true" : "false");
      paintPreview(form);
    });
  }

  const menu = form.querySelector<HTMLInputElement>('input[name="module"][value="menu"]');
  const plans = form.querySelector<HTMLInputElement>('input[name="module"][value="meal-plans"]');
  const tables = form.querySelector<HTMLInputElement>('input[name="module"][value="table-booking"]');
  const spaces = form.querySelector<HTMLInputElement>('input[name="module"][value="space-booking"]');
  const lists = form.querySelector<HTMLInputElement>('input[name="module"][value="content-lists"]');
  const dep = document.querySelector<HTMLElement>("#dep-note");
  const syncDeps = () => {
    if (menu && plans) {
      if (plans.checked) {
        menu.checked = true;
        menu.disabled = true;
      } else menu.disabled = false;
    }
    const notes: string[] = [];
    if (tables?.checked || spaces?.checked) notes.push("Table counts and rooms are added later.");
    if (plans?.checked) notes.push("This also turns the menu on.");
    if (dep) dep.textContent = notes.join(" ");
    for (const box of form.querySelectorAll<HTMLInputElement>('input[name="list"]')) box.disabled = !lists?.checked;
  };
  for (const box of form.querySelectorAll<HTMLInputElement>('input[name="module"], input[name="list"]')) box.addEventListener("change", syncDeps);
  syncDeps();

  form.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const goto = target.closest<HTMLButtonElement>("[data-goto]");
    const next = target.closest("[data-next]");
    const back = target.closest("[data-back]");
    if (goto) {
      const dest = Number(goto.dataset.goto);
      if (dest > step) {
        for (let n = step; n < dest; n++) {
          if (!validateStep(n)) {
            show(n);
            return;
          }
        }
      }
      show(dest);
      return;
    }
    if (next) {
      if (validateStep(step)) show(Math.min(5, step + 1));
    }
    if (back) show(Math.max(1, step - 1));
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = readBrief(form);
    const built = buildBrief(input);
    const alert = document.querySelector<HTMLElement>("#form-alert");
    if (!built.ok) {
      if (alert) {
        alert.hidden = false;
        alert.textContent = built.errors.join(" ");
      }
      const errors = fieldErrors(input);
      for (let n = 1; n <= 4; n++) {
        if ((STEP_FIELDS[n] ?? []).some((name) => errors[name])) {
          show(n);
          showErrors(form, errors, STEP_FIELDS[n] ?? []);
          return;
        }
      }
      return;
    }
    if (alert) alert.hidden = true;
    yaml = built.result.yaml;
    const out = document.querySelector<HTMLElement>("#yaml-out");
    if (out) out.textContent = yaml;
    const contrast = document.querySelector<HTMLElement>("#contrast-final");
    if (contrast) {
      contrast.hidden = built.result.warnings.length === 0;
      contrast.textContent = "Some of these colours are hard to read.";
    }
    document.getElementById("review")?.setAttribute("hidden", "");
    document.getElementById("done")?.removeAttribute("hidden");
  });

  document.querySelector("#copy-yaml")?.addEventListener("click", async () => {
    const button = document.querySelector<HTMLButtonElement>("#copy-yaml");
    try {
      await navigator.clipboard.writeText(yaml);
      if (button) button.textContent = "Copied";
    } catch {
      document.querySelector<HTMLElement>("#yaml-out")?.focus();
      if (button) button.textContent = "Select the file and copy";
    }
    window.setTimeout(() => {
      if (button) button.textContent = "Copy";
    }, 1600);
  });

  document.querySelector("#download-yaml")?.addEventListener("click", () => {
    const blob = new Blob([yaml], { type: "application/yaml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "client.yaml";
    link.click();
    URL.revokeObjectURL(url);
  });

  document.querySelector("#edit-brief")?.addEventListener("click", () => show(1));
  show(step);
}
