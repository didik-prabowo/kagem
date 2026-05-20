# Dev Toolkit

Personal browser-based toolkit for daily development needs. Built with Next.js, runs locally or over LAN.

![Dev Toolkit](docs/screenshots/preview.png)

## Tools

**Comparators**

| Tool | Route | Description |
|---|---|---|
| Text Comparator | `/text-comparator` | Line-by-line diff with added/removed/unchanged counts |
| .ENV Comparator | `/env-comparator` | Compare two .env files, highlight missing or differing keys |

**Formatters**

| Tool | Route | Description |
|---|---|---|
| YAML ↔ JSON ↔ .ENV | `/yaml` | Convert between YAML, JSON, and .ENV — edit either panel, others update live |
| XML Formatter | `/xml-formatter` | Format/minify XML with tree view and schema visualization |
| JSON Formatter | `/json-formatter` | Format, minify, sort keys, tree view, schema inference |
| SQL Formatter | `/sql-formatter` | Format/minify SQL with syntax highlighting, multi-dialect |

**Generators**

| Tool | Route | Description |
|---|---|---|
| UUID Generator | `/uuid` | Generate UUID v4 (random) and v7 (time-ordered), with format options |
| Random String Generator | `/random-string` | Generate random strings with custom length, charset, and quantity |
| Regex Tester | `/regex` | Test regex patterns in real-time, view matches & capture groups |
| Timestamp Converter | `/timestamp` | Unix timestamp ↔ date, auto-detect seconds/milliseconds, relative time |
| Hash Generator | `/hash` | Generate MD5, SHA-1, SHA-256, SHA-384, SHA-512 — supports HMAC |
| Lorem Ipsum Generator | `/lorem` | Generate placeholder text by paragraphs, sentences, or words |
| Color Converter | `/color` | Convert HEX ↔ RGB ↔ HSL ↔ HSV ↔ CMYK, color picker, shades, contrast ratio |
| Cron Parser | `/cron` | Parse cron expressions, field breakdown, next N run times |
| Number Base Converter | `/base` | Convert binary ↔ octal ↔ decimal ↔ hex, bit visualization, custom base |

**Encoders**

| Tool | Route | Description |
|---|---|---|
| Base64 Encode / Decode | `/base64` | Encode/decode with URL-safe mode |
| URL Encoder / Parser | `/url-parser` | Parse URL components, edit query params, encode/decode |
| JWT Decoder / Encoder | `/jwt` | Decode JWT claims, validate expiry, encode with HMAC secret |

## Running

```bash
npm install
npm run dev      # starts on 0.0.0.0:3000 (accessible from LAN)
npm run build    # production build
```

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Ace Editor (`react-ace`) for code input/output panels
- `js-yaml` for YAML parsing/serialization
- `sql-formatter` for SQL formatting
- `xml-formatter` for XML formatting
- `diff` for line-by-line text comparison
- `crypto-js` for HMAC signing (works over HTTP/LAN, unlike Web Crypto API)
