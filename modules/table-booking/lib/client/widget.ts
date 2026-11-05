// Browser side of the table-booking section (vanilla). The shared flow lives in booking-core's lib/client/ui.ts.
import { bookingWidget, type WidgetConf } from "../../../booking-core/lib/client/ui.ts";

export type TableWidgetConf = WidgetConf;

export function mountTable(root: HTMLElement) {
  const conf = JSON.parse(root.dataset.conf!) as TableWidgetConf;
  const party = root.querySelector<HTMLSelectElement>('select[name="party"]')!;
  const large = root.querySelector<HTMLElement>("[data-large]")!;
  const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const w = bookingWidget(root, conf, {
    query: () => (party.value === "more" ? "Bigger groups book through an enquiry (see above)." : party.value ? { party: party.value } : "Choose the number of guests."),
    extra: () => ({ party: Number(party.value) }),
  });
  const sync = () => {
    const more = party.value === "more";
    large.hidden = !more;
    submit.disabled = more;
  };
  party.addEventListener("change", () => {
    sync();
    void w.refresh();
  });
  sync();
}
