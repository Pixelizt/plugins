// Picked up by the forms module (src/modules/*/form-hooks.ts). A form definition with "quote": "meal-plans"
// gets its plan re-priced here on submit. See server/quote.ts.
import { createPlanHook } from "./server/quote.ts";
import { loadPlanData } from "./lib/load.ts";

export default createPlanHook(loadPlanData);
