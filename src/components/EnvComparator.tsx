"use client";

import { useState } from "react";
import Link from "next/link";

// ── Parser ─────────────────────────────────────────────────────────────────────

function parseEnv(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) val = val.slice(1, -1);
    if (key) map.set(key, val);
  }
  return map;
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Status = "match" | "different" | "only-a" | "only-b";

interface EnvEntry {
  key:     string;
  valueA:  string | null;
  valueB:  string | null;
  status:  Status;
}

function compareEnv(a: Map<string, string>, b: Map<string, string>): EnvEntry[] {
  const all = new Set([...a.keys(), ...b.keys()]);
  const entries: EnvEntry[] = [];

  for (const key of all) {
    const va = a.has(key) ? a.get(key)! : null;
    const vb = b.has(key) ? b.get(key)! : null;
    const status: Status =
      va === null ? "only-b" :
      vb === null ? "only-a" :
      va === vb   ? "match"  : "different";
    entries.push({ key, valueA: va, valueB: vb, status });
  }

  const order: Record<Status, number> = { different: 0, "only-a": 1, "only-b": 1, match: 2 };
  return entries.sort((x, y) => order[x.status] - order[y.status] || x.key.localeCompare(y.key));
}

// ── Examples ───────────────────────────────────────────────────────────────────

const EXAMPLE_A = `# App
APP_NAME=MyApp
APP_ENV=development
APP_PORT=3000
APP_DEBUG=true

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp_dev
DB_USER=admin
DB_PASSWORD=secret123

# Auth
JWT_SECRET=dev-secret-key
SESSION_TIMEOUT=3600

# Storage
S3_BUCKET=myapp-dev`;

const EXAMPLE_B = `# App
APP_NAME=MyApp
APP_ENV=production
APP_PORT=8080
APP_DEBUG=false

# Database
DB_HOST=db.prod.internal
DB_PORT=5432
DB_NAME=myapp_prod
DB_USER=prod_admin
DB_PASSWORD=Str0ngP@ssw0rd!

# Auth
JWT_SECRET=prod-super-secret-key-xyz
SESSION_TIMEOUT=1800
JWT_EXPIRY=86400

# Storage
S3_BUCKET=myapp-production
S3_REGION=ap-southeast-1

# Cache
REDIS_URL=redis://cache.prod.internal:6379`;

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<Status, { icon: string; color: string; bg: string; label: string }> = {
  different: { icon: "≠", color: "#ce9178", bg: "#2d1a00", label: "Different" },
  "only-a":  { icon: "←", color: "#569cd6", bg: "#0e1e2e", label: "Only in A" },
  "only-b":  { icon: "→", color: "#9b59b6", bg: "#1e0e2e", label: "Only in B" },
  match:     { icon: "✓", color: "#4a4a4a", bg: "transparent", label: "Match" },
};

// ── Main ───────────────────────────────────────────────────────────────────────

