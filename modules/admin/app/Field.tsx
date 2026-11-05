// Recursive form field generated from a JSON Schema node.
import { useId, useState } from "react";
import { blank, itemTitle, kindOf, labelOf, unwrap, type JS } from "./schema.ts";
import { safeFileName, storagePath, toWebp } from "../lib/image.ts";

export interface Ctx { readOnly: boolean; upload: (path: string, blob: Blob) => Promise<string> }

const input = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60";

export function Field({ name, schema, value, onChange, ctx }: { name: string; schema: JS; value: unknown; onChange: (v: unknown) => void; ctx: Ctx }) {
  const id = useId();
  const s = unwrap(schema);
  const label = labelOf(schema, name);
  const help = s.help ?? schema.help;
  const kind = kindOf(schema);
  const wrap = (control: React.ReactNode) => (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      {control}
      {help && <p className="mt-1 text-xs text-muted-text">{help}</p>}
    </div>
  );
  switch (kind) {
    case "boolean":
      return (
        <label className="mb-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(value)} disabled={ctx.readOnly} onChange={(e) => onChange(e.target.checked)} /> {label}
        </label>
      );
    case "number":
      return wrap(<input id={id} type="number" className={input} disabled={ctx.readOnly} value={value === undefined || value === null ? "" : String(value)} min={s.minimum} max={s.maximum} step="any"
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />);
    case "select":
      return wrap(<select id={id} className={input} disabled={ctx.readOnly} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
        {(s.enum ?? []).map((o) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
      </select>);
    case "textarea":
      return wrap(<textarea id={id} rows={5} className={input} disabled={ctx.readOnly} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />);
    case "tags":
      return wrap(<input id={id} className={input} disabled={ctx.readOnly} placeholder="Separate with commas" value={Array.isArray(value) ? value.join(", ") : ""}
        onChange={(e) => onChange(e.target.value.split(",").map((x) => x.trim()).filter(Boolean).map((x) => (kindOf(unwrap(s.items)) === "number" ? Number(x) : x)))} />);
    case "image":
      return wrap(<ImageField id={id} value={(value ?? { src: "", alt: "" }) as { src: string; alt: string }} onChange={onChange} ctx={ctx} />);
    case "object":
      return (
        <fieldset className="mb-4 rounded-md border border-border p-4">
          <legend className="px-1 text-sm font-semibold">{label}</legend>
          <ObjectFields schema={s} value={(value ?? {}) as Record<string, unknown>} onChange={onChange} ctx={ctx} />
        </fieldset>
      );
    case "record":
      return wrap(<RecordField value={(value ?? {}) as Record<string, unknown>} valueSchema={s.additionalProperties as JS} onChange={onChange} ctx={ctx} />);
    case "list":
      return (
        <div className="mb-4">
          <p className="text-sm font-semibold">{label}</p>
          <ListField schema={s} value={Array.isArray(value) ? value : []} onChange={onChange} ctx={ctx} />
        </div>
      );
    case "json":
      return wrap(<JsonField id={id} value={value} onChange={onChange} readOnly={ctx.readOnly} />);
    default: {
      const type = ({ date: "date", datetime: "datetime-local", color: "color", url: "url", email: "email", tel: "tel" } as Record<string, string>)[kind] ?? "text";
      return wrap(<input id={id} type={type} className={input} disabled={ctx.readOnly} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />);
    }
  }
}

export function ObjectFields({ schema, value, onChange, ctx }: { schema: JS; value: Record<string, unknown>; onChange: (v: unknown) => void; ctx: Ctx }) {
  const s = unwrap(schema);
  return (
    <>
      {Object.entries(s.properties ?? {}).filter(([k]) => k !== "sample").map(([k, sub]) => (
        <Field key={k} name={k} schema={sub} value={value[k]} ctx={ctx}
          onChange={(v) => { const next = { ...value }; if (v === undefined || v === "") delete next[k]; else next[k] = v; onChange(next); }} />
      ))}
      {s.properties?.sample && (
        <label className="mb-2 flex items-center gap-2 text-xs text-muted-text">
          <input type="checkbox" checked={Boolean(value.sample)} disabled={ctx.readOnly} onChange={(e) => { const n = { ...value }; if (e.target.checked) n.sample = true; else delete n.sample; onChange(n); }} />
          Placeholder: keep this off the live site
        </label>
      )}
    </>
  );
}

export function ListField({ schema, value, onChange, ctx }: { schema: JS; value: unknown[]; onChange: (v: unknown[]) => void; ctx: Ctx }) {
  const item = unwrap(schema.items);
  const [open, setOpen] = useState<number | null>(null);
  const move = (i: number, d: number) => { const n = [...value]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); onChange(n); setOpen(null); };
  return (
    <div className="mt-2 divide-y divide-border rounded-md border border-border">
      {value.map((it, i) => (
        <div key={i} className="p-3">
          <div className="flex items-center gap-2">
            <button type="button" className="flex-1 text-start text-sm font-medium" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              {itemTitle(it, item, i)}{(it as { sample?: boolean })?.sample ? <span className="ms-2 text-xs text-muted-text">(placeholder)</span> : null}
            </button>
            {!ctx.readOnly && <>
              <button type="button" className="px-2 text-sm" disabled={i === 0} aria-label="Move up" onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="px-2 text-sm" disabled={i === value.length - 1} aria-label="Move down" onClick={() => move(i, 1)}>↓</button>
              <button type="button" className="px-2 text-sm text-red-700" aria-label="Delete" onClick={() => { if (confirm(`Delete "${itemTitle(it, item, i)}"?`)) onChange(value.filter((_, j) => j !== i)); }}>✕</button>
            </>}
          </div>
          {open === i && (
            <div className="mt-3">
              <ObjectFields schema={item} value={(it ?? {}) as Record<string, unknown>} ctx={ctx} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} />
            </div>
          )}
        </div>
      ))}
      {!ctx.readOnly && (
        <div className="p-3"><button type="button" className="text-sm font-semibold text-primary" onClick={() => { onChange([...value, blank(item)]); setOpen(value.length); }}>+ Add</button></div>
      )}
    </div>
  );
}

