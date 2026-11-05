// The admin dashboard: one client-only React app at /admin. Plain on purpose: no animation, fast, clear.
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { z } from "zod";
import { current, signIn, signOut, type Session } from "./session.ts";
import { canSee, viewFile, visibleViews, type AdminViewProps, type ViewMeta } from "./views.ts";
import { Field, ListField, type Ctx } from "./Field.tsx";
import { csvKeys, kindOf, unwrap, type JS } from "./schema.ts";
import { boolColumn, diffImport, importRows, listColumn, numberColumn, textColumn, toCsv, type ColumnSpec } from "../lib/csv.ts";
import { ConflictError, getDoc, getHistory, publish, saveDoc, type HistoryRow } from "../../cms/lib/client.ts";
import { diffDoc, type JsonSchema } from "../../cms/lib/diff.ts";

export interface DocMeta { key: string; label: string; group: string; editRole: "editor" | "admin"; schema: JS; seed: unknown }
export interface TableMeta { key: string; label: string; columns: string[]; orderBy?: string }
export interface AdminProps { site: string; supabaseUrl: string; anonKey: string; docs: DocMeta[]; tables: TableMeta[]; views?: ViewMeta[] }

// Custom views from modules (see views.ts), loaded on first open.
const viewModules = import.meta.glob<{ default: ComponentType<AdminViewProps> }>("/src/modules/*/admin/*.tsx");

const btn = "rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50";
const primary = `${btn} bg-primary text-primary-foreground`;
const ghost = `${btn} border border-border`;

function useHash() {
  const [h, setH] = useState(typeof location === "undefined" ? "" : location.hash);
  useEffect(() => { const f = () => setH(location.hash); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return h.replace(/^#\/?/, "");
}

export default function App(props: AdminProps) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => { current(props.supabaseUrl, props.anonKey).then(setSession, () => setSession(null)); }, []);
  if (!props.supabaseUrl || !props.anonKey) return <Shell site={props.site}><p className="p-8">The dashboard isn't connected yet: set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY, then rebuild.</p></Shell>;
  if (session === undefined) return <Shell site={props.site}><p className="p-8">Loading…</p></Shell>;
  if (!session) return <Login {...props} onIn={setSession} />;
  if (!session.role) return <Shell site={props.site}><p className="p-8">This account has no dashboard role. Ask the agency to add one. <button className="underline" onClick={() => { signOut(); setSession(null); }}>Sign out</button></p></Shell>;
  return <Dashboard {...props} session={session} onOut={() => { signOut(); setSession(null); }} />;
}

function Shell({ site, children }: { site: string; children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background text-foreground"><header className="border-b border-border px-6 py-3 font-semibold">{site} · Dashboard</header>{children}</div>;
}

function Login({ site, supabaseUrl, anonKey, onIn }: AdminProps & { onIn: (s: Session) => void }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Shell site={site}>
      <form className="mx-auto mt-16 max-w-sm space-y-4 p-6" onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true); setErr("");
        try { onIn(await signIn(supabaseUrl, anonKey, String(f.get("email")), String(f.get("password")))); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
      }}>
        <h1 className="text-2xl font-bold">Sign in</h1>
        <label className="block text-sm">Email<input name="email" type="email" required autoComplete="username" className="mt-1 w-full rounded-md border border-border px-3 py-2" /></label>
        <label className="block text-sm">Password<input name="password" type="password" required autoComplete="current-password" className="mt-1 w-full rounded-md border border-border px-3 py-2" /></label>
        {err && <p className="text-sm text-red-700" role="alert">{err}</p>}
        <button className={primary} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </Shell>
  );
}

