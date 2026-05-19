"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { format } from "sql-formatter";

const SqlAceWrapper = dynamic(() => import("./SqlAceWrapper"), { ssr: false });

type Dialect = "sql" | "mysql" | "postgresql" | "sqlite" | "tsql" | "plsql";

const DIALECTS: { value: Dialect; label: string }[] = [
  { value: "sql",        label: "Standard SQL" },
  { value: "mysql",      label: "MySQL" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "sqlite",     label: "SQLite" },
  { value: "tsql",       label: "T-SQL" },
  { value: "plsql",      label: "PL/SQL" },
];

const EXAMPLE = `SELECT u.id, u.name, u.email, COUNT(o.id) AS order_count, SUM(o.total) AS total_spent FROM users u LEFT JOIN orders o ON u.id=o.user_id WHERE u.created_at>='2024-01-01' AND u.status='active' GROUP BY u.id,u.name,u.email HAVING COUNT(o.id)>0 ORDER BY total_spent DESC LIMIT 20`;

function minifySql(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .trim();
}


function IconBtn({ title, onClick, disabled = false, children }: {
  title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      className="flex items-center justify-center w-7 h-7 rounded transition-colors disabled:opacity-25 hover:enabled:bg-white/10"
      style={{ color: "#9d9d9d" }}
    >{children}</button>
  );
}

function tryFormat(sql: string, d: Dialect): { result: string; error: string } {
  try {
    return { result: format(sql, { language: d, keywordCase: "upper", indentStyle: "standard" }), error: "" };
  } catch (e) {
    return { result: "", error: e instanceof Error ? e.message : "Format failed" };
  }
}

export default function SqlFormatter() {
  const [input, setInput]       = useState("");
  const [formatted, setFormatted] = useState("");
  const [error, setError]       = useState("");
  const [dialect, setDialect]   = useState<Dialect>("sql");
  const [copied, setCopied]     = useState(false);

  const updateFormatted = (sql: string, d: Dialect) => {
    if (!sql.trim()) { setFormatted(""); setError(""); return; }
    const { result, error: err } = tryFormat(sql, d);
    setFormatted(result);
    setError(err);
  };

  const handleInput = (sql: string) => {
    setInput(sql);
    updateFormatted(sql, dialect);
  };

  const doFormat = () => {
    if (!input.trim()) return;
    const { result, error: err } = tryFormat(input, dialect);
    if (result) { setInput(result); setFormatted(result); }
    setError(err);
  };

  const doMinify = () => {
    if (!input.trim()) return;
    setInput(minifySql(input));
    // formatted stays — right panel keeps showing formatted version
  };

  const changeDialect = (d: Dialect) => {
    setDialect(d);
    updateFormatted(input, d);
  };

  const doCopy = async () => {
    if (!formatted) return;
    try { await navigator.clipboard.writeText(formatted); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = formatted; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const doPaste = async () => {
    try { const t = await navigator.clipboard.readText(); handleInput(t); }
    catch { alert("Clipboard not accessible over HTTP. Use Ctrl+V / Cmd+V to paste directly."); }
  };

  const doClear = () => { setInput(""); setFormatted(""); setError(""); };

  return (
    <div className="h-screen flex flex-col font-mono text-sm overflow-hidden" style={{ background: "#1e1e1e", color: "#d4d4d4" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 shrink-0 border-b" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs transition-colors hover:text-white" style={{ color: "#858585" }}>← Home</Link>
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <span className="font-bold" style={{ color: "#569cd6" }}>SQL</span>
          <span className="text-sm font-sans font-medium">SQL Formatter</span>
        </div>
        <select
          value={dialect}
          onChange={e => changeDialect(e.target.value as Dialect)}
          className="text-xs font-sans px-2 py-1 rounded border outline-none"
          style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#cccccc" }}
        >
          {DIALECTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </header>

      {/* Panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Input */}
        <div className="flex flex-col" style={{ width: "50%", minWidth: 0, borderRight: "1px solid #3c3c3c" }}>
          <div className="flex items-center gap-0.5 px-2 py-1 shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c" }}>
            <IconBtn title="Format SQL" onClick={() => doFormat()} disabled={!input}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4h12M5 8h9M5 12h9" />
                <path d="M2 6.5l1.5 1.5-1.5 1.5" />
              </svg>
            </IconBtn>
            <IconBtn title="Minify SQL" onClick={doMinify} disabled={!input}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 5h12M2 8h12M2 11h12" />
              </svg>
            </IconBtn>
            <div className="w-px h-4 mx-1" style={{ background: "#3c3c3c" }} />
            <IconBtn title="Paste from clipboard" onClick={doPaste}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="8" height="10" rx="1" />
                <path d="M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1" />
              </svg>
            </IconBtn>
            <IconBtn title="Use example" onClick={() => handleInput(EXAMPLE)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
                <path d="M10 2v3h3" />
                <path d="M5 8h6M5 11h4" />
              </svg>
            </IconBtn>
            <IconBtn title="Clear" onClick={doClear} disabled={!input}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </IconBtn>
            <span className="ml-auto text-xs font-sans" style={{ color: "#858585" }}>
              {input ? `${input.length} chars` : ""}
            </span>
          </div>
          <div className="flex-1 relative" style={{ minHeight: 0 }}>
            <SqlAceWrapper value={input} onChange={handleInput} name="sql-input-editor" />
          </div>
        </div>

        {/* Right — Always formatted output */}
        <div className="flex flex-col" style={{ width: "50%", minWidth: 0 }}>
          <div className="flex items-center gap-0.5 px-2 py-1 shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c" }}>
            {/* Copy */}
            <IconBtn title={copied ? "Copied!" : "Copy formatted SQL"} onClick={doCopy} disabled={!formatted}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="5" width="8" height="9" rx="1" />
                <path d="M3 11V3a1 1 0 011-1h7" />
              </svg>
            </IconBtn>
            <span className="ml-auto text-xs font-sans" style={{ color: "#858585" }}>
              {formatted ? `${formatted.length} chars` : ""}
            </span>
          </div>

          {error ? (
            <div className="p-4">
              <div className="rounded p-4 border text-xs font-sans" style={{ background: "#2d0000", borderColor: "#5a1a1a", color: "#f44747" }}>
                {error}
              </div>
            </div>
          ) : formatted ? (
            <div className="flex-1 relative" style={{ minHeight: 0 }}>
              <SqlAceWrapper value={formatted} name="sql-output-editor" readOnly />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm font-sans" style={{ color: "#4a4a4a" }}>Type or paste SQL on the left, then click Format</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
