"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

type Mode = "encode" | "decode";

function encodeBase64(text: string, urlSafe: boolean): string {
  const bytes = new TextEncoder().encode(text);
  const bin = Array.from(bytes, (b) => String.fromCodePoint(b)).join("");
  let b64 = btoa(bin);
  if (urlSafe) b64 = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return b64;
}

function decodeBase64(b64: string, urlSafe: boolean): string {
  let s = b64.trim();
  if (urlSafe) s = s.replace(/-/g, "+").replace(/_/g, "/");
  // re-pad
  s += "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export default function Base64Converter() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("encode");
  const [urlSafe, setUrlSafe] = useState(false);
  const [copied, setCopied] = useState(false);

  const convert = useCallback((val: string, m: Mode, us: boolean) => {
    if (!val) { setOutput(""); setError(""); return; }
    try {
      setOutput(m === "encode" ? encodeBase64(val, us) : decodeBase64(val, us));
      setError("");
    } catch {
      setOutput("");
      setError(m === "decode" ? "Input bukan Base64 yang valid" : "Gagal encode");
    }
  }, []);

  const onInput = (val: string) => { setInput(val); convert(val, mode, urlSafe); };

  const switchMode = (m: Mode) => {
    setMode(m);
    convert(input, m, urlSafe);
  };

  const toggleUrlSafe = () => {
    const next = !urlSafe;
    setUrlSafe(next);
    convert(input, mode, next);
  };

  const doCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = output;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const doPaste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      onInput(t);
    } catch {
      alert("Clipboard not accessible over HTTP. Use Ctrl+V / Cmd+V to paste directly.");
    }
  };

  const doSwap = () => {
    const nextMode: Mode = mode === "encode" ? "decode" : "encode";
    setInput(output);
    setMode(nextMode);
    convert(output, nextMode, urlSafe);
  };

  const doClear = () => { setInput(""); setOutput(""); setError(""); };

  return (
    <div
      className="h-screen flex flex-col font-mono text-sm overflow-hidden"
      style={{ background: "#1e1e1e", color: "#d4d4d4" }}
    >
      {/* ── Header ── */}
      <header
        className="flex items-center justify-between px-4 py-2 shrink-0 border-b"
        style={{ background: "#252526", borderColor: "#3c3c3c" }}
      >
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs transition-colors hover:text-white" style={{ color: "#858585" }}>
            ← Home
          </Link>
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <span className="font-bold" style={{ color: "#ce9178" }}>B64</span>
          <span className="text-sm font-sans font-medium">Base64 Converter</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mode toggle */}
          <div className="flex rounded overflow-hidden border" style={{ borderColor: "#3c3c3c" }}>
            {(["encode", "decode"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className="px-3 py-1 text-xs font-sans capitalize transition-colors"
                style={{
                  background: mode === m ? "#0e639c" : "#2d2d2d",
                  color: mode === m ? "#fff" : "#858585",
                }}
              >
                {m}
              </button>
            ))}
          </div>

          {/* URL-safe toggle */}
          <button
            onClick={toggleUrlSafe}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-sans rounded border transition-colors"
            style={{
              borderColor: urlSafe ? "#0e639c" : "#3c3c3c",
              background: urlSafe ? "#0e1e2e" : "transparent",
              color: urlSafe ? "#569cd6" : "#858585",
            }}
          >
            <span
              className="w-3 h-3 rounded-sm border flex items-center justify-center"
              style={{ borderColor: urlSafe ? "#569cd6" : "#555" }}
            >
              {urlSafe && <span style={{ color: "#569cd6", fontSize: 9, lineHeight: 1 }}>✓</span>}
            </span>
            URL-safe
          </button>

          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />

          {[
            { label: copied ? "✓ Copied" : "Copy", action: doCopy, disabled: !output },
            { label: "Paste",  action: doPaste,  disabled: false },
            { label: "Swap ⇅", action: doSwap,   disabled: !output },
            { label: "Clear",  action: doClear,  disabled: !input },
          ].map(({ label, action, disabled }) => (
            <button
              key={label}
              onClick={action}
              disabled={disabled}
              className="px-3 py-1 text-xs font-sans rounded transition-colors disabled:opacity-30"
              style={{ background: "#3c3c3c", color: "#cccccc" }}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Panels ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Input */}
        <div className="flex flex-col" style={{ width: "50%", borderRight: "1px solid #3c3c3c" }}>
          <div
            className="flex items-center justify-between px-3 py-1 text-xs shrink-0 border-b font-sans"
            style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}
          >
            <span>{mode === "encode" ? "Plain text" : "Base64"}</span>
            {input && <span>{input.length} chars</span>}
          </div>
          <textarea
            value={input}
            onChange={(e) => onInput(e.target.value)}
            placeholder={mode === "encode" ? "Type or paste text here..." : "Paste Base64 string here..."}
            className="flex-1 resize-none outline-none text-sm leading-6 p-4 font-mono"
            style={{ background: "#1e1e1e", color: "#d4d4d4", caretColor: "#d4d4d4" }}
            spellCheck={false}
          />
        </div>

        {/* Right — Output */}
        <div className="flex flex-col flex-1">
          <div
            className="flex items-center justify-between px-3 py-1 text-xs shrink-0 border-b font-sans"
            style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}
          >
            <span>{mode === "encode" ? "Base64" : "Plain text"}</span>
            {output && <span>{output.length} chars</span>}
          </div>

          {error ? (
            <div className="p-4">
              <div
                className="rounded p-4 border text-xs font-sans"
                style={{ background: "#2d0000", borderColor: "#5a1a1a", color: "#f44747" }}
              >
                {error}
              </div>
            </div>
          ) : (
            <textarea
              value={output}
              readOnly
              placeholder="Output will appear here..."
              className="flex-1 resize-none outline-none text-sm leading-6 p-4 font-mono"
              style={{ background: "#1a1a1a", color: "#d4d4d4", cursor: "default" }}
              spellCheck={false}
            />
          )}
        </div>
      </div>

      {/* ── Footer — stats ── */}
      {(input || output) && !error && (
        <div
          className="flex items-center gap-6 px-4 py-1.5 text-xs font-sans shrink-0 border-t"
          style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}
        >
          {input && <span>Input: {input.length} chars</span>}
          {output && <span>Output: {output.length} chars</span>}
          {input && output && (
            <span>
              Ratio:{" "}
              <span style={{ color: "#d4d4d4" }}>
                {(output.length / Math.max(input.length, 1)).toFixed(2)}×
              </span>
            </span>
          )}
          {urlSafe && <span style={{ color: "#569cd6" }}>URL-safe mode</span>}
        </div>
      )}
    </div>
  );
}