function RecordField({ value, valueSchema, onChange, ctx }: { value: Record<string, unknown>; valueSchema: JS; onChange: (v: unknown) => void; ctx: Ctx }) {
  const numeric = kindOf(valueSchema ?? {}) === "number";
  const rows = Object.entries(value);
  const set = (entries: [string, unknown][]) => onChange(Object.fromEntries(entries.filter(([k]) => k)));
  return (
    <div className="mt-1 space-y-2">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex gap-2">
          <input className={input} aria-label="Name" disabled={ctx.readOnly} value={k} onChange={(e) => set(rows.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))} />
          <input className={input} aria-label="Value" disabled={ctx.readOnly} type={numeric ? "number" : "text"} value={String(v ?? "")}
            onChange={(e) => set(rows.map((r, j) => (j === i ? [r[0], numeric ? Number(e.target.value) : e.target.value] : r)))} />
        </div>
      ))}
      {!ctx.readOnly && <button type="button" className="text-sm text-primary" onClick={() => onChange({ ...value, [`field${rows.length + 1}`]: numeric ? 0 : "" })}>+ Add row</button>}
    </div>
  );
}

function JsonField({ id, value, onChange, readOnly }: { id: string; value: unknown; onChange: (v: unknown) => void; readOnly: boolean }) {
  const [text, setText] = useState(JSON.stringify(value ?? null, null, 2));
  const [bad, setBad] = useState(false);
  return <>
    <textarea id={id} rows={6} className={`${input} font-mono`} disabled={readOnly} value={text}
      onChange={(e) => { setText(e.target.value); try { onChange(JSON.parse(e.target.value)); setBad(false); } catch { setBad(true); } }} />
    {bad && <p className="text-xs text-red-700">Not valid JSON yet.</p>}
  </>;
}

function ImageField({ id, value, onChange, ctx }: { id: string; value: { src: string; alt: string }; onChange: (v: unknown) => void; ctx: Ctx }) {
  const [busy, setBusy] = useState("");
  return (
    <div className="mt-1 flex gap-3">
      {value.src ? <img src={value.src} alt="" className="h-20 w-20 rounded-md object-cover" /> : <div className="h-20 w-20 rounded-md bg-muted" />}
      <div className="flex-1 space-y-2">
        <input id={id} className={input} placeholder="Image URL" disabled={ctx.readOnly} value={value.src} onChange={(e) => onChange({ ...value, src: e.target.value })} />
        <input className={input} placeholder="Describe the photo (for screen readers and Google)" disabled={ctx.readOnly} value={value.alt} onChange={(e) => onChange({ ...value, alt: e.target.value })} />
        {!ctx.readOnly && (
          <label className="inline-block cursor-pointer text-sm font-semibold text-primary">
            {busy || "Upload photo"}
            <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                setBusy("Converting…");
                const blob = await toWebp(file);
                setBusy("Uploading…");
                const src = await ctx.upload(storagePath("images", "uploads", safeFileName(file.name, { ext: blob.type === "image/webp" ? "webp" : "jpg" })), blob);
                onChange({ ...value, src });
              } catch (err) { alert((err as Error).message); } finally { setBusy(""); }
            }} />
          </label>
        )}
      </div>
    </div>
  );
}
