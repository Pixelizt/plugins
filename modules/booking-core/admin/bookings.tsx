// Admin view "bookings" (module.ts → adminViews): a day/week list with accept / decline / cancel, closures
// ("block a date or time") and manual entry of phone bookings. Reads bookings with the staff member's token
// (RLS: admin + editor); every change goes through the server endpoints, which re-check the role and send emails.
import { useEffect, useMemo, useState } from "react";
import type { AdminViewProps } from "../../admin/app/views.ts";
import { textColumn, toCsv } from "../../admin/lib/csv.ts";
import { addDays, dayBounds, hm, todayIn, zoned } from "../../../kit/lib/time.ts";
import { formatDay } from "../lib/time.ts";
import type { Status } from "../lib/capacity.ts";
import type { TypeInfo } from "../lib/schema.ts";

interface Row {
  id: string; kind: "table" | "space"; resource_id: string; starts_at: string; ends_at: string; party_size: number; status: Status;
  hold_until: string | null; source: string; name: string; email: string | null; phone: string | null; notes: string | null;
  facts: [string, string][]; delivery: Record<string, string>; decided_by: string | null;
}
interface BlockRow { id: number; kind: string | null; resource_id: string | null; starts_at: string; ends_at: string; reason: string; created_by: string | null }
interface Meta { timezone: string; types: TypeInfo[]; scopes: { value: string; label: string }[] }

const COLS = "id,kind,resource_id,starts_at,ends_at,party_size,status,hold_until,source,name,email,phone,notes,facts,delivery,decided_by";
const btn = "rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-50";
const primary = `${btn} bg-primary text-primary-foreground`;
const ghost = `${btn} border border-border`;
const input = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2";
const BADGE: Record<Status, string> = {
  pending: "bg-secondary text-secondary-foreground", confirmed: "bg-primary text-primary-foreground",
  declined: "bg-muted text-muted-text", cancelled: "bg-muted text-muted-text line-through", expired: "bg-muted text-muted-text",
};

