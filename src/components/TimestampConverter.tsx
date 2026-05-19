"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// ── Helpers ────────────────────────────────────────────────────────────────────

function isMilliseconds(n: number) {
  return n > 9_999_999_999;
}

function toMs(n: number) {
  return isMilliseconds(n) ? n : n * 1000;
}

function pad(n: number, len = 2) {
  return String(n).padStart(len, "0");
}

function toDatetimeLocal(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function relativeTime(ms: number) {
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const past = diff < 0;
  if (abs < 5000) return "just now";
  const units: [number, string][] = [
    [365.25 * 24 * 3600 * 1000, "year"],
    [30.44  * 24 * 3600 * 1000, "month"],
    [7      * 24 * 3600 * 1000, "week"],
    [24     * 3600 * 1000,      "day"],
    [3600   * 1000,             "hour"],
    [60     * 1000,             "minute"],
    [1000,                      "second"],
  ];
  for (const [unitMs, label] of units) {
    const n = Math.floor(abs / unitMs);
    if (n >= 1) return past ? `${n} ${label}${n !== 1 ? "s" : ""} ago` : `in ${n} ${label}${n !== 1 ? "s" : ""}`;
  }
  return "just now";
}

function localTZ() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// ── Formats ────────────────────────────────────────────────────────────────────

function buildFormats(ms: number, tick: number) {
  void tick;
  const d = new Date(ms);
  const s = Math.floor(ms / 1000);
  return [
    { label: "Unix (seconds)",           value: String(s),                                                       color: "#569cd6" },
    { label: "Unix (milliseconds)",      value: String(ms),                                                      color: "#569cd6" },
    { label: "ISO 8601",                 value: d.toISOString(),                                                 color: "#ce9178" },
    { label: "UTC",                      value: d.toUTCString(),                                                 color: "#ce9178" },
    { label: `Local (${localTZ()})`,     value: d.toLocaleString("en-US", { timeZoneName: "short", hour12: false }), color: "#ce9178" },
    { label: "Date",                     value: d.toISOString().slice(0, 10),                                    color: "#ce9178" },
    { label: "Time (UTC)",               value: d.toISOString().slice(11, 19),                                   color: "#ce9178" },
    { label: "Relative",                 value: relativeTime(ms),                                                color: "#4ec9b0" },
  ];
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function TimestampConverter() {
  const [tsInput,   setTsInput]   = useState("");
  const [dateInput, setDateInput] = useState("");
  const [activeMs,  setActiveMs]  = useState<number | null>(null);
  const [tsError,   setTsError]   = useState("");
  const [tick,      setTick]      = useState(0);
  const [copied,    setCopied]    = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const handleTsChange = (val: string) => {
    setTsInput(val);
    setTsError("");
    if (!val.trim()) { setActiveMs(null); setDateInput(""); return; }
    const n = Number(val.trim());
    if (isNaN(n) || !isFinite(n)) { setTsError("Invalid number"); setActiveMs(null); return; }
    const ms = toMs(n);
    const d = new Date(ms);
    if (isNaN(d.getTime())) { setTsError("Invalid timestamp"); setActiveMs(null); return; }
    setActiveMs(ms);
    setDateInput(toDatetimeLocal(d));
  };

  const handleDateChange = (val: string) => {
    setDateInput(val);
    if (!val) { setActiveMs(null); setTsInput(""); setTsError(""); return; }
    const d = new Date(val);
    if (isNaN(d.getTime())) return;
    const ms = d.getTime();
    setActiveMs(ms);
    setTsInput(String(Math.floor(ms / 1000)));
    setTsError("");
  };

  const setNow = () => {
    const ms = Date.now();
    setTsInput(String(Math.floor(ms / 1000)));
    setActiveMs(ms);
    setDateInput(toDatetimeLocal(new Date(ms)));
    setTsError("");
  };

  const doCopy = async (val: string, label: string) => {
    try { await navigator.clipboard.writeText(val); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = val; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const doClear = () => { setTsInput(""); setDateInput(""); setActiveMs(null); setTsError(""); };

  const detectedUnit  = tsInput && !tsError ? (isMilliseconds(Number(tsInput)) ? "milliseconds" : "seconds") : null;
  const formats       = activeMs !== null ? buildFormats(activeMs, tick) : null;

  return (
    <div className="h-screen flex flex-col font-mono text-sm overflow-hidden" style={{ background: "#1e1e1e", color: "#d4d4d4" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 shrink-0 border-b" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs transition-colors hover:text-white" style={{ color: "#858585" }}>← Home</Link>
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <span className="font-bold" style={{ color: "#569cd6" }}>TS</span>
          <span className="text-sm font-sans font-medium">Timestamp Converter</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={setNow} className="text-xs font-sans px-2.5 py-1 rounded border transition-colors" style={{ background: "#0e1e2e", borderColor: "#0e639c", color: "#569cd6" }}>
            Now
          </button>
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <button onClick={doClear} disabled={!tsInput && !dateInput} className="text-xs font-sans px-2.5 py-1 rounded disabled:opacity-30" style={{ background: "#3c3c3c", color: "#cccccc" }}>
            Clear
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — inputs */}
        <div className="flex flex-col" style={{ width: "50%", minWidth: 0, borderRight: "1px solid #3c3c3c" }}>
          {/* Unix timestamp input */}
          <div className="px-3 py-1 text-xs font-sans shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}>
            Unix Timestamp
          </div>
          <div className="p-4 border-b" style={{ borderColor: "#3c3c3c" }}>
            <input
              value={tsInput}
              onChange={e => handleTsChange(e.target.value)}
              placeholder="e.g. 1716825600"
              className="w-full px-3 py-2 rounded border outline-none text-sm font-mono"
              style={{ background: "#252526", borderColor: tsError ? "#f44747" : "#3c3c3c", color: "#d4d4d4", caretColor: "#d4d4d4" }}
              spellCheck={false}
            />
            {tsError && (
              <p className="mt-1.5 text-xs font-sans" style={{ color: "#f44747" }}>{tsError}</p>
            )}
            {detectedUnit && !tsError && (
              <p className="mt-1.5 text-xs font-sans" style={{ color: "#858585" }}>
                Detected: <span style={{ color: "#569cd6" }}>{detectedUnit}</span>
              </p>
            )}
          </div>

          {/* Date / time input */}
          <div className="px-3 py-1 text-xs font-sans shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}>
            Date / Time <span style={{ color: "#4a4a4a" }}>(local timezone)</span>
          </div>
          <div className="p-4">
            <input
              type="datetime-local"
              value={dateInput}
              onChange={e => handleDateChange(e.target.value)}
              step="1"
              className="w-full px-3 py-2 rounded border outline-none text-sm font-mono"
              style={{ background: "#252526", borderColor: "#3c3c3c", color: "#d4d4d4", colorScheme: "dark" }}
            />
          </div>
        </div>

        {/* Right — outputs */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-3 py-1 text-xs font-sans shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}>
            Formats
          </div>
          {!formats ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm font-sans" style={{ color: "#4a4a4a" }}>Enter a timestamp or pick a date</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
              {formats.map(({ label, value, color }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-sans" style={{ color: "#858585" }}>{label}</span>
                    <button
                      onClick={() => doCopy(value, label)}
                      className="text-xs font-sans px-2 py-0.5 rounded"
                      style={{ background: "#3c3c3c", color: copied === label ? "#4ec9b0" : "#cccccc" }}
                    >
                      {copied === label ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div
                    className="text-xs px-3 py-2 rounded select-all font-mono"
                    style={{ background: "#252526", color, border: "1px solid #3c3c3c" }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
