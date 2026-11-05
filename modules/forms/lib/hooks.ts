// Quote hooks: the one extension point of the submission pipeline. Types only (pure).
//
// A form definition can name a hook (`"quote": "meal-plans"`). Any installed module can provide hooks in
// src/modules/<m>/form-hooks.ts (default export: one hook or an array). On submit, after validation and the rate
// limit and before the save, the pipeline calls hook.quote(body.quote, ctx). The hook re-works whatever the browser
// claimed (a price, a plan…) from the SERVER's own data (rule 8) and returns what to store and email instead.
//
// Contract for hook authors:
// - `customerBlocks` go into the customer's email: server-generated data only, never text the visitor typed (rule 9).
// - Throwing is allowed: it is recorded as `delivery.quote = "error: …"` and treated like an { error } outcome.
// - The enquiry is always saved, whatever the hook answers. A hook can't reject a submission.
import type { ClientConfig } from "../../../kit/config/schema.ts";
import type { FormDef } from "./schema.ts";

/** A block of an email: optional heading, label/value rows, then plain lines. Everything is escaped. */
export interface EmailBlock {
  heading?: string;
  rows?: [string, string][];
  lines?: string[];
}

export interface QuoteContext {
  cfg: ClientConfig;
  formId: string;
  def: FormDef;
  /** The validated fields (a copy: change them through `fields` in the outcome). */
  fields: Record<string, string>;
  now: Date;
  env: Record<string, string | undefined>;
}

/** Common to both outcomes. Unknown field keys (not in the form) are ignored; "" removes a field. */
interface OutcomeBase {
  fields?: Record<string, string>;
  /** Extra Google Sheet columns for this row (form tab and "All"). Keep the keys stable (rule 17). */
  sheet?: Record<string, string>;
}

export interface QuoteOk extends OutcomeBase {
  /** One line for the dashboard's delivery column, e.g. "priced USD 120.00". */
  delivery: string;
  /** Replaces the subject tag of the team email, e.g. the plan name. */
  subjectTag?: string;
  teamBlocks?: EmailBlock[];
  /** Server-generated only (rule 9). Added to the customer email when the form has one. */
  customerBlocks?: EmailBlock[];
  /** A highlighted line for the team, e.g. "the page showed a different price". */
  teamNote?: string;
}

export interface QuoteError extends OutcomeBase {
  /** Why the server could not price it. Recorded as "price to confirm: <error>" and shown to the team. */
  error: string;
}

export type QuoteOutcome = QuoteOk | QuoteError;

export interface FormHook {
  /** Referenced by a form definition's `quote`. */
  name: string;
  quote(input: unknown, ctx: QuoteContext): QuoteOutcome | Promise<QuoteOutcome>;
}

export const isQuoteError = (o: QuoteOutcome): o is QuoteError => typeof (o as QuoteError).error === "string";
