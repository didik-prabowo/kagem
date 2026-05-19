# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # dev server (runs on 0.0.0.0:3000, accessible from LAN)
npm run build    # production build — always run this to verify before finishing
npm run lint     # ESLint
```

No test suite exists yet.

## Stack

- **Next.js 16** (App Router, Turbopack) + TypeScript + Tailwind CSS v4 + `@tailwindcss/postcss`
- Tailwind v4 uses `@import "tailwindcss"` in CSS (not `@tailwind` directives) and `@tailwindcss/postcss` in `postcss.config.mjs`
- `allowedDevOrigins: ["*"]` in `next.config.ts` — intentional, allows HMR from any LAN device

## Architecture

This is a **personal dev toolkit** — a collection of browser-based tools, each as its own route.

### Adding a new tool

1. Create `src/app/<tool-name>/page.tsx`
2. Create the component in `src/components/`
3. Register it in the `tools` array in `src/app/page.tsx` (name, description, href, icon, color)

### JSON Formatter (`/json-formatter`)

The main tool. All logic lives in `src/components/JsonFormatter.tsx` (one large client component) with a thin page wrapper at `src/app/json-formatter/page.tsx`.

**Layout:** split panel — Ace editor (left 50%) + output panel (right).

**Left panel — editor:**
- `AceWrapper.tsx` wraps `react-ace` with `tomorrow_night` theme, dynamically imported (`ssr: false`) to avoid SSR issues. The wrapper is `absolute inset-0` inside a `relative` container so Ace fills it without overflowing.
- Mini toolbar above the editor: Format, Minify, Sort keys, Undo, Redo, Copy, Paste, Clear
- **Undo/redo** is a custom stack (`stackRef` + `opIdxRef`) that tracks batch operations only (Format/Minify/Sort/Paste/Clear), not per-keystroke. Ace's native Ctrl+Z handles granular undo inside each session.
- **Clipboard:** `navigator.clipboard` requires HTTPS. When accessed over HTTP (LAN), `doCopy` falls back to `document.execCommand('copy')`; `doPaste` shows an alert asking the user to paste manually with Ctrl+V.

**Toolbar** starts with an empty editor — "Use example" icon button (between Paste and Clear) loads the sample JSON and pushes it onto the undo stack via `pushOp(EXAMPLE); applyVal(EXAMPLE)`.

**Right panel — tabs:**
- **Tree View** — recursive `JsonNode` component with expand/collapse per node (default: open at depth < 2). A "Expand all / Collapse all" bar above the tree uses `TreeCtx` (React context with `{ seq, open }`) — `seq` always increments so `useEffect` in every node fires even when `open` value is unchanged.
- **Raw Output** — read-only Ace editor (`AceWrapper` with `readOnly={true}`, `name="json-output-editor"`). Container is `flex-1 relative` (not the shared `overflow-auto p-4` div used by Tree/Schema tabs).
- **Schema** — `deriveSchema()` infers types from JSON data and renders them as a collapsible tree with colored type badges (`SchemaNode` component).

**`AceWrapper.tsx`** accepts optional `readOnly` and `name` props — used for both input (left) and Raw Output (right).

**Color palette** (`C` constant) matches VS Code Dark+ theme throughout both panels.

### Base64 Converter (`/base64`)

All logic in `src/components/Base64Converter.tsx`.

**Layout:** split panel — input textarea (left) + readonly output textarea (right) + footer stats bar.

**Key details:**
- UTF-8 safe via `TextEncoder/TextDecoder` — standard `btoa/atob` only handles Latin-1.
- **URL-safe mode** replaces `+/=` with `-_` (and strips padding) for use in URLs/tokens. Toggling URL-safe reconverts current input immediately.
- **Swap ⇅** button moves output → input and flips encode↔decode mode.
- Clipboard fallback same pattern as JSON Formatter (`execCommand` for copy, alert for paste on HTTP/LAN).
- Footer shows input chars, output chars, and encode ratio (Base64 is always ~1.33×).

### URL Encoder / Parser (`/url-parser`)

All logic in `src/components/UrlTool.tsx`. Two tabs: **Parser** and **Encoder**.

**Parser tab:**
- Input bar parses via `new URL()` into components (protocol, hostname, port, pathname, hash) displayed as read-only fields.
- Query params rendered as an editable key/value table — editing any row or adding/removing a row immediately rebuilds the URL via `buildUrl()`.
- Reconstructed URL shown at bottom with a Copy button.
- "Use example" button loads a sample URL with multiple query params.

**Encoder tab:**
- Split panel — plain textarea (left) + readonly encoded output (right), computed inline via `doEncode()`.
- **Mode toggle:** encode / decode.
- **Type toggle:** `encodeURIComponent` (encodes `& = ? /` etc.) vs `encodeURI` (leaves URL-structural chars intact).
- "Use example" loads context-appropriate data: plain text in encode mode, a percent-encoded string in decode mode (`EXAMPLE_ENC` is a `Record<EncMode, string>`).

### SQL Formatter (`/sql-formatter`)

All logic in `src/components/SqlFormatter.tsx`. Uses the `sql-formatter` npm package.

**Layout:** split panel — `SqlAceWrapper` editor (left) + read-only `SqlAceWrapper` output (right). `SqlAceWrapper.tsx` uses SQL mode, `tomorrow_night` theme, word wrap enabled (`wrap: true`).

**State:** two separate states — `input` (what's in the left editor) and `formatted` (always the formatted version, shown on the right). Right panel never reflects minified state.

**Key details:**
- Dialect selector (header): Standard SQL, MySQL, PostgreSQL, SQLite, T-SQL, PL/SQL — changing dialect calls `updateFormatted(input, d)`.
- No auto-format on `onChange` — `handleInput` updates `input` AND calls `updateFormatted` to keep right panel in sync.
- **Format** button rewrites `input` with formatted SQL (visible change in left editor) via `tryFormat()`.
- **Minify** strips comments and collapses whitespace via `minifySql()` (regex, no lib), writes result to `input` only — right panel keeps showing formatted SQL.
- Left toolbar: icon buttons (Format, Minify, | Paste, Use example, Clear) + char count — same `IconBtn` pattern as JSON Formatter.
- Right toolbar: icon Copy button only.
- Clipboard fallback same pattern as other tools.

### XML Formatter (`/xml-formatter`)

All logic in `src/components/XmlFormatter.tsx`. Uses the `xml-formatter` npm package. `XmlAceWrapper.tsx` is the Ace wrapper with XML mode (same pattern as `SqlAceWrapper.tsx`).

**Layout:** split panel — `XmlAceWrapper` editor (left) + tabbed output panel (right).

**State:** `input` (left editor) + `formatted` (always the formatted version, right panel). Right panel never reflects minified state — same pattern as SQL Formatter.

**Right panel — tabs:**
- **Formatted** — read-only `XmlAceWrapper`. Copy button in tab bar.
- **Tree View** — recursive `XmlTreeNode` component. Parses with `DOMParser`, renders element names (teal), attributes (blue/orange), text content, expand/collapse per node (default open at depth < 3). Closing tag shown when expanded.
- **Schema** — `XmlSchemaNode` derives schema via `deriveSchema()`: walks the DOM, merges repeated sibling elements into a single entry with a `[N]` count badge. Shows `@attr` entries under each element. Legend row above the tree.

**Key details:**
- `tryFormat()` wraps `xml-formatter`; errors shown in header bar.
- `minifyXml()` strips comments and collapses whitespace (regex, no lib).
- Tab label consistency with JSON Formatter: "Tree View", "Formatted", "Schema".

### Regex Tester (`/regex`)

All logic in `src/components/RegexTester.tsx`. No external dependencies — uses native `RegExp`.

**Layout:** split panel — regex input bar + test string textarea (left) + preview + match table (right).

**Key details:**
- Regex bar renders `/pattern/flags` style; pattern text turns red on invalid regex.
- Flag toggles in header: `g` (global), `i` (case insensitive), `m` (multiline), `s` (dotAll). `g` on by default.
- `getMatches()` runs `RegExp.exec()` in a loop (safety limit: 10 000 iterations); guards against infinite loops on zero-length matches via `re.lastIndex++`.
- `buildSegments()` splits the test string into highlight/plain segments for the preview panel.
- Preview: plain text with `<mark>` spans for matches (gold highlight + underline). Match table: index, position (start–end), value, capture groups.
- Both `getMatches` and `buildSegments` are wrapped in `useMemo`.

### Timestamp Converter (`/timestamp`)

All logic in `src/components/TimestampConverter.tsx`. No external dependencies.

**Layout:** split panel — unix timestamp input + datetime-local input (left) + formatted outputs list (right).

**Key details:**
- Bidirectional sync: typing in the unix input updates the date picker and vice versa.
- `isMilliseconds(n)`: timestamps > 9 999 999 999 treated as ms; otherwise seconds. Detected unit shown below input.
- `buildFormats()` returns 8 rows: Unix (s), Unix (ms), ISO 8601, UTC, Local (with named timezone via `Intl.DateTimeFormat`), Date, Time (UTC), Relative.
- `relativeTime()` computes human-readable relative string (e.g. "3 hours ago", "in 2 days"); updates every second via `setInterval` in `useEffect`.
- **Now** button in header fills both inputs with the current time.

### Hash Generator (`/hash`)

All logic in `src/components/HashGenerator.tsx`. Uses `crypto-js` (already a dependency from JWT tool).

**Layout:** split panel — input textarea (left) + hash results list (right).

**Key details:**
- Computes all 5 algorithms at once on every keystroke: MD5, SHA-1, SHA-256, SHA-384, SHA-512.
- **HMAC toggle** in header: activates a secret key input; switches all outputs to HMAC variants (`CryptoJS.HmacSHA256` etc.).
- Each result row: algorithm label + hash value (selectable) + Copy button with "Copied!" feedback.
- Example: the classic *"The quick brown fox jumps over the lazy dog"* string.

### JWT Decoder / Encoder (`/jwt`)

All logic in `src/components/JwtTool.tsx`. Two tabs: **Decoder** and **Encoder**.

**Decoder tab:**
- Splits token on `.`, base64url-decodes header + payload via `b64urlDecode()` (UTF-8 safe, uses `TextDecoder`).
- Displays Header and Payload as formatted JSON; signature shown as raw base64url string.
- Status badge: Valid / Expired / Not yet valid — derived from `exp`/`nbf` claims.
- Timestamps (`iat`, `exp`, `nbf`) formatted as human-readable dates alongside raw values.

**Encoder tab:**
- Editable header (JSON textarea) + payload (JSON textarea) + secret input.
- Auto-signs on every change via `useEffect([headerStr, payloadStr, secret])` — synchronous via `crypto-js` (`CryptoJS.HmacSHA256/384/512`). Web Crypto API requires HTTPS and doesn't work over LAN HTTP.
- Color-coded token output: blue = header, orange = payload, grey = signature.
- Clears generated token when any input is empty.

**Key detail:** `b64urlDecode/b64urlEncode` handle the `+→-`, `/→_`, padding differences between standard Base64 and JWT's base64url encoding.

### Text Comparator (`/text-comparator`)

All logic in `src/components/TextComparator.tsx`. Uses the `diff` npm package (`diffLines`).

**Layout:** split panel — two stacked textareas (Original top, Modified bottom) on the left; unified diff table on the right.

**Key details:**
- `buildDiffLines(changes)` tracks `origLine` and `modLine` counters separately, producing rows with both line numbers (one null for added/removed lines).
- Table: orig# | mod# | sign (+/−/space) | content. Added rows have green bg, removed rows have red bg, unchanged rows are dimmed.
- Header stats: `+N added`, `−N removed`, `N unchanged`. Shows "✓ Identical" badge when both inputs are non-empty and no diffs.

### .ENV Comparator (`/env-comparator`)

All logic in `src/components/EnvComparator.tsx`.

**Layout:** split panel — two stacked textareas (File A top, File B bottom) on the left; comparison table on the right.

**Key details:**
- `parseEnv(text)` → `Map<string, string>`: splits on newlines, skips blank lines and `#` comments, strips surrounding quotes from values.
- `compareEnv(mapA, mapB)` → `EnvEntry[]`: status is `"match"` | `"different"` | `"only-a"` | `"only-b"`. Sorted: different → missing (only-a/only-b) → match, then alphabetical within each group.
- **Mask values** toggle: shows first 2 chars + up to 6 bullets (`••••••`) for sensitive values. Short values (≤4 chars) fully masked.
- Header stats: ✓ N (match) ≠ N (different) ← N (only-a) → N (only-b) — counts only shown when non-zero.
- Status colors follow VS Code Dark+ palette: orange (different), blue (only-a), purple (only-b), dimmed (match).
