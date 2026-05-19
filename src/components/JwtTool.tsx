"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import CryptoJS from "crypto-js";

type Tab = "decode" | "encode";

// ── Utilities ──────────────────────────────────────────────────────────────────

function b64urlDecode(str: string): string {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  s += "=".repeat((4 - (s.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function b64urlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const bin = Array.from(bytes, (b) => String.fromCodePoint(b)).join("");
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

interface Decoded {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  sig: string;
}

function decodeToken(token: string): { decoded: Decoded | null; error: string } {
  const parts = token.trim().split(".");
  if (parts.length !== 3) return { decoded: null, error: parts.length < 3 ? "Token tidak lengkap — JWT harus memiliki 3 bagian" : "Format tidak valid" };
  try {
    return {
      decoded: {
        header:  JSON.parse(b64urlDecode(parts[0])),
        payload: JSON.parse(b64urlDecode(parts[1])),
        sig:     parts[2],
      },
      error: "",
    };
  } catch {
    return { decoded: null, error: "Gagal decode token" };
  }
}

function signToken(headerStr: string, payloadStr: string, secret: string): { token: string; error: string } {
  try {
    const header  = JSON.parse(headerStr);
    const payload = JSON.parse(payloadStr);
    const alg     = typeof header.alg === "string" ? header.alg : "HS256";

    const data = `${b64urlEncode(JSON.stringify(header))}.${b64urlEncode(JSON.stringify(payload))}`;
    const hmac = alg === "HS384" ? CryptoJS.HmacSHA384(data, secret)
               : alg === "HS512" ? CryptoJS.HmacSHA512(data, secret)
               :                   CryptoJS.HmacSHA256(data, secret);
    const sig = CryptoJS.enc.Base64.stringify(hmac)
                  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    return { token: `${data}.${sig}`, error: "" };
  } catch (e) {
    return { token: "", error: e instanceof Error ? e.message : "Gagal encode token" };
  }
}

function fmtTime(unix: unknown): string {
  if (typeof unix !== "number") return "—";
  return new Date(unix * 1000).toLocaleString();
}

function tokenStatus(payload: Record<string, unknown>): { label: string; color: string } | null {
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.nbf === "number" && payload.nbf > now)
    return { label: "Not yet valid", color: "#ce9178" };
  if (typeof payload.exp === "number")
    return payload.exp < now
      ? { label: "Expired", color: "#f44747" }
      : { label: "Valid", color: "#4ec9b0" };
  return null;
}

// ── JSON highlight ─────────────────────────────────────────────────────────────

function highlightJson(obj: unknown): string {
  const str = JSON.stringify(obj, null, 2);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc(str).replace(
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (m) => {
      if (/^"/.test(m) && /:$/.test(m)) return `<span style="color:#9cdcfe">${m}</span>`;
      if (/^"/.test(m))                 return `<span style="color:#ce9178">${m}</span>`;
      if (/true|false/.test(m))         return `<span style="color:#569cd6">${m}</span>`;
      if (/null/.test(m))               return `<span style="color:#569cd6">${m}</span>`;
      return `<span style="color:#b5cea8">${m}</span>`;
    }
  );
}

// ── Constants ──────────────────────────────────────────────────────────────────

const EXAMPLE_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
  ".eyJzdWIiOiJ1c2VyXzEyMyIsIm5hbWUiOiJKb2huIERvZSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTcxNjIzOTAyMiwiZXhwIjoxNzE2MjQyNjIyfQ" +
  ".SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

const DEFAULT_HEADER  = JSON.stringify({ alg: "HS256", typ: "JWT" }, null, 2);
const defaultPayload = () => {
  const now = Math.floor(Date.now() / 1000);
  return JSON.stringify({ sub: "user_123", name: "John Doe", role: "admin", iat: now, exp: now + 3600 }, null, 2);
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded border overflow-hidden" style={{ borderColor: "#3c3c3c" }}>
      <div className="flex items-center justify-between px-3 py-1.5 text-xs font-sans" style={{ background: "#252526", color: "#858585" }}>
        <span className="font-semibold tracking-wider uppercase" style={{ fontSize: 10 }}>{title}</span>
        {badge}
      </div>
      <div style={{ background: "#1a1a1a" }}>{children}</div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function JwtTool() {
  const [tab, setTab] = useState<Tab>("decode");

  // Decode
  const [token, setToken]       = useState("");
  const [decoded, setDecoded]   = useState<Decoded | null>(null);
  const [decodeErr, setDecodeErr] = useState("");
  const [copiedDec, setCopiedDec] = useState(false);

  // Encode
  const [headerStr, setHeaderStr] = useState(DEFAULT_HEADER);
  const [payloadStr, setPayloadStr] = useState(defaultPayload());
  const [secret, setSecret]       = useState("your-secret-key");
  const [genToken, setGenToken]   = useState("");
  const [genErr, setGenErr]       = useState("");
  const [copiedEnc, setCopiedEnc] = useState(false);

  const handleToken = (val: string) => {
    setToken(val);
    if (!val.trim()) { setDecoded(null); setDecodeErr(""); return; }
    const { decoded: d, error } = decodeToken(val);
    setDecoded(d); setDecodeErr(error);
  };

  useEffect(() => {
    if (!headerStr.trim() || !payloadStr.trim()) { setGenToken(""); setGenErr(""); return; }
    const { token: t, error } = signToken(headerStr, payloadStr, secret);
    setGenToken(t); setGenErr(error);
  }, [headerStr, payloadStr, secret]);

  const copyText = async (text: string, setCopied: (v: boolean) => void) => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const status = decoded ? tokenStatus(decoded.payload) : null;

  return (
    <div className="h-screen flex flex-col font-mono text-sm overflow-hidden" style={{ background: "#1e1e1e", color: "#d4d4d4" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 shrink-0 border-b" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs transition-colors hover:text-white" style={{ color: "#858585" }}>← Home</Link>
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <span className="font-bold" style={{ color: "#dcdcaa" }}>JWT</span>
          <span className="text-sm font-sans font-medium">JWT Decoder / Encoder</span>
        </div>
        <div className="flex rounded overflow-hidden border" style={{ borderColor: "#3c3c3c" }}>
          {(["decode", "encode"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3 py-1 text-xs font-sans capitalize transition-colors"
              style={{ background: tab === t ? "#0e639c" : "#2d2d2d", color: tab === t ? "#fff" : "#858585" }}
            >{t === "decode" ? "Decoder" : "Encoder"}</button>
          ))}
        </div>
      </header>

      {/* ── Decode tab ── */}
      {tab === "decode" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left — input */}
          <div className="flex flex-col" style={{ width: "50%", minWidth: 0, borderRight: "1px solid #3c3c3c" }}>
            <div className="flex items-center gap-2 px-3 py-1.5 shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c" }}>
              <button onClick={() => handleToken(EXAMPLE_TOKEN)}
                className="text-xs font-sans px-2 py-0.5 rounded transition-colors"
                style={{ background: "#3c3c3c", color: "#cccccc" }}
              >Use example</button>
              <button onClick={() => { setToken(""); setDecoded(null); setDecodeErr(""); }}
                disabled={!token}
                className="text-xs font-sans px-2 py-0.5 rounded transition-colors disabled:opacity-30"
                style={{ background: "#3c3c3c", color: "#cccccc" }}
              >Clear</button>
              <button onClick={() => copyText(token, setCopiedDec)} disabled={!token}
                className="text-xs font-sans px-2 py-0.5 rounded transition-colors disabled:opacity-30 ml-auto"
                style={{ background: "#3c3c3c", color: "#cccccc" }}
              >{copiedDec ? "✓ Copied" : "Copy"}</button>
            </div>
            <textarea
              value={token}
              onChange={(e) => handleToken(e.target.value)}
              placeholder="Paste JWT token here..."
              className="flex-1 resize-none outline-none text-xs leading-6 p-4 font-mono"
              style={{ background: "#1e1e1e", color: "#ce9178", caretColor: "#d4d4d4", wordBreak: "break-all" }}
              spellCheck={false}
            />
            {decodeErr && (
              <div className="px-4 py-2 text-xs font-sans shrink-0 border-t" style={{ background: "#2d0000", borderColor: "#5a1a1a", color: "#f44747" }}>
                ✕ {decodeErr}
              </div>
            )}
          </div>

          {/* Right — decoded */}
          <div className="flex flex-col flex-1 overflow-auto p-4 gap-3">
            {!token && (
              <p className="text-sm font-sans m-auto" style={{ color: "#4a4a4a" }}>Paste a JWT token on the left</p>
            )}
            {decoded && (
              <>
                {/* Status */}
                {status && (
                  <div className="flex items-center gap-2 text-xs font-sans px-3 py-1.5 rounded border" style={{ borderColor: "#3c3c3c", background: "#252526" }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: status.color }} />
                    <span style={{ color: status.color }}>{status.label}</span>
                    {typeof decoded.payload.exp === "number" && (
                      <span style={{ color: "#858585" }}>— exp: {fmtTime(decoded.payload.exp)}</span>
                    )}
                  </div>
                )}

                {/* Header */}
                <Section title="Header">
                  <pre className="text-xs leading-5 p-3 overflow-x-auto font-mono"
                    dangerouslySetInnerHTML={{ __html: highlightJson(decoded.header) }}
                  />
                </Section>

                {/* Payload */}
                <Section title="Payload" badge={
                  typeof decoded.payload.exp === "number"
                    ? <span className="text-xs" style={{ color: "#858585" }}>exp {fmtTime(decoded.payload.exp)}</span>
                    : undefined
                }>
                  <pre className="text-xs leading-5 p-3 overflow-x-auto font-mono"
                    dangerouslySetInnerHTML={{ __html: highlightJson(decoded.payload) }}
                  />
                  {(!!decoded.payload.iat || !!decoded.payload.exp || !!decoded.payload.nbf) && (
                    <div className="px-3 pb-3 flex flex-col gap-1">
                      {typeof decoded.payload.iat === "number" && (
                        <div className="text-xs font-sans flex gap-2" style={{ color: "#858585" }}>
                          <span className="w-8 shrink-0" style={{ color: "#569cd6" }}>iat</span>
                          <span>{fmtTime(decoded.payload.iat)}</span>
                        </div>
                      )}
                      {typeof decoded.payload.exp === "number" && (
                        <div className="text-xs font-sans flex gap-2" style={{ color: "#858585" }}>
                          <span className="w-8 shrink-0" style={{ color: (decoded.payload.exp as number) < Date.now() / 1000 ? "#f44747" : "#4ec9b0" }}>exp</span>
                          <span>{fmtTime(decoded.payload.exp)}</span>
                        </div>
                      )}
                      {typeof decoded.payload.nbf === "number" && (
                        <div className="text-xs font-sans flex gap-2" style={{ color: "#858585" }}>
                          <span className="w-8 shrink-0" style={{ color: "#ce9178" }}>nbf</span>
                          <span>{fmtTime(decoded.payload.nbf)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </Section>

                {/* Signature */}
                <Section title="Signature">
                  <p className="text-xs p-3 font-mono break-all" style={{ color: "#858585" }}>{decoded.sig}</p>
                </Section>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Encode tab ── */}
      {tab === "encode" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left — inputs */}
          <div className="flex flex-col overflow-auto p-4 gap-3" style={{ width: "50%", minWidth: 0, borderRight: "1px solid #3c3c3c" }}>
            {/* Header */}
            <div>
              <p className="text-xs font-sans mb-1.5 uppercase tracking-wider" style={{ color: "#858585", fontSize: 10 }}>Header</p>
              <textarea
                value={headerStr}
                onChange={(e) => setHeaderStr(e.target.value)}
                rows={4}
                className="w-full resize-none outline-none text-xs leading-5 p-3 font-mono rounded border"
                style={{ background: "#252526", borderColor: "#3c3c3c", color: "#d4d4d4", caretColor: "#d4d4d4" }}
                spellCheck={false}
              />
            </div>

            {/* Payload */}
            <div>
              <p className="text-xs font-sans mb-1.5 uppercase tracking-wider" style={{ color: "#858585", fontSize: 10 }}>Payload</p>
              <textarea
                value={payloadStr}
                onChange={(e) => setPayloadStr(e.target.value)}
                rows={8}
                className="w-full resize-none outline-none text-xs leading-5 p-3 font-mono rounded border"
                style={{ background: "#252526", borderColor: "#3c3c3c", color: "#d4d4d4", caretColor: "#d4d4d4" }}
                spellCheck={false}
              />
            </div>

            {/* Secret */}
            <div>
              <p className="text-xs font-sans mb-1.5 uppercase tracking-wider" style={{ color: "#858585", fontSize: 10 }}>Secret</p>
              <input
                type="text"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="w-full outline-none text-xs p-3 font-mono rounded border"
                style={{ background: "#252526", borderColor: "#3c3c3c", color: "#4ec9b0", caretColor: "#d4d4d4" }}
                spellCheck={false}
              />
            </div>
          </div>

          {/* Right — generated token */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-1.5 shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c" }}>
              <span className="text-xs font-sans" style={{ color: "#858585" }}>Generated Token</span>
              <button onClick={() => copyText(genToken, setCopiedEnc)} disabled={!genToken}
                className="text-xs font-sans px-2 py-0.5 rounded transition-colors disabled:opacity-30 ml-auto"
                style={{ background: "#3c3c3c", color: "#cccccc" }}
              >{copiedEnc ? "✓ Copied" : "Copy"}</button>
            </div>

            {genErr ? (
              <div className="p-4 text-xs font-sans" style={{ color: "#f44747" }}>✕ {genErr}</div>
            ) : genToken ? (
              <div className="flex-1 overflow-auto p-4">
                {/* Color-coded token parts */}
                {(() => {
                  const parts = genToken.split(".");
                  const colors = ["#569cd6", "#ce9178", "#858585"];
                  return (
                    <div className="text-xs font-mono leading-6 break-all mb-4">
                      {parts.map((p, i) => (
                        <span key={i}>
                          <span style={{ color: colors[i] }}>{p}</span>
                          {i < 2 && <span style={{ color: "#4a4a4a" }}>.</span>}
                        </span>
                      ))}
                    </div>
                  );
                })()}
                {/* Legend */}
                <div className="flex gap-4 text-xs font-sans">
                  {[["#569cd6", "header"], ["#ce9178", "payload"], ["#858585", "signature"]].map(([color, label]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <span style={{ color: "#858585" }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm font-sans" style={{ color: "#4a4a4a" }}>Fill in header, payload, and secret on the left</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
