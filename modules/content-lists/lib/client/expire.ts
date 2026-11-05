// Pages are static, and a rebuild may be days away. This runs in the browser and applies what has changed since the build:
//  - an offer past its last day removes itself; one whose start day has come appears
//  - an event past its last day moves to "Past events" (newest first, held to data-max), or goes if the page has none
// "Today" is the business's date (data-tz on the list), not the visitor's. Same pure functions the build uses.
import { nowIn, todayIn } from "../../../../kit/lib/time.ts";
import { isPast, offerState } from "../dates.ts";

const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));

function offers(list: HTMLElement, today: string) {
  for (const el of $$("[data-offer]", list)) {
    const s = offerState({ start: el.dataset.start, end: el.dataset.end }, today);
    if (s === "expired") el.remove();
    else el.hidden = s === "scheduled";
  }
  list.hidden = !$$("[data-offer]:not([hidden])", list).length;
  if (!$$("[data-offer]", list).length) list.remove();
}

function events(list: HTMLElement, now: string) {
  const past = list.querySelector<HTMLElement>("[data-events-past]");
  const pastWrap = list.querySelector<HTMLElement>("[data-events-past-wrap]");
  const upcoming = list.querySelector<HTMLElement>("[data-events-upcoming]");
  let moved = false;
  for (const el of $$("[data-event][data-end]", list)) {
    if (!isPast({ end: el.dataset.end, end_time: el.dataset.endTime }, now)) continue;
    if (!past) {
      el.remove();
      continue;
    }
    $$("[data-upcoming-only]", el).forEach((x) => x.remove());
    el.dataset.past = "";
    el.dataset.ended = el.dataset.end!;
    delete el.dataset.end;
    past.insertBefore(el, past.firstChild);
    moved = true;
  }
  if (past && moved) {
    const ended = (el: HTMLElement) => el.dataset.ended ?? "";
    const max = Number(past.dataset.max) || 0;
    const cards = Array.from(past.children) as HTMLElement[];
    cards.sort((a, b) => (ended(b) < ended(a) ? -1 : ended(b) > ended(a) ? 1 : 0));
    cards.forEach((el, i) => (i < max ? past.appendChild(el) : el.remove()));
  }
  if (pastWrap && past) pastWrap.hidden = !past.children.length;
  if (upcoming && !$$("[data-event]", upcoming).length) upcoming.remove();
  // nothing left at all: the whole section goes, no empty heading
  if (!$$("[data-event]", list).length) list.remove();
}

for (const list of $$("[data-kit-list]")) {
  const tz = list.dataset.tz || "UTC";
  if (list.dataset.kitList === "offers") offers(list, todayIn(tz, new Date()));
  else if (list.dataset.kitList === "events") events(list, nowIn(tz, new Date()));
}
