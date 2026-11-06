// Test-only. Confirms each block the gallery writes passes that module's own schema.
// Not imported by the site, so the browser bundle does not pull module code.
import { z } from "zod";
import cms from "../../../modules/cms/module.ts";
import admin from "../../../modules/admin/module.ts";
import forms from "../../../modules/forms/module.ts";
import menu from "../../../modules/menu/module.ts";
import lists from "../../../modules/content-lists/module.ts";
import booking from "../../../modules/booking-core/module.ts";
import tables from "../../../modules/table-booking/module.ts";
import spaces from "../../../modules/space-booking/module.ts";
import plans from "../../../modules/meal-plans/module.ts";
import whatsapp from "../../../modules/whatsapp/module.ts";

const SCHEMAS: Record<string, z.ZodType | undefined> = {
  cms: cms.config,
  admin: admin.config,
  forms: forms.config,
  menu: menu.config,
  "content-lists": lists.config,
  "booking-core": booking.config,
  "table-booking": tables.config,
  "space-booking": spaces.config,
  "meal-plans": plans.config,
  whatsapp: whatsapp.config,
};

export function moduleErrors(modules: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const [name, value] of Object.entries(modules)) {
    const schema = SCHEMAS[name];
    if (!schema) {
      errors.push(`modules.${name}: the gallery has no schema check for this module`);
      continue;
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success) errors.push(`modules.${name}:\n${z.prettifyError(parsed.error)}`);
  }
  return errors;
}
