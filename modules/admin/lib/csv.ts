// Generic CSV engine for the admin's list editors: RFC 4180 parsing, safe export, a column spec per list,
// an import that reports errors by line and column, and a diff for the preview before saving.
// Ported from the reference project's src/admin/csv.js (parse, quote, importTable, canon). Nothing here knows about
// menus, events or any other content type: callers describe their columns with a ColumnSpec.
// Pure: runs in Node and in the browser. The value comparison (canon) belongs to the cms module: one rule for the
// History diff, the publish email and this import preview.
import { NUMBER, canon } from "../../cms/lib/diff.ts";

export { canon };

/** One column of a list. `key` is the property on the item, `header` the name in the CSV (matched case-insensitively). */
export interface ColumnSpec<T = unknown> {
  key: string;
  header: string;
  /** Turns the cell text (trimmed) into a value. Return undefined for "no value". Throw an Error with the message to show. */
  parse(cell: string): T | undefined;
  /** Turns the value into cell text. Return "" for no value. */
  serialize(value: T | undefined): string;
  /** A missing header or an empty cell is an error for a required column. */
  required?: boolean;
}

export interface ImportError {
  /** The line in the file where the record starts, counting the header as line 1 (blank lines included). */
  line: number;
  /** The CSV header of the column at fault, or of the id column for a duplicate id. */
  column: string;
  message: string;
}

export interface ImportResult {
  /** Parsed rows, holding only the keys whose columns were in the file. Apply them only when `errors` is empty. */
  rows: Record<string, unknown>[];
  errors: ImportError[];
}

export interface ImportDiff<T> {
  added: T[];
  changed: { id: string; fields: string[] }[];
  removed: T[];
  unchanged: number;
}

// a cell starting with one of these is read by spreadsheets as a formula (=HYPERLINK, +1+1, -2+3, @SUM)
// tab and carriage return are included because some spreadsheets treat a cell starting with them the same way
const FORMULA_START = /^[=+\-@\t\r]/;
const ESCAPED_FORMULA = /^'[=+\-@\t\r]/;

/** One record of the file with the line it starts on. Blank records are kept here so line numbers stay true. */
interface RawRecord {
  line: number;
  cells: string[];
}

function records(text: string): RawRecord[] {
  const src = String(text).replace(/^﻿/, "");
  const out: RawRecord[] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let start = 1;
  const endRecord = () => {
    row.push(cell);
    out.push({ line: start, cells: row });
    row = [];
    cell = "";
    start = line;
  };
  for (let i = 0; i < src.length; i++) {
    const c = src.charAt(i);
    const next = src.charAt(i + 1);
    if (quoted) {
      if (c === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
        if (c === "\n" || (c === "\r" && next !== "\n")) line++;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && next === "\n") i++;
      line++;
      endRecord();
    } else {
      cell += c;
    }
  }
  if (cell !== "" || row.length) endRecord();
  return out;
}

const isBlank = (cells: string[]) => cells.every((c) => c.trim() === "");

/**
 * RFC 4180 CSV to rows of cells. Handles quoted cells, "" escapes, quoted line breaks, CRLF and LF, a leading
 * BOM, and drops blank lines (a trailing newline does not make an empty row).
 */
export function parseCsv(text: string): string[][] {
  return records(text)
    .map((r) => r.cells)
    .filter((cells) => !isBlank(cells));
}

/** The text of one cell: quoted when needed, and a leading = + - @ tab or CR is prefixed with ' so it is not a formula. */
function cell(text: string): string {
  const safe = FORMULA_START.test(text) ? "'" + text : text;
  return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
}

