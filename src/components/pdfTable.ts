// Pure table-extraction helpers for the PDF → CSV tool (no DOM / pdf.js here).

export type TextItem = { str: string; x: number; y: number; w: number; h: number };
type Cell = { text: string; x0: number; x1: number };

// Text items of one page → rows of cells.
// Rows: items sharing a baseline. Cells: items closer than `gap` pt horizontally.
// Columns: union of cell x-spans within each block of consecutive multi-cell rows.
// ponytail: geometry heuristic — no ruling lines, no OCR; merged/wrapped cells may split. Upgrade to line-detection if real tables need it.
export function itemsToRows(items: TextItem[], gap: number): string[][] {
  const its = items.filter(i => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  if (!its.length) return [];

  const lines: TextItem[][] = [];
  for (const it of its) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last[0].y - it.y) <= Math.max(2, it.h * 0.4)) last.push(it);
    else lines.push([it]);
  }

  const rows: Cell[][] = lines.map(line => {
    const cells: Cell[] = [];
    for (const it of line.sort((a, b) => a.x - b.x)) {
      const c = cells[cells.length - 1];
      if (c && it.x - c.x1 < gap) {
        const space = it.x - c.x1 > it.h * 0.15 && !c.text.endsWith(" ") && !it.str.startsWith(" ");
        c.text += (space ? " " : "") + it.str;
        c.x1 = Math.max(c.x1, it.x + it.w);
      } else cells.push({ text: it.str, x0: it.x, x1: it.x + it.w });
    }
    cells.forEach(c => { c.text = c.text.trim(); });
    return cells;
  });

  // Columns are computed per block of consecutive multi-cell rows, so headings and
  // numbered lists elsewhere on the page don't widen (and merge) a table's columns.
  const out: string[][] = [];
  let block: Cell[][] = [];
  const flush = () => { out.push(...alignColumns(block)); block = []; };
  for (const r of rows) {
    if (r.length > 1) block.push(r);
    else { flush(); out.push(r.map(c => c.text)); }
  }
  flush();
  return out;
}

// Columns = union of cell x-spans; each cell goes to the column holding its left edge.
function alignColumns(rows: Cell[][]): string[][] {
  const spans = rows.flat().map(c => [c.x0, c.x1]).sort((a, b) => a[0] - b[0]);
  const cols: number[][] = [];
  for (const [a, b] of spans) {
    const last = cols[cols.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else cols.push([a, b]);
  }
  return rows.map(r => {
    const out = cols.map(() => "");
    for (const c of r) {
      let best = 0, bestD = Infinity;
      cols.forEach(([a, b], i) => {
        const d = c.x0 < a ? a - c.x0 : c.x0 > b ? c.x0 - b : 0;
        if (d < bestD) { bestD = d; best = i; }
      });
      out[best] = out[best] ? out[best] + " " + c.text : c.text;
    }
    return out;
  });
}

export function toCsv(rows: string[][], delim: string): string {
  const width = Math.max(0, ...rows.map(r => r.length));
  const esc = (v: string) => /["\r\n]/.test(v) || v.includes(delim) ? `"${v.replace(/"/g, '""')}"` : v;
  return rows.map(r => Array.from({ length: width }, (_, i) => esc(r[i] ?? "")).join(delim)).join("\n");
}

// Hand-built one-page PDF with a small table — powers "Use example" without shipping a binary.
export function examplePdf(): Uint8Array {
  const rows = [
    ["Invoice", "Date", "Customer", "Amount"],
    ["INV-001", "2026-07-01", "PT Maju Jaya", "1,250.00"],
    ["INV-002", "2026-07-15", "CV Sinar Abadi", "980.50"],
    ["INV-003", "2026-08-02", "Toko Sejahtera", "12,400.00"],
    ["INV-004", "2026-09-20", "PT Nusantara Digital", "75.25"],
  ];
  const xs = [50, 130, 220, 0];
  const amountRight = 460;
  // Helvetica advance widths (per 1000 em) for the right-aligned Amount column
  const numW = (s: string) => [...s].reduce((w, ch) => w + (ch === "," || ch === "." ? 278 : 556), 0) / 100;
  let content = "BT /F1 16 Tf 50 780 Td (Sales Report Q3 2026) Tj ET\n";
  rows.forEach((r, i) => r.forEach((t, j) => {
    const x = j === 3 ? (i === 0 ? amountRight - 42 : amountRight - numW(t)) : xs[j];
    content += `BT /F1 10 Tf ${x.toFixed(2)} ${740 - i * 18} Td (${t}) Tj ET\n`;
  }));
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
    + offs.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("")
    + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