function Dashboard(props: AdminProps & { session: Session; onOut: () => void }) {
  const route = useHash();
  const [publishMsg, setPublishMsg] = useState("");
  const api = { url: props.supabaseUrl, anon: props.anonKey, token: props.session.access_token };
  const groups = useMemo(() => [...new Set(props.docs.map((d) => d.group))], [props.docs]);
  const [kind, key] = route.split("/") as [string, string | undefined];
  const doc = kind === "doc" ? props.docs.find((d) => d.key === key) : undefined;
  const table = kind === "table" ? props.tables.find((t) => t.key === key) : undefined;
  const views = visibleViews(props.views ?? [], props.session.role);
  const view = kind === "view" ? (props.views ?? []).find((v) => v.id === key) : undefined;
  return (
    <div className="grid min-h-dvh grid-cols-[14rem_1fr] bg-background text-foreground">
      <nav className="border-e border-border p-4 text-sm" aria-label="Dashboard">
        <p className="mb-4 font-semibold">{props.site}</p>
        {groups.map((g) => (
          <div key={g} className="mb-4">
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-text">{g}</p>
            {props.docs.filter((d) => d.group === g).map((d) => (
              <a key={d.key} href={`#/doc/${d.key}`} className={`block rounded px-2 py-1 ${doc?.key === d.key ? "bg-muted font-semibold" : ""}`}>{d.label}</a>
            ))}
          </div>
        ))}
        {props.tables.length > 0 && <div className="mb-4"><p className="mb-1 text-xs uppercase tracking-wide text-muted-text">Inbox</p>
          {props.tables.map((t) => <a key={t.key} href={`#/table/${t.key}`} className={`block rounded px-2 py-1 ${table?.key === t.key ? "bg-muted font-semibold" : ""}`}>{t.label}</a>)}</div>}
        {views.length > 0 && <div className="mb-4"><p className="mb-1 text-xs uppercase tracking-wide text-muted-text">Tools</p>
          {views.map((v) => <a key={v.id} href={`#/view/${v.id}`} className={`block rounded px-2 py-1 ${view?.id === v.id ? "bg-muted font-semibold" : ""}`}>{v.label}</a>)}</div>}
        <div className="mt-8 space-y-2 border-t border-border pt-4">
          <p className="text-xs text-muted-text">{props.session.email} · {props.session.role}</p>
          {props.session.role === "admin" && (
            <button className={primary} onClick={async () => {
              setPublishMsg("Publishing…");
              const r = await publish(api).catch((e) => ({ ok: false, error: (e as Error).message }));
              setPublishMsg(r.ok ? "Published. The site updates in a few minutes." : r.error ?? "Publish failed");
            }}>Publish</button>
          )}
          {publishMsg && <p className="text-xs" role="status">{publishMsg}</p>}
          <button className="block text-xs underline" onClick={props.onOut}>Sign out</button>
        </div>
      </nav>
      <main className="p-6">
        {doc ? <DocEditor key={doc.key} doc={doc} api={api} role={props.session.role} supabaseUrl={props.supabaseUrl} />
          : table ? <TableView key={table.key} table={table} api={api} />
          : view ? <CustomView key={view.id} view={view} api={api} session={props.session} />
          : <div><h1 className="text-2xl font-bold">Welcome</h1><p className="mt-2 text-muted-text">Pick a section on the left. Save your changes, then press Publish (admins) to update the website.</p></div>}
      </main>
    </div>
  );
}

type Api = { url: string; anon: string; token: string };

function CustomView({ view, api, session }: { view: ViewMeta; api: Api; session: Session }) {
  const [View, setView] = useState<ComponentType<AdminViewProps> | null>(null);
  const [err, setErr] = useState("");
  const allowed = canSee(session.role, view.minRole);
  useEffect(() => {
    if (!allowed) return;
    const load = viewModules[viewFile(view)];
    if (!load) { setErr(`The "${view.label}" view is missing (${viewFile(view)}).`); return; }
    load().then((m) => setView(() => m.default), (e) => setErr(`Couldn't load "${view.label}": ${(e as Error).message}`));
  }, [view.id, allowed]);
  if (!allowed) return <p role="alert">This needs the {view.minRole} role.</p>;
  if (err) return <p role="alert">{err}</p>;
  if (!View) return <p>Loading…</p>;
  return <View api={api} session={{ email: session.email, role: session.role }} />;
}

function columnsFor(itemSchema: JS): ColumnSpec[] {
  const props = unwrap(itemSchema).properties ?? {};
  return csvKeys(itemSchema).map((k) => {
    const kind = kindOf(props[k]!);
    return kind === "number" ? numberColumn(k, k) : kind === "boolean" ? boolColumn(k, k) : kind === "tags" ? listColumn(k, k) : textColumn(k, k);
  });
}

