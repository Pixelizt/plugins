// The "meal-plans" quote hook for the forms pipeline (modules/forms/lib/hooks.ts). Ported from the reference project's
// plan-quote.js and the subscription branch of api/submit.js.
//
// The browser sends only its picks. This prices them again with the engine, from the server's own menu, config and
// set menus (rule 8): every name and every amount stored or emailed comes from here, never from the request.
// When the picks can't be priced, the enquiry is still saved, marked "price to confirm" for the team, and the
// customer gets the form's fixed wording only (rule 9).
import type { EmailBlock, FormHook, QuoteOutcome } from "../../forms/lib/hooks.ts";
import { isConfigured } from "../lib/schema.ts";
import { todayIn } from "../../../kit/lib/time.ts";
import { formatMinor, minorDigits } from "../../../kit/lib/money.ts";
import { formatDate, lengthText, mealsText, planFacts, planName, planText, priceRows, quotePlan, weekLines } from "../lib/engine.ts";
import type { LoadedPlans } from "../lib/load.ts";

export const HOOK_NAME = "meal-plans";
/** Stable sheet columns (rule 17): the same keys whether or not the plan could be priced. */
export const SHEET_COLUMNS = ["plan_name", "plan_meals", "plan_length", "plan_first_day", "plan_last_day", "plan_total"] as const;

const MAX_ECHO = 4000;

export function createPlanHook(load: () => Promise<Pick<LoadedPlans, "conf" | "items" | "sets" | "currency" | "locale" | "copy">>): FormHook {
  return {
    name: HOOK_NAME,
    async quote(input, ctx): Promise<QuoteOutcome> {
      const data = await load();
      const field = data.conf.plan_field;
      const sent = (ctx.fields[field] ?? "").slice(0, MAX_ECHO);
      const blankSheet = Object.fromEntries(SHEET_COLUMNS.map((k) => [k, ""])) as Record<(typeof SHEET_COLUMNS)[number], string>;
      // The customer's own text is kept for the team only, clearly marked as unchecked. Never for the customer.
      const unchecked = (reason: string): QuoteOutcome => ({
        error: reason,
        fields: { [field]: `PRICE TO CONFIRM (${reason}).\nThe plan as the customer's page described it, NOT checked by the website:\n\n${sent || "(empty)"}` },
        sheet: { ...blankSheet, plan_total: "to confirm" },
      });

      if (!isConfigured(data.conf)) return unchecked("meal plans are not set up in client.yaml");
      if (input === undefined || input === null) return unchecked("no plan picks were sent (an old page, or no JavaScript)");
      const r = quotePlan(input, data, todayIn(ctx.cfg.client.timezone, ctx.now));
      if (!r.ok) return unchecked(r.problems.map((p) => p.message).join("; "));
      const q = r.quote;
      if (!q.price) return unchecked(q.problems.map((p) => p.message).join("; "));

      const money = (n: number) => formatMinor(n, data.currency, data.locale);
      const digits = minorDigits(data.currency);
      const total = money(q.price.total);
      const name = planName(q);
      const facts = planFacts(q, data.locale);
      const prices = priceRows(q.price, data.currency, data.locale, q.dates.length);
      const week: EmailBlock[] = weekLines(q, data.currency, data.locale).map((d) => ({ heading: d.day, rows: d.meals }));

      const shown = (input as { shown_total?: unknown }).shown_total;
      const teamNote =
        typeof shown === "number" && shown !== q.price.total
          ? `The page showed ${money(shown)} when this was sent; the website re-priced it at ${total} from the current menu (the menu changed, or the page was old). The customer was emailed ${total}.`
          : undefined;

      return {
        delivery: `priced ${total}`,
        subjectTag: `${name}, ${total}`,
        fields: { [field]: planText(q, data) },
        sheet: {
          plan_name: name,
          plan_meals: mealsText(q),
          plan_length: lengthText(q),
          plan_first_day: q.start.chosen ? q.dates[0]! : `not chosen (priced from ${q.dates[0]})`,
          plan_last_day: q.dates[q.dates.length - 1]!,
          // a plain number in major units, so the sheet can sort and total it
          plan_total: (q.price.total / 10 ** digits).toFixed(digits),
        },
        ...(teamNote ? { teamNote } : {}),
        teamBlocks: [
          { lines: [`No payment has been taken. Contact the customer to confirm the plan, the start date and payment.`] },
          { heading: "Plan", rows: facts },
          { heading: "Price", rows: prices },
          ...week,
        ],
        // server data only: menu names, config labels, dates and amounts worked out here (rule 9)
        customerBlocks: [
          { heading: "Your plan", rows: facts },
          { heading: "Price", rows: prices },
          ...week,
          { lines: [...(q.unpicked ? [`Some "of your choice" items are still to choose; we'll ask you. The price stays the same.`] : []), ...(q.start.chosen ? [] : [`You haven't picked a start date yet, so the price is worked out from ${formatDate(q.dates[0]!, data.locale)}.`]), data.copy.payment_note] },
        ],
      };
    },
  };
}
