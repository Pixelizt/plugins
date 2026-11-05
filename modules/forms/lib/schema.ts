// Form definitions (src/content/forms.json) and this module's client.yaml block. Pure.
import { z } from "zod";

export const FIELD_TYPES = ["text", "textarea", "email", "tel", "number", "date", "time", "select", "checkbox", "url"] as const;

export const FieldDef = z.strictObject({
  // stable key: sheet column, stored JSON key, admin column. NEVER rename once data exists (rule 17)
  key: z.string().regex(/^[a-z][a-z0-9_]*$/, "snake_case key"),
  label: z.string().min(1),
  type: z.enum(FIELD_TYPES).default("text"),
  required: z.boolean().default(false),
  options: z.array(z.string().min(1)).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  placeholder: z.string().optional(),
  autocomplete: z.string().optional(),
  full: z.boolean().default(false), // spans the full row in two-column layouts
});

export const FormDef = z
  .strictObject({
    name: z.string().min(1), // "Contact": sheet tab, team email, admin filter
    submit: z.string().default("Send"),
    success: z.string().min(1), // shown after sending
    note: z.string().optional(), // small print under the form
    subject_from: z.string().optional(), // field key whose value tags the team email subject
    team_next_step: z.string().default("Reply to the customer."),
    // Customer confirmation: fixed wording only, never echoes what the visitor typed (rule 9).
    // Say what the request is NOT (rule 18), e.g. "This doesn't confirm your booking yet."
    customer_email: z.strictObject({ subject: z.string().min(1), heading: z.string().min(1), body: z.array(z.string().min(1)).min(1) }).optional(),
    // Name of a quote hook (src/modules/<m>/form-hooks.ts) that re-works this form's request on the server,
    // e.g. "meal-plans" re-prices a plan. See lib/hooks.ts.
    quote: z.string().regex(/^[a-z][a-z0-9-]*$/).optional(),
    fields: z.array(FieldDef).min(1),
  })
  .superRefine((f, ctx) => {
    const keys = f.fields.map((x) => x.key);
    keys.forEach((k, i) => keys.indexOf(k) !== i && ctx.addIssue({ code: "custom", message: `duplicate field key "${k}"` }));
    f.fields.forEach((x) => x.type === "select" && !x.options?.length && ctx.addIssue({ code: "custom", message: `select "${x.key}" needs options` }));
    if (f.subject_from && !keys.includes(f.subject_from)) ctx.addIssue({ code: "custom", message: `subject_from "${f.subject_from}" is not a field` });
  });

export const FormsDoc = z.record(z.string().regex(/^[a-z][a-z0-9-]*$/), FormDef);

export const FormsConfig = z
  .strictObject({
    phone_region: z.string().regex(/^[A-Z]{2}$/, "ISO country code like GB").default("GB"),
    retention_days: z.number().int().min(1).max(3650).default(100), // D17; must match the privacy policy
    rate_limit: z.strictObject({ max: z.number().int().min(1).default(5), window_minutes: z.number().int().min(1).default(10) }).default({ max: 5, window_minutes: 10 }),
    sheets: z.boolean().default(false), // D18
    forms: z.array(z.string()).default(["contact"]), // which definitions in forms.json are live
  })
  .default({ phone_region: "GB", retention_days: 100, rate_limit: { max: 5, window_minutes: 10 }, sheets: false, forms: ["contact"] });

export type FieldDef = z.infer<typeof FieldDef>;
export type FormDef = z.infer<typeof FormDef>;
export type FormsConfig = z.infer<typeof FormsConfig>;
