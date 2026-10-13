"use client";

import { useState, useRef, useEffect, createContext, useContext } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { parse, print, stripIgnoredCharacters, Kind } from "graphql";
import type { DocumentNode, DefinitionNode, SelectionSetNode, FieldDefinitionNode, InputValueDefinitionNode } from "graphql";

// seq increments on every expand/collapse all so useEffect always fires
const TreeCtx = createContext<{ seq: number; open: boolean } | null>(null);

type Tab = "tree" | "raw" | "schema";

const C = {
  keyword: "#569cd6",
  type:    "#4ec9b0",
  field:   "#9cdcfe",
  arg:     "#ce9178",
  punct:   "#808080",
  dim:     "#6a6a6a",
};

const GraphqlAceWrapper = dynamic(() => import("./GraphqlAceWrapper"), { ssr: false });

const EXAMPLE = `query GetUser($id: ID!, $first: Int = 10) { user(id: $id) { id name email ...UserAvatar posts(first: $first, orderBy: {field: CREATED_AT, direction: DESC}) { edges { node { id title createdAt } } pageInfo { hasNextPage endCursor } } } } fragment UserAvatar on User { avatar(size: 64) { url } }`;


// ── Tree View: AST → generic tree items ───────────────────────────────────────

type Seg = [string, string]; // [text, color]
type Item = { label: Seg[]; children?: Item[] };

const args = (a?: readonly { kind: Kind }[]): Seg[] =>
  a && a.length ? [["(" + a.map(n => print(n as never)).join(", ") + ")", C.arg]] : [];

function selItems(set?: SelectionSetNode): Item[] | undefined {
  return set?.selections.map(sel => {
    if (sel.kind === Kind.FIELD) return {
      label: [...(sel.alias ? [[sel.alias.value + ": ", C.dim] as Seg] : []), [sel.name.value, C.field], ...args(sel.arguments)],
      children: selItems(sel.selectionSet),
    };
    if (sel.kind === Kind.FRAGMENT_SPREAD) return { label: [["...", C.punct], [sel.name.value, C.type]] };
    return {
      label: [["... on ", C.keyword], [sel.typeCondition?.name.value ?? "", C.type]],
      children: selItems(sel.selectionSet),
    };
  });
}

const fieldItem = (f: FieldDefinitionNode | InputValueDefinitionNode): Item => ({
  label: [
    [f.name.value, C.field],
    ...("arguments" in f ? args(f.arguments) : []),
    [": ", C.punct], [print(f.type), C.type],
    ...("defaultValue" in f && f.defaultValue ? [[" = " + print(f.defaultValue), C.arg] as Seg] : []),
  ],
});

function defItem(d: DefinitionNode): Item {
  switch (d.kind) {
    case Kind.OPERATION_DEFINITION:
      return {
        label: [[d.operation + " ", C.keyword], [d.name?.value ?? "(anonymous)", C.type], ...args(d.variableDefinitions)],
        children: selItems(d.selectionSet),
      };
    case Kind.FRAGMENT_DEFINITION:
      return {
        label: [["fragment ", C.keyword], [d.name.value, C.type], [" on ", C.keyword], [d.typeCondition.name.value, C.type]],
        children: selItems(d.selectionSet),
      };
    case Kind.OBJECT_TYPE_DEFINITION: case Kind.OBJECT_TYPE_EXTENSION:
    case Kind.INTERFACE_TYPE_DEFINITION: case Kind.INTERFACE_TYPE_EXTENSION:
    case Kind.INPUT_OBJECT_TYPE_DEFINITION: case Kind.INPUT_OBJECT_TYPE_EXTENSION:
      return { label: [[kindWord(d) + " ", C.keyword], [d.name.value, C.type]], children: (d.fields ?? []).map(fieldItem) };
    case Kind.ENUM_TYPE_DEFINITION: case Kind.ENUM_TYPE_EXTENSION:
      return { label: [[kindWord(d) + " ", C.keyword], [d.name.value, C.type]], children: (d.values ?? []).map(v => ({ label: [[v.name.value, C.field]] })) };
    case Kind.UNION_TYPE_DEFINITION: case Kind.UNION_TYPE_EXTENSION:
      return { label: [[kindWord(d) + " ", C.keyword], [d.name.value, C.type]], children: (d.types ?? []).map(t => ({ label: [[t.name.value, C.type]] })) };
    case Kind.SCALAR_TYPE_DEFINITION: case Kind.SCALAR_TYPE_EXTENSION:
      return { label: [[kindWord(d) + " ", C.keyword], [d.name.value, C.type]] };
    case Kind.SCHEMA_DEFINITION: case Kind.SCHEMA_EXTENSION:
      return { label: [[kindWord(d), C.keyword]], children: (d.operationTypes ?? []).map(o => ({ label: [[o.operation + ": ", C.field], [o.type.name.value, C.type]] })) };
    case Kind.DIRECTIVE_DEFINITION:
      return { label: [["directive ", C.keyword], ["@" + d.name.value, C.type], ...args(d.arguments)] };
    default:
      return { label: [[(d as DefinitionNode).kind, C.keyword]] };
  }
}

