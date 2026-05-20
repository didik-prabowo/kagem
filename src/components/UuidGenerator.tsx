"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ── UUID generation ────────────────────────────────────────────────────────────

function uuidv4(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

function uuidv7(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  // Write 48-bit timestamp into bytes 0–5 using division to avoid
  // 32-bit bitwise operator limitations on large integers.
  let t = Date.now();
  for (let i = 5; i >= 0; i--) { b[i] = t % 256; t = Math.floor(t / 256); }
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

function applyFormat(uuid: string, uppercase: boolean, noHyphens: boolean, braces: boolean): string {
  let s = uuid;
  if (noHyphens) s = s.replace(/-/g, "");
  if (uppercase) s = s.toUpperCase();
  if (braces)    s = `{${s}}`;
  return s;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function CheckOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="flex items-center gap-2 text-xs font-sans transition-colors" style={{ color: checked ? "#d4d4d4" : "#555" }}>
      <span className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0" style={{ borderColor: checked ? "#569cd6" : "#444" }}>
        {checked && <span style={{ color: "#569cd6", fontSize: 9, lineHeight: 1 }}>✓</span>}
      </span>
      {label}
    </button>
  );
}

type Version = "v4" | "v7";

// ── Main ───────────────────────────────────────────────────────────────────────

export default function UuidGenerator() {
  const [version,   setVersion]   = useState<Version>("v4");
  const [quantity,  setQuantity]  = useState(10);
  const [uppercase, setUppercase] = useState(false);
  const [noHyphens, setNoHyphens] = useState(false);
  const [braces,    setBraces]    = useState(false);
  const [results,   setResults]   = useState<string[]>([]);
  const [copied,    setCopied]    = useState<number | "all" | null>(null);
  const [tick,      setTick]      = useState(0);

  const generate = useCallback(() => {
    const raw = Array.from({ length: quantity }, () => version === "v4" ? uuidv4() : uuidv7());
    setResults(raw.map(u => applyFormat(u, uppercase, noHyphens, braces)));
  }, [version, quantity, uppercase, noHyphens, braces]);

  useEffect(() => { generate(); }, [generate, tick]);

  const clamp = (v: number) => Math.max(1, Math.min(50, v));

  const doCopy = async (text: string, key: number | "all") => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="h-screen flex flex-col font-mono text-sm overflow-hidden" style={{ background: "#1e1e1e", color: "#d4d4d4" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 shrink-0 border-b" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs transition-colors hover:text-white" style={{ color: "#858585" }}>← Home</Link>
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <span className="font-bold" style={{ color: "#c586c0" }}>UUID</span>
          <span className="text-sm font-sans font-medium">UUID Generator</span>
        </div>
        <button
          onClick={() => setTick(t => t + 1)}
          className="flex items-center gap-1.5 text-xs font-sans px-2.5 py-1 rounded border transition-colors"
          style={{ background: "#0e1e2e", borderColor: "#0e639c", color: "#569cd6" }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M13.5 8A5.5 5.5 0 112.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M2.5 2v3.5H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Regenerate
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — settings */}
        <div className="flex flex-col gap-6 p-5 overflow-auto shrink-0" style={{ width: "280px", borderRight: "1px solid #3c3c3c" }}>

          {/* Version */}
          <div>
            <span className="text-xs font-sans block mb-2" style={{ color: "#858585" }}>Version</span>
            <div className="flex gap-2">
              {(["v4", "v7"] as Version[]).map(v => (
                <button
                  key={v}
                  onClick={() => setVersion(v)}
                  className="flex-1 py-1.5 text-xs font-mono rounded border transition-colors"
                  style={{
                    borderColor: version === v ? "#0e639c" : "#3c3c3c",
                    background:  version === v ? "#0e1e2e" : "transparent",
                    color:       version === v ? "#569cd6" : "#555",
                  }}
                >{v}</button>
              ))}
            </div>
            <p className="mt-2 text-xs font-sans leading-4" style={{ color: "#4a4a4a" }}>
              {version === "v4"
                ? "Fully random — the most common UUID format."
                : "Time-ordered — monotonically sortable, great for database primary keys."}
            </p>
          </div>

          {/* Quantity */}
          <div>
            <span className="text-xs font-sans block mb-2" style={{ color: "#858585" }}>Quantity</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setQuantity(q => clamp(q - 1))} className="w-7 h-7 rounded border text-sm hover:bg-white/10 transition-colors" style={{ borderColor: "#3c3c3c", color: "#858585" }}>−</button>
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(clamp(Number(e.target.value)))}
                className="flex-1 text-xs font-mono text-center px-2 py-1 rounded border outline-none"
                style={{ background: "#252526", borderColor: "#3c3c3c", color: "#d4d4d4" }}
                min={1} max={50}
              />
              <button onClick={() => setQuantity(q => clamp(q + 1))} className="w-7 h-7 rounded border text-sm hover:bg-white/10 transition-colors" style={{ borderColor: "#3c3c3c", color: "#858585" }}>+</button>
            </div>
          </div>

          {/* Format */}
          <div>
            <span className="text-xs font-sans block mb-2" style={{ color: "#858585" }}>Format</span>
            <div className="flex flex-col gap-2.5">
              <CheckOption label="Uppercase" checked={uppercase} onChange={() => setUppercase(v => !v)} />
              <CheckOption label="No hyphens" checked={noHyphens} onChange={() => setNoHyphens(v => !v)} />
              <CheckOption label="Braces  { }" checked={braces} onChange={() => setBraces(v => !v)} />
            </div>
            {/* Preview */}
            <div className="mt-3 px-2.5 py-2 rounded text-xs font-mono break-all" style={{ background: "#252526", color: "#c586c0", border: "1px solid #3c3c3c" }}>
              {results[0] ?? applyFormat("550e8400-e29b-41d4-a716-446655440000", uppercase, noHyphens, braces)}
            </div>
          </div>
        </div>

        {/* Right — results */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1 shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c" }}>
            <span className="text-xs font-sans" style={{ color: "#858585" }}>
              {results.length > 0 ? `${results.length} UUIDs` : "Results"}
            </span>
            {results.length > 0 && (
              <button
                onClick={() => doCopy(results.join("\n"), "all")}
                className="text-xs font-sans px-2.5 py-0.5 rounded transition-colors"
                style={{ background: "#3c3c3c", color: copied === "all" ? "#4ec9b0" : "#cccccc" }}
              >
                {copied === "all" ? "Copied!" : "Copy all"}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {results.map((uuid, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 border-b"
                style={{ borderColor: "#2a2a2a", minHeight: 36 }}
              >
                <span className="text-xs shrink-0 w-6 text-right" style={{ color: "#4a4a4a" }}>{i + 1}</span>
                <span className="flex-1 text-xs font-mono py-2 select-all" style={{ color: "#c586c0" }}>{uuid}</span>
                <button
                  onClick={() => doCopy(uuid, i)}
                  className="shrink-0 text-xs font-sans px-2 py-0.5 rounded transition-colors"
                  style={{ background: "#2d2d2d", color: copied === i ? "#4ec9b0" : "#858585" }}
                >
                  {copied === i ? "✓" : "Copy"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
