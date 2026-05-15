# Dev Toolkit

Personal browser-based toolkit for daily development needs. Built with Next.js, runs locally or over LAN.

## Tools

| Tool | Route | Description |
|---|---|---|
| JSON Formatter | `/json-formatter` | Format, minify, sort keys, tree view, schema inference |
| Base64 Converter | `/base64` | Encode/decode with URL-safe mode |
| URL Encoder / Parser | `/url-parser` | Parse URL components, edit query params, encode/decode |
| SQL Formatter | `/sql-formatter` | Format/minify SQL with syntax highlighting, multi-dialect |

## Running

```bash
npm install
npm run dev      # starts on 0.0.0.0:3000 (accessible from LAN)
npm run build    # production build
```

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Ace Editor (`react-ace`) for JSON and SQL input/output panels
- `sql-formatter` for SQL formatting
