"use client";

import { useState } from "react";
import Link from "next/link";
import CryptoJS from "crypto-js";

// ── Hash computation ───────────────────────────────────────────────────────────

const ALGOS = ["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
type Algo = typeof ALGOS[number];

function compute(text: string, algo: Algo, hmac: boolean, secret: string): string {
  const key = hmac ? secret : null;
  switch (algo) {
    case "MD5":    return key ? CryptoJS.HmacMD5(text, key).toString()    : CryptoJS.MD5(text).toString();
    case "SHA-1":  return key ? CryptoJS.HmacSHA1(text, key).toString()   : CryptoJS.SHA1(text).toString();
    case "SHA-256":return key ? CryptoJS.HmacSHA256(text, key).toString() : CryptoJS.SHA256(text).toString();
    case "SHA-384":return key ? CryptoJS.HmacSHA384(text, key).toString() : CryptoJS.SHA384(text).toString();
    case "SHA-512":return key ? CryptoJS.HmacSHA512(text, key).toString() : CryptoJS.SHA512(text).toString();
  }
}

// ── Example ────────────────────────────────────────────────────────────────────

const EXAMPLE = "The quick brown fox jumps over the lazy dog";

// ── Main ───────────────────────────────────────────────────────────────────────

export default function HashGenerator() {
  const [text, setText]     = useState("");
  const [hmac, setHmac]     = useState(false);
  const [secret, setSecret] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

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

  const hashes = text
    ? ALGOS.map(algo => ({ algo, hash: compute(text, algo, hmac, secret) }))
    : null;

  return (
    <div className="h-screen flex flex-col font-mono text-sm overflow-hidden" style={{ background: "#1e1e1e", color: "#d4d4d4" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 shrink-0 border-b" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs transition-colors hover:text-white" style={{ color: "#858585" }}>← Home</Link>
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <span className="font-bold" style={{ color: "#4ec9b0" }}>#</span>
          <span className="text-sm font-sans font-medium">Hash Generator</span>
        </div>

        <div className="flex items-center gap-2">
          {/* HMAC toggle */}
          <button
            onClick={() => setHmac(h => !h)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-sans rounded border transition-colors"
            style={{
              borderColor: hmac ? "#0e639c" : "#3c3c3c",
              background:  hmac ? "#0e1e2e" : "transparent",
              color:       hmac ? "#569cd6" : "#858585",
            }}
          >
            <span className="w-3 h-3 rounded-sm border flex items-center justify-center" style={{ borderColor: hmac ? "#569cd6" : "#555" }}>
              {hmac && <span style={{ color: "#569cd6", fontSize: 9, lineHeight: 1 }}>✓</span>}
            </span>
            HMAC
          </button>

          {hmac && (
            <>
              <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
              <input
                value={secret}
                onChange={e => setSecret(e.target.value)}
                placeholder="Secret key..."
                className="text-xs font-mono px-2.5 py-1 rounded border outline-none w-44"
                style={{ background: "#1e1e1e", borderColor: "#3c3c3c", color: "#d4d4d4" }}
              />
            </>
          )}

          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <button
            onClick={() => setText(EXAMPLE)}
            className="text-xs font-sans px-2.5 py-1 rounded transition-colors"
            style={{ background: "#3c3c3c", color: "#cccccc" }}
          >
            Use example
          </button>
          <button
            onClick={() => setText("")}
            disabled={!text}
            className="text-xs font-sans px-2.5 py-1 rounded transition-colors disabled:opacity-30"
            style={{ background: "#3c3c3c", color: "#cccccc" }}
          >
            Clear
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — input */}
        <div className="flex flex-col" style={{ width: "50%", minWidth: 0, borderRight: "1px solid #3c3c3c" }}>
          <div className="flex items-center justify-between px-3 py-1 text-xs font-sans shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}>
            <span>Input</span>
            {text && <span>{text.length} chars</span>}
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste text to hash here..."
            className="flex-1 resize-none outline-none text-sm leading-6 p-4 font-mono"
            style={{ background: "#1e1e1e", color: "#d4d4d4", caretColor: "#d4d4d4" }}
            spellCheck={false}
          />
        </div>

        {/* Right — results */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-3 py-1 text-xs font-sans shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}>
            <span>{hmac ? "HMAC Hashes" : "Hashes"}</span>
          </div>

          {!hashes ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm font-sans" style={{ color: "#4a4a4a" }}>Paste text on the left to get started</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
              {hashes.map(({ algo, hash }) => (
                <div key={algo}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-sans font-semibold" style={{ color: "#4ec9b0" }}>{hmac ? `HMAC-${algo}` : algo}</span>
                    <button
                      onClick={() => doCopy(hash, algo)}
                      className="text-xs font-sans px-2 py-0.5 rounded transition-colors"
                      style={{ background: "#3c3c3c", color: copied === algo ? "#4ec9b0" : "#cccccc" }}
                    >
                      {copied === algo ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div
                    className="text-xs leading-5 px-3 py-2 rounded break-all select-all"
                    style={{ background: "#252526", color: "#ce9178", border: "1px solid #3c3c3c" }}
                  >
                    {hash}
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