export default function EnvComparator() {
  const [textA, setTextA]   = useState("");
  const [textB, setTextB]   = useState("");
  const [masked, setMasked] = useState(true);

  const mapA    = parseEnv(textA);
  const mapB    = parseEnv(textB);
  const entries = textA || textB ? compareEnv(mapA, mapB) : [];

  const stats = {
    total:     entries.length,
    match:     entries.filter(e => e.status === "match").length,
    different: entries.filter(e => e.status === "different").length,
    onlyA:     entries.filter(e => e.status === "only-a").length,
    onlyB:     entries.filter(e => e.status === "only-b").length,
  };

  const maskVal = (v: string | null) => {
    if (v === null) return null;
    if (!masked || v === "") return v;
    if (v.length <= 4) return "••••";
    return v.slice(0, 2) + "•".repeat(Math.min(v.length - 2, 6));
  };

  const loadExample = () => { setTextA(EXAMPLE_A); setTextB(EXAMPLE_B); };
  const doClear     = () => { setTextA(""); setTextB(""); };

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
          <span className="font-bold" style={{ color: "#ce9178" }}>.ENV</span>
          <span className="text-sm font-sans font-medium">.ENV Comparator</span>
        </div>

        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <>
              <span className="text-xs font-sans" style={{ color: "#4ec9b0" }}>✓ {stats.match}</span>
              {stats.different > 0 && <span className="text-xs font-sans" style={{ color: "#ce9178" }}>≠ {stats.different}</span>}
              {stats.onlyA > 0 && <span className="text-xs font-sans" style={{ color: "#569cd6" }}>← {stats.onlyA}</span>}
              {stats.onlyB > 0 && <span className="text-xs font-sans" style={{ color: "#9b59b6" }}>→ {stats.onlyB}</span>}
              <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
            </>
          )}
          {/* Mask toggle */}
          <button
            onClick={() => setMasked(m => !m)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-sans rounded border transition-colors"
            style={{
              borderColor: masked ? "#0e639c" : "#3c3c3c",
              background:  masked ? "#0e1e2e" : "transparent",
              color:       masked ? "#569cd6" : "#858585",
            }}
          >
            <span className="w-3 h-3 rounded-sm border flex items-center justify-center" style={{ borderColor: masked ? "#569cd6" : "#555" }}>
              {masked && <span style={{ color: "#569cd6", fontSize: 9, lineHeight: 1 }}>✓</span>}
            </span>
            Mask values
          </button>
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <button onClick={loadExample} className="text-xs font-sans px-2.5 py-1 rounded transition-colors" style={{ background: "#3c3c3c", color: "#cccccc" }}>Use example</button>
          <button onClick={doClear} disabled={!textA && !textB} className="text-xs font-sans px-2.5 py-1 rounded transition-colors disabled:opacity-30" style={{ background: "#3c3c3c", color: "#cccccc" }}>Clear</button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — inputs */}
        <div className="flex flex-col" style={{ width: "50%", minWidth: 0, borderRight: "1px solid #3c3c3c" }}>
          {/* File A */}
          <div className="flex flex-col flex-1 overflow-hidden" style={{ borderBottom: "1px solid #3c3c3c" }}>
            <div className="flex items-center justify-between px-3 py-1 text-xs font-sans shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}>
              <span>File A</span>
              <div className="flex items-center gap-2">
                {mapA.size > 0 && <span>{mapA.size} keys</span>}
                <button onClick={() => doCopy(textA)} disabled={!textA} className="px-2 py-0.5 rounded disabled:opacity-30 transition-colors" style={{ background: "#3c3c3c", color: "#cccccc" }}>Copy</button>
              </div>
            </div>
            <textarea
              value={textA}
              onChange={e => setTextA(e.target.value)}
              placeholder={"APP_ENV=development\nDB_HOST=localhost\n..."}
              className="flex-1 resize-none outline-none text-xs leading-6 p-4 font-mono"
              style={{ background: "#1e1e1e", color: "#d4d4d4", caretColor: "#d4d4d4" }}
              spellCheck={false}
            />
          </div>

          {/* File B */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1 text-xs font-sans shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}>
              <span>File B</span>
              <div className="flex items-center gap-2">
                {mapB.size > 0 && <span>{mapB.size} keys</span>}
                <button onClick={() => doCopy(textB)} disabled={!textB} className="px-2 py-0.5 rounded disabled:opacity-30 transition-colors" style={{ background: "#3c3c3c", color: "#cccccc" }}>Copy</button>
              </div>
            </div>
            <textarea
              value={textB}
              onChange={e => setTextB(e.target.value)}
              placeholder={"APP_ENV=production\nDB_HOST=db.prod.internal\n..."}
              className="flex-1 resize-none outline-none text-xs leading-6 p-4 font-mono"
              style={{ background: "#1e1e1e", color: "#d4d4d4", caretColor: "#d4d4d4" }}
              spellCheck={false}
            />
          </div>
        </div>

        {/* Right — result table */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1 text-xs font-sans shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c", color: "#858585" }}>
            <span>Comparison</span>
            {entries.length > 0 && <span>{stats.total} keys</span>}
          </div>

          {entries.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm font-sans" style={{ color: "#4a4a4a" }}>Paste isi .env di sebelah kiri untuk mulai membandingkan</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              {/* Legend */}
              <div className="flex items-center gap-4 px-4 py-2 border-b text-xs font-sans" style={{ borderColor: "#3c3c3c", background: "#252526" }}>
                {(Object.entries(STATUS_CFG) as [Status, typeof STATUS_CFG[Status]][]).map(([, cfg]) => (
                  <span key={cfg.label} className="flex items-center gap-1.5">
                    <span style={{ color: cfg.color }}>{cfg.icon}</span>
                    <span style={{ color: "#858585" }}>{cfg.label}</span>
                  </span>
                ))}
              </div>

              <table className="w-full border-collapse text-xs font-mono" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "24px" }} />
                  <col style={{ width: "35%" }} />
                  <col style={{ width: "calc(32.5% - 12px)" }} />
                  <col style={{ width: "calc(32.5% - 12px)" }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#2d2d2d" }}>
                    <th className="py-1.5 border-b" style={{ borderColor: "#3c3c3c" }} />
                    <th className="py-1.5 px-3 text-left border-b font-sans font-normal" style={{ borderColor: "#3c3c3c", color: "#858585" }}>Key</th>
                    <th className="py-1.5 px-3 text-left border-b font-sans font-normal" style={{ borderColor: "#3c3c3c", color: "#569cd6" }}>File A</th>
                    <th className="py-1.5 px-3 text-left border-b font-sans font-normal" style={{ borderColor: "#3c3c3c", color: "#9b59b6" }}>File B</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const cfg = STATUS_CFG[entry.status];
                    const va  = maskVal(entry.valueA);
                    const vb  = maskVal(entry.valueB);
                    return (
                      <tr key={entry.key} style={{ background: cfg.bg }} className="border-b" >
                        <td className="text-center py-1.5" style={{ borderColor: "#3c3c3c", color: cfg.color }}>{cfg.icon}</td>
                        <td className="px-3 py-1.5 truncate" style={{ borderColor: "#3c3c3c", color: "#9cdcfe" }}>{entry.key}</td>
                        <td className="px-3 py-1.5 truncate" style={{
                          borderColor: "#3c3c3c",
                          color: va === null ? "#3c3c3c" : entry.status === "match" ? "#4a4a4a" : "#d4d4d4",
                          fontStyle: va === null ? "italic" : "normal",
                        }}>{va === null ? "—" : va === "" ? <span style={{ color: "#3c3c3c" }}>(empty)</span> : va}</td>
                        <td className="px-3 py-1.5 truncate" style={{
                          borderColor: "#3c3c3c",
                          color: vb === null ? "#3c3c3c" : entry.status === "match" ? "#4a4a4a" : "#d4d4d4",
                          fontStyle: vb === null ? "italic" : "normal",
                        }}>{vb === null ? "—" : vb === "" ? <span style={{ color: "#3c3c3c" }}>(empty)</span> : vb}</td>
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
