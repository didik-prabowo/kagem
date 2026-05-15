"use client";

import { useState, useCallback, useRef, useEffect, createContext, useContext } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

// seq increments on every expand/collapse all so useEffect always fires
const TreeCtx = createContext<{ seq: number; open: boolean } | null>(null);

const AceEditor = dynamic(() => import("./AceWrapper"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0" style={{ background: "#1e1e1e" }} />
  ),
});

type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

const C = {
  key: "#9cdcfe",
  string: "#ce9178",
  number: "#b5cea8",
  bool: "#569cd6",
  null: "#569cd6",
  bracket: "#d4d4d4",
  arrow: "#858585",
  comment: "#6a9955",
};

const EXAMPLE = `{
  "array": [
    1,
    2,
    3
  ],
  "boolean": true,
  "null": null,
  "number": 123,
  "object": {
    "a": "b",
    "c": "d",
    "e": "f"
  },
  "string": "Hello World"
}`;

function parseJson(val: string): { data: JsonValue | null; error: string } {
  try {
    return { data: JSON.parse(val), error: "" };
  } catch (e) {
    return { data: null, error: (e as Error).message };
  }
}

// ── Tree renderer ─────────────────────────────────────────────────────────────

function safeStr(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function JsonNode({
  data,
  keyName,
  depth = 0,
  isLast = true,
}: {
  data: JsonValue;
  keyName?: string;
  depth?: number;
  isLast?: boolean;
}) {
  const force = useContext(TreeCtx);
  const [open, setOpen] = useState(depth < 2);
  const pad = depth * 16;

  useEffect(() => {
    if (force !== null) setOpen(force.open);
  }, [force?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  const Key = () =>
    keyName !== undefined ? (
      <>
        <span style={{ color: C.key }}>"{keyName}"</span>
        <span style={{ color: C.bracket }}>: </span>
      </>
    ) : null;

  const Comma = () =>
    !isLast ? <span style={{ color: C.bracket }}>,</span> : null;

  if (data === null)
    return (
      <div className="flex leading-6" style={{ paddingLeft: pad }}>
        <Key /><span style={{ color: C.null }}>null</span><Comma />
      </div>
    );

  if (typeof data === "boolean")
    return (
      <div className="flex leading-6" style={{ paddingLeft: pad }}>
        <Key /><span style={{ color: C.bool }}>{String(data)}</span><Comma />
      </div>
    );

  if (typeof data === "number")
    return (
      <div className="flex leading-6" style={{ paddingLeft: pad }}>
        <Key /><span style={{ color: C.number }}>{data}</span><Comma />
      </div>
    );

  if (typeof data === "string") {
    const display = data.length > 80 ? safeStr(data.slice(0, 80)) + "…" : safeStr(data);
    return (
      <div className="flex leading-6" style={{ paddingLeft: pad }}>
        <Key /><span style={{ color: C.string }}>"{display}"</span><Comma />
      </div>
    );
  }

  const isArr = Array.isArray(data);
  const entries = isArr
    ? (data as JsonValue[])
    : Object.entries(data as Record<string, JsonValue>);
  const count = entries.length;
  const [ob, cb] = isArr ? ["[", "]"] : ["{", "}"];

  if (count === 0)
    return (
      <div className="flex leading-6" style={{ paddingLeft: pad }}>
        <Key /><span style={{ color: C.bracket }}>{ob}{cb}</span><Comma />
      </div>
    );

  return (
    <div>
      <div
        className="flex items-center leading-6 rounded cursor-pointer select-none hover:bg-white/[0.04]"
        style={{ paddingLeft: pad }}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="mr-1 text-[10px] inline-block transition-transform duration-100"
          style={{ color: C.arrow, transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          ▶
        </span>
        <Key />
        <span style={{ color: C.bracket }}>{ob}</span>
        {!open && (
          <>
            <span className="mx-1.5 text-xs italic" style={{ color: C.comment }}>
              {count} {isArr ? (count === 1 ? "item" : "items") : count === 1 ? "key" : "keys"}
            </span>
            <span style={{ color: C.bracket }}>{cb}</span>
            <Comma />
          </>
        )}
      </div>
      {open && (
        <>
          {isArr
            ? (data as JsonValue[]).map((item, i) => (
                <JsonNode key={i} data={item} depth={depth + 1} isLast={i === count - 1} />
              ))
            : Object.entries(data as Record<string, JsonValue>).map(([k, v], i) => (
                <JsonNode key={k} data={v} keyName={k} depth={depth + 1} isLast={i === count - 1} />
              ))}
          <div className="flex leading-6" style={{ paddingLeft: pad }}>
            <span style={{ color: C.bracket }}>{cb}</span>
            <Comma />
          </div>
        </>
      )}
    </div>
  );
}

// ── Schema visualizer ────────────────────────────────────────────────────────

interface Schema {
  type: string;
  example?: JsonValue;
  properties?: Record<string, Schema>;
  items?: Schema;
  count?: number;
  types?: string[];
}

function deriveSchema(val: JsonValue): Schema {
  if (val === null) return { type: "null" };
  if (typeof val === "boolean") return { type: "boolean", example: val };
  if (typeof val === "number") return { type: "number", example: val };
  if (typeof val === "string") return { type: "string", example: val };
  if (Array.isArray(val)) {
    const count = val.length;
    if (count === 0) return { type: "array", items: { type: "unknown" }, count };
    const schemas = val.map(deriveSchema);
    const types = [...new Set(schemas.map((s) => s.type))];
    return {
      type: "array",
      items: types.length === 1 ? schemas[0] : { type: "mixed", types },
      count,
    };
  }
  const properties: Record<string, Schema> = {};
  for (const [k, v] of Object.entries(val as Record<string, JsonValue>)) {
    properties[k] = deriveSchema(v);
  }
  return { type: "object", properties };
}

const TYPE_STYLE: Record<string, { bg: string; fg: string }> = {
  string:  { bg: "#0d2e27", fg: "#4ec9b0" },
  number:  { bg: "#162b16", fg: "#b5cea8" },
  boolean: { bg: "#0d1e35", fg: "#569cd6" },
  null:    { bg: "#242424", fg: "#858585" },
  object:  { bg: "#28143a", fg: "#c586c0" },
  array:   { bg: "#2e1c0a", fg: "#ce9178" },
  mixed:   { bg: "#2e2a08", fg: "#dcdcaa" },
  unknown: { bg: "#242424", fg: "#858585" },
};

function TypeBadge({ type }: { type: string }) {
  const s = TYPE_STYLE[type] ?? TYPE_STYLE.unknown;
  return (
    <span
      className="font-sans rounded px-1.5 py-px"
      style={{ background: s.bg, color: s.fg, fontSize: "10px", lineHeight: "16px" }}
    >
      {type}
    </span>
  );
}

function SchemaNode({
  schema,
  keyName,
  depth = 0,
  isLast = true,
}: {
  schema: Schema;
  keyName?: string;
  depth?: number;
  isLast?: boolean;
}) {
  const [open, setOpen] = useState(depth < 2);
  const pad = depth * 16;

  const Key = () =>
    keyName !== undefined ? (
      <span className="mr-2" style={{ color: "#9cdcfe" }}>
        "{keyName}"
      </span>
    ) : null;

  const isExpandable = schema.type === "object" || schema.type === "array";

  if (!isExpandable) {
    const example =
      schema.example !== undefined
        ? String(schema.example).slice(0, 40)
        : null;
    return (
      <div
        className="flex items-center gap-2 leading-7 font-sans text-xs"
        style={{ paddingLeft: pad }}
      >
        <Key />
        <TypeBadge type={schema.type} />
        {example !== null && (
          <span className="truncate max-w-xs" style={{ color: "#6a6a6a" }}>
            {schema.type === "string" ? `"${example}"` : example}
          </span>
        )}
        {!isLast && <span style={{ color: "#444" }}>,</span>}
      </div>
    );
  }

  if (schema.type === "array") {
    const itemType = schema.items?.type ?? "unknown";
    return (
      <div>
        <div
          className="flex items-center gap-2 leading-7 font-sans text-xs cursor-pointer select-none hover:bg-white/[0.04] rounded"
          style={{ paddingLeft: pad }}
          onClick={() => setOpen((v) => !v)}
        >
          <span
            className="text-[10px] transition-transform duration-100 inline-block"
            style={{ color: "#858585", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            ▶
          </span>
          <Key />
          <TypeBadge type="array" />
          <span style={{ color: "#6a6a6a" }}>{schema.count} × </span>
          <TypeBadge type={itemType === "mixed" ? "mixed" : itemType} />
          {itemType === "mixed" && schema.items?.types && (
            <span style={{ color: "#6a6a6a", fontSize: "10px" }}>
              ({schema.items.types.join(" | ")})
            </span>
          )}
        </div>
        {open && schema.items && schema.items.type !== "mixed" && (
          <div>
            <SchemaNode schema={schema.items} keyName="[n]" depth={depth + 1} />
          </div>
        )}
      </div>
    );
  }

  // object
  const entries = Object.entries(schema.properties ?? {});
  return (
    <div>
      <div
        className="flex items-center gap-2 leading-7 font-sans text-xs cursor-pointer select-none hover:bg-white/[0.04] rounded"
        style={{ paddingLeft: pad }}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="text-[10px] transition-transform duration-100 inline-block"
          style={{ color: "#858585", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          ▶
        </span>
        <Key />
        <TypeBadge type="object" />
        <span style={{ color: "#6a6a6a" }}>{entries.length} keys</span>
      </div>
      {open &&
        entries.map(([k, s], i) => (
          <SchemaNode
            key={k}
            schema={s}
            keyName={k}
            depth={depth + 1}
            isLast={i === entries.length - 1}
          />
        ))}
    </div>
  );
}

// ── Sort keys helper ─────────────────────────────────────────────────────────

function sortKeys(val: JsonValue): JsonValue {
  if (val === null || typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(sortKeys);
  return Object.keys(val as Record<string, JsonValue>)
    .sort()
    .reduce<Record<string, JsonValue>>((acc, k) => {
      acc[k] = sortKeys((val as Record<string, JsonValue>)[k]);
      return acc;
    }, {});
}

// ── Icon button ───────────────────────────────────────────────────────────────

function IconBtn({
  title,
  onClick,
  disabled = false,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center w-7 h-7 rounded transition-colors disabled:opacity-25 hover:enabled:bg-white/10"
      style={{ color: "#9d9d9d" }}
    >
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Tab = "tree" | "raw" | "schema";


export default function JsonFormatter() {
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<JsonValue | null>(null);
  const [formatted, setFormatted] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("tree");
  const [copied, setCopied] = useState(false);

  // Undo/redo history (tracks batch ops: format, minify, sort, paste, clear)
  const stackRef = useRef<string[]>([""]);
  const idxRef = useRef(0);
  const [opIdx, setOpIdx] = useState(0); // drives button disabled state

  const pushOp = (val: string) => {
    const next = stackRef.current.slice(0, idxRef.current + 1).concat(val);
    stackRef.current = next;
    idxRef.current = next.length - 1;
    setOpIdx(next.length - 1);
  };

  const process = useCallback((val: string) => {
    if (!val.trim()) {
      setParsed(null); setFormatted(""); setError(""); return;
    }
    const { data, error: err } = parseJson(val);
    setParsed(data);
    setFormatted(data ? JSON.stringify(data, null, 2) : "");
    setError(err);
  }, []);

  const applyVal = (val: string) => {
    setInput(val);
    process(val);
  };

  // Live typing — update current stack entry so undo restores typed state
  const onInput = (val: string) => {
    stackRef.current[idxRef.current] = val;
    applyVal(val);
  };

  const doFormat = () => {
    if (!parsed) return;
    const f = JSON.stringify(parsed, null, 2);
    pushOp(f); applyVal(f);
  };

  const doMinify = () => {
    if (!parsed) return;
    const m = JSON.stringify(parsed);
    pushOp(m); applyVal(m);
  };

  const doSort = () => {
    if (!parsed) return;
    const s = JSON.stringify(sortKeys(parsed), null, 2);
    pushOp(s); applyVal(s);
  };

  const doUndo = () => {
    if (idxRef.current <= 0) return;
    idxRef.current--;
    setOpIdx(idxRef.current);
    applyVal(stackRef.current[idxRef.current]);
  };

  const doRedo = () => {
    if (idxRef.current >= stackRef.current.length - 1) return;
    idxRef.current++;
    setOpIdx(idxRef.current);
    applyVal(stackRef.current[idxRef.current]);
  };

  const doCopy = async () => {
    if (!formatted) return;
    try {
      await navigator.clipboard.writeText(formatted);
    } catch {
      // Fallback for non-HTTPS (e.g. LAN access over HTTP)
      const ta = document.createElement("textarea");
      ta.value = formatted;
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
      pushOp(t); applyVal(t);
    } catch {
      // Clipboard API not available (non-HTTPS) — user must paste manually into editor
      alert("Paste langsung ke editor menggunakan Ctrl+V / Cmd+V");
    }
  };

  const doClear = () => {
    pushOp(""); applyVal("");
    setParsed(null); setFormatted(""); setError("");
  };

  const isValid = parsed !== null;
  const canUndo = opIdx > 0;

  const [treeForce, setTreeForce] = useState<{ seq: number; open: boolean } | null>(null);
  const expandAll  = () => setTreeForce(p => ({ seq: (p?.seq ?? 0) + 1, open: true }));
  const collapseAll = () => setTreeForce(p => ({ seq: (p?.seq ?? 0) + 1, open: false }));
  const canRedo = opIdx < stackRef.current.length - 1;

  return (
    <div
      className="h-screen flex flex-col font-mono text-sm overflow-hidden"
      style={{ background: "#1e1e1e", color: "#d4d4d4" }}
    >
      {/* ── Toolbar ── */}
      <header
        className="flex items-center justify-between px-4 py-2 shrink-0 border-b"
        style={{ background: "#252526", borderColor: "#3c3c3c" }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs transition-colors hover:text-white"
            style={{ color: "#858585" }}
          >
            ← Home
          </Link>
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <span className="font-bold" style={{ color: "#569cd6" }}>{"{}"}</span>
          <span className="text-sm font-sans font-medium">JSON Formatter</span>
        </div>

        <div className="flex items-center gap-1.5">
          {input && (
            <div className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: error ? "#f44747" : isValid ? "#4ec9b0" : "#858585" }}
              />
              <span
                className="text-xs font-sans"
                style={{ color: error ? "#f44747" : isValid ? "#4ec9b0" : "#858585" }}
              >
                {error ? "Invalid JSON" : isValid ? "Valid JSON" : "—"}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── Panels ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Ace Editor */}
        <div
          className="flex flex-col"
          style={{ width: "50%", borderRight: "1px solid #3c3c3c" }}
        >
          <div
            className="flex items-center justify-between px-3 py-1 text-xs shrink-0 border-b font-sans"
            style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}
          >
            <span>Input</span>
            {input && (
              <span>{input.length} chars · {input.split("\n").length} lines</span>
            )}
          </div>

          {/* Mini toolbar */}
          <div
            className="flex items-center gap-0.5 px-2 py-1 shrink-0 border-b"
            style={{ background: "#2a2a2a", borderColor: "#3c3c3c" }}
          >
            <IconBtn title="Format (indent)" onClick={doFormat} disabled={!isValid}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4h12M5 8h9M5 12h9" />
                <path d="M2 6.5l1.5 1.5-1.5 1.5" />
              </svg>
            </IconBtn>
            <IconBtn title="Minify (compress)" onClick={doMinify} disabled={!isValid}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 5h12M2 8h12M2 11h12" />
              </svg>
            </IconBtn>
            <IconBtn title="Sort keys A→Z" onClick={doSort} disabled={!isValid}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4h7M2 8h5M2 12h3" />
                <path d="M12 2v12M10 10l2 2 2-2" />
              </svg>
            </IconBtn>
            <div className="w-px h-4 mx-1" style={{ background: "#3c3c3c" }} />
            <IconBtn title="Undo" onClick={doUndo} disabled={!canUndo}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 6H10a3 3 0 010 6H7" />
                <path d="M4.5 4l-2 2 2 2" />
              </svg>
            </IconBtn>
            <IconBtn title="Redo" onClick={doRedo} disabled={!canRedo}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11.5 6H6a3 3 0 000 6h3" />
                <path d="M11.5 4l2 2-2 2" />
              </svg>
            </IconBtn>
            <div className="w-px h-4 mx-1" style={{ background: "#3c3c3c" }} />
            <IconBtn title={copied ? "Copied!" : "Copy output"} onClick={doCopy} disabled={!isValid}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="5" width="8" height="9" rx="1" />
                <path d="M3 11V3a1 1 0 011-1h7" />
              </svg>
            </IconBtn>
            <IconBtn title="Paste from clipboard" onClick={doPaste}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="10" height="10" rx="1" />
                <path d="M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1" />
              </svg>
            </IconBtn>
            <IconBtn title="Use example" onClick={() => { pushOp(EXAMPLE); applyVal(EXAMPLE); }}>
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
          </div>

          <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
            <AceEditor value={input} onChange={onInput} />
          </div>

          {error && (
            <div
              className="px-4 py-2 text-xs shrink-0 border-t font-sans"
              style={{ background: "#2d0000", borderColor: "#5a1a1a", color: "#f44747" }}
            >
              ✕ {error}
            </div>
          )}
        </div>

        {/* Right — Tree / Raw */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div
            className="flex items-center shrink-0 border-b"
            style={{ background: "#2d2d2d", borderColor: "#3c3c3c" }}
          >
            {(["tree", "raw", "schema"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-4 py-1.5 text-xs font-sans transition-colors"
                style={{
                  color: tab === t ? "#ffffff" : "#858585",
                  borderBottom: tab === t ? "2px solid #0e639c" : "2px solid transparent",
                  background: tab === t ? "#1e1e1e" : "transparent",
                }}
              >
                {t === "tree" ? "Tree View" : t === "raw" ? "Raw Output" : "Schema"}
              </button>
            ))}
          </div>

          {/* Collapse / Expand bar — tree view only */}
          {tab === "tree" && (
            <div
              className="flex items-center gap-1 px-3 py-1 shrink-0 border-b"
              style={{ background: "#252526", borderColor: "#3c3c3c" }}
            >
              <button
                onClick={expandAll}
                disabled={!parsed}
                className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-sans rounded transition-colors disabled:opacity-30 hover:enabled:bg-white/10"
                style={{ color: "#9d9d9d" }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 4l4 4 4-4" />
                </svg>
                Expand all
              </button>
              <div className="w-px h-3" style={{ background: "#3c3c3c" }} />
              <button
                onClick={collapseAll}
                disabled={!parsed}
                className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-sans rounded transition-colors disabled:opacity-30 hover:enabled:bg-white/10"
                style={{ color: "#9d9d9d" }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 8l4-4 4 4" />
                </svg>
                Collapse all
              </button>
            </div>
          )}

          {tab === "raw" ? (
            <div className="flex-1 relative" style={{ minHeight: 0 }}>
              {input && !error && parsed !== null
                ? <AceEditor value={formatted} name="json-output-editor" readOnly />
                : <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-xs font-sans" style={{ color: "#4a4a4a" }}>
                      {!input ? "Output akan muncul di sini" : "JSON tidak valid"}
                    </p>
                  </div>
              }
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-4">
              {!input && (
                <p className="text-xs font-sans" style={{ color: "#4a4a4a" }}>
                  Output akan muncul di sini
                </p>
              )}
              {input && error && (
                <div
                  className="rounded p-4 border text-xs font-sans"
                  style={{ background: "#2d0000", borderColor: "#5a1a1a", color: "#f44747" }}
                >
                  <p className="font-semibold mb-1">JSON tidak valid</p>
                  <p className="font-mono opacity-80">{error}</p>
                </div>
              )}
              {input && !error && parsed !== null && (
                tab === "tree" ? (
                  <TreeCtx.Provider value={treeForce}>
                    <div className="text-sm leading-6">
                      <JsonNode data={parsed} />
                    </div>
                  </TreeCtx.Provider>
                ) : (
                  <div>
                    <p className="text-xs font-sans mb-4" style={{ color: "#6a6a6a" }}>
                      Schema derived from JSON data
                    </p>
                    <SchemaNode schema={deriveSchema(parsed)} />
                  </div>
                )
              )}
            </div>
          )}

          {formatted && (
            <div
              className="px-4 py-1.5 text-xs shrink-0 border-t font-sans"
              style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}
            >
              {formatted.length} chars · {formatted.split("\n").length} lines
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
