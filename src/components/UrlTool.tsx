"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";

type Tab = "parse" | "encode";
type EncMode = "encode" | "decode";
type EncType = "component" | "full";

interface Param { id: string; key: string; value: string }
interface Parsed {
  protocol: string; username: string; password: string;
  hostname: string; port: string; pathname: string; hash: string;
}

function tryParse(raw: string): { parsed: Parsed; params: Param[] } | null {
  try {
    const url = new URL(raw.trim());
    const params: Param[] = [];
    let i = 0;
    url.searchParams.forEach((v, k) => params.push({ id: String(i++), key: k, value: v }));
    return {
      parsed: {
        protocol: url.protocol.replace(":", ""),
        username: url.username,
        password: url.password,
        hostname: url.hostname,
        port: url.port,
        pathname: url.pathname,
        hash: url.hash.replace("#", ""),
      },
      params,
    };
  } catch { return null; }
}

function buildUrl(p: Parsed, params: Param[]): string {
  try {
    const url = new URL(`${p.protocol}://${p.hostname}`);
    if (p.port) url.port = p.port;
    if (p.username) url.username = p.username;
    if (p.password) url.password = p.password;
    url.pathname = p.pathname;
    if (p.hash) url.hash = p.hash;
    const sp = new URLSearchParams();
    params.forEach(({ key, value }) => { if (key) sp.append(key, value); });
    url.search = sp.toString();
    return url.toString();
  } catch { return ""; }
}

function doEncode(text: string, mode: EncMode, type: EncType): string {
  if (!text) return "";
  try {
    if (mode === "encode") return type === "component" ? encodeURIComponent(text) : encodeURI(text);
    return type === "component" ? decodeURIComponent(text) : decodeURI(text);
  } catch { return "Invalid input"; }
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-sans" style={{ color: "#858585" }}>{label}</span>
      <span
        className={`text-sm break-all ${mono ? "font-mono" : "font-sans"}`}
        style={{ color: value ? "#d4d4d4" : "#4a4a4a" }}
      >
        {value || "—"}
      </span>
    </div>
  );
}

const EXAMPLE_URL = "https://api.example.com/v1/users?page=1&limit=10&sort=name&order=asc&filter=active#results";
const EXAMPLE_ENC: Record<EncMode, string> = {
  encode: "hello world & foo=bar/baz?query=value with spaces",
  decode: "hello%20world%20%26%20foo%3Dbar%2Fbaz%3Fquery%3Dvalue%20with%20spaces",
};

// ── Main ───────────────────────────────────────────────────────────────────