function kindWord(d: DefinitionNode): string {
  const ext = d.kind.endsWith("Extension") ? "extend " : "";
  const word: Record<string, string> = {
    Object: "type", Interface: "interface", InputObject: "input", Enum: "enum", Union: "union", Scalar: "scalar", Schema: "schema",
  };
  const base = d.kind.replace(/TypeDefinition|TypeExtension|Definition|Extension/, "");
  return ext + (word[base] ?? base);
}

function Label({ segs }: { segs: Seg[] }) {
  return <>{segs.map(([t, c], i) => <span key={i} style={{ color: c }}>{t}</span>)}</>;
}

function GqlNode({ item, depth = 0 }: { item: Item; depth?: number }) {
  const force = useContext(TreeCtx);
  const [open, setOpen] = useState(depth < 3);
  const pad = depth * 16;

  useEffect(() => {
    if (force !== null) setOpen(force.open);
  }, [force?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item.children?.length)
    return <div className="leading-6 whitespace-pre" style={{ paddingLeft: pad + 14 }}><Label segs={item.label} /></div>;

  return (
    <div>
      <div className="leading-6 whitespace-pre cursor-pointer select-none hover:bg-white/5 rounded" style={{ paddingLeft: pad }} onClick={() => setOpen(o => !o)}>
        <span className="inline-block w-3.5 text-xs" style={{ color: C.punct }}>{open ? "▾" : "▸"}</span>
        <Label segs={item.label} />
        <span style={{ color: C.punct }}>{open ? " {" : " { … }"}</span>
        {!open && <span className="text-xs font-sans ml-2" style={{ color: C.dim }}>{item.children.length} items</span>}
      </div>
      {open && <>
        {item.children.map((c, i) => <GqlNode key={i} item={c} depth={depth + 1} />)}
        <div className="leading-6" style={{ paddingLeft: pad + 14, color: C.punct }}>{"}"}</div>
      </>}
    </div>
  );
}

// ── Schema: per-definition summary with kind badges ───────────────────────────

const BADGE: Record<string, string> = {
  query: "#569cd6", mutation: "#c586c0", subscription: "#d7ba7d", fragment: "#4ec9b0",
  type: "#4ec9b0", input: "#dcdcaa", enum: "#b5cea8", interface: "#9cdcfe", union: "#ce9178", scalar: "#d4d4d4",
};

function schemaRows(d: DefinitionNode): { badge: string; name: string; rows: Seg[][] } {
  if (d.kind === Kind.OPERATION_DEFINITION) return {
    badge: d.operation, name: d.name?.value ?? "(anonymous)",
    rows: (d.variableDefinitions ?? []).map(v => [["$" + v.variable.name.value, C.field], [": ", C.punct], [print(v.type), C.type],
      ...(v.defaultValue ? [[" = " + print(v.defaultValue), C.arg] as Seg] : [])]),
  };
  if (d.kind === Kind.FRAGMENT_DEFINITION) return { badge: "fragment", name: d.name.value, rows: [[["on ", C.keyword], [d.typeCondition.name.value, C.type]]] };
  const item = defItem(d);
  return {
    badge: kindWord(d).replace("extend ", ""),
    name: "name" in d && d.name ? d.name.value : "",
    rows: (item.children ?? []).map(c => c.label),
  };
}

function SchemaView({ doc }: { doc: DocumentNode }) {
  return (
    <div className="flex flex-col gap-3">
      {doc.definitions.map((d, i) => {
        const { badge, name, rows } = schemaRows(d);
        const color = BADGE[badge] ?? C.keyword;
        return (
          <div key={i} className="rounded border" style={{ borderColor: "#3c3c3c" }}>
            <div className="flex items-center gap-2 px-3 py-1.5 border-b" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
              <span className="text-[10px] font-sans px-1.5 py-0.5 rounded" style={{ color, border: `1px solid ${color}55`, background: `${color}15` }}>{badge}</span>
              <span style={{ color: C.type }}>{name}</span>
              <span className="ml-auto text-xs font-sans" style={{ color: C.dim }}>{rows.length || ""}</span>
            </div>
            {rows.length > 0 && (
              <div className="px-3 py-1.5 text-sm">
                {rows.map((r, j) => <div key={j} className="leading-6 whitespace-pre"><Label segs={r} /></div>)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

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

function tryFormat(gql: string): { result: string; doc: DocumentNode | null; error: string } {
  try {
    const doc = parse(gql);
    return { result: print(doc), doc, error: "" };
  } catch (e) {
    return { result: "", doc: null, error: e instanceof Error ? e.message : "Format failed" };
  }
}

export default function GraphqlFormatter() {
  const [input, setInput]       = useState("");
  const [formatted, setFormatted] = useState("");
  const [error, setError]       = useState("");
  const [copied, setCopied]     = useState(false);
  const [doc, setDoc]           = useState<DocumentNode | null>(null);
  const [tab, setTab]           = useState<Tab>("tree");
  const [treeForce, setTreeForce] = useState<{ seq: number; open: boolean } | null>(null);
  const expandAll   = () => setTreeForce(p => ({ seq: (p?.seq ?? 0) + 1, open: true }));
  const collapseAll = () => setTreeForce(p => ({ seq: (p?.seq ?? 0) + 1, open: false }));

  const updateFormatted = (gql: string) => {
    if (!gql.trim()) { setFormatted(""); setDoc(null); setError(""); return; }
    const { result, doc: d, error: err } = tryFormat(gql);
    setFormatted(result);
    setDoc(d);
    setError(err);
  };

  // Undo/redo history (tracks batch ops: format, minify, paste, example, clear) — same as JSON Formatter
  const stackRef = useRef<string[]>([""]);
  const idxRef = useRef(0);
  const [opIdx, setOpIdx] = useState(0); // drives button disabled state

  const pushOp = (val: string) => {
    const next = stackRef.current.slice(0, idxRef.current + 1).concat(val);
    stackRef.current = next;
    idxRef.current = next.length - 1;
    setOpIdx(next.length - 1);
  };

  const applyVal = (gql: string) => {
    setInput(gql);
    updateFormatted(gql);
  };

  // Live typing — update current stack entry so undo restores typed state
  const handleInput = (gql: string) => {
    stackRef.current[idxRef.current] = gql;
    applyVal(gql);
  };

  const doFormat = () => {
    if (!input.trim()) return;
    const { result, error: err } = tryFormat(input);
    if (result) { pushOp(result); setInput(result); setFormatted(result); }
    setError(err);
  };

  const doMinify = () => {
    if (!input.trim()) return;
    try { const m = stripIgnoredCharacters(input); pushOp(m); setInput(m); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Minify failed"); }
    // formatted stays — right panel keeps showing formatted version
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

  const canUndo = opIdx > 0;
  const canRedo = opIdx < stackRef.current.length - 1;

  const doCopy = async () => {
    if (!formatted) return;
    try { await navigator.clipboard.writeText(formatted); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = formatted; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const doPaste = async () => {
    try { const t = await navigator.clipboard.readText(); pushOp(t); applyVal(t); }
    catch { alert("Clipboard not accessible over HTTP. Use Ctrl+V / Cmd+V to paste directly."); }
  };

  const doClear = () => { pushOp(""); applyVal(""); };

  return (
    <div className="h-screen flex flex-col font-mono text-sm overflow-hidden" style={{ background: "#1e1e1e", color: "#d4d4d4" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 shrink-0 border-b" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs transition-colors hover:text-white" style={{ color: "#858585" }}>← Home</Link>
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <span className="font-bold" style={{ color: "#e535ab" }}>GQL</span>
          <span className="text-sm font-sans font-medium">GraphQL Formatter</span>
        </div>
      </header>

      {/* Panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Input */}
        <div className="flex flex-col" style={{ width: "50%", minWidth: 0, borderRight: "1px solid #3c3c3c" }}>
          <div className="flex items-center gap-0.5 px-2 py-1 shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c" }}>
            <IconBtn title="Format GraphQL" onClick={() => doFormat()} disabled={!input}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4h12M5 8h9M5 12h9" />
                <path d="M2 6.5l1.5 1.5-1.5 1.5" />
              </svg>
            </IconBtn>
            <IconBtn title="Minify GraphQL" onClick={doMinify} disabled={!input}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 5h12M2 8h12M2 11h12" />
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
            <IconBtn title={copied ? "Copied!" : "Copy output"} onClick={doCopy} disabled={!formatted}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="5" width="8" height="9" rx="1" />
                <path d="M3 11V3a1 1 0 011-1h7" />
              </svg>
            </IconBtn>
            <IconBtn title="Paste from clipboard" onClick={doPaste}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="8" height="10" rx="1" />
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
            <span className="ml-auto text-xs font-sans" style={{ color: "#858585" }}>
              {input ? `${input.length} chars` : ""}
            </span>
          </div>
          <div className="flex-1 relative" style={{ minHeight: 0 }}>
            <GraphqlAceWrapper value={input} onChange={handleInput} name="graphql-input-editor" />
          </div>
        </div>

        {/* Right — Tree / Formatted / Schema */}
        <div className="flex flex-col" style={{ width: "50%", minWidth: 0 }}>
          <div className="flex items-center shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c" }}>
            {(["tree", "raw", "schema"] as Tab[]).map(t => (
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
                {t === "tree" ? "Tree View" : t === "raw" ? "Formatted" : "Schema"}
              </button>
            ))}
          </div>

          {/* Collapse / Expand bar — tree view only */}
          {tab === "tree" && (
            <div className="flex items-center gap-1 px-3 py-1 shrink-0 border-b" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
              <button
                onClick={expandAll}
                disabled={!doc}
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
                disabled={!doc}
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

          {tab === "raw" && !error && formatted ? (
            <div className="flex-1 relative" style={{ minHeight: 0 }}>
              <GraphqlAceWrapper value={formatted} name="graphql-output-editor" readOnly />
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-4">
              {!input && (
                <p className="text-xs font-sans" style={{ color: "#4a4a4a" }}>Output will appear here</p>
              )}
              {input && error && (
                <div className="rounded p-4 border text-xs font-sans" style={{ background: "#2d0000", borderColor: "#5a1a1a", color: "#f44747" }}>
                  <p className="font-semibold mb-1">GraphQL tidak valid</p>
                  <p className="font-mono opacity-80">{error}</p>
                </div>
              )}
              {input && !error && doc && (
                tab === "tree" ? (
                  <TreeCtx.Provider value={treeForce}>
                    <div className="text-sm leading-6">
                      {doc.definitions.map((d, i) => <GqlNode key={i} item={defItem(d)} />)}
                    </div>
                  </TreeCtx.Provider>
                ) : (
                  <div>
                    <p className="text-xs font-sans mb-4" style={{ color: "#6a6a6a" }}>
                      Operations, fragments &amp; types with their variables / fields
                    </p>
                    <SchemaView doc={doc} />
                  </div>
                )
              )}
            </div>
          )}

          {formatted && (
            <div className="px-4 py-1.5 text-xs shrink-0 border-t font-sans" style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}>
              {formatted.length} chars · {formatted.split("\n").length} lines
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
