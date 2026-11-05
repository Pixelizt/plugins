import { defineModule } from "../../kit/module-def.ts";
import meta from "./module.json";
import { ListsConfig, listSchemas } from "./lib/schema.ts";

const doc = (key: keyof typeof listSchemas, label: string) => ({
  schema: listSchemas[key].meta({ label }),
  label,
  group: "Content",
  // only lists enabled in client.yaml → modules.content-lists.enabled appear in the admin
  when: (c: { enabled: string[] }) => c.enabled.includes(key),
});

export default defineModule({
  ...meta,
  config: ListsConfig,
  docs: {
    events: doc("events", "Events"),
    offers: doc("offers", "Offers"),
    faqs: doc("faqs", "FAQs"),
    reviews: doc("reviews", "Reviews"),
    gallery: doc("gallery", "Gallery"),
    posts: doc("posts", "Blog posts"),
  },
});