export default function UrlTool() {
  const [tab, setTab] = useState<Tab>("parse");

  // Parse tab
  const [urlInput, setUrlInput] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [params, setParams] = useState<Param[]>([]);
  const [parseError, setParseError] = useState("");
  const [reconstructed, setReconstructed] = useState("");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const idRef = useRef(0);
  const newId = () => String(idRef.current++);

  const handleUrlInput = (raw: string) => {
    setUrlInput(raw);
    if (!raw.trim()) { setParsed(null); setParams([]); setParseError(""); setReconstructed(""); return; }
    const result = tryParse(raw);
    if (result) {
      setParsed(result.parsed);
      setParams(result.params);
      setParseError("");
      setReconstructed(buildUrl(result.parsed, result.params));
    } else {
      setParsed(null); setParams([]); setParseError("URL tidak valid");
      setReconstructed("");
    }
  };

  const updateParam = (id: string, field: "key" | "value", val: string) => {
    const next = params.map(p => p.id === id ? { ...p, [field]: val } : p);
    setParams(next);
    if (parsed) setReconstructed(buildUrl(parsed, next));
  };

  const removeParam = (id: string) => {
    const next = params.filter(p => p.id !== id);
    setParams(next);
    if (parsed) setReconstructed(buildUrl(parsed, next));
  };

  const addParam = () => {
    const next = [...params, { id: newId(), key: "", value: "" }];
    setParams(next);
    if (parsed) setReconstructed(buildUrl(parsed, next));
  };

  const copyUrl = async () => {
    if (!reconstructed) return;
    try { await navigator.clipboard.writeText(reconstructed); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = reconstructed; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Encode tab
  const [encInput, setEncInput] = useState("");
  const [encMode, setEncMode] = useState<EncMode>("encode");
  const [encType, setEncType] = useState<EncType>("component");
  const encOutput = doEncode(encInput, encMode, encType);

  const copyEnc = useCallback(async () => {
    if (!encOutput) return;
    try { await navigator.clipboard.writeText(encOutput); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = encOutput; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
  }, [encOutput]);

  return (
    <div className="h-screen flex flex-col font-mono text-sm overflow-hidden" style={{ background: "#1e1e1e", color: "#d4d4d4" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 shrink-0 border-b" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs transition-colors hover:text-white" style={{ color: "#858585" }}>← Home</Link>
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <span className="font-bold" style={{ color: "#4ec9b0" }}>🔗</span>
          <span className="text-sm font-sans font-medium">URL Encoder / Parser</span>
        </div>
        <div className="flex rounded overflow-hidden border" style={{ borderColor: "#3c3c3c" }}>
          {(["parse", "encode"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3 py-1 text-xs font-sans capitalize transition-colors"
              style={{ background: tab === t ? "#0e639c" : "#2d2d2d", color: tab === t ? "#fff" : "#858585" }}
            >{t === "parse" ? "Parser" : "Encoder"}</button>
          ))}
        </div>
      </header>

      {/* ── Parse tab ── */}
      {tab === "parse" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* URL input bar */}
          <div className="px-4 py-3 shrink-0 border-b" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => handleUrlInput(EXAMPLE_URL)}
                className="text-xs font-sans px-2 py-0.5 rounded transition-colors"
                style={{ background: "#3c3c3c", color: "#cccccc" }}
              >
                Use example
              </button>
            </div>
            <div className="flex items-center gap-2 rounded border px-3 py-2" style={{ background: "#1e1e1e", borderColor: parseError ? "#5a1a1a" : "#3c3c3c" }}>
              <span className="text-xs shrink-0 font-sans" style={{ color: "#858585" }}>URL</span>
              <input
                value={urlInput}
                onChange={e => handleUrlInput(e.target.value)}
                placeholder="https://example.com/path?foo=bar&baz=qux#section"
                className="flex-1 bg-transparent outline-none text-sm font-mono"
                style={{ color: "#d4d4d4", caretColor: "#d4d4d4" }}
                spellCheck={false}
                autoComplete="off"
              />
              {urlInput && (
                <button onClick={() => handleUrlInput("")} className="text-xs font-sans shrink-0" style={{ color: "#858585" }}>✕</button>
              )}
            </div>
            {parseError && <p className="text-xs font-sans mt-1.5" style={{ color: "#f44747" }}>✕ {parseError}</p>}
          </div>

          {!parsed && !parseError && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm font-sans" style={{ color: "#4a4a4a" }}>Paste a URL above to start parsing</p>
            </div>
          )}

          {parsed && (
            <div className="flex flex-1 overflow-hidden">
              {/* Left: Components */}
              <div className="flex flex-col overflow-auto p-4 gap-4" style={{ width: "45%", borderRight: "1px solid #3c3c3c" }}>
                <p className="text-xs font-sans font-medium uppercase tracking-wider" style={{ color: "#858585" }}>Components</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <Field label="Protocol" value={parsed.protocol} />
                  <Field label="Hostname" value={parsed.hostname} mono />
                  <Field label="Port" value={parsed.port} />
                  <Field label="Pathname" value={parsed.pathname} mono />
                  {parsed.username && <Field label="Username" value={parsed.username} />}
                  {parsed.password && <Field label="Password" value={parsed.password} />}
                  <Field label="Hash / Fragment" value={parsed.hash} mono />
                </div>

                {/* Reconstructed URL */}
                <div className="mt-2">
                  <p className="text-xs font-sans font-medium uppercase tracking-wider mb-2" style={{ color: "#858585" }}>Reconstructed URL</p>
                  <div className="rounded border p-3 text-xs font-mono break-all" style={{ background: "#252526", borderColor: "#3c3c3c", color: "#4ec9b0" }}>
                    {reconstructed || "—"}
                  </div>
                  {reconstructed && (
                    <button onClick={copyUrl} className="mt-2 text-xs font-sans px-2 py-1 rounded transition-colors" style={{ background: "#3c3c3c", color: "#cccccc" }}>
                      {copiedUrl ? "✓ Copied" : "Copy URL"}
                    </button>
                  )}
                </div>
              </div>

              {/* Right: Query params */}
              <div className="flex flex-col overflow-auto p-4" style={{ flex: 1 }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-sans font-medium uppercase tracking-wider" style={{ color: "#858585" }}>
                    Query Params {params.length > 0 && <span style={{ color: "#d4d4d4" }}>({params.length})</span>}
                  </p>
                  <button onClick={addParam} className="text-xs font-sans px-2 py-0.5 rounded transition-colors" style={{ background: "#3c3c3c", color: "#cccccc" }}>
                    + Add
                  </button>
                </div>

                {params.length === 0 ? (
                  <p className="text-xs font-sans" style={{ color: "#4a4a4a" }}>Tidak ada query params</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {/* Header */}
                    <div className="grid text-xs font-sans pb-1 border-b" style={{ gridTemplateColumns: "1fr 1fr 24px", borderColor: "#3c3c3c", color: "#858585" }}>
                      <span className="px-2">Key</span>
                      <span className="px-2">Value</span>
                      <span />
                    </div>
                    {params.map(p => (
                      <div key={p.id} className="grid items-center gap-1" style={{ gridTemplateColumns: "1fr 1fr 24px" }}>
                        <input
                          value={p.key}
                          onChange={e => updateParam(p.id, "key", e.target.value)}
                          className="rounded px-2 py-1 text-xs font-mono outline-none border"
                          style={{ background: "#252526", borderColor: "#3c3c3c", color: "#9cdcfe" }}
                          placeholder="key"
                          spellCheck={false}
                        />
                        <input
                          value={p.value}
                          onChange={e => updateParam(p.id, "value", e.target.value)}
                          className="rounded px-2 py-1 text-xs font-mono outline-none border"
                          style={{ background: "#252526", borderColor: "#3c3c3c", color: "#ce9178" }}
                          placeholder="value"
                          spellCheck={false}
                        />
                        <button onClick={() => removeParam(p.id)} className="text-center text-xs transition-colors hover:text-red-400" style={{ color: "#555" }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Encode tab ── */}
      {tab === "encode" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Encode toolbar */}
          <div className="flex items-center gap-3 px-4 py-2 shrink-0 border-b" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
            {/* Mode */}
            <div className="flex rounded overflow-hidden border" style={{ borderColor: "#3c3c3c" }}>
              {(["encode", "decode"] as EncMode[]).map(m => (
                <button key={m} onClick={() => setEncMode(m)}
                  className="px-3 py-1 text-xs font-sans capitalize transition-colors"
                  style={{ background: encMode === m ? "#0e639c" : "#2d2d2d", color: encMode === m ? "#fff" : "#858585" }}
                >{m}</button>
              ))}
            </div>
            <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
            {/* Type */}
            {(["component", "full"] as EncType[]).map(t => (
              <button key={t} onClick={() => setEncType(t)}
                className="text-xs font-sans px-2 py-1 rounded transition-colors"
                style={{ background: encType === t ? "#1e2d3d" : "transparent", color: encType === t ? "#569cd6" : "#858585", border: `1px solid ${encType === t ? "#0e639c" : "#3c3c3c"}` }}
              >
                {t === "component" ? "encodeURIComponent" : "encodeURI"}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={() => setEncInput(EXAMPLE_ENC[encMode])}
                className="text-xs font-sans px-3 py-1 rounded transition-colors"
                style={{ background: "#3c3c3c", color: "#cccccc" }}
              >Use example</button>
              <button onClick={copyEnc} disabled={!encOutput}
                className="text-xs font-sans px-3 py-1 rounded transition-colors disabled:opacity-30"
                style={{ background: "#3c3c3c", color: "#cccccc" }}
              >Copy</button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Input */}
            <div className="flex flex-col" style={{ width: "50%", borderRight: "1px solid #3c3c3c" }}>
              <div className="px-3 py-1 text-xs font-sans shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}>
                {encMode === "encode" ? "Plain text" : "Encoded"}
              </div>
              <textarea
                value={encInput}
                onChange={e => setEncInput(e.target.value)}
                placeholder={encMode === "encode" ? "hello world / foo=bar&baz=qux" : "hello%20world"}
                className="flex-1 resize-none outline-none text-sm leading-6 p-4"
                style={{ background: "#1e1e1e", color: "#d4d4d4", caretColor: "#d4d4d4" }}
                spellCheck={false}
              />
            </div>
            {/* Output */}
            <div className="flex flex-col flex-1">
              <div className="px-3 py-1 text-xs font-sans shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}>
                {encMode === "encode" ? "Encoded" : "Plain text"}
              </div>
              <textarea
                value={encOutput}
                readOnly
                placeholder="Output..."
                className="flex-1 resize-none outline-none text-sm leading-6 p-4"
                style={{ background: "#1a1a1a", color: encOutput === "Invalid input" ? "#f44747" : "#4ec9b0" }}
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
