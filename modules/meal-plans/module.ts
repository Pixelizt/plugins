import { defineModule } from "../../kit/module-def.ts";
import meta from "./module.json";
import { MealPlansConfig, MealPlansDoc } from "./lib/schema.ts";

export default defineModule({
  ...meta,
  config: MealPlansConfig,
  docs: {
    meal_plans: { schema: MealPlansDoc, label: "Meal plans", group: "Content" },
  },
});
