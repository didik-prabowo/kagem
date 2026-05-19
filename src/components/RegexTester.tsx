"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────────

type Flag = "g" | "i" | "m" | "s";

interface Match {
  index:  number;
  value:  string;
  start:  number;
  end:    number;
  groups: (string | undefined)[];
}

// ── Logic ──────────────────────────────────────────────────────────────────────

function getMatches(pattern: string, flags: Set<Flag>, text: string): { matches: Match[]; error: string | null } {
  if (!pattern) return { matches: [], error: null };
  try {
    const flagStr = [...flags].join("");
    const re = new RegExp(pattern, flagStr.includes("g") ? flagStr : flagStr + "g");
    const matches: Match[] = [];
    let m: RegExpExecArray | null;
    let limit = 10000;
    while ((m = re.exec(text)) !== null && limit-- > 0) {
      matches.push({ index: matches.length, value: m[0], start: m.index, end: m.index + m[0].length, groups: m.slice(1) });
      if (!flagStr.includes("g")) break;
      if (m[0].length === 0) re.lastIndex++;
    }
    return { matches, error: null };
  } catch (e) {
    return { matches: [], error: (e as Error).message };
  }
}

function buildSegments(text: string, matches: Match[]) {
  const segs: { text: string; highlight: boolean }[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start > cursor) segs.push({ text: text.slice(cursor, m.start), highlight: false });
    segs.push({ text: m.value, highlight: true });
    cursor = m.end;
  }
  if (cursor < text.length) segs.push({ text: text.slice(cursor), highlight: false });
  return segs;
}

// ── Examples ───────────────────────────────────────────────────────────────────

const EXAMPLE_PATTERN = "[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}";
const EXAMPLE_TEXT = `Contact us at support@example.com or sales@company.org.
You can also reach john.doe@email.co.uk for inquiries.
Invalid addresses: @nodomain, noatsign.com, missing@`;

// ── Main ───────────────────────────────────────────────────────────────────────

