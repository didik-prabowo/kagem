"use client";

import { useState } from "react";
import Link from "next/link";
import { diffLines, Change } from "diff";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  origLine: number | null;
  modLine:  number | null;
  content:  string;
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function buildDiffLines(changes: Change[]): DiffLine[] {
  const lines: DiffLine[] = [];
  let orig = 1, mod = 1;

  for (const change of changes) {
    const parts = change.value.split("\n");
    if (parts[parts.length - 1] === "") parts.pop();

    for (const content of parts) {
      if (change.removed) {
        lines.push({ type: "removed",   origLine: orig++, modLine: null,  content });
      } else if (change.added) {
        lines.push({ type: "added",     origLine: null,   modLine: mod++, content });
      } else {
        lines.push({ type: "unchanged", origLine: orig++, modLine: mod++, content });
      }
    }
  }
  return lines;
}

const EXAMPLE_ORIGINAL = `function greet(name) {
  console.log("Hello, " + name);
  return true;
}

const user = "World";
greet(user);`;

const EXAMPLE_MODIFIED = `function greet(name, greeting = "Hello") {
  console.log(greeting + ", " + name + "!");
  return name;
}

const user = "Developer";
greet(user, "Hi");`;

// ── Main ───────────────────────────────────────────────────────────────────────

export default function TextComparator() {
  const [original, setOriginal] = useState("");
  const [modified, setModified] = useState("");

  const changes   = original || modified ? diffLines(original, modified) : [];
  const diffLines_ = buildDiffLines(changes);
  const added     = changes.filter(c => c.added).reduce((n, c) => n + (c.count ?? 0), 0);
  const removed   = changes.filter(c => c.removed).reduce((n, c) => n + (c.count ?? 0), 0);
  const unchanged = changes.filter(c => !c.added && !c.removed).reduce((n, c) => n + (c.count ?? 0), 0);
  const identical = (original || modified) ? (added === 0 && removed === 0) : false;

  const loadExample = () => { setOriginal(EXAMPLE_ORIGINAL); setModified(EXAMPLE_MODIFIED); };
  const doClear     = () => { setOriginal(""); setModified(""); };

  const doCopy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
  };

  return (
    <div className="h-screen flex flex-col font-mono text-sm overflow-hidden" style={{ background: "#1e1e1e", color: "#d4d4d4" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 shrink-0 border-b" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs transition-colors hover:text-white" style={{ color: "#858585" }}>← Home</Link>
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <span className="font-bold" style={{ color: "#4ec9b0" }}>DIFF</span>
          <span className="text-sm font-sans font-medium">Text Comparator</span>
        </div>

        <div className="flex items-center gap-3">
          {identical && (
            <span className="text-xs font-sans px-2 py-0.5 rounded" style={{ background: "#0e2d1e", color: "#4ec9b0" }}>
              ✓ Identical
            </span>
          )}
          {!identical && (added > 0 || removed > 0) && (
            <div className="flex items-center gap-3 text-xs font-sans">
              <span style={{ color: "#4ec9b0" }}>+{added} added</span>
              <span style={{ color: "#f44747" }}>−{removed} removed</span>
              <span style={{ color: "#858585" }}>{unchanged} unchanged</span>
            </div>
          )}
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <button onClick={loadExample} className="text-xs font-sans px-2.5 py-1 rounded transition-colors" style={{ background: "#3c3c3c", color: "#cccccc" }}>
            Use example
          </button>
          <button onClick={doClear} disabled={!original && !modified} className="text-xs font-sans px-2.5 py-1 rounded transition-colors disabled:opacity-30" style={{ background: "#3c3c3c", color: "#cccccc" }}>
            Clear
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — inputs (stacked) */}
        <div className="flex flex-col" style={{ width: "50%", minWidth: 0, borderRight: "1px solid #3c3c3c" }}>
          {/* Original */}
          <div className="flex flex-col flex-1 overflow-hidden" style={{ borderBottom: "1px solid #3c3c3c" }}>
            <div className="flex items-center justify-between px-3 py-1 text-xs font-sans shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}>
              <span>Original</span>
              <div className="flex items-center gap-2">
                {original && <span>{original.split("\n").length} lines</span>}
                <button onClick={() => doCopy(original)} disabled={!original} className="px-2 py-0.5 rounded disabled:opacity-30 transition-colors" style={{ background: "#3c3c3c", color: "#cccccc" }}>Copy</button>
              </div>
            </div>
            <textarea
              value={original}
              onChange={e => setOriginal(e.target.value)}
              placeholder="Paste teks original di sini..."
              className="flex-1 resize-none outline-none text-sm leading-6 p-4 font-mono"
              style={{ background: "#1e1e1e", color: "#d4d4d4", caretColor: "#d4d4d4" }}
              spellCheck={false}
            />
          </div>

          {/* Modified */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1 text-xs font-sans shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}>
              <span>Modified</span>
              <div className="flex items-center gap-2">
                {modified && <span>{modified.split("\n").length} lines</span>}
                <button onClick={() => doCopy(modified)} disabled={!modified} className="px-2 py-0.5 rounded disabled:opacity-30 transition-colors" style={{ background: "#3c3c3c", color: "#cccccc" }}>Copy</button>
              </div>
            </div>
            <textarea
              value={modified}
              onChange={e => setModified(e.target.value)}
              placeholder="Paste teks yang sudah dimodifikasi di sini..."
              className="flex-1 resize-none outline-none text-sm leading-6 p-4 font-mono"
              style={{ background: "#1e1e1e", color: "#d4d4d4", caretColor: "#d4d4d4" }}
              spellCheck={false}
            />
          </div>
        </div>

        {/* Right — diff output */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1 text-xs font-sans shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}>
            <span>Diff</span>
            {diffLines_.length > 0 && <span>{diffLines_.length} lines</span>}
          </div>

          {!original && !modified ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm font-sans" style={{ color: "#4a4a4a" }}>Paste teks di sebelah kiri untuk mulai membandingkan</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse text-xs font-mono leading-6" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "36px" }} />
                  <col style={{ width: "36px" }} />
                  <col style={{ width: "20px" }} />
                  <col />
                </colgroup>
                <tbody>
                  {diffLines_.map((line, i) => {
                    const isAdded   = line.type === "added";
                    const isRemoved = line.type === "removed";
                    const bg        = isAdded ? "#0e2d1e" : isRemoved ? "#2d0000" : "transparent";
                    const color     = isAdded ? "#4ec9b0" : isRemoved ? "#f44747" : "#6a6a6a";
                    const sign      = isAdded ? "+" : isRemoved ? "−" : " ";

                    return (
                      <tr key={i} style={{ background: bg }}>
                        <td className="text-right pr-2 select-none border-r" style={{ color: "#4a4a4a", borderColor: "#3c3c3c", paddingLeft: "8px" }}>
                          {line.origLine ?? ""}
                        </td>
                        <td className="text-right pr-2 select-none border-r" style={{ color: "#4a4a4a", borderColor: "#3c3c3c" }}>
                          {line.modLine ?? ""}
                        </td>
                        <td className="text-center select-none" style={{ color }}>
                          {sign}
                        </td>
                        <td className="pl-2 pr-4 whitespace-pre" style={{ color: isAdded ? "#d4d4d4" : isRemoved ? "#d4d4d4" : "#858585" }}>
                          {line.content}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