function DocEditor({ doc, api, role, supabaseUrl }: { doc: DocMeta; api: Api; role: Session["role"]; supabaseUrl: string }) {
  const [value, setValue] = useState<unknown>(undefined);
  const [version, setVersion] = useState<string | null>(null);
  const [saved, setSaved] = useState<unknown>(undefined);
  const [msg, setMsg] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const readOnly = role === "demo" || (doc.editRole === "admin" && role !== "admin");
  const validator = useMemo(() => z.fromJSONSchema(doc.schema as Parameters<typeof z.fromJSONSchema>[0]), [doc.schema]);
  const dirty = JSON.stringify(value) !== JSON.stringify(saved);

  const load = async () => {
    setMsg("Loading…");
    try {
      const row = await getDoc(api, doc.key);
      const v = row ? row.value : structuredClone(doc.seed);
      setValue(v); setSaved(v); setVersion(row?.updated_at ?? null);
      setMsg(row ? `Last saved ${new Date(row.updated_at).toLocaleString()}${row.updated_by ? ` by ${row.updated_by}` : ""}` : "Not saved yet: showing the starting content.");
    } catch (e) { setMsg((e as Error).message); }
  };
  useEffect(() => { void load(); }, [doc.key]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    addEventListener("beforeunload", warn); return () => removeEventListener("beforeunload", warn);
  }, [dirty]);

  const ctx: Ctx = {
    readOnly,
    upload: async (path, blob) => {
      const r = await fetch(`${supabaseUrl}/storage/v1/object/${path}`, { method: "POST", headers: { apikey: api.anon, Authorization: `Bearer ${api.token}`, "Content-Type": blob.type, "x-upsert": "false" }, body: blob });
      if (!r.ok) throw new Error(`Upload failed (${r.status})`);
      return `${supabaseUrl}/storage/v1/object/public/${path}`;
    },
  };

  const save = async () => {
    const r = validator.safeParse(value);
    if (!r.success) { setErrors(r.error.issues.map((i) => `${i.path.join(" › ") || "Section"}: ${i.message}`)); return; }
    setErrors([]); setMsg("Saving…");
    try {
      const row = await saveDoc(api, doc.key, value, version);
      setVersion(row.updated_at); setSaved(value);
      setMsg(`Saved ${new Date(row.updated_at).toLocaleTimeString()}. Publish to put it on the website.`);
    } catch (e) { setMsg(e instanceof ConflictError ? e.message : `Not saved: ${(e as Error).message}`); }
  };

  if (value === undefined) return <p>{msg}</p>;
  const s = unwrap(doc.schema);
  const lists: [string | null, JS][] = kindOf(s) === "list" ? [[null, s]] : Object.entries(s.properties ?? {}).filter(([, v]) => kindOf(v) === "list").map(([k, v]) => [k, unwrap(v)]);

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="me-auto text-2xl font-bold">{doc.label}</h1>
        <button className={ghost} onClick={async () => setHistory(await getHistory(api, doc.key).catch(() => []))}>History</button>
        {!readOnly && <button className={primary} disabled={!dirty} onClick={save}>{dirty ? "Save" : "Saved"}</button>}
      </div>
      <p className="mb-4 text-sm text-muted-text" role="status">{readOnly ? "View only. " : ""}{msg}</p>
      {errors.length > 0 && <ul className="mb-4 rounded-md border border-red-700 p-3 text-sm text-red-700" role="alert">{errors.slice(0, 12).map((e) => <li key={e}>{e}</li>)}</ul>}
      {lists.map(([k, ls]) => <CsvTools key={k ?? "_"} name={k ?? doc.key} items={(k ? (value as Record<string, unknown>)[k] : value) as unknown[] ?? []} itemSchema={unwrap(ls.items)} readOnly={readOnly}
        onImport={(items) => setValue(k ? { ...(value as object), [k]: items } : items)} />)}
      {kindOf(s) === "list"
        ? <ListField schema={s} value={value as unknown[]} onChange={setValue} ctx={ctx} />
        : <Field name={doc.key} schema={{ ...doc.schema, label: " " }} value={value} onChange={setValue} ctx={ctx} />}
      {history && <HistoryDialog rows={history} current={value} schema={doc.schema} readOnly={readOnly} onClose={() => setHistory(null)} onRestore={(v) => { setValue(v); setHistory(null); setMsg("Restored into the editor. Check it, then Save."); }} />}
    </div>
  );
}

