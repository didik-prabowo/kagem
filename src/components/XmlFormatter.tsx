"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import xmlFormat from "xml-formatter";

const XmlAceWrapper = dynamic(() => import("./XmlAceWrapper"), { ssr: false });

// ── Formatting helpers ─────────────────────────────────────────────────────────

function tryFormat(xml: string): { result: string; error: string } {
  try {
    const result = xmlFormat(xml, { indentation: "  ", lineSeparator: "\n", collapseContent: true });
    return { result, error: "" };
  } catch (e) {
    return { result: "", error: e instanceof Error ? e.message : "Format failed" };
  }
}

function minifyXml(xml: string): string {
  return xml
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Tree types & parser ────────────────────────────────────────────────────────

interface XmlNode {
  tag:      string;
  attrs:    [string, string][];
  children: XmlNode[];
  text:     string;
}

function domToNode(el: Element): XmlNode {
  const attrs: [string, string][] = [];
  for (const a of el.attributes) attrs.push([a.name, a.value]);
  const children: XmlNode[] = [];
  let text = "";
  for (const c of el.childNodes) {
    if (c.nodeType === Node.ELEMENT_NODE) children.push(domToNode(c as Element));
    else if (c.nodeType === Node.TEXT_NODE) { const t = c.textContent?.trim() ?? ""; if (t) text = t; }
  }
  return { tag: el.tagName, attrs, children, text };
}

function parseXml(xml: string): XmlNode | null {
  try {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    if (doc.querySelector("parsererror")) return null;
    return domToNode(doc.documentElement);
  } catch { return null; }
}

// ── Schema types & deriver ─────────────────────────────────────────────────────

interface SchemaNode {
  tag:      string;
  attrs:    string[];
  children: Map<string, { node: SchemaNode; count: number }>;
  hasText:  boolean;
}

function mergeSchema(base: SchemaNode, el: Element): void {
  for (const a of el.attributes) if (!base.attrs.includes(a.name)) base.attrs.push(a.name);
  for (const c of el.childNodes) {
    if (c.nodeType === Node.TEXT_NODE && c.textContent?.trim()) base.hasText = true;
    if (c.nodeType !== Node.ELEMENT_NODE) continue;
    const child = c as Element;
    const existing = base.children.get(child.tagName);
    if (existing) { existing.count++; mergeSchema(existing.node, child); }
    else           { base.children.set(child.tagName, { node: deriveSchema(child), count: 1 }); }
  }
}

function deriveSchema(el: Element): SchemaNode {
  const node: SchemaNode = {
    tag:      el.tagName,
    attrs:    Array.from(el.attributes).map(a => a.name),
    children: new Map(),
    hasText:  false,
  };
  for (const c of el.childNodes) {
    if (c.nodeType === Node.TEXT_NODE && c.textContent?.trim()) node.hasText = true;
    if (c.nodeType !== Node.ELEMENT_NODE) continue;
    const child = c as Element;
    const existing = node.children.get(child.tagName);
    if (existing) { existing.count++; mergeSchema(existing.node, child); }
    else           { node.children.set(child.tagName, { node: deriveSchema(child), count: 1 }); }
  }
  return node;
}

function parseSchema(xml: string): SchemaNode | null {
  try {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    if (doc.querySelector("parsererror")) return null;
    return deriveSchema(doc.documentElement);
  } catch { return null; }
}

// ── Tree node component ────────────────────────────────────────────────────────

function XmlTreeNode({ node, depth }: { node: XmlNode; depth: number }) {
  const [open, setOpen] = useState(depth < 3);
  const hasContent = node.children.length > 0 || node.text;

  return (
    <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
      <div
        className="flex items-start gap-1 py-0.5 rounded cursor-pointer hover:bg-white/5 select-none"
        onClick={() => hasContent && setOpen(o => !o)}
        style={{ minHeight: 22 }}
      >
        {/* Chevron */}
        <span className="shrink-0 w-3 mt-0.5 text-center" style={{ color: "#4a4a4a", fontSize: 10 }}>
          {hasContent ? (open ? "▾" : "▸") : ""}
        </span>
        {/* Tag + attrs */}
        <span className="text-xs font-mono leading-5 break-all">
          <span style={{ color: "#808080" }}>&lt;</span>
          <span style={{ color: "#4ec9b0" }}>{node.tag}</span>
          {node.attrs.map(([k, v]) => (
            <span key={k}>
              <span style={{ color: "#9cdcfe" }}> {k}</span>
              <span style={{ color: "#808080" }}>=</span>
              <span style={{ color: "#ce9178" }}>"{v}"</span>
            </span>
          ))}
          {!hasContent && <span style={{ color: "#808080" }}>/&gt;</span>}
          {hasContent && !open && (
            <>
              <span style={{ color: "#808080" }}>&gt;…&lt;/</span>
              <span style={{ color: "#4ec9b0" }}>{node.tag}</span>
              <span style={{ color: "#808080" }}>&gt;</span>
            </>
          )}
          {hasContent && open && <span style={{ color: "#808080" }}>&gt;</span>}
        </span>
      </div>

      {open && hasContent && (
        <div>
          {node.text && (
            <div style={{ paddingLeft: 16 }} className="py-0.5">
              <span className="text-xs font-mono" style={{ color: "#d4d4d4" }}>{node.text}</span>
            </div>
          )}
          {node.children.map((child, i) => (
            <XmlTreeNode key={i} node={child} depth={depth + 1} />
          ))}
          <div className="py-0.5" style={{ paddingLeft: 16 }}>
            <span className="text-xs font-mono" style={{ color: "#808080" }}>
              &lt;/<span style={{ color: "#4ec9b0" }}>{node.tag}</span>&gt;
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Schema node component ──────────────────────────────────────────────────────

function XmlSchemaNode({ node, count, depth }: { node: SchemaNode; count: number; depth: number }) {
  const [open, setOpen] = useState(depth < 3);
  const hasChildren = node.children.size > 0 || node.attrs.length > 0 || node.hasText;
  const many = count > 1;

  return (
    <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
      <div
        className="flex items-center gap-1.5 py-0.5 rounded cursor-pointer hover:bg-white/5 select-none"
        onClick={() => hasChildren && setOpen(o => !o)}
      >
        <span className="shrink-0 w-3 text-center" style={{ color: "#4a4a4a", fontSize: 10 }}>
          {hasChildren ? (open ? "▾" : "▸") : ""}
        </span>
        {/* Element name */}
        <span className="text-xs font-mono" style={{ color: "#4ec9b0" }}>&lt;{node.tag}&gt;</span>
        {/* Cardinality badge */}
        {many && (
          <span className="text-xs font-sans px-1 rounded" style={{ background: "#1a2a3a", color: "#569cd6", fontSize: 10 }}>
            [{count}]
          </span>
        )}
        {/* Text badge */}
        {node.hasText && node.children.size === 0 && (
          <span className="text-xs font-sans px-1 rounded" style={{ background: "#2a1e00", color: "#ce9178", fontSize: 10 }}>
            text
          </span>
        )}
      </div>

      {open && hasChildren && (
        <div>
          {/* Attributes */}
          {node.attrs.map(attr => (
            <div key={attr} style={{ paddingLeft: 16 }} className="flex items-center gap-1.5 py-0.5">
              <span className="shrink-0 w-3" />
              <span className="text-xs font-mono" style={{ color: "#9cdcfe" }}>@{attr}</span>
              <span className="text-xs font-sans px-1 rounded" style={{ background: "#1e2a1e", color: "#4ec9b0", fontSize: 10 }}>attr</span>
            </div>
          ))}
          {/* Children */}
          {[...node.children.entries()].map(([tag, { node: child, count: cnt }]) => (
            <XmlSchemaNode key={tag} node={child} count={cnt} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
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

// ── Example ────────────────────────────────────────────────────────────────────

const EXAMPLE = `<?xml version="1.0" encoding="UTF-8"?><catalog><book id="1"><title>The Pragmatic Programmer</title><author>David Thomas</author><year>2019</year><price currency="USD">49.95</price><tags><tag>programming</tag><tag>best-practices</tag></tags></book><book id="2"><title>Clean Code</title><author>Robert C. Martin</author><year>2008</year><price currency="USD">39.99</price><tags><tag>programming</tag><tag>refactoring</tag></tags></book></catalog>`;

type Tab = "formatted" | "tree" | "schema";

// ── Main ───────────────────────────────────────────────────────────────────────

export default function XmlFormatter() {
  const [input,     setInput]     = useState("");
  const [formatted, setFormatted] = useState("");
  const [error,     setError]     = useState("");
  const [copied,    setCopied]    = useState(false);
  const [tab,       setTab]       = useState<Tab>("formatted");

  const updateFormatted = useCallback((xml: string) => {
    if (!xml.trim()) { setFormatted(""); setError(""); return; }
    const { result, error: err } = tryFormat(xml);
    setFormatted(result);
    setError(err);
  }, []);

  const handleInput = (xml: string) => { setInput(xml); updateFormatted(xml); };

  const doFormat = () => {
    if (!input.trim()) return;
    const { result, error: err } = tryFormat(input);
    if (result) { setInput(result); setFormatted(result); }
    setError(err);
  };

  const doMinify = () => { if (input.trim()) setInput(minifyXml(input)); };

  const doPaste = async () => {
    try { handleInput(await navigator.clipboard.readText()); }
    catch { alert("Clipboard not accessible over HTTP. Use Ctrl+V to paste directly."); }
  };

  const doCopy = async () => {
    const text = formatted || input;
    if (!text) return;
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const doClear = () => { setInput(""); setFormatted(""); setError(""); };

  const treeRoot   = (tab === "tree"   && input) ? parseXml(input)   : null;
  const schemaRoot = (tab === "schema" && input) ? parseSchema(input) : null;

  const TABS: { id: Tab; label: string }[] = [
    { id: "formatted", label: "Formatted" },
    { id: "tree",      label: "Tree View" },
    { id: "schema",    label: "Schema" },
  ];

  return (
    <div className="h-screen flex flex-col font-mono text-sm overflow-hidden" style={{ background: "#1e1e1e", color: "#d4d4d4" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 shrink-0 border-b" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs transition-colors hover:text-white" style={{ color: "#858585" }}>← Home</Link>
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <span className="font-bold" style={{ color: "#4ec9b0" }}>XML</span>
          <span className="text-sm font-sans font-medium">XML Formatter</span>
        </div>
        {error && (
          <span className="text-xs font-sans px-2 py-0.5 rounded truncate max-w-xs" style={{ background: "#2d0000", color: "#f44747" }}>
            {error}
          </span>
        )}
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — editor */}
        <div className="flex flex-col" style={{ width: "50%", minWidth: 0, borderRight: "1px solid #3c3c3c" }}>
          <div className="flex items-center gap-0.5 px-2 py-1 shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c" }}>
            <IconBtn title="Format" onClick={doFormat} disabled={!input.trim()}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </IconBtn>
            <IconBtn title="Minify" onClick={doMinify} disabled={!input.trim()}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M11 6l2 2-2 2M5 6L3 8l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </IconBtn>
            <div className="w-px h-4 mx-1" style={{ background: "#3c3c3c" }} />
            <IconBtn title="Paste" onClick={doPaste}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="4" y="4" width="9" height="10" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M6 8h4M6 11h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </IconBtn>
            <IconBtn title="Use example" onClick={() => handleInput(EXAMPLE)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L9.5 6h4l-3.2 2.3 1.2 4L8 10l-3.5 2.3 1.2-4L2.5 6h4L8 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              </svg>
            </IconBtn>
            <IconBtn title="Clear" onClick={doClear} disabled={!input}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 4h10l-1 9H4L3 4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                <path d="M1 4h14M6 4V2h4v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </IconBtn>
            <div className="flex-1" />
            {input.length > 0 && <span className="text-xs font-sans px-2" style={{ color: "#4a4a4a" }}>{input.length.toLocaleString()} chars</span>}
          </div>
          <div className="flex-1 relative" style={{ minHeight: 0 }}>
            <XmlAceWrapper value={input} onChange={handleInput} name="xml-input-editor" />
          </div>
        </div>

        {/* Right — tabs */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center justify-between shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c" }}>
            <div className="flex">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="px-4 py-1.5 text-xs font-sans border-b-2 transition-colors"
                  style={{
                    borderColor:     tab === t.id ? "#4ec9b0"  : "transparent",
                    color:           tab === t.id ? "#d4d4d4"  : "#858585",
                    background:      "transparent",
                  }}
                >{t.label}</button>
              ))}
            </div>
            {tab === "formatted" && (
              <IconBtn title="Copy" onClick={doCopy} disabled={!formatted && !input}>
                {copied
                  ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="#4ec9b0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="8" height="9" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M3 11V3a1 1 0 011-1h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                }
              </IconBtn>
            )}
          </div>

          {/* Tab content */}
          {tab === "formatted" && (
            <div className="flex-1 relative" style={{ minHeight: 0 }}>
              <XmlAceWrapper value={formatted} readOnly name="xml-output-editor" />
            </div>
          )}

          {tab === "tree" && (
            <div className="flex-1 overflow-auto p-4">
              {!input ? (
                <p className="text-sm font-sans text-center mt-8" style={{ color: "#4a4a4a" }}>No XML yet</p>
              ) : !treeRoot ? (
                <p className="text-xs font-sans" style={{ color: "#f44747" }}>XML tidak valid</p>
              ) : (
                <XmlTreeNode node={treeRoot} depth={0} />
              )}
            </div>
          )}

          {tab === "schema" && (
            <div className="flex-1 overflow-auto p-4">
              {!input ? (
                <p className="text-sm font-sans text-center mt-8" style={{ color: "#4a4a4a" }}>No XML yet</p>
              ) : !schemaRoot ? (
                <p className="text-xs font-sans" style={{ color: "#f44747" }}>XML tidak valid</p>
              ) : (
                <>
                  {/* Legend */}
                  <div className="flex items-center gap-4 mb-4 text-xs font-sans" style={{ color: "#858585" }}>
                    <span className="flex items-center gap-1.5">
                      <span style={{ color: "#4ec9b0" }}>&lt;tag&gt;</span> element
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span style={{ color: "#9cdcfe" }}>@attr</span> attribute
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="px-1 rounded" style={{ background: "#1a2a3a", color: "#569cd6" }}>[N]</span> repeated
                    </span>
                  </div>
                  <XmlSchemaNode node={schemaRoot} count={1} depth={0} />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
