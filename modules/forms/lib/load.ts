// The site's form definitions, bundled at build from src/content/forms.json and validated.
// Not CMS-editable in v0.1: the server must validate against exactly what the page shows.
import { z } from "zod";
import raw from "../../../content/forms.json";
import { FormsDoc } from "./schema.ts";

const parsed = FormsDoc.safeParse(raw);
if (!parsed.success) throw new Error(`src/content/forms.json is invalid:\n${z.prettifyError(parsed.error)}`);
export const forms = parsed.data;