export default function RegexTester() {
  const [pattern, setPattern] = useState("");
  const [text, setText]       = useState("");
  const [flags, setFlags]     = useState<Set<Flag>>(new Set(["g"]));

  const toggleFlag = (f: Flag) =>
    setFlags(prev => { const n = new Set(prev); n.has(f) ? n.delete(f) : n.add(f); return n; });

  const { matches, error } = useMemo(() => getMatches(pattern, flags, text), [pattern, flags, text]);
  const segments           = useMemo(() => buildSegments(text, matches), [text, matches]);
  const flagStr            = [...flags].join("");

  const loadExample = () => { setPattern(EXAMPLE_PATTERN); setText(EXAMPLE_TEXT); };
  const doClear     = () => { setPattern(""); setText(""); };

  return (
    <div className="h-screen flex flex-col font-mono text-sm overflow-hidden" style={{ background: "#1e1e1e", color: "#d4d4d4" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 shrink-0 border-b" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs transition-colors hover:text-white" style={{ color: "#858585" }}>← Home</Link>
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <span className="font-bold" style={{ color: "#dcdcaa" }}>.*</span>
          <span className="text-sm font-sans font-medium">Regex Tester</span>
        </div>

        <div className="flex items-center gap-2">
          {text && pattern && !error && (
            <span className="text-xs font-sans px-2 py-0.5 rounded" style={{
              background: matches.length > 0 ? "#0e2d1e" : "#2a2a00",
              color:      matches.length > 0 ? "#4ec9b0" : "#dcdcaa",
            }}>
              {matches.length} match{matches.length !== 1 ? "es" : ""}
            </span>
          )}
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          {(["g", "i", "m", "s"] as Flag[]).map(f => (
            <button
              key={f}
              onClick={() => toggleFlag(f)}
              title={{ g: "global", i: "case insensitive", m: "multiline", s: "dotAll (. matches \\n)" }[f]}
              className="w-7 h-7 text-xs font-mono rounded border transition-colors"
              style={{
                borderColor: flags.has(f) ? "#0e639c" : "#3c3c3c",
                background:  flags.has(f) ? "#0e1e2e" : "transparent",
                color:       flags.has(f) ? "#569cd6" : "#555",
              }}
            >{f}</button>
          ))}
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <button onClick={loadExample} className="text-xs font-sans px-2.5 py-1 rounded" style={{ background: "#3c3c3c", color: "#cccccc" }}>Use example</button>
          <button onClick={doClear} disabled={!pattern && !text} className="text-xs font-sans px-2.5 py-1 rounded disabled:opacity-30" style={{ background: "#3c3c3c", color: "#cccccc" }}>Clear</button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — inputs */}
        <div className="flex flex-col" style={{ width: "50%", minWidth: 0, borderRight: "1px solid #3c3c3c" }}>
          {/* Regex bar */}
          <div className="flex items-center shrink-0 border-b" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
            <span className="pl-4 pr-1 text-base select-none" style={{ color: "#858585" }}>/</span>
            <input
              value={pattern}
              onChange={e => setPattern(e.target.value)}
              placeholder="pattern..."
              className="flex-1 py-2 outline-none text-sm font-mono"
              style={{ background: "transparent", color: error ? "#f44747" : "#dcdcaa", caretColor: "#d4d4d4" }}
              spellCheck={false}
            />
            <span className="px-3 py-2 text-base select-none" style={{ color: "#858585" }}>/{flagStr}</span>
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-1.5 text-xs font-sans border-b shrink-0" style={{ background: "#2d0000", borderColor: "#3c3c3c", color: "#f44747" }}>
              {error}
            </div>
          )}

          {/* Test string */}
          <div className="flex items-center justify-between px-3 py-1 text-xs font-sans shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}>
            <span>Test string</span>
            {text && <span>{text.length} chars · {text.split("\n").length} lines</span>}
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste text to test here..."
            className="flex-1 resize-none outline-none text-sm leading-6 p-4 font-mono"
            style={{ background: "#1e1e1e", color: "#d4d4d4", caretColor: "#d4d4d4" }}
            spellCheck={false}
          />
        </div>

        {/* Right — results */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Highlighted preview */}
          <div className="px-3 py-1 text-xs font-sans shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}>
            Preview
          </div>
          <div className="overflow-auto shrink-0" style={{ maxHeight: "45%", borderBottom: "1px solid #3c3c3c" }}>
            {!text ? (
              <div className="flex items-center justify-center h-16">
                <p className="text-xs font-sans" style={{ color: "#4a4a4a" }}>No text yet</p>
              </div>
            ) : (
              <pre className="p-4 text-xs leading-6 whitespace-pre-wrap break-words font-mono">
                {segments.length > 0
                  ? segments.map((seg, i) =>
                      seg.highlight
                        ? <mark key={i} style={{ background: "#3d2b00", color: "#dcdcaa", outline: "1px solid #6b4f00", borderRadius: "2px" }}>{seg.text}</mark>
                        : <span key={i} style={{ color: "#858585" }}>{seg.text}</span>
                    )
                  : <span style={{ color: "#858585" }}>{text}</span>
                }
              </pre>
            )}
          </div>

          {/* Match list */}
          <div className="flex items-center justify-between px-3 py-1 text-xs font-sans shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}>
            <span>Matches</span>
            {matches.length > 0 && <span>{matches.length} found</span>}
          </div>
          <div className="flex-1 overflow-auto">
            {matches.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm font-sans" style={{ color: "#4a4a4a" }}>
                  {pattern && text && !error ? "No matches" : "Matches will appear here"}
                </p>
              </div>
            ) : (
              <table className="w-full border-collapse text-xs" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "36px" }} />
                  <col style={{ width: "80px" }} />
                  <col />
                  <col style={{ width: "38%" }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#2d2d2d" }}>
                    {["#", "Pos", "Match", "Groups"].map(h => (
                      <th key={h} className="py-1.5 px-2 text-left border-b font-sans font-normal" style={{ borderColor: "#3c3c3c", color: "#858585" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matches.map(m => (
                    <tr key={m.index} className="border-b" style={{ borderColor: "#2a2a2a" }}>
                      <td className="py-1.5 px-2 font-mono" style={{ color: "#4a4a4a" }}>{m.index + 1}</td>
                      <td className="py-1.5 px-2 font-mono" style={{ color: "#569cd6" }}>{m.start}–{m.end}</td>
                      <td className="py-1.5 px-2 font-mono truncate" style={{ color: "#dcdcaa" }}>{m.value}</td>
                      <td className="py-1.5 px-2 font-mono truncate" style={{ color: "#ce9178" }}>
                        {m.groups.length > 0
                          ? m.groups.map((g, i) => (
                              <span key={i}>
                                {i > 0 && <span style={{ color: "#4a4a4a" }}>, </span>}
                                {g ?? <span style={{ color: "#4a4a4a" }}>–</span>}
                              </span>
                            ))
                          : <span style={{ color: "#4a4a4a" }}>—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
