"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { itemsToRows, toCsv, examplePdf, type TextItem } from "./pdfTable";

type Tab = "table" | "csv";

const DELIMS = [
  { value: ",",  label: "Comma ," },
  { value: ";",  label: "Semicolon ;" },
  { value: "\t", label: "Tab" },
];

// pdf.js touches browser globals at import time, so it is loaded lazily on first use.
async function extractPages(data: Uint8Array): Promise<TextItem[][]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: TextItem[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    pages.push(tc.items.flatMap(i => "str" in i
      ? [{ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: i.height || Math.abs(i.transform[3]) }]
      : []));
  }
  return pages;
}

export default function PdfToCsv() {
  const [fileName, setFileName] = useState("");
  const [pages, setPages]       = useState<TextItem[][] | null>(null);
  const [page, setPage]         = useState<"all" | number>("all");
  const [gap, setGap]           = useState(6);
  const [delim, setDelim]       = useState(",");
  const [tab, setTab]           = useState<Tab>("table");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (name: string, data: Uint8Array) => {
    setLoading(true); setError(""); setFileName(name); setPage("all");
    try { setPages(await extractPages(data)); }
    catch (e) { setPages(null); setError(e instanceof Error ? e.message : "Failed to read PDF"); }
    setLoading(false);
  };

  const loadFile = async (f?: File) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) { setError("File bukan PDF"); return; }
    load(f.name, new Uint8Array(await f.arrayBuffer()));
  };

  const rows = useMemo(() => {
    if (!pages) return [];
    const sel = page === "all" ? pages : [pages[page - 1]];
    return sel.flatMap(p => itemsToRows(p, gap));
  }, [pages, page, gap]);

  const csv   = useMemo(() => toCsv(rows, delim), [rows, delim]);
  const width = Math.max(0, ...rows.map(r => r.length));
  const noText = pages !== null && rows.length === 0;

  const doCopy = async () => {
    try { await navigator.clipboard.writeText(csv); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = csv; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const doDownload = () => {
    // BOM so Excel opens UTF-8 correctly
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = (fileName.replace(/\.pdf$/i, "") || "table") + ".csv";
    a.click(); URL.revokeObjectURL(url);
  };

  const doClear = () => { setPages(null); setFileName(""); setError(""); if (fileRef.current) fileRef.current.value = ""; };

  const label = "text-xs font-sans mb-1.5 block";
  const field = "w-full text-xs font-sans px-2 py-1.5 rounded border outline-none";
  const fieldStyle = { background: "#2d2d2d", borderColor: "#3c3c3c", color: "#cccccc" };
  const btn = "px-3 py-1 text-xs font-sans rounded border transition-colors disabled:opacity-30 hover:enabled:bg-white/10";

  return (
    <div className="h-screen flex flex-col font-mono text-sm overflow-hidden" style={{ background: "#1e1e1e", color: "#d4d4d4" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 shrink-0 border-b" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs transition-colors hover:text-white" style={{ color: "#858585" }}>← Home</Link>
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <span className="font-bold" style={{ color: "#f14c4c" }}>PDF</span>
          <span className="text-sm font-sans font-medium">PDF → CSV</span>
        </div>
        <span className="text-xs font-sans" style={{ color: "#858585" }}>Diproses di browser — file tidak diupload</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left — file + options */}
        <div className="flex flex-col gap-5 p-4 overflow-auto shrink-0" style={{ width: 300, borderRight: "1px solid #3c3c3c" }}>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files[0]); }}
            className="rounded border-2 border-dashed p-6 text-center cursor-pointer transition-colors font-sans"
            style={{ borderColor: dragging ? "#0e639c" : "#3c3c3c", background: dragging ? "#0e639c22" : "#252526" }}
          >
            <p className="text-xs" style={{ color: "#cccccc" }}>Drop PDF di sini</p>
            <p className="text-xs mt-1" style={{ color: "#6a6a6a" }}>atau klik untuk pilih file</p>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => loadFile(e.target.files?.[0])} />
          </div>

          <div className="flex gap-2">
            <button className={btn} style={{ borderColor: "#3c3c3c", color: "#cccccc" }}
              onClick={() => load("example.pdf", examplePdf())}>Use example</button>
            <button className={btn} style={{ borderColor: "#3c3c3c", color: "#cccccc" }}
              onClick={doClear} disabled={!pages && !error}>Clear</button>
          </div>

          {fileName && (
            <div className="text-xs font-sans break-all" style={{ color: "#858585" }}>
              <span style={{ color: "#cccccc" }}>{fileName}</span>
              {pages && ` · ${pages.length} page${pages.length > 1 ? "s" : ""}`}
            </div>
          )}

          <div>
            <span className={label} style={{ color: "#858585" }}>Page</span>
            <select value={page} disabled={!pages} onChange={e => setPage(e.target.value === "all" ? "all" : Number(e.target.value))}
              className={field} style={fieldStyle}>
              <option value="all">All pages</option>
              {pages?.map((_, i) => <option key={i} value={i + 1}>Page {i + 1}</option>)}
            </select>
          </div>

          <div>
            <span className={label} style={{ color: "#858585" }}>Delimiter</span>
            <select value={delim} onChange={e => setDelim(e.target.value)} className={field} style={fieldStyle}>
              {DELIMS.map(d => <option key={d.label} value={d.value}>{d.label}</option>)}
            </select>
          </div>

          <div>
            <span className={label} style={{ color: "#858585" }}>Cell gap: {gap} pt</span>
            <input type="range" min={1} max={30} value={gap} onChange={e => setGap(Number(e.target.value))}
              className="w-full cursor-pointer" style={{ accentColor: "#0e639c" }} />
            <p className="text-xs font-sans mt-1.5 leading-relaxed" style={{ color: "#6a6a6a" }}>
              Teks yang jaraknya lebih kecil dari ini digabung jadi satu sel. Naikkan kalau kata dalam satu sel terpecah, turunkan kalau kolom tergabung.
            </p>
          </div>
        </div>

        {/* Right — Table / CSV */}
        <div className="flex flex-col flex-1 overflow-hidden" style={{ minWidth: 0 }}>
          <div className="flex items-center shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c" }}>
            {(["table", "csv"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="px-4 py-1.5 text-xs font-sans transition-colors"
                style={{
                  color: tab === t ? "#ffffff" : "#858585",
                  borderBottom: tab === t ? "2px solid #0e639c" : "2px solid transparent",
                  background: tab === t ? "#1e1e1e" : "transparent",
                }}
              >{t === "table" ? "Table" : "CSV"}</button>
            ))}
            <div className="ml-auto flex gap-2 px-2">
              <button className={btn} style={{ borderColor: "#3c3c3c", color: "#cccccc" }} onClick={doCopy} disabled={!rows.length}>
                {copied ? "Copied!" : "Copy"}
              </button>
              <button className={btn} style={{ borderColor: "#0e639c", background: "#0e639c", color: "#ffffff" }} onClick={doDownload} disabled={!rows.length}>
                Download .csv
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {loading ? (
              <p className="text-xs font-sans" style={{ color: "#858585" }}>Reading PDF…</p>
            ) : error ? (
              <div className="rounded p-4 border text-xs font-sans" style={{ background: "#2d0000", borderColor: "#5a1a1a", color: "#f44747" }}>
                <p className="font-semibold mb-1">Gagal membaca PDF</p>
                <p className="font-mono opacity-80">{error}</p>
              </div>
            ) : noText ? (
              <p className="text-xs font-sans" style={{ color: "#858585" }}>
                Tidak ada teks di PDF ini. Kemungkinan hasil scan (gambar) — OCR tidak didukung.
              </p>
            ) : !pages ? (
              <p className="text-xs font-sans" style={{ color: "#4a4a4a" }}>Output will appear here</p>
            ) : tab === "csv" ? (
              <pre className="text-xs leading-5 whitespace-pre">{csv}</pre>
            ) : (
              <table className="text-xs border-collapse">
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-white/5">
                      <td className="px-2 py-1 text-right select-none border" style={{ color: "#6a6a6a", borderColor: "#3c3c3c" }}>{i + 1}</td>
                      {Array.from({ length: width }, (_, j) => (
                        <td key={j} className="px-2 py-1 border align-top" style={{ borderColor: "#3c3c3c", maxWidth: 420 }}>{r[j] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {rows.length > 0 && (
            <div className="px-4 py-1.5 text-xs shrink-0 border-t font-sans" style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}>
              {rows.length} rows · {width} columns
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
