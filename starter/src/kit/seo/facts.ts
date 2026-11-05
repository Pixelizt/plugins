// Factual highlights from client.yaml. Empty fields disappear. Nothing here is invented.
import type { ClientConfig } from "../config/schema.ts";

export type Highlights = ClientConfig["highlights"];

export interface FactLine { label: string; text: string }

/** Lines worth showing. Blank parking, empty lists and empty "other" rows are dropped. */
export function factLines(h: Highlights): FactLine[] {
  const lines: FactLine[] = [];
  for (const a of h.awards) {
    const text = [a.year, a.by].filter(Boolean).join(", ");
    lines.push({ label: "Award", text: text ? `${a.name} (${text})` : a.name });
  }
  if (h.specialties.length) lines.push({ label: "Known for", text: h.specialties.join(", ") });
  if (h.dietary.length) lines.push({ label: "Dietary options", text: h.dietary.join(", ") });
  if (h.ambience.length) lines.push({ label: "Ambience", text: h.ambience.join(", ") });
  if (h.parking.trim()) lines.push({ label: "Parking", text: h.parking.trim() });
  for (const o of h.other) lines.push({ label: o.label, text: o.text });
  return lines;
}

/** FAQ entries only for facts the client actually filled in. */
export function factFaqs(h: Highlights): { q: string; a: string }[] {
  const faqs: { q: string; a: string }[] = [];
  if (h.specialties.length) faqs.push({ q: "What is this place known for?", a: h.specialties.join(", ") });
  if (h.dietary.length) faqs.push({ q: "What dietary options are offered?", a: h.dietary.join(", ") });
  if (h.parking.trim()) faqs.push({ q: "Is there parking?", a: h.parking.trim() });
  if (h.ambience.length) faqs.push({ q: "What is the atmosphere like?", a: h.ambience.join(", ") });
  if (h.awards.length) {
    const a = h.awards.map((award) => {
      const extra = [award.year, award.by].filter(Boolean).join(", ");
      return extra ? `${award.name} (${extra})` : award.name;
    });
    faqs.push({ q: "Which awards has the business received?", a: a.join("; ") });
  }
  return faqs;
}
