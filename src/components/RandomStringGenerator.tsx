"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ── Generation logic ───────────────────────────────────────────────────────────

const CHARSETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  digits:    "0123456789",
  symbols:   "!@#$%^&*()-_=+[]{}|;:,.<>?/",
};

type CharsetKey = keyof typeof CHARSETS;

function buildCharset(enabled: Record<CharsetKey, boolean>, excludeAmbiguous: boolean, custom: string): string {
  let chars = "";
  if (enabled.uppercase) chars += CHARSETS.uppercase;
  if (enabled.lowercase) chars += CHARSETS.lowercase;
  if (enabled.digits)    chars += CHARSETS.digits;
  if (enabled.symbols)   chars += CHARSETS.symbols;
  chars += custom;
  if (excludeAmbiguous)  chars = chars.replace(/[0O1lI]/g, "");
  return [...new Set(chars)].join("");
}

function generateOne(length: number, charset: string): string {
  if (!charset) return "";
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, n => charset[n % charset.length]).join("");
}

// ── Toggle button ──────────────────────────────────────────────────────────────

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 text-xs font-mono rounded border transition-colors"
      style={{
        borderColor: active ? "#0e639c" : "#3c3c3c",
        background:  active ? "#0e1e2e" : "transparent",
        color:       active ? "#569cd6" : "#555",
      }}
    >{label}</button>
  );
}

// ── Checkbox option ────────────────────────────────────────────────────────────

function CheckOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="flex items-center gap-2 text-xs font-sans transition-colors"
      style={{ color: checked ? "#d4d4d4" : "#555" }}
    >
      <span className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0"
        style={{ borderColor: checked ? "#569cd6" : "#444" }}>
        {checked && <span style={{ color: "#569cd6", fontSize: 9, lineHeight: 1 }}>✓</span>}
      </span>
      {label}
    </button>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function RandomStringGenerator() {
  const [length,   setLength]   = useState(16);
  const [quantity, setQuantity] = useState(10);
  const [enabled,  setEnabled]  = useState<Record<CharsetKey, boolean>>({
    uppercase: true,
    lowercase: true,
    digits:    true,
    symbols:   false,
  });
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false);
  const [custom,   setCustom]   = useState("");
  const [results,  setResults]  = useState<string[]>([]);
  const [copied,   setCopied]   = useState<number | "all" | null>(null);
  const [tick,     setTick]     = useState(0);

  const charset = buildCharset(enabled, excludeAmbiguous, custom);

  const regenerate = useCallback(() => {
    if (!charset) { setResults([]); return; }
    setResults(Array.from({ length: quantity }, () => generateOne(length, charset)));
  }, [length, quantity, charset]);

  // auto-generate when settings change
  useEffect(() => { regenerate(); }, [regenerate, tick]);

  const toggleCharset = (key: CharsetKey) =>
    setEnabled(prev => ({ ...prev, [key]: !prev[key] }));

  const clampLength   = (v: number) => Math.max(1,  Math.min(256, v));
  const clampQuantity = (v: number) => Math.max(1,  Math.min(50,  v));

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

  const copyAll = () => doCopy(results.join("\n"), "all");

  const charsetLabels: { key: CharsetKey; label: string }[] = [
    { key: "uppercase", label: "A–Z" },
    { key: "lowercase", label: "a–z" },
    { key: "digits",    label: "0–9" },
    { key: "symbols",   label: "!@#" },
  ];

  return (
    <div className="h-screen flex flex-col font-mono text-sm overflow-hidden" style={{ background: "#1e1e1e", color: "#d4d4d4" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 shrink-0 border-b" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs transition-colors hover:text-white" style={{ color: "#858585" }}>← Home</Link>
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <span className="font-bold" style={{ color: "#4ec9b0" }}>RNG</span>
          <span className="text-sm font-sans font-medium">Random String Generator</span>
        </div>
        <div className="flex items-center gap-2">
          {!charset && (
            <span className="text-xs font-sans px-2 py-0.5 rounded" style={{ background: "#2d0000", color: "#f44747" }}>
              No characters selected
            </span>
          )}
          <button
            onClick={() => setTick(t => t + 1)}
            disabled={!charset}
            className="flex items-center gap-1.5 text-xs font-sans px-2.5 py-1 rounded border transition-colors disabled:opacity-30"
            style={{ background: "#0e1e2e", borderColor: "#0e639c", color: "#569cd6" }}
          >
            {/* refresh icon */}
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M13.5 8A5.5 5.5 0 112.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M2.5 2v3.5H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Regenerate
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — settings */}
        <div className="flex flex-col gap-5 p-5 overflow-auto shrink-0" style={{ width: "300px", borderRight: "1px solid #3c3c3c" }}>

          {/* Length */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-sans" style={{ color: "#858585" }}>Length</span>
              <input
                type="number"
                value={length}
                onChange={e => setLength(clampLength(Number(e.target.value)))}
                className="w-14 text-xs font-mono text-right px-2 py-0.5 rounded border outline-none"
                style={{ background: "#252526", borderColor: "#3c3c3c", color: "#d4d4d4" }}
                min={1} max={256}
              />
            </div>
            <input
              type="range"
              min={1} max={128}
              value={Math.min(length, 128)}
              onChange={e => setLength(Number(e.target.value))}
              className="w-full accent-blue-500"
              style={{ accentColor: "#569cd6" }}
            />
            <div className="flex justify-between text-xs font-sans mt-0.5" style={{ color: "#4a4a4a" }}>
              <span>1</span><span>128</span>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <span className="text-xs font-sans block mb-2" style={{ color: "#858585" }}>Quantity</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setQuantity(q => clampQuantity(q - 1))} className="w-7 h-7 rounded border text-sm transition-colors hover:bg-white/10" style={{ borderColor: "#3c3c3c", color: "#858585" }}>−</button>
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(clampQuantity(Number(e.target.value)))}
                className="flex-1 text-xs font-mono text-center px-2 py-1 rounded border outline-none"
                style={{ background: "#252526", borderColor: "#3c3c3c", color: "#d4d4d4" }}
                min={1} max={50}
              />
              <button onClick={() => setQuantity(q => clampQuantity(q + 1))} className="w-7 h-7 rounded border text-sm transition-colors hover:bg-white/10" style={{ borderColor: "#3c3c3c", color: "#858585" }}>+</button>
            </div>
          </div>

          {/* Character sets */}
          <div>
            <span className="text-xs font-sans block mb-2" style={{ color: "#858585" }}>Characters</span>
            <div className="flex flex-wrap gap-2">
              {charsetLabels.map(({ key, label }) => (
                <Toggle key={key} label={label} active={enabled[key]} onClick={() => toggleCharset(key)} />
              ))}
            </div>
            {charset && (
              <p className="mt-2 text-xs font-mono leading-4 break-all" style={{ color: "#4a4a4a" }}>
                {charset.length} chars: {charset.slice(0, 40)}{charset.length > 40 ? "…" : ""}
              </p>
            )}
          </div>

          {/* Options */}
          <div>
            <span className="text-xs font-sans block mb-2" style={{ color: "#858585" }}>Options</span>
            <div className="flex flex-col gap-2">
              <CheckOption
                label="Exclude ambiguous (0 O 1 l I)"
                checked={excludeAmbiguous}
                onChange={() => setExcludeAmbiguous(v => !v)}
              />
            </div>
          </div>

          {/* Custom characters */}
          <div>
            <span className="text-xs font-sans block mb-2" style={{ color: "#858585" }}>Custom characters</span>
            <input
              value={custom}
              onChange={e => setCustom(e.target.value)}
              placeholder="e.g. €£¥₿"
              className="w-full px-2.5 py-1.5 text-xs font-mono rounded border outline-none"
              style={{ background: "#252526", borderColor: "#3c3c3c", color: "#d4d4d4", caretColor: "#d4d4d4" }}
              spellCheck={false}
            />
          </div>
        </div>

        {/* Right — results */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1 shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c" }}>
            <span className="text-xs font-sans" style={{ color: "#858585" }}>
              {results.length > 0 ? `${results.length} strings · ${length} chars each` : "Results"}
            </span>
            {results.length > 0 && (
              <button
                onClick={copyAll}
                className="text-xs font-sans px-2.5 py-0.5 rounded transition-colors"
                style={{ background: "#3c3c3c", color: copied === "all" ? "#4ec9b0" : "#cccccc" }}
              >
                {copied === "all" ? "Copied!" : "Copy all"}
              </button>
            )}
          </div>

          {!charset ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm font-sans" style={{ color: "#4a4a4a" }}>Select at least one character set</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              {results.map((str, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 border-b"
                  style={{ borderColor: "#2a2a2a", minHeight: 36 }}
                >
                  <span className="text-xs shrink-0 w-6 text-right" style={{ color: "#4a4a4a" }}>{i + 1}</span>
                  <span className="flex-1 text-xs font-mono py-2 select-all break-all" style={{ color: "#ce9178" }}>{str}</span>
                  <button
                    onClick={() => doCopy(str, i)}
                    className="shrink-0 text-xs font-sans px-2 py-0.5 rounded transition-colors"
                    style={{ background: "#2d2d2d", color: copied === i ? "#4ec9b0" : "#858585" }}
                  >
                    {copied === i ? "✓" : "Copy"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