function CsvTools({ name, items, itemSchema, readOnly, onImport }: { name: string; items: unknown[]; itemSchema: JS; readOnly: boolean; onImport: (items: unknown[]) => void }) {
  const columns = useMemo(() => columnsFor(itemSchema), [itemSchema]);
  if (!columns.length) return null;
  const hasId = columns.some((c) => c.key === "id");
  return (
    <div className="mb-4 flex gap-3 text-sm">
      <button className="underline" onClick={() => {
        const blob = new Blob([toCsv(items as object[], columns)], { type: "text/csv" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${name}.csv`; a.click(); URL.revokeObjectURL(a.href);
      }}>Download {name} as CSV</button>
      {!readOnly && <label className="cursor-pointer underline">Import CSV<input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        const r = importRows(await f.text(), columns, hasId ? { idKey: "id" } : {});
        if (r.errors.length) { alert(`Fix these first:\n${r.errors.slice(0, 10).map((x) => `line ${x.line}, ${x.column}: ${x.message}`).join("\n")}`); return; }
        const byId = new Map((items as Record<string, unknown>[]).map((it) => [String(it.id), it]));
        const merged = hasId ? r.rows.map((row) => ({ ...(byId.get(String(row.id)) ?? {}), ...row })) : r.rows;
        if (hasId) {
          const d = diffImport(items as Record<string, unknown>[], merged as Record<string, unknown>[], "id");
          if (!confirm(`${d.added.length} added, ${d.changed.length} changed, ${d.removed.length} removed, ${d.unchanged} unchanged. Apply? (Nothing is saved until you press Save.)`)) return;
        } else if (!confirm(`Replace ${items.length} entries with ${merged.length} from the file? (Nothing is saved until you press Save.)`)) return;
        onImport(merged);
        e.target.value = "";
      }} /></label>}
    </div>
  );
}

function HistoryDialog({ rows, current, schema, readOnly, onClose, onRestore }: { rows: HistoryRow[]; current: unknown; schema: JS; readOnly: boolean; onClose: () => void; onRestore: (v: unknown) => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="History" className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="max-h-[80dvh] w-full max-w-2xl overflow-auto rounded-md bg-background p-6">
        <div className="mb-4 flex items-center"><h2 className="me-auto text-xl font-bold">History</h2><button className={ghost} autoFocus onClick={onClose}>Close</button></div>
        {rows.length === 0 && <p className="text-sm text-muted-text">No earlier versions yet.</p>}
        {rows.map((r) => {
          const lines = diffDoc(r.value, current, schema as JsonSchema);
          return (
            <div key={r.id} className="mb-4 border-b border-border pb-4">
              <div className="flex items-center gap-3"><p className="me-auto text-sm font-semibold">{new Date(r.saved_at).toLocaleString()} {r.saved_by && <span className="font-normal text-muted-text">· {r.saved_by}</span>}</p>
                {!readOnly && <button className={ghost} onClick={() => onRestore(r.value)}>Restore</button>}</div>
              <p className="mt-1 text-xs text-muted-text">Going from this version to what's in the editor now:</p>
              <ul className="mt-1 list-disc ps-5 text-sm">{(lines.length ? lines : ["No differences"]).slice(0, 8).map((l) => <li key={l}>{l}</li>)}</ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TableView({ table, api }: { table: TableMeta; api: Api }) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    fetch(`${api.url}/rest/v1/${table.key}?select=*&order=${table.orderBy ?? "id"}.desc&limit=500`, { headers: { apikey: api.anon, Authorization: `Bearer ${api.token}` } })
      .then(async (r) => { if (!r.ok) throw new Error(`Couldn't load (${r.status})`); setRows(await r.json()); }).catch((e) => setErr(e.message));
  }, [table.key]);
  const show = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "object" ? Object.entries(v as object).map(([k, x]) => `${k}: ${typeof x === "object" ? JSON.stringify(x) : x}`).join(" · ") : /^\d{4}-\d\d-\d\dT/.test(String(v)) ? new Date(String(v)).toLocaleString() : String(v));
  if (err) return <p role="alert">{err}</p>;
  if (!rows) return <p>Loading…</p>;
  return (
    <div>
      <div className="mb-4 flex items-center gap-3"><h1 className="me-auto text-2xl font-bold">{table.label}</h1>
        <button className={ghost} onClick={() => {
          const cols = table.columns.map((k) => textColumn(k, k));
          const flat = rows.map((r) => Object.fromEntries(table.columns.map((k) => [k, show(r[k])])));
          const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([toCsv(flat, cols)], { type: "text/csv" })); a.download = `${table.key}.csv`; a.click();
        }}>Download CSV</button></div>
      <p className="mb-2 text-sm text-muted-text">{rows.length} most recent</p>
      <div className="overflow-x-auto"><table className="w-full text-start text-sm">
        <thead><tr>{table.columns.map((c) => <th key={c} className="border-b border-border p-2 text-start">{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={String(r.id ?? i)} className="cursor-pointer align-top hover:bg-muted" onClick={() => setOpen(open === i ? null : i)}>
            {table.columns.map((c) => <td key={c} className="max-w-xs truncate border-b border-border p-2" title={show(r[c])}>{open === i ? <span className="whitespace-pre-wrap">{show(r[c])}</span> : show(r[c])}</td>)}
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}
