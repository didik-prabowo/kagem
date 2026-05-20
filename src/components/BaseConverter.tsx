"use client";

import { useState } from "react";
import Link from "next/link";

// ── Core ───────────────────────────────────────────────────────────────────────

const CHARS = "0123456789abcdefghijklmnopqrstuvwxyz";

function parseNum(input: string, base: number): number | null {
  const s = input.trim().replace(/[\s_]/g, "");
  if (!s || s === "-") return null;
  const neg = s[0] === "-";
  const body = neg ? s.slice(1) : s;
  if (!body) return null;
  const valid = CHARS.slice(0, base);
  if (!body.toLowerCase().split("").every(c => valid.includes(c))) return null;
  const n = parseInt(body, base);
  if (!isFinite(n)) return null;
  return neg ? -n : n;
}

function toBase(n: number, base: number): string {
  if (!isFinite(n) || n !== Math.trunc(n)) return "";
  if (n === 0) return "0";
  const neg = n < 0;
  return (neg ? "-" : "") + Math.abs(n).toString(base);
}

// Group binary string from right, 4 bits per chunk
function groupBin(s: string): string {
  const neg = s.startsWith("-");
  const body = neg ? s.slice(1) : s;
  const pad = (4 - (body.length % 4)) % 4;
  const padded = "0".repeat(pad) + body;
  const chunks: string[] = [];
  for (let i = 0; i < padded.length; i += 4) chunks.push(padded.slice(i, i + 4));
  return (neg ? "-" : "") + chunks.join(" ");
}

type BitWidth = 8 | 16 | 32;

// Two's complement bit string for the given width
function getBits(n: number, width: BitWidth): string {
  const unsigned = width === 32 ? (n >>> 0) : (n & ((1 << width) - 1));
  return unsigned.toString(2).padStart(width, "0");
}

// ── Base row ───────────────────────────────────────────────────────────────────

type RowProps = {
  label: string;
  prefix: string;
  value: string;
  valid: boolean;
  copied: boolean;
  onChange: (v: string) => void;
  onCopy: () => void;
};

