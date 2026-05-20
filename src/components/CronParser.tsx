"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Field definitions ──────────────────────────────────────────────────────────

const FIELDS = [
  { label: "Minute",  short: "min", min: 0,  max: 59 },
  { label: "Hour",    short: "hr",  min: 0,  max: 23 },
  { label: "Day",     short: "day", min: 1,  max: 31 },
  { label: "Month",   short: "mon", min: 1,  max: 12 },
  { label: "Weekday", short: "wd",  min: 0,  max: 6  },
];

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_SHORT   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const MACROS: Record<string, string> = {
  "@yearly":   "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly":  "0 0 1 * *",
  "@weekly":   "0 0 * * 0",
  "@daily":    "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly":   "0 * * * *",
};

// ── Parser ─────────────────────────────────────────────────────────────────────

function parseField(expr: string, min: number, max: number): number[] | null {
  const values = new Set<number>();
  for (const part of expr.split(",")) {
    const slashIdx = part.indexOf("/");
    let step = 1;
    let rangePart = part;
    if (slashIdx !== -1) {
      step = parseInt(part.slice(slashIdx + 1));
      if (isNaN(step) || step < 1) return null;
      rangePart = part.slice(0, slashIdx);
    }
    let from: number, to: number;
    if (rangePart === "*") {
      from = min; to = max;
    } else if (rangePart.includes("-")) {
      const dash = rangePart.indexOf("-");
      from = parseInt(rangePart.slice(0, dash));
      to   = parseInt(rangePart.slice(dash + 1));
      if (isNaN(from) || isNaN(to)) return null;
    } else {
      from = parseInt(rangePart);
      if (isNaN(from)) return null;
      to = slashIdx !== -1 ? max : from;
    }
    if (from < min || to > max || from > to) return null;
    for (let i = from; i <= to; i += step) values.add(i);
  }
  return Array.from(values).sort((a, b) => a - b);
}

function parseCron(raw: string): {
  parts: string[];
  fields: (number[] | null)[];
  error: string;
} {
  let expr = raw.trim().toLowerCase();
  if (MACROS[expr]) expr = MACROS[expr];
  const parts = expr.split(/\s+/);
  if (parts.length !== 5)
    return { parts: [], fields: [], error: "Expected 5 space-separated fields: minute hour day month weekday" };
  const fields = parts.map((p, i) => parseField(p, FIELDS[i].min, FIELDS[i].max));
  const bad = fields.findIndex(f => f === null);
  if (bad !== -1)
    return { parts, fields, error: `Invalid ${FIELDS[bad].label.toLowerCase()} field: "${parts[bad]}"` };
  return { parts, fields, error: "" };
}

// ── Description ────────────────────────────────────────────────────────────────

