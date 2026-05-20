"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

// ── Color math ─────────────────────────────────────────────────────────────────

function clamp255(v: number) { return Math.max(0, Math.min(255, Math.round(v))); }

function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map(v => clamp255(v).toString(16).padStart(2, "0")).join("");
}

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace(/^#/, "");
  if (h.length === 3) return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16)];
  if (h.length === 6) return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  return null;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
    case g: h = (b - r) / d + 2; break;
    case b: h = (r - g) / d + 4; break;
  }
  return [Math.round(h / 6 * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) { const v = clamp255(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return [clamp255(hue(h+1/3)*255), clamp255(hue(h)*255), clamp255(hue(h-1/3)*255)];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [Math.round(h*360), Math.round(max === 0 ? 0 : d/max*100), Math.round(max*100)];
}

function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return [0, 0, 0, 100];
  return [
    Math.round((1-r-k)/(1-k)*100),
    Math.round((1-g-k)/(1-k)*100),
    Math.round((1-b-k)/(1-k)*100),
    Math.round(k*100),
  ];
}

function luminance(r: number, g: number, b: number) {
  return [r,g,b].reduce((sum, v, i) => {
    const s = v / 255;
    const lin = s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    return sum + lin * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}

function fgColor(r: number, g: number, b: number) {
  return luminance(r,g,b) > 0.179 ? "#000000" : "#ffffff";
}

// ── Parser ─────────────────────────────────────────────────────────────────────

function parseColor(input: string): [number, number, number] | null {
  const s = input.trim();

  // HEX
  if (/^#?[0-9a-fA-F]{3}$/.test(s) || /^#?[0-9a-fA-F]{6}$/.test(s)) {
    return hexToRgb(s.startsWith("#") ? s : "#" + s);
  }

  // rgb / rgba
  const rgbM = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbM) return [parseInt(rgbM[1]), parseInt(rgbM[2]), parseInt(rgbM[3])];

  // hsl / hsla
  const hslM = s.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?/i);
  if (hslM) return hslToRgb(parseFloat(hslM[1]), parseFloat(hslM[2]), parseFloat(hslM[3]));

  // r, g, b bare numbers
  const parts = s.split(/[\s,]+/).map(Number);
  if (parts.length === 3 && parts.every(v => !isNaN(v) && v >= 0 && v <= 255))
    return [parts[0], parts[1], parts[2]] as [number, number, number];

  return null;
}

// ── Slider ─────────────────────────────────────────────────────────────────────

function Slider({ label, value, max, accent, onChange }: {
  label: string; value: number; max: number; accent: string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono w-4 shrink-0" style={{ color: "#858585" }}>{label}</span>
      <input type="range" min={0} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 cursor-pointer"
        style={{ accentColor: accent }}
      />
      <input
        type="number" min={0} max={max} value={value}
        onChange={e => onChange(Math.max(0, Math.min(max, Number(e.target.value))))}
        className="w-10 text-xs font-mono text-center rounded border outline-none px-1 py-0.5"
        style={{ background: "#252526", borderColor: "#3c3c3c", color: "#d4d4d4" }}
      />
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

const DEFAULT_RGB: [number, number, number] = [99, 102, 241];

export default function ColorConverter() {
  const [rgb, setRgb]           = useState<[number,number,number]>(DEFAULT_RGB);
  const [textInput, setTextInput] = useState(rgbToHex(...DEFAULT_RGB));
  const [inputError, setInputError] = useState(false);
  const [copied, setCopied]     = useState<string | null>(null);

  const [r, g, b] = rgb;
  const hex       = rgbToHex(r, g, b);
  const [h, sl, l] = rgbToHsl(r, g, b);
  const [, sv, v]  = rgbToHsv(r, g, b);
  const [c, m, y, k] = rgbToCmyk(r, g, b);
  const fg = fgColor(r, g, b);

  const applyRgb = useCallback((next: [number,number,number]) => {
    setRgb(next);
    setTextInput(rgbToHex(...next));
    setInputError(false);
  }, []);

  const handleText = (val: string) => {
    setTextInput(val);
    const parsed = parseColor(val);
    if (parsed) { setRgb(parsed); setInputError(false); }
    else setInputError(val.trim().length > 0);
  };

  const doCopy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const formats = [
    { key: "hex",   label: "HEX",          value: hex },
    { key: "hexu",  label: "HEX (upper)",   value: hex.toUpperCase() },
    { key: "rgb",   label: "RGB",           value: `rgb(${r}, ${g}, ${b})` },
    { key: "hsl",   label: "HSL",           value: `hsl(${h}, ${sl}%, ${l}%)` },
    { key: "hsv",   label: "HSV / HSB",     value: `hsv(${h}, ${sv}%, ${v}%)` },
    { key: "cmyk",  label: "CMYK",          value: `cmyk(${c}%, ${m}%, ${y}%, ${k}%)` },
    { key: "cssv",  label: "CSS variable",  value: `--color: ${hex};` },
    { key: "tw",    label: "Tailwind bg",   value: `bg-[${hex}]` },
  ];

  // 9 shades by varying lightness
  const shades = [10, 20, 30, 40, 50, 60, 70, 80, 90].map(lv => {
    const [sr, sg, sb] = hslToRgb(h, sl, lv);
    return { hex: rgbToHex(sr, sg, sb), lv };
  });

  return (
    <div className="h-screen flex flex-col font-mono text-sm overflow-hidden" style={{ background: "#1e1e1e", color: "#d4d4d4" }}>
      {/* Header */}
      <header className="flex items-center px-4 py-2 shrink-0 border-b gap-3" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
        <Link href="/" className="text-xs transition-colors hover:text-white" style={{ color: "#858585" }}>← Home</Link>
        <div className="w-px h-4" style={{ background: "#3c3c3c" }} />
        <span className="font-bold" style={{ color: "#e06c75" }}>RGB</span>
        <span className="text-sm font-sans font-medium">Color Converter</span>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — inputs */}
        <div className="flex flex-col gap-5 p-5 shrink-0 overflow-auto" style={{ width: "300px", borderRight: "1px solid #3c3c3c" }}>

          {/* Swatch */}
          <div
            className="w-full rounded-lg flex items-center justify-center font-bold select-all text-sm"
            style={{ height: 130, background: hex, color: fg, transition: "background 0.08s", letterSpacing: "0.05em" }}
          >
            {hex.toUpperCase()}
          </div>

          {/* Native picker */}
          <div>
            <span className="text-xs font-sans block mb-1.5" style={{ color: "#858585" }}>Color picker</span>
            <input
              type="color"
              value={hex}
              onChange={e => applyRgb(hexToRgb(e.target.value) ?? rgb)}
              className="w-full h-9 rounded cursor-pointer border"
              style={{ background: "#2d2d2d", borderColor: "#3c3c3c", padding: "2px" }}
            />
          </div>

          {/* Text input */}
          <div>
            <span className="text-xs font-sans block mb-1.5" style={{ color: "#858585" }}>Any format</span>
            <input
              type="text"
              value={textInput}
              onChange={e => handleText(e.target.value)}
              placeholder="#hex · rgb() · hsl()"
              spellCheck={false}
              className="w-full text-xs font-mono px-3 py-2 rounded border outline-none"
              style={{
                background: "#252526",
                borderColor: inputError ? "#f44747" : "#3c3c3c",
                color: "#d4d4d4",
              }}
            />
          </div>

          {/* RGB sliders */}
          <div>
            <span className="text-xs font-sans block mb-2" style={{ color: "#858585" }}>RGB</span>
            <div className="flex flex-col gap-2">
              <Slider label="R" value={r} max={255} accent="#f44747" onChange={v => applyRgb([v, g, b])} />
              <Slider label="G" value={g} max={255} accent="#4ec9b0" onChange={v => applyRgb([r, v, b])} />
              <Slider label="B" value={b} max={255} accent="#569cd6" onChange={v => applyRgb([r, g, v])} />
            </div>
          </div>

          {/* HSL sliders */}
          <div>
            <span className="text-xs font-sans block mb-2" style={{ color: "#858585" }}>HSL</span>
            <div className="flex flex-col gap-2">
              <Slider label="H" value={h}  max={360} accent="#dcdcaa" onChange={v => applyRgb(hslToRgb(v, sl, l))} />
              <Slider label="S" value={sl} max={100} accent="#dcdcaa" onChange={v => applyRgb(hslToRgb(h, v, l))} />
              <Slider label="L" value={l}  max={100} accent="#dcdcaa" onChange={v => applyRgb(hslToRgb(h, sl, v))} />
            </div>
          </div>
        </div>

        {/* Right — formats + shades */}
        <div className="flex flex-col flex-1 p-6 gap-6 overflow-auto">

          {/* Formats */}
          <div>
            <span className="text-xs font-sans block mb-3" style={{ color: "#858585" }}>Formats</span>
            <div className="flex flex-col gap-2">
              {formats.map(({ key, label, value }) => (
                <div key={key}
                  className="flex items-center gap-3 px-3 py-2.5 rounded border"
                  style={{ background: "#252526", borderColor: "#3c3c3c" }}
                >
                  <span className="text-xs font-sans shrink-0" style={{ width: 100, color: "#858585" }}>{label}</span>
                  <span className="flex-1 text-xs font-mono truncate" style={{ color: "#d4d4d4" }}>{value}</span>
                  <button
                    onClick={() => doCopy(value, key)}
                    className="text-xs font-sans px-2 py-0.5 rounded shrink-0 transition-colors"
                    style={{ background: "#3c3c3c", color: copied === key ? "#4ec9b0" : "#cccccc" }}
                  >
                    {copied === key ? "Copied!" : "Copy"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Shades */}
          <div>
            <span className="text-xs font-sans block mb-3" style={{ color: "#858585" }}>Shades (same hue & saturation)</span>
            <div className="flex gap-1">
              {shades.map(({ hex: sh, lv }) => (
                <button
                  key={lv}
                  title={`L=${lv}%  ${sh}`}
                  onClick={() => applyRgb(hexToRgb(sh) ?? rgb)}
                  className="flex-1 rounded flex flex-col items-center justify-end pb-1 transition-transform hover:scale-105"
                  style={{ height: 64, background: sh }}
                >
                  <span className="text-xs font-mono" style={{ fontSize: 9, color: fgColor(...(hexToRgb(sh) ?? [0,0,0])), opacity: 0.7 }}>
                    {lv}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Contrast */}
          <div>
            <span className="text-xs font-sans block mb-3" style={{ color: "#858585" }}>Contrast</span>
            <div className="flex gap-2">
              {[["On white", 255,255,255], ["On black", 0,0,0]].map(([label, wr, wg, wb]) => {
                const bgLum = luminance(wr as number, wg as number, wb as number);
                const fgLum = luminance(r, g, b);
                const ratio = (Math.max(bgLum, fgLum) + 0.05) / (Math.min(bgLum, fgLum) + 0.05);
                const ratioStr = ratio.toFixed(2) + ":1";
                const aa = ratio >= 4.5, aaa = ratio >= 7;
                return (
                  <div key={label as string}
                    className="flex-1 rounded p-3 border"
                    style={{ background: `rgb(${wr},${wg},${wb})`, borderColor: "#3c3c3c" }}
                  >
                    <span className="text-sm font-bold block mb-1" style={{ color: hex }}>{label as string}</span>
                    <span className="text-xs font-mono block" style={{ color: `rgb(${wr},${wg},${wb})`, WebkitTextStroke: "0.5px #888" }}>
                      {ratioStr}
                    </span>
                    <div className="flex gap-1 mt-1.5">
                      <span className="text-xs px-1 rounded font-sans" style={{ background: aa ? "#0e3a1e" : "#3a0e0e", color: aa ? "#4ec9b0" : "#f44747" }}>AA</span>
                      <span className="text-xs px-1 rounded font-sans" style={{ background: aaa ? "#0e3a1e" : "#3a0e0e", color: aaa ? "#4ec9b0" : "#f44747" }}>AAA</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