/** Writes rows as CRLF CSV with a header line taken from the columns, in the column order. */
export function toCsv<T extends object>(rows: readonly T[], columns: readonly ColumnSpec[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(",")];
  for (const row of rows) {
    const fields = row as Record<string, unknown>;
    lines.push(columns.map((c) => cell(c.serialize(fields[c.key]))).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

/** Reads the file against the columns. Errors are collected, not thrown, so the editor can list them all at once. */
export function importRows(text: string, columns: readonly ColumnSpec[], options: { idKey?: string } = {}): ImportResult {
  const recs = records(text).filter((r) => !isBlank(r.cells));
  const errors: ImportError[] = [];
  if (!recs.length) return { rows: [], errors: [{ line: 1, column: "", message: "The file is empty." }] };

  const headerRec = recs[0];
  const header = (headerRec?.cells ?? []).map(normalizeHeader);
  const position = new Map<string, number>();
  header.forEach((h, i) => {
    if (!position.has(h)) position.set(h, i);
  });

  for (const col of columns) {
    if (col.required && !position.has(normalizeHeader(col.header))) {
      errors.push({ line: headerRec?.line ?? 1, column: col.header, message: `Missing column: ${col.header}` });
    }
  }
  if (errors.length) return { rows: [], errors };

  const idHeader = options.idKey ? columns.find((c) => c.key === options.idKey)?.header : undefined;
  const seenIds = new Set<string>();
  const rows: Record<string, unknown>[] = [];

  for (const rec of recs.slice(1)) {
    const row: Record<string, unknown> = {};
    let ok = true;
    for (const col of columns) {
      const i = position.get(normalizeHeader(col.header));
      if (i === undefined) continue;
      let raw = (rec.cells[i] ?? "").trim();
      if (ESCAPED_FORMULA.test(raw)) raw = raw.slice(1); // undo the ' that cell() added
      if (raw === "" && col.required) {
        errors.push({ line: rec.line, column: col.header, message: `${col.header} is required` });
        ok = false;
        continue;
      }
      try {
        const value = col.parse(raw);
        if (value !== undefined) row[col.key] = value;
      } catch (e) {
        errors.push({ line: rec.line, column: col.header, message: e instanceof Error ? e.message : String(e) });
        ok = false;
      }
    }
    if (ok && idHeader !== undefined && options.idKey) {
      const id = String(row[options.idKey] ?? "");
      if (id !== "") {
        if (seenIds.has(id)) errors.push({ line: rec.line, column: idHeader, message: `id "${id}" is used twice` });
        seenIds.add(id);
      }
    }
    if (ok) rows.push(row);
  }
  return { rows, errors };
}

function normalizeHeader(h: string): string {
  return h.replace(/^﻿/, "").trim().toLowerCase();
}

/**
 * What an import would change, matched by `idKey`, for the preview before saving. A field counts as changed when
 * canon() differs, so "" against a missing value and "24" against 24 are not changes. If an id appears twice in
 * the current list, the first one is used.
 */
export function diffImport<T extends object>(currentItems: readonly T[], importedItems: readonly T[], idKey: keyof T & string): ImportDiff<T> {
  const idOf = (item: T) => String((item as Record<string, unknown>)[idKey] ?? "");
  const current = new Map<string, T>();
  for (const item of currentItems) if (!current.has(idOf(item))) current.set(idOf(item), item);
  const imported = new Map<string, T>();
  for (const item of importedItems) if (!imported.has(idOf(item))) imported.set(idOf(item), item);

  const added: T[] = [];
  const changed: { id: string; fields: string[] }[] = [];
  let unchanged = 0;
  for (const [id, item] of imported) {
    const before = current.get(id);
    if (!before) {
      added.push(item);
      continue;
    }
    const a = before as Record<string, unknown>;
    const b = item as Record<string, unknown>;
    const fields = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => k !== idKey && canon(a[k]) !== canon(b[k]));
    if (fields.length) changed.push({ id, fields });
    else unchanged++;
  }
  const removed = [...current].filter(([id]) => !imported.has(id)).map(([, item]) => item);
  return { added, changed, removed, unchanged };
}

// ---------- column builders for the common cell types ----------
// An empty cell is "no value" for all of these, which is what the required check and canon() expect.

export function textColumn(key: string, header: string, opts: { required?: boolean } = {}): ColumnSpec<string> {
  return {
    key,
    header,
    required: opts.required,
    parse: (c) => (c === "" ? undefined : c),
    serialize: (v) => (v === undefined || v === null ? "" : String(v)),
  };
}

export function numberColumn(key: string, header: string, opts: { required?: boolean } = {}): ColumnSpec<number> {
  return {
    key,
    header,
    required: opts.required,
    parse(c) {
      if (c === "") return undefined;
      if (!NUMBER.test(c)) throw new Error(`${header} must be a number`);
      return Number(c);
    },
    serialize: (v) => (v === undefined || v === null ? "" : String(v)),
  };
}

/** yes, true or 1 is true; no, false or 0 is false. */
export function boolColumn(key: string, header: string, opts: { required?: boolean } = {}): ColumnSpec<boolean> {
  return {
    key,
    header,
    required: opts.required,
    parse(c) {
      if (c === "") return undefined;
      if (/^(yes|true|1)$/i.test(c)) return true;
      if (/^(no|false|0)$/i.test(c)) return false;
      throw new Error(`${header} must be yes or no`);
    },
    serialize: (v) => (v === undefined || v === null ? "" : v ? "yes" : "no"),
  };
}

/** A list in one cell, separated by |: a|b|c. Blank entries are dropped. */
export function listColumn(key: string, header: string, opts: { required?: boolean } = {}): ColumnSpec<string[]> {
  return {
    key,
    header,
    required: opts.required,
    parse: (c) => {
      const items = c.split("|").map((x) => x.trim()).filter(Boolean);
      return items.length ? items : undefined;
    },
    serialize: (v) => (v ?? []).join("|"),
  };
}