function BaseRow({ label, prefix, value, valid, copied, onChange, onCopy }: RowProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-sans" style={{ color: "#858585" }}>{label}</span>
        <span className="text-xs font-mono" style={{ color: "#3c3c3c" }}>{prefix}</span>
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          spellCheck={false}
          className="flex-1 text-xs font-mono px-3 py-2 rounded border outline-none"
          style={{
            background: "#252526",
            borderColor: value && !valid ? "#f44747" : "#3c3c3c",
            color: "#d4d4d4",
            letterSpacing: "0.03em",
          }}
        />
        <button
          onClick={onCopy}
          disabled={!value || !valid}
          className="text-xs font-sans px-2.5 rounded border transition-colors disabled:opacity-30"
          style={{
            background: "#2d2d2d",
            borderColor: "#3c3c3c",
            color: copied ? "#4ec9b0" : "#858585",
          }}
        >
          {copied ? "✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}

// ── Bit viewer ─────────────────────────────────────────────────────────────────

const NIBBLE_COLORS = ["#0e1e2e", "#162030"];

function BitViewer({ bits, width }: { bits: string; width: BitWidth }) {
  const nibbles: string[] = [];
  for (let i = 0; i < bits.length; i += 4) nibbles.push(bits.slice(i, i + 4));

  return (
    <div>
      {/* Bit index labels — top */}
      <div className="flex mb-1" style={{ gap: 2 }}>
        {nibbles.map((_, ni) => (
          <div key={ni} className="flex flex-1">
            {[0, 1, 2, 3].map(bi => {
              const idx = width - 1 - (ni * 4 + bi);
              return (
                <span key={bi} className="flex-1 text-center" style={{ fontSize: 9, color: "#3c3c3c" }}>
                  {idx % 4 === 3 ? idx : ""}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bit boxes */}
      <div className="flex rounded overflow-hidden" style={{ gap: 2 }}>
        {nibbles.map((nib, ni) => (
          <div key={ni} className="flex flex-1 rounded overflow-hidden">
            {nib.split("").map((bit, bi) => (
              <div
                key={bi}
                className="flex-1 flex items-center justify-center font-mono"
                style={{
                  height: 28,
                  fontSize: 11,
                  background: ni % 2 === 0 ? NIBBLE_COLORS[0] : NIBBLE_COLORS[1],
                  color: bit === "1" ? "#61afef" : "#3c3c3c",
                  borderLeft: bi === 0 && ni > 0 ? "1px solid #2a2a2a" : "none",
                }}
              >
                {bit}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Byte hex labels — bottom */}
      {width >= 16 && (
        <div className="flex mt-1" style={{ gap: 2 }}>
          {Array.from({ length: width / 8 }, (_, i) => {
            const byteBits = bits.slice(i * 8, i * 8 + 8);
            const byteVal = parseInt(byteBits, 2);
            return (
              <div key={i} className="flex-1 text-center" style={{ flex: "0 0 calc(50% - 1px)" }}>
                <span className="text-xs font-mono" style={{ color: "#4a4a4a" }}>
                  {byteVal.toString(16).padStart(2, "0")}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

const POWERS2 = [0,1,2,3,4,5,6,7,8,9,10,11,12,16,20,24,32].map(e => ({ exp: e, val: Math.pow(2, e) }));

export default function BaseConverter() {
  const [raw, setRaw] = useState<Record<string, string>>({
    bin: "11111111", oct: "377", dec: "255", hex: "ff",
  });
  const [lastValid, setLastValid]   = useState(255);
  const [width,     setWidth]       = useState<BitWidth>(8);
  const [customBase, setCustomBase] = useState(36);
  const [customRaw,  setCustomRaw]  = useState(toBase(255, 36));
  const [copied,     setCopied]     = useState<string | null>(null);

  const bases = [
    { key: "bin", label: "Binary",      base: 2,  prefix: "0b" },
    { key: "oct", label: "Octal",       base: 8,  prefix: "0o" },
    { key: "dec", label: "Decimal",     base: 10, prefix: ""   },
    { key: "hex", label: "Hexadecimal", base: 16, prefix: "0x" },
  ];

  const spreadFrom = (n: number, skipKey: string) => {
    setLastValid(n);
    const next: Record<string, string> = { ...raw };
    bases.forEach(({ key, base }) => {
      if (key !== skipKey) next[key] = toBase(n, base);
    });
    if (skipKey !== "custom") setCustomRaw(toBase(n, customBase));
    setRaw(next);
  };

  const handleBase = (key: string, base: number, val: string) => {
    setRaw(r => ({ ...r, [key]: val }));
    const n = parseNum(val, base);
    if (n !== null) spreadFrom(n, key);
  };

  const handleCustomBase = (val: number) => {
    const b = Math.max(2, Math.min(36, val));
    setCustomBase(b);
    setCustomRaw(toBase(lastValid, b));
  };

  const handleCustomVal = (val: string) => {
    setCustomRaw(val);
    const n = parseNum(val, customBase);
    if (n !== null) spreadFrom(n, "custom");
  };

  const doCopy = async (text: string, key: string) => {
    if (!text) return;
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

  const bits = getBits(lastValid, width);

  return (
    <div className="h-screen flex flex-col font-mono text-sm overflow-hidden" style={{ background: "#1e1e1e", color: "#d4d4d4" }}>

      {/* Header */}
      <header className="flex items-center px-4 py-2 shrink-0 border-b gap-3" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
        <Link href="/" className="text-xs transition-colors hover:text-white" style={{ color: "#858585" }}>← Home</Link>
        <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
        <span className="font-bold" style={{ color: "#98c379" }}>0x</span>
        <span className="text-sm font-sans font-medium">Number Base Converter</span>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — inputs */}
        <div className="flex flex-col gap-5 p-5 shrink-0 overflow-auto" style={{ width: "300px", borderRight: "1px solid #3c3c3c" }}>

          {/* Base inputs */}
          {bases.map(({ key, label, base, prefix }) => {
            const val = base === 2 ? groupBin(raw[key]) : raw[key];
            const rawVal = raw[key];
            const valid = !rawVal || parseNum(rawVal, base) !== null;
            const copyText = base === 16 ? "0x" + rawVal : base === 2 ? "0b" + rawVal.replace(/\s/g, "") : rawVal;
            return (
              <BaseRow
                key={key}
                label={label}
                prefix={prefix}
                value={base === 2 ? groupBin(raw[key]) : raw[key]}
                valid={valid}
                copied={copied === key}
                onChange={v => handleBase(key, base, v.replace(/[\s_]/g, ""))}
                onCopy={() => doCopy(copyText, key)}
              />
            );
          })}

          <div className="h-px" style={{ background: "#3c3c3c" }} />

          {/* Bit width */}
          <div>
            <span className="text-xs font-sans block mb-2" style={{ color: "#858585" }}>Bit width (visualization)</span>
            <div className="flex gap-1">
              {([8, 16, 32] as BitWidth[]).map(w => (
                <button
                  key={w}
                  onClick={() => setWidth(w)}
                  className="flex-1 py-1.5 text-xs font-sans rounded border transition-colors"
                  style={{
                    background:  width === w ? "#0e1e2e" : "transparent",
                    borderColor: width === w ? "#0e639c" : "#3c3c3c",
                    color:       width === w ? "#61afef" : "#555",
                  }}
                >{w}-bit</button>
              ))}
            </div>
          </div>

          {/* Custom base */}
          <div>
            <span className="text-xs font-sans block mb-2" style={{ color: "#858585" }}>
              Custom base <span style={{ color: "#3c3c3c" }}>(2–36)</span>
            </span>
            <div className="flex gap-2 mb-2">
              <input
                type="number" min={2} max={36} value={customBase}
                onChange={e => handleCustomBase(Number(e.target.value))}
                className="w-16 text-xs font-mono text-center px-2 py-1.5 rounded border outline-none"
                style={{ background: "#252526", borderColor: "#3c3c3c", color: "#d4d4d4" }}
              />
              <input
                type="text"
                value={customRaw}
                onChange={e => handleCustomVal(e.target.value)}
                spellCheck={false}
                placeholder="value"
                className="flex-1 text-xs font-mono px-3 py-1.5 rounded border outline-none"
                style={{
                  background: "#252526",
                  borderColor: customRaw && parseNum(customRaw, customBase) === null ? "#f44747" : "#3c3c3c",
                  color: "#d4d4d4",
                }}
              />
              <button
                onClick={() => doCopy(customRaw, "custom")}
                disabled={!customRaw || parseNum(customRaw, customBase) === null}
                className="text-xs font-sans px-2.5 rounded border transition-colors disabled:opacity-30"
                style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: copied === "custom" ? "#4ec9b0" : "#858585" }}
              >{copied === "custom" ? "✓" : "Copy"}</button>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="flex flex-col flex-1 p-6 gap-6 overflow-auto">

          {/* Bit visualization */}
          <div>
            <span className="text-xs font-sans block mb-3" style={{ color: "#858585" }}>
              {width}-bit pattern · decimal {lastValid} · hex {toBase(lastValid, 16).padStart(width / 4, "0")}
            </span>
            <BitViewer bits={bits} width={width} />
          </div>

          <div className="h-px" style={{ background: "#3c3c3c" }} />

          {/* Powers of 2 reference */}
          <div>
            <span className="text-xs font-sans block mb-3" style={{ color: "#858585" }}>Powers of 2 reference</span>
            <div className="grid gap-1" style={{ gridTemplateColumns: "auto auto auto auto" }}>
              <span className="text-xs font-sans pb-1 border-b" style={{ color: "#4a4a4a", borderColor: "#3c3c3c" }}>exp</span>
              <span className="text-xs font-sans pb-1 border-b" style={{ color: "#4a4a4a", borderColor: "#3c3c3c" }}>decimal</span>
              <span className="text-xs font-sans pb-1 border-b" style={{ color: "#4a4a4a", borderColor: "#3c3c3c" }}>hex</span>
              <span className="text-xs font-sans pb-1 border-b" style={{ color: "#4a4a4a", borderColor: "#3c3c3c" }}></span>
              {POWERS2.map(({ exp, val }) => {
                const isActive = lastValid === val;
                return [
                  <span key={`e${exp}`} className="text-xs font-mono py-0.5" style={{ color: isActive ? "#98c379" : "#4a4a4a" }}>2^{exp}</span>,
                  <span key={`d${exp}`} className="text-xs font-mono py-0.5" style={{ color: isActive ? "#98c379" : "#858585" }}>{val.toLocaleString()}</span>,
                  <span key={`h${exp}`} className="text-xs font-mono py-0.5" style={{ color: isActive ? "#98c379" : "#858585" }}>0x{val.toString(16)}</span>,
                  <button key={`u${exp}`} onClick={() => spreadFrom(val, "")}
                    className="text-xs font-sans px-1.5 py-0.5 rounded transition-colors justify-self-start"
                    style={{ background: isActive ? "#0e1e2e" : "transparent", color: isActive ? "#61afef" : "#3c3c3c", border: `1px solid ${isActive ? "#0e639c" : "transparent"}` }}
                  >use</button>,
                ];
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