function ordinal(n: number) {
  const s = ["th","st","nd","rd"];
  const v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

function buildDescription(parts: string[]): string {
  if (!parts.length) return "";
  const [min, hour, day, month, weekday] = parts;

  if (parts.every(p => p === "*")) return "Every minute";

  const chunks: string[] = [];

  // ── time part ──────────────────────────────────────────────────────────────
  const stepMin  = min.match(/^\*\/(\d+)$/);
  const stepHour = hour.match(/^\*\/(\d+)$/);

  if (stepMin && hour === "*") {
    chunks.push(`Every ${stepMin[1]} minute${stepMin[1] === "1" ? "" : "s"}`);
  } else if (stepHour && min === "0") {
    chunks.push(`Every ${stepHour[1]} hour${stepHour[1] === "1" ? "" : "s"}`);
  } else if (stepHour) {
    const ms = parseField(min, 0, 59) ?? [];
    chunks.push(`Every ${stepHour[1]} hours at minute${ms.length > 1 ? "s" : ""} ${ms.join(", ")}`);
  } else if (hour === "*" && min !== "*") {
    const ms = parseField(min, 0, 59) ?? [];
    chunks.push(`At minute${ms.length > 1 ? "s" : ""} ${ms.join(", ")} of every hour`);
  } else if (hour !== "*" && min !== "*") {
    const hs = parseField(hour, 0, 23) ?? [];
    const ms = parseField(min, 0, 59) ?? [];
    if (ms.length === 1 && ms[0] === 0) {
      chunks.push(`At ${hs.map(h => `${String(h).padStart(2,"0")}:00`).join(", ")}`);
    } else {
      const times = hs.flatMap(h =>
        ms.map(m => `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`)
      );
      chunks.push(`At ${times.slice(0,8).join(", ")}${times.length > 8 ? ` (+${times.length-8} more)` : ""}`);
    }
  } else {
    // hour=*, min=*  —  already handled above ("every minute")
    chunks.push("Every minute");
  }

  // ── date part ──────────────────────────────────────────────────────────────
  if (month !== "*") {
    const ms = parseField(month, 1, 12) ?? [];
    chunks.push(`in ${ms.map(m => MONTH_SHORT[m-1]).join(", ")}`);
  }
  if (day !== "*" && weekday !== "*") {
    const ds = parseField(day, 1, 31) ?? [];
    const ws = parseField(weekday, 0, 6) ?? [];
    chunks.push(`on the ${ds.map(ordinal).join(", ")} or ${ws.map(w => DAY_SHORT[w]).join(", ")}`);
  } else if (day !== "*") {
    const ds = parseField(day, 1, 31) ?? [];
    chunks.push(`on the ${ds.map(ordinal).join(", ")} of the month`);
  } else if (weekday !== "*") {
    const ws = parseField(weekday, 0, 6) ?? [];
    chunks.push(`on ${ws.map(w => DAY_SHORT[w]).join(", ")}`);
  }

  return chunks.join(", ");
}

// ── Next runs ──────────────────────────────────────────────────────────────────

function nextRuns(parts: string[], fields: (number[] | null)[], count: number): Date[] {
  if (!parts.length || fields.some(f => f === null)) return [];
  const [minutes, hours, days, months, weekdays] = fields as number[][];

  const domRestricted = parts[2] !== "*";
  const dowRestricted = parts[4] !== "*";

  const results: Date[] = [];
  const cur = new Date();
  cur.setSeconds(0, 0);
  cur.setMinutes(cur.getMinutes() + 1);

  let iter = 0;
  while (results.length < count && iter < 300_000) {
    iter++;
    const mon = cur.getMonth() + 1;
    const day = cur.getDate();
    const wd  = cur.getDay();
    const h   = cur.getHours();
    const m   = cur.getMinutes();

    if (!months.includes(mon)) {
      cur.setMonth(cur.getMonth() + 1, 1);
      cur.setHours(0, 0, 0, 0);
      continue;
    }

    const dayOk = domRestricted && dowRestricted
      ? (days.includes(day) || weekdays.includes(wd))
      : (!domRestricted || days.includes(day)) && (!dowRestricted || weekdays.includes(wd));

    if (!dayOk) {
      cur.setDate(cur.getDate() + 1);
      cur.setHours(0, 0, 0, 0);
      continue;
    }
    if (!hours.includes(h)) {
      cur.setHours(cur.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!minutes.includes(m)) {
      cur.setMinutes(cur.getMinutes() + 1, 0, 0);
      continue;
    }

    results.push(new Date(cur));
    cur.setMinutes(cur.getMinutes() + 1, 0, 0);
  }
  return results;
}

// ── Relative time ──────────────────────────────────────────────────────────────

function relative(date: Date): string {
  const diff = date.getTime() - Date.now();
  const min  = Math.floor(diff / 60_000);
  const hr   = Math.floor(min / 60);
  const day  = Math.floor(hr / 24);
  if (min < 1)   return "< 1 min";
  if (min < 60)  return `${min}m`;
  if (hr  < 24)  return `${hr}h`;
  if (day < 14)  return `${day}d`;
  if (day < 60)  return `${Math.floor(day/7)}w`;
  if (day < 365) return `${Math.floor(day/30)}mo`;
  return `${Math.floor(day/365)}y`;
}

// ── Field value display ────────────────────────────────────────────────────────

function fieldSummary(vals: number[] | null, fieldIdx: number): string {
  if (!vals) return "invalid";
  const { min, max } = FIELDS[fieldIdx];
  if (vals.length === max - min + 1) return "every value";
  const fmt = (v: number) =>
    fieldIdx === 3 ? MONTH_SHORT[v-1] :
    fieldIdx === 4 ? DAY_SHORT[v] : String(v);
  if (vals.length <= 10) return vals.map(fmt).join(", ");
  return `${fmt(vals[0])}–${fmt(vals[vals.length-1])} (${vals.length})`;
}

// ── Presets ────────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: "Every minute",      expr: "* * * * *"    },
  { label: "Every 5 min",       expr: "*/5 * * * *"  },
  { label: "Every 15 min",      expr: "*/15 * * * *" },
  { label: "Hourly",            expr: "0 * * * *"    },
  { label: "Every 6 hours",     expr: "0 */6 * * *"  },
  { label: "Daily midnight",    expr: "0 0 * * *"    },
  { label: "Weekdays 9 AM",     expr: "0 9 * * 1-5"  },
  { label: "Sunday midnight",   expr: "0 0 * * 0"    },
  { label: "1st of month",      expr: "0 0 1 * *"    },
  { label: "Jan 1st midnight",  expr: "0 0 1 1 *"    },
];

const COUNT_OPTS = [5, 10, 20, 50];

// ── Main ───────────────────────────────────────────────────────────────────────

export default function CronParser() {
  const [input,    setInput]    = useState("*/5 * * * *");
  const [runCount, setRunCount] = useState(10);

  const parsed      = useMemo(() => parseCron(input), [input]);
  const description = useMemo(
    () => parsed.parts.length === 5 ? buildDescription(parsed.parts) : "",
    [parsed.parts]
  );
  const runs = useMemo(
    () => nextRuns(parsed.parts, parsed.fields, runCount),
    [parsed.parts, parsed.fields, runCount]
  );

  const { parts, fields, error } = parsed;

  const dtFmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

  return (
    <div className="h-screen flex flex-col font-mono text-sm overflow-hidden" style={{ background: "#1e1e1e", color: "#d4d4d4" }}>

      {/* Header */}
      <header className="flex items-center px-4 py-2 shrink-0 border-b gap-3" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
        <Link href="/" className="text-xs transition-colors hover:text-white" style={{ color: "#858585" }}>← Home</Link>
        <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
        <span className="font-bold" style={{ color: "#61afef" }}>*/n</span>
        <span className="text-sm font-sans font-medium">Cron Parser</span>
        {error && (
          <span className="ml-2 text-xs font-sans px-2 py-0.5 rounded truncate max-w-xs" style={{ background: "#2d0000", color: "#f44747" }}>
            {error}
          </span>
        )}
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left */}
        <div className="flex flex-col gap-5 p-5 shrink-0 overflow-auto" style={{ width: "300px", borderRight: "1px solid #3c3c3c" }}>

          {/* Input */}
          <div>
            <span className="text-xs font-sans block mb-1.5" style={{ color: "#858585" }}>Expression</span>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              spellCheck={false}
              placeholder="* * * * *"
              className="w-full text-sm font-mono px-3 py-2 rounded border outline-none"
              style={{
                background: "#252526",
                borderColor: error ? "#f44747" : "#3c3c3c",
                color: "#d4d4d4",
                letterSpacing: "0.05em",
              }}
            />
            <div className="flex justify-between px-1 mt-1">
              {FIELDS.map(f => (
                <span key={f.short} className="text-xs" style={{ color: "#3c3c3c" }}>{f.short}</span>
              ))}
            </div>
          </div>

          {/* Field breakdown */}
          {parts.length === 5 && (
            <div>
              <span className="text-xs font-sans block mb-2" style={{ color: "#858585" }}>Breakdown</span>
              <div className="flex flex-col gap-1">
                {FIELDS.map(({ label }, i) => (
                  <div key={label}
                    className="grid items-center gap-2 px-2 py-1.5 rounded"
                    style={{ background: "#252526", gridTemplateColumns: "56px 44px 1fr" }}
                  >
                    <span className="text-xs font-sans" style={{ color: "#858585" }}>{label}</span>
                    <span className="text-xs font-mono" style={{ color: "#61afef" }}>{parts[i]}</span>
                    <span className="text-xs font-sans truncate" style={{ color: "#4a4a4a" }}>
                      {fieldSummary(fields[i], i)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Presets */}
          <div>
            <span className="text-xs font-sans block mb-2" style={{ color: "#858585" }}>Presets</span>
            <div className="flex flex-col gap-0.5">
              {PRESETS.map(({ label, expr }) => {
                const active = input.trim() === expr;
                return (
                  <button
                    key={expr}
                    onClick={() => setInput(expr)}
                    className="flex items-center justify-between px-2 py-1.5 rounded text-left text-xs transition-colors hover:bg-white/5"
                    style={{
                      border: `1px solid ${active ? "#0e639c" : "transparent"}`,
                      background: active ? "#0e1e2e" : "transparent",
                    }}
                  >
                    <span style={{ color: active ? "#61afef" : "#858585" }}>{label}</span>
                    <span className="font-mono text-xs" style={{ color: active ? "#61afef" : "#3c3c3c" }}>{expr}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Description */}
          <div className="px-6 py-4 shrink-0 border-b" style={{ borderColor: "#3c3c3c", background: "#252526" }}>
            <span className="text-xs font-sans block mb-1" style={{ color: "#858585" }}>Human-readable</span>
            <p className="text-base font-sans leading-snug" style={{ color: description ? "#d4d4d4" : "#4a4a4a" }}>
              {description || (error ? "Invalid expression" : "—")}
            </p>
          </div>

          {/* Runs header */}
          <div className="flex items-center gap-3 px-6 py-2 shrink-0 border-b" style={{ borderColor: "#3c3c3c", background: "#2d2d2d" }}>
            <span className="text-xs font-sans" style={{ color: "#858585" }}>Next runs</span>
            <div className="flex gap-1">
              {COUNT_OPTS.map(n => (
                <button
                  key={n}
                  onClick={() => setRunCount(n)}
                  className="text-xs font-sans px-2 py-0.5 rounded transition-colors"
                  style={{
                    background:  runCount === n ? "#0e1e2e" : "transparent",
                    color:       runCount === n ? "#61afef" : "#555",
                    border:      `1px solid ${runCount === n ? "#0e639c" : "#3c3c3c"}`,
                  }}
                >{n}</button>
              ))}
            </div>
            <span className="ml-auto text-xs font-sans" style={{ color: "#4a4a4a" }}>
              {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </span>
          </div>

          {/* Runs list */}
          <div className="flex-1 overflow-auto">
            {!error && runs.length === 0 && (
              <p className="p-6 text-xs font-sans" style={{ color: "#4a4a4a" }}>
                No runs found within the next year.
              </p>
            )}
            {runs.map((date, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-6 py-2.5 border-b"
                style={{ borderColor: "#252526", background: i % 2 === 0 ? "transparent" : "#1a1a1a" }}
              >
                <span className="text-xs font-sans w-5 text-right shrink-0" style={{ color: "#3c3c3c" }}>
                  {i + 1}
                </span>
                <span className="font-mono text-xs flex-1" style={{ color: "#d4d4d4" }}>
                  {dtFmt.format(date)}
                </span>
                <span
                  className="text-xs font-sans px-2 py-0.5 rounded shrink-0"
                  style={{ background: "#252526", color: "#61afef" }}
                >
                  {relative(date)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
