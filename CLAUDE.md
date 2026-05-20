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
- **Key bug:** `tryParse()` assigned param IDs from a local counter (always starting at `"0"`), colliding with `idRef` which also starts at `0`. Fixed by re-mapping parsed params through `newId()` in `handleUrlInput`.

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

### Lorem Ipsum Generator (`/lorem`)

All logic in `src/components/LoremIpsum.tsx`. No external dependencies.

**Layout:** settings panel (280px left) + read-only output textarea (right, Georgia serif font).

**Key details:**
- Mode selector: Paragraphs | Sentences | Words — each has a per-mode count max (20 / 50 / 200).
- "Start with Lorem ipsum..." checkbox prepends the classic opening sentence.
- "Wrap with HTML `<p>` tags" checkbox wraps output in `<p>` elements.
- Output regenerates on every settings change AND on manual "Regenerate" button click (via a `tick` counter that forces `useEffect` to re-run even when other deps are unchanged).
- Word/char count shown in output toolbar.

### Color Converter (`/color`)

All logic in `src/components/ColorConverter.tsx`. No external dependencies — pure color math.

**Layout:** left panel (300px, inputs) + right panel (formats + shades + contrast).

**Key details:**
- Internal state is `[r, g, b]` — all other representations are derived.
- Text input auto-detects format: `#hex`, `rgb()`, `hsl()`, or bare `r g b` numbers.
- RGB and HSL sliders each have a number input alongside the range.
- 8 format outputs: HEX, HEX (upper), RGB, HSL, HSV/HSB, CMYK, CSS variable, Tailwind `bg-[]`.
- Shade strip: 9 swatches at lightness 10%–90% (same hue & saturation) — click any to select.
- Contrast checker: WCAG AA/AAA badges vs white and black backgrounds.
- `fgColor(r,g,b)` uses relative luminance to pick black or white text on the swatch preview.

### Cron Parser (`/cron`)

All logic in `src/components/CronParser.tsx`. No external dependencies.

**Layout:** left panel (300px, input + breakdown + presets) + right panel (description + run list).

**Key details:**
- Supports `@yearly`, `@monthly`, `@weekly`, `@daily`, `@midnight`, `@hourly` macros (expanded before parsing).
- `parseField()` handles `*`, `n`, `n-m`, `*/step`, `n/step`, `n-m/step`, comma lists.
- `nextRuns()` iterates minute-by-minute (up to 300 000 iterations); advances by month/day/hour in bulk to skip non-matching ranges efficiently.
- Day-of-month vs day-of-week OR logic: when both fields are restricted (not `*`), a time matches if either condition is true (standard cron behavior).
- `buildDescription()` produces a human-readable sentence; handles step patterns, multi-value lists, and common shortcuts.
- Count selector: 5 / 10 / 20 / 50 next runs. Local timezone name shown in header.

### Number Base Converter (`/base`)

All logic in `src/components/BaseConverter.tsx`. No external dependencies.

**Layout:** left panel (300px, base inputs + bit width + custom base) + right panel (bit viewer + powers-of-2 table).

**Key details:**
- Internal state: `lastValid` (number) + raw string per field. Editing any field parses it and spreads the new value to all other fields.
- `parseNum()` accepts optional leading `-`, spaces/underscores as separators (stripped before parsing).
- Binary input display groups bits into nibbles with spaces (visual only — underscores stripped on parse).
- Bit viewer (`BitViewer`): shows 8/16/32-bit two's complement pattern. Bits colored by value (1 = blue, 0 = dim), grouped into nibbles with alternating dark backgrounds. Byte hex labels below for 16/32-bit modes.
- Custom base (2–36): separate input pair — changing the base immediately reconverts `lastValid`.
- Powers-of-2 table: 2^0 through 2^32, "use" button loads that value into all fields.
- Precision limited to JS `Number` (~53-bit integers); no BigInt to avoid TypeScript ES2020 target issues.

### YAML ↔ JSON ↔ .ENV (`/yaml`)

All logic in `src/components/YamlJsonConverter.tsx`. Uses `js-yaml`. `YamlAceWrapper.tsx` is the Ace wrapper with YAML mode.

**Layout:** three equal panels (YAML | JSON | .ENV), each with a toolbar.

**Key details:**
- `Source` type is `"yaml" | "json"` only — .ENV is output-only (read-only textarea, no Paste button).
- Editing either YAML or JSON panel parses it, serializes to the other format, and derives .ENV via `flattenObj()`.
- `.ENV is read-only` because the format is inherently flat — round-tripping YAML/JSON → .ENV → YAML/JSON loses nested structure.
- `flattenObj()` recursively flattens nested objects to `UPPER_SNAKE_CASE` keys; values with spaces/special chars are quoted.

### UUID Generator (`/uuid`)

All logic in `src/components/UuidGenerator.tsx`. No external dependencies — uses `crypto.getRandomValues()`.

**Key details:**
- v4: random bytes from `crypto.getRandomValues()`, set version bits `b[6] = (b[6] & 0x0f) | 0x40` and variant bits `b[8] = (b[8] & 0x3f) | 0x80`.
- v7: timestamp-ordered. Timestamp bytes written with a loop (`for i=5..0: b[i] = t%256; t = floor(t/256)`) to avoid BigInt literals (TypeScript target < ES2020 rejects the `n` suffix).
- Format options: uppercase, no hyphens, braces `{}`.

### Random String Generator (`/random-string`)

All logic in `src/components/RandomStringGenerator.tsx`. Uses `crypto.getRandomValues()` for cryptographic randomness.

**Key details:**
- Charset toggles: A–Z, a–z, 0–9, symbols (`!@#$%^&*`), exclude ambiguous chars (`0O1lI`), custom extra chars.
- Length slider (1–256) + number input, quantity 1–50.
- Generates all strings at once, displays as a copyable list with individual + bulk Copy buttons.

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
