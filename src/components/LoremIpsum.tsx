"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ── Corpus ─────────────────────────────────────────────────────────────────────

const WORDS = [
  "lorem","ipsum","dolor","sit","amet","consectetur","adipiscing","elit","sed","do",
  "eiusmod","tempor","incididunt","ut","labore","et","dolore","magna","aliqua","enim",
  "ad","minim","veniam","quis","nostrud","exercitation","ullamco","laboris","nisi",
  "aliquip","ex","ea","commodo","consequat","duis","aute","irure","in","reprehenderit",
  "voluptate","velit","esse","cillum","eu","fugiat","nulla","pariatur","excepteur",
  "sint","occaecat","cupidatat","non","proident","sunt","culpa","qui","officia",
  "deserunt","mollit","anim","id","est","laborum","perspiciatis","unde","omnis","iste",
  "natus","error","voluptatem","accusantium","doloremque","laudantium","totam","rem",
  "aperiam","eaque","ipsa","quae","ab","illo","inventore","veritatis","quasi",
  "architecto","beatae","vitae","dicta","explicabo","nemo","ipsam","quia","voluptas",
  "aspernatur","odit","aut","fugit","consequuntur","magni","dolores","eos","ratione",
  "sequi","nesciunt","neque","porro","quisquam","dolorem","adipisci","numquam",
  "eius","modi","tempora","incidunt","magnam","aliquam","quaerat","voluptatibus",
  "vitae","dicta","sunt","explicabo","architecto","beatae","quasi","inventore",
  "blanditiis","praesentium","voluptatum","deleniti","atque","corrupti","quos",
  "molestias","excepturi","occaecati","cupiditate","similique","provident",
];

const CLASSIC = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

// ── Generation ─────────────────────────────────────────────────────────────────

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function genWords(n: number): string {
  return Array.from({ length: n }, () => pick(WORDS)).join(" ");
}

function genSentence(): string {
  const words = Array.from({ length: rnd(6, 14) }, () => pick(WORDS));
  // randomly add a comma
  if (words.length > 8 && Math.random() > 0.5) words.splice(rnd(3, 6), 0, words.splice(rnd(3, 6), 1)[0] + ",");
  const raw = words.join(" ").replace(",,", ",");
  return raw.charAt(0).toUpperCase() + raw.slice(1) + ".";
}

function genParagraph(): string {
  return Array.from({ length: rnd(3, 6) }, genSentence).join(" ");
}

type Mode = "paragraphs" | "sentences" | "words";

