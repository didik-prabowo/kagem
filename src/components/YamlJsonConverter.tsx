"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import yaml from "js-yaml";

const YamlAceWrapper = dynamic(() => import("./YamlAceWrapper"), { ssr: false });
const AceWrapper     = dynamic(() => import("./AceWrapper"),     { ssr: false });

// ── .ENV helpers ───────────────────────────────────────────────────────────────

function parseEnvToObj(text: string): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (key) obj[key] = val;
  }
  return obj;
}

function flattenObj(obj: unknown, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  if (obj === null || obj === undefined) return out;
  if (typeof obj !== "object") {
    if (prefix) out[prefix] = String(obj);
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      Object.assign(out, flattenObj(item, prefix ? `${prefix}_${i}` : String(i)));
    });
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = (prefix ? `${prefix}_${k}` : k).toUpperCase().replace(/[^A-Z0-9]/g, "_");
    Object.assign(out, flattenObj(v, key));
  }
  return out;
}

function objToEnv(obj: unknown): string {
  const flat = flattenObj(obj);
  return Object.entries(flat).map(([k, v]) => {
    const needsQuotes = /[\s#"'\\]/.test(v) || v === "";
    return `${k}=${needsQuotes ? `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : v}`;
  }).join("\n");
}

// ── Conversion ─────────────────────────────────────────────────────────────────

type Source = "yaml" | "json";

function parseSource(text: string, source: Source): { obj: unknown; error: string } {
  try {
    if (source === "yaml") return { obj: yaml.load(text), error: "" };
    if (source === "json") return { obj: JSON.parse(text), error: "" };
    return { obj: parseEnvToObj(text), error: "" };
  } catch (e) {
    return { obj: null, error: (e as Error).message };
  }
}

function serializeTarget(obj: unknown, target: Source): string {
  if (obj === null || obj === undefined) return "";
  if (target === "yaml") return yaml.dump(obj, { indent: 2, lineWidth: -1, quotingType: '"' });
  if (target === "json") return JSON.stringify(obj, null, 2);
  return objToEnv(obj);
}

// ── Icon buttons ───────────────────────────────────────────────────────────────

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

const IcoPaste = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="4" y="4" width="9" height="10" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M6 8h4M6 11h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

function IcoCopy({ ok }: { ok: boolean }) {
  return ok
    ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="#4ec9b0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="8" height="9" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M3 11V3a1 1 0 011-1h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
}

// ── Example ────────────────────────────────────────────────────────────────────

const EXAMPLE_YAML = `# Application config
app:
  name: MyApp
  version: "2.1.0"
  debug: false

server:
  host: 0.0.0.0
  port: 8080

database:
  host: db.internal
  port: 5432
  name: myapp_prod
  pool:
    min: 2
    max: 20
`;

// ── Panel toolbar ──────────────────────────────────────────────────────────────

function PanelBar({ label, color, lines, copied, onPaste, onCopy }: {
  label: string; color: string; lines: number | null;
  copied: boolean; onPaste: () => void; onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5 px-2 py-1 shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c" }}>
      <span className="text-xs font-sans font-semibold px-1 mr-1" style={{ color }}>{label}</span>
      <div className="w-px h-4 mr-0.5" style={{ background: "#3c3c3c" }} />
      <IconBtn title="Paste" onClick={onPaste}><IcoPaste /></IconBtn>
      <IconBtn title="Copy" onClick={onCopy}><IcoCopy ok={copied} /></IconBtn>
      <div className="flex-1" />
      {lines !== null && <span className="text-xs font-sans px-2" style={{ color: "#4a4a4a" }}>{lines} lines</span>}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function YamlJsonConverter() {
  const [yamlText, setYamlText] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [envText,  setEnvText]  = useState("");
  const [error,    setError]    = useState("");
  const [copied,   setCopied]   = useState<string | null>(null);

  const handleChange = (text: string, source: Source) => {
    if (source === "yaml") setYamlText(text);
    if (source === "json") setJsonText(text);

    if (!text.trim()) {
      if (source !== "yaml") setYamlText("");
      if (source !== "json") setJsonText("");
      setEnvText("");
      setError("");
      return;
    }

    const { obj, error: err } = parseSource(text, source);
    if (err) { setError(err); return; }
    setError("");

    const other: Source = source === "yaml" ? "json" : "yaml";
    const otherOut = serializeTarget(obj, other);
    if (other === "yaml") setYamlText(otherOut);
    if (other === "json") setJsonText(otherOut);
    setEnvText(objToEnv(obj));
  };

  const doClear = () => { setYamlText(""); setJsonText(""); setEnvText(""); setError(""); };

  const doPaste = async (target: Source) => {
    try { handleChange(await navigator.clipboard.readText(), target); }
    catch { alert("Clipboard not accessible over HTTP. Use Ctrl+V to paste directly."); }
  };

  const doCopy = async (text: string, source: string) => {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(source);
    setTimeout(() => setCopied(null), 1500);
  };

  const lines = (t: string) => t ? t.split("\n").length : null;

  return (
    <div className="h-screen flex flex-col font-mono text-sm overflow-hidden" style={{ background: "#1e1e1e", color: "#d4d4d4" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 shrink-0 border-b" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs transition-colors hover:text-white" style={{ color: "#858585" }}>← Home</Link>
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <span className="font-bold" style={{ color: "#dcdcaa" }}>YAML</span>
          <span className="text-sm font-sans font-medium">YAML ↔ JSON ↔ .ENV</span>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-xs font-sans px-2 py-0.5 rounded truncate max-w-sm" style={{ background: "#2d0000", color: "#f44747" }}>
              {error}
            </span>
          )}
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <button onClick={() => handleChange(EXAMPLE_YAML, "yaml")} className="text-xs font-sans px-2.5 py-1 rounded" style={{ background: "#3c3c3c", color: "#cccccc" }}>Use example</button>
          <button onClick={doClear} disabled={!yamlText && !jsonText && !envText} className="text-xs font-sans px-2.5 py-1 rounded disabled:opacity-30" style={{ background: "#3c3c3c", color: "#cccccc" }}>Clear</button>
        </div>
      </header>

      {/* Three panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* YAML */}
        <div className="flex flex-col" style={{ width: "33.333%", minWidth: 0, borderRight: "1px solid #3c3c3c" }}>
          <PanelBar label="YAML" color="#dcdcaa" lines={lines(yamlText)}
            copied={copied === "yaml"} onPaste={() => doPaste("yaml")} onCopy={() => doCopy(yamlText, "yaml")} />
          <div className="flex-1 relative" style={{ minHeight: 0 }}>
            <YamlAceWrapper value={yamlText} onChange={v => handleChange(v, "yaml")} name="yaml-editor" />
          </div>
        </div>

        {/* JSON */}
        <div className="flex flex-col" style={{ width: "33.333%", minWidth: 0, borderRight: "1px solid #3c3c3c" }}>
          <PanelBar label="JSON" color="#569cd6" lines={lines(jsonText)}
            copied={copied === "json"} onPaste={() => doPaste("json")} onCopy={() => doCopy(jsonText, "json")} />
          <div className="flex-1 relative" style={{ minHeight: 0 }}>
            <AceWrapper value={jsonText} onChange={v => handleChange(v, "json")} name="json-yaml-editor" />
          </div>
        </div>

        {/* .ENV — read-only output */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center gap-0.5 px-2 py-1 shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c" }}>
            <span className="text-xs font-sans font-semibold px-1 mr-1" style={{ color: "#ce9178" }}>.ENV</span>
            <span className="text-xs font-sans px-1" style={{ color: "#4a4a4a" }}>output only</span>
            <div className="flex-1" />
            {lines(envText) && <span className="text-xs font-sans px-2" style={{ color: "#4a4a4a" }}>{lines(envText)} lines</span>}
            <IconBtn title="Copy" onClick={() => doCopy(envText, "env")} disabled={!envText}>
              <IcoCopy ok={copied === "env"} />
            </IconBtn>
          </div>
          <div className="flex-1 relative" style={{ minHeight: 0 }}>
            <textarea
              value={envText}
              readOnly
              className="absolute inset-0 resize-none outline-none text-xs font-mono p-4 cursor-default"
              style={{ background: "#1e1e1e", color: "#ce9178", lineHeight: "1.6" }}
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