export default function BookingsView({ api, session }: AdminViewProps) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [err, setErr] = useState("");
  const [date, setDate] = useState("");
  const [range, setRange] = useState<"day" | "week">("day");
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [panel, setPanel] = useState<"" | "block" | "manual">("");
  const auth = { apikey: api.anon, Authorization: `Bearer ${api.token}` };

  const call = async (path: string, body?: unknown) => {
    const r = await fetch(path, { method: body === undefined ? "GET" : "POST", headers: { ...auth, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const j = await r.json().catch(() => ({ ok: false, error: `Error ${r.status}` }));
    return j as { ok: boolean; error?: string; [k: string]: unknown };
  };

  useEffect(() => {
    call("/api/bookings/meta").then((j) => {
      if (!j.ok) return setErr(j.error ?? "Couldn't load");
      const m = j as unknown as Meta;
      setMeta(m);
      setDate(todayIn(m.timezone, Date.now()));
    }, (e) => setErr((e as Error).message));
  }, []);

  const tz = meta?.timezone ?? "UTC";
  const span = useMemo(() => {
    if (!date) return null;
    const from = dayBounds(date, tz).from;
    const to = dayBounds(addDays(date, range === "day" ? 1 : 7), tz).from;
    return { from, to };
  }, [date, range, tz]);

  const load = async () => {
    if (!span) return;
    setRows(null);
    const f = new Date(span.from).toISOString();
    const t = new Date(span.to).toISOString();
    try {
      const [b, k] = await Promise.all([
        fetch(`${api.url}/rest/v1/bookings?select=${COLS}&starts_at=gte.${encodeURIComponent(f)}&starts_at=lt.${encodeURIComponent(t)}&order=starts_at&limit=2000`, { headers: auth }),
        fetch(`${api.url}/rest/v1/booking_blocks?select=*&starts_at=lt.${encodeURIComponent(t)}&ends_at=gt.${encodeURIComponent(f)}&order=starts_at`, { headers: auth }),
      ]);
      if (!b.ok) throw new Error(`Couldn't load bookings (${b.status})`);
      setRows(await b.json());
      setBlocks(k.ok ? await k.json() : []);
    } catch (e) { setErr((e as Error).message); }
  };
  useEffect(() => { void load(); }, [span?.from, span?.to]);

  const act = async (r: Row, status: "confirmed" | "declined" | "cancelled") => {
    const ask = status === "confirmed" ? null : status === "declined" ? "Decline this request? The customer is emailed." : "Cancel this booking? The customer is emailed.";
    if (ask && !confirm(ask)) return;
    setBusy(r.id);
    const j = await call("/api/bookings/status", { id: r.id, status });
    setBusy("");
    setMsg(j.ok ? `Booking ${status}.${j.email && j.email !== "ok" && j.email !== "none" ? ` Email: ${j.email}` : ""}` : j.error ?? "Failed");
    await load();
  };

  if (err) return <p role="alert">{err}</p>;
  if (!meta || !date) return <p>Loading…</p>;
  const now = Date.now();
  const shown = (rows ?? []).filter((r) => filter === "all" || r.status === "confirmed" || (r.status === "pending" && (!r.hold_until || Date.parse(r.hold_until) > now)) || r.status === "expired");
  const byDay = new Map<string, Row[]>();
  for (const r of shown) {
    const d = zoned(Date.parse(r.starts_at), tz).date;
    byDay.set(d, [...(byDay.get(d) ?? []), r]);
  }
  const time = (iso: string) => hm(zoned(Date.parse(iso), tz).minutes);
  const covers = shown.filter((r) => r.status === "confirmed").reduce((n, r) => n + r.party_size, 0);
  const label = (k: string) => meta.types.find((t) => t.kind === k)?.label ?? k;

  const csv = () => {
    const cols = ["date", "time", "end", "type", "status", "party", "name", "phone", "email", "notes", "details", "reference"].map((k) => textColumn(k, k));
    const flat = shown.map((r) => ({
      date: zoned(Date.parse(r.starts_at), tz).date, time: time(r.starts_at), end: time(r.ends_at), type: label(r.kind), status: r.status, party: String(r.party_size),
      name: r.name, phone: r.phone ?? "", email: r.email ?? "", notes: r.notes ?? "", details: r.facts.map(([k, v]) => `${k}: ${v}`).join("; "), reference: r.id.replace(/-/g, "").slice(0, 8).toUpperCase(),
    }));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([toCsv(flat, cols)], { type: "text/csv" }));
    a.download = `bookings-${date}-${range}.csv`;
    a.click();
  };

  return (
    <div className="max-w-5xl">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <h1 className="me-auto text-2xl font-bold">Bookings</h1>
        <button className={ghost} onClick={() => setDate(addDays(date, range === "day" ? -1 : -7))} aria-label="Earlier">←</button>
        <label className="text-sm">Date<input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={input} /></label>
        <button className={ghost} onClick={() => setDate(addDays(date, range === "day" ? 1 : 7))} aria-label="Later">→</button>
        <button className={ghost} onClick={() => setDate(todayIn(tz, Date.now()))}>Today</button>
        <label className="text-sm">Show<select value={range} onChange={(e) => setRange(e.target.value as "day" | "week")} className={input}><option value="day">Day</option><option value="week">Week</option></select></label>
        <label className="text-sm">Status<select value={filter} onChange={(e) => setFilter(e.target.value as "active" | "all")} className={input}><option value="active">Open and confirmed</option><option value="all">Everything</option></select></label>
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <button className={panel === "manual" ? primary : ghost} onClick={() => setPanel(panel === "manual" ? "" : "manual")}>Add a phone booking</button>
        <button className={panel === "block" ? primary : ghost} onClick={() => setPanel(panel === "block" ? "" : "block")}>Block a date or time</button>
        <button className={ghost} onClick={() => void load()}>Refresh</button>
        <button className={ghost} onClick={csv} disabled={!shown.length}>Download CSV</button>
      </div>
      <p className="mb-4 text-sm" role="status">{msg}</p>
      {panel === "manual" && <ManualForm meta={meta} date={date} call={call} onDone={(m) => { setMsg(m); setPanel(""); void load(); }} />}
      {panel === "block" && <BlockForm meta={meta} date={date} call={call} onDone={(m) => { setMsg(m); setPanel(""); void load(); }} />}

      {blocks.length > 0 && (
        <div className="mb-6 rounded-md border border-border p-3 text-sm">
          <p className="mb-2 font-semibold">Closed</p>
          {blocks.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-3 py-1">
              <span className="me-auto">{formatDay(zoned(Date.parse(b.starts_at), tz).date)} {time(b.starts_at)} to {time(b.ends_at)} · {meta.scopes.find((s) => s.value === (b.resource_id ?? b.kind ?? "all"))?.label ?? "Everything"}{b.reason ? ` · ${b.reason}` : ""}</span>
              <button className={ghost} onClick={async () => { if (!confirm("Open this time for bookings again?")) return; const j = await call("/api/bookings/block", { action: "remove", id: b.id }); setMsg(j.ok ? "Closure removed." : j.error ?? "Failed"); void load(); }}>Remove</button>
            </div>
          ))}
        </div>
      )}

      {rows === null ? <p>Loading…</p> : shown.length === 0 ? <p className="text-muted-text">No bookings {range === "day" ? "that day" : "that week"}.</p> : (
        <>
          <p className="mb-2 text-sm text-muted-text">{shown.length} bookings · {covers} confirmed guests</p>
          {[...byDay.entries()].map(([d, list]) => (
            <section key={d} className="mb-6">
              <h2 className="mb-2 text-lg font-semibold">{formatDay(d)}</h2>
              <ul className="divide-y divide-border rounded-md border border-border">
                {list.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-start gap-3 p-3 text-sm">
                    <span className="w-24 font-semibold tabular-nums">{time(r.starts_at)}–{time(r.ends_at)}</span>
                    <span className="min-w-48 flex-1">
                      <span className="font-semibold">{r.name}</span> · {r.party_size} {r.party_size === 1 ? "guest" : "guests"} · {label(r.kind)}
                      {r.facts.length > 0 && <span className="block text-muted-text">{r.facts.map(([k, v]) => `${k}: ${v}`).join(" · ")}</span>}
                      <span className="block text-muted-text">{[r.phone, r.email].filter(Boolean).join(" · ")}{r.source === "staff" ? " · by phone" : ""}</span>
                      {r.notes && <span className="block whitespace-pre-wrap">“{r.notes}”</span>}
                      {r.status === "pending" && r.hold_until && <span className="block text-muted-text">Held until {formatDay(zoned(Date.parse(r.hold_until), tz).date)} {time(r.hold_until)}</span>}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[r.status]}`}>{r.status}</span>
                    <span className="flex gap-2">
                      {(r.status === "pending" || r.status === "expired") && <>
                        <button className={primary} disabled={busy === r.id} onClick={() => act(r, "confirmed")}>Accept</button>
                        <button className={ghost} disabled={busy === r.id} onClick={() => act(r, "declined")}>Decline</button>
                      </>}
                      {r.status === "confirmed" && <button className={ghost} disabled={busy === r.id} onClick={() => act(r, "cancelled")}>Cancel</button>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
      <p className="mt-6 text-xs text-muted-text">Signed in as {session.email}. Times are in {tz}. Requests that weren't answered before their hold ran out show as "expired": you can still accept one if there's room.</p>
    </div>
  );
}

type Call = (path: string, body?: unknown) => Promise<{ ok: boolean; error?: string; [k: string]: unknown }>;

function ManualForm({ meta, date, call, onDone }: { meta: Meta; date: string; call: Call; onDone: (msg: string) => void }) {
  const [kind, setKind] = useState(meta.types[0]?.kind ?? "table");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const t = meta.types.find((x) => x.kind === kind);
  const [space, setSpace] = useState(t?.spaces?.[0]?.id ?? "");
  const sp = t?.spaces?.find((s) => s.id === space);
  if (!t) return <p>No booking types are set up.</p>;
  return (
    <form className="mb-6 grid gap-3 rounded-md border border-border p-4 sm:grid-cols-3" onSubmit={async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      setBusy(true); setErr("");
      const j = await call("/api/bookings/manual", {
        type: kind, date: f.date, time: f.time, party: f.party, space: f.space, duration: f.duration,
        details: { name: f.name, phone: f.phone, email: f.email, notes: f.notes }, notify: f.notify === "on",
      });
      setBusy(false);
      if (j.ok) onDone(`Booked (reference ${String(j.reference)}).`);
      else setErr(`${j.error ?? "Failed"}${j.fields ? `: ${Object.entries(j.fields as Record<string, string>).map(([k, v]) => `${k} ${v}`).join(", ")}` : ""}`);
    }}>
      <p className="font-semibold sm:col-span-3">Add a phone booking (confirmed straight away; capacity still applies)</p>
      {meta.types.length > 1 && <label className="text-sm">Type<select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={input}>{meta.types.map((x) => <option key={x.kind} value={x.kind}>{x.label}</option>)}</select></label>}
      <label className="text-sm">Date<input name="date" type="date" required defaultValue={date} className={input} /></label>
      <label className="text-sm">Start time<input name="time" type="time" required step={t.slot_minutes * 60} className={input} /></label>
      {t.spaces && <>
        <label className="text-sm">Space<select name="space" value={space} onChange={(e) => setSpace(e.target.value)} className={input}>{t.spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        {sp && <label className="text-sm">Length (minutes)<input name="duration" type="number" required min={sp.min_minutes} max={sp.max_minutes} step={t.slot_minutes} defaultValue={sp.min_minutes} className={input} /></label>}
      </>}
      <label className="text-sm">Guests<input name="party" type="number" required min={t.party?.min ?? sp?.min_guests ?? 1} max={t.party?.max ?? sp?.capacity} defaultValue={t.party?.min ?? sp?.min_guests ?? 1} className={input} /></label>
      <label className="text-sm">Name<input name="name" required className={input} /></label>
      <label className="text-sm">Phone<input name="phone" type="tel" className={input} /></label>
      <label className="text-sm">Email<input name="email" type="email" className={input} /></label>
      <label className="text-sm sm:col-span-2">Notes<input name="notes" className={input} /></label>
      <label className="flex items-center gap-2 text-sm"><input name="notify" type="checkbox" defaultChecked /> Email the customer a confirmation</label>
      {err && <p className="text-sm text-red-700 sm:col-span-3" role="alert">{err}</p>}
      <div className="sm:col-span-3"><button className={primary} disabled={busy}>{busy ? "Saving…" : "Save booking"}</button></div>
    </form>
  );
}

function BlockForm({ meta, date, call, onDone }: { meta: Meta; date: string; call: Call; onDone: (msg: string) => void }) {
  const [err, setErr] = useState("");
  return (
    <form className="mb-6 grid gap-3 rounded-md border border-border p-4 sm:grid-cols-3" onSubmit={async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      const j = await call("/api/bookings/block", { action: "add", date: f.date, from: f.from || undefined, to: f.to || undefined, scope: f.scope, reason: f.reason });
      if (!j.ok) return setErr(j.error ?? "Failed");
      const n = j.affected as number | null;
      onDone(`Closed. ${n ? `${n} existing booking${n === 1 ? " is" : "s are"} inside that time and still stand: call ${n === 1 ? "that customer" : "those customers"} or cancel ${n === 1 ? "it" : "them"} below.` : "No existing bookings were inside it."}`);
    }}>
      <p className="font-semibold sm:col-span-3">Block a date or time (no new bookings; existing ones stay)</p>
      <label className="text-sm">Date<input name="date" type="date" required defaultValue={date} className={input} /></label>
      <label className="text-sm">From (empty = all day)<input name="from" type="time" className={input} /></label>
      <label className="text-sm">To<input name="to" type="time" className={input} /></label>
      <label className="text-sm">What<select name="scope" className={input}>{meta.scopes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
      <label className="text-sm sm:col-span-2">Reason (staff only)<input name="reason" maxLength={200} className={input} /></label>
      {err && <p className="text-sm text-red-700 sm:col-span-3" role="alert">{err}</p>}
      <div className="sm:col-span-3"><button className={primary}>Block</button></div>
    </form>
  );
}