function generate(mode: Mode, count: number, classic: boolean, html: boolean): string {
  if (mode === "words") {
    const out = genWords(count);
    const text = classic ? "Lorem ipsum " + out : out.charAt(0).toUpperCase() + out.slice(1);
    return html ? `<p>${text}</p>` : text;
  }

  if (mode === "sentences") {
    const sentences = Array.from({ length: count }, genSentence);
    if (classic) sentences[0] = CLASSIC;
    return html ? `<p>${sentences.join(" ")}</p>` : sentences.join(" ");
  }

  // paragraphs
  const paras = Array.from({ length: count }, genParagraph);
  if (classic) paras[0] = CLASSIC + " " + Array.from({ length: rnd(2, 5) }, genSentence).join(" ");
  if (html) return paras.map(p => `<p>${p}</p>`).join("\n");
  return paras.join("\n\n");
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function CheckOption({ label, desc, checked, onChange }: {
  label: string; desc?: string; checked: boolean; onChange: () => void;
}) {
  return (
    <button onClick={onChange} className="flex items-start gap-2 text-left transition-colors w-full">
      <span className="mt-0.5 w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0"
        style={{ borderColor: checked ? "#569cd6" : "#444" }}>
        {checked && <span style={{ color: "#569cd6", fontSize: 9, lineHeight: 1 }}>✓</span>}
      </span>
      <span>
        <span className="text-xs font-sans" style={{ color: checked ? "#d4d4d4" : "#555" }}>{label}</span>
        {desc && <span className="block text-xs font-sans mt-0.5" style={{ color: "#4a4a4a" }}>{desc}</span>}
      </span>
    </button>
  );
}

const MODES: { id: Mode; label: string }[] = [
  { id: "paragraphs", label: "Paragraphs" },
  { id: "sentences",  label: "Sentences"  },
  { id: "words",      label: "Words"      },
];

const MAX: Record<Mode, number> = { paragraphs: 20, sentences: 50, words: 200 };

// ── Main ───────────────────────────────────────────────────────────────────────

export default function LoremIpsum() {
  const [mode,    setMode]    = useState<Mode>("paragraphs");
  const [count,   setCount]   = useState(3);
  const [classic, setClassic] = useState(true);
  const [html,    setHtml]    = useState(false);
  const [output,  setOutput]  = useState("");
  const [copied,  setCopied]  = useState(false);
  const [tick,    setTick]    = useState(0);

  const gen = useCallback(() => {
    setOutput(generate(mode, count, classic, html));
  }, [mode, count, classic, html]);

  useEffect(() => { gen(); }, [gen, tick]);

  const clamp = (v: number) => Math.max(1, Math.min(MAX[mode], v));

  const changeMode = (m: Mode) => {
    setMode(m);
    setCount(m === "paragraphs" ? 3 : m === "sentences" ? 5 : 50);
  };

  const doCopy = async () => {
    try { await navigator.clipboard.writeText(output); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = output; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const wordCount = output.split(/\s+/).filter(Boolean).length;
  const charCount = output.length;

  return (
    <div className="h-screen flex flex-col font-mono text-sm overflow-hidden" style={{ background: "#1e1e1e", color: "#d4d4d4" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 shrink-0 border-b" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs transition-colors hover:text-white" style={{ color: "#858585" }}>← Home</Link>
          <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
          <span className="font-bold" style={{ color: "#9b59b6" }}>Li</span>
          <span className="text-sm font-sans font-medium">Lorem Ipsum</span>
        </div>
        <button
          onClick={() => setTick(t => t + 1)}
          className="flex items-center gap-1.5 text-xs font-sans px-2.5 py-1 rounded border transition-colors"
          style={{ background: "#0e1e2e", borderColor: "#0e639c", color: "#569cd6" }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M13.5 8A5.5 5.5 0 112.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M2.5 2v3.5H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Regenerate
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — settings */}
        <div className="flex flex-col gap-6 p-5 overflow-auto shrink-0" style={{ width: "280px", borderRight: "1px solid #3c3c3c" }}>

          {/* Type */}
          <div>
            <span className="text-xs font-sans block mb-2" style={{ color: "#858585" }}>Generate</span>
            <div className="flex flex-col gap-1.5">
              {MODES.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => changeMode(id)}
                  className="py-1.5 px-3 text-xs font-sans rounded border text-left transition-colors"
                  style={{
                    borderColor: mode === id ? "#0e639c" : "#3c3c3c",
                    background:  mode === id ? "#0e1e2e" : "transparent",
                    color:       mode === id ? "#569cd6" : "#555",
                  }}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Count */}
          <div>
            <span className="text-xs font-sans block mb-2" style={{ color: "#858585" }}>
              Count <span style={{ color: "#4a4a4a" }}>(max {MAX[mode]})</span>
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setCount(q => clamp(q - 1))} className="w-7 h-7 rounded border text-sm hover:bg-white/10 transition-colors" style={{ borderColor: "#3c3c3c", color: "#858585" }}>−</button>
              <input
                type="number"
                value={count}
                onChange={e => setCount(clamp(Number(e.target.value)))}
                className="flex-1 text-xs font-mono text-center px-2 py-1 rounded border outline-none"
                style={{ background: "#252526", borderColor: "#3c3c3c", color: "#d4d4d4" }}
                min={1} max={MAX[mode]}
              />
              <button onClick={() => setCount(q => clamp(q + 1))} className="w-7 h-7 rounded border text-sm hover:bg-white/10 transition-colors" style={{ borderColor: "#3c3c3c", color: "#858585" }}>+</button>
            </div>
          </div>

          {/* Options */}
          <div>
            <span className="text-xs font-sans block mb-3" style={{ color: "#858585" }}>Options</span>
            <div className="flex flex-col gap-3">
              <CheckOption
                label='Start with "Lorem ipsum..."'
                checked={classic}
                onChange={() => setClassic(v => !v)}
              />
              <CheckOption
                label="Wrap with HTML <p> tags"
                checked={html}
                onChange={() => setHtml(v => !v)}
              />
            </div>
          </div>
        </div>

        {/* Right — output */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1 shrink-0 border-b" style={{ background: "#2d2d2d", borderColor: "#3c3c3c" }}>
            <span className="text-xs font-sans" style={{ color: "#858585" }}>
              {output ? `${wordCount.toLocaleString()} words · ${charCount.toLocaleString()} chars` : "Output"}
            </span>
            <button
              onClick={doCopy}
              disabled={!output}
              className="text-xs font-sans px-2.5 py-0.5 rounded transition-colors disabled:opacity-30"
              style={{ background: "#3c3c3c", color: copied ? "#4ec9b0" : "#cccccc" }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <textarea
            value={output}
            readOnly
            className="flex-1 resize-none outline-none p-6 select-all"
            style={{
              background: "#1e1e1e",
              color: "#d4d4d4",
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 15,
              lineHeight: 1.8,
              cursor: "text",
            }}
          />
        </div>
      </div>
    </div>
  );
}
