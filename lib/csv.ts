// Hand-written CSV (no dependency). Plain-Node importable (tests).

type Cell = string | number | null | undefined;

/** Every field quoted, CRLF, UTF-8 BOM so Excel shows accents. */
export const toCsv = (rows: Cell[][]) =>
  "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n") + "\r\n";

/** One CSV line → fields. Handles quotes and "" escapes; `sep` is , or ; (French Excel). */
function splitLine(line: string, sep: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted && ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === sep && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export type StockCsvRow = { line: number; sku: string; price?: number; stock?: number };
export type StockCsvError = { line: number; raw: string };

/**
 * `sku,price,stock` (empty cell = leave unchanged). A header row is optional; when present, columns
 * are found by name (sku / price|prix / stock), so the variants export can be edited and re-imported.
 */
export function parseStockCsv(text: string): { rows: StockCsvRow[]; invalid: StockCsvError[] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const first = lines.find((l) => l.trim()) ?? "";
  const sep = first.includes(";") && !first.includes(",") ? ";" : ",";
  let cols = { sku: 0, price: 1, stock: 2 };
  const head = splitLine(first, sep).map((h) => h.toLowerCase());
  const hasHeader = head.includes("sku");
  if (hasHeader) {
    cols = { sku: head.indexOf("sku"), price: head.findIndex((h) => h === "price" || h === "prix"), stock: head.indexOf("stock") };
  }
  const int = (s: string | undefined) => (s === undefined || s === "" ? undefined : /^\d{1,9}$/.test(s) ? Number(s) : NaN);

  const rows: StockCsvRow[] = [];
  const invalid: StockCsvError[] = [];
  const headerIndex = hasHeader ? lines.indexOf(first) : -1;
  lines.forEach((raw, i) => {
    if (!raw.trim() || i === headerIndex) return;
    const f = splitLine(raw, sep);
    const sku = f[cols.sku] ?? "";
    const price = cols.price < 0 ? undefined : int(f[cols.price]?.replace(/\s/g, ""));
    const stock = cols.stock < 0 ? undefined : int(f[cols.stock]?.replace(/\s/g, ""));
    if (!/^[A-Za-z0-9._-]{1,40}$/.test(sku) || Number.isNaN(price) || Number.isNaN(stock) || (price === undefined && stock === undefined)) {
      invalid.push({ line: i + 1, raw });
    } else rows.push({ line: i + 1, sku, price, stock });
  });
  return { rows, invalid };
}
