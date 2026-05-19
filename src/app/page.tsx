import Link from "next/link";

const categories = [
  {
    name: "Comparators",
    tools: [
      {
        name: "Text Comparator",
        description: "Compare two texts, view line-by-line differences",
        href: "/text-comparator",
        icon: "DIFF",
        color: "#4ec9b0",
      },
      {
        name: ".ENV Comparator",
        description: "Compare two .env files, highlight missing or differing keys",
        href: "/env-comparator",
        icon: ".ENV",
        color: "#ce9178",
      },
    ],
  },
  {
    name: "Formatters",
    tools: [
      {
        name: "XML Formatter",
        description: "Format & minify XML dengan syntax highlighting",
        href: "/xml-formatter",
        icon: "XML",
        color: "#4ec9b0",
      },
      {
        name: "JSON Formatter",
        description: "Format, validate, dan minify JSON",
        href: "/json-formatter",
        icon: "{}",
        color: "#60a5fa",
      },
      {
        name: "SQL Formatter",
        description: "Format & minify SQL, supports multiple dialects",
        href: "/sql-formatter",
        icon: "SQL",
        color: "#569cd6",
      },
    ],
  },
  {
    name: "Generators",
    tools: [
      {
        name: "Random String Generator",
        description: "Generate random strings with custom length, charset, and quantity",
        href: "/random-string",
        icon: "RNG",
        color: "#4ec9b0",
      },
      {
        name: "Regex Tester",
        description: "Test regex patterns in real-time, view matches & capture groups",
        href: "/regex",
        icon: ".*",
        color: "#dcdcaa",
      },
      {
        name: "Timestamp Converter",
        description: "Unix timestamp ↔ date, auto-detect seconds/milliseconds, relative time",
        href: "/timestamp",
        icon: "TS",
        color: "#569cd6",
      },
      {
        name: "Hash Generator",
        description: "Generate MD5, SHA-1, SHA-256, SHA-384, SHA-512 — support HMAC",
        href: "/hash",
        icon: "#",
        color: "#4ec9b0",
      },
    ],
  },
  {
    name: "Encoders",
    tools: [
      {
        name: "Base64 Encode / Decode",
        description: "Encode & decode Base64, support URL-safe",
        href: "/base64",
        icon: "B64",
        color: "#ce9178",
      },
      {
        name: "URL Encoder / Parser",
        description: "Parse URL, edit query params, encode & decode",
        href: "/url-parser",
        icon: "🔗",
        color: "#4ec9b0",
      },
      {
        name: "JWT Decoder / Encoder",
        description:
          "Decode JWT tokens, view claims & expiry, encode with a secret",
        href: "/jwt",
        icon: "JWT",
        color: "#dcdcaa",
      },
    ],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 32 32"
            width="36"
            height="36"
          >
            <rect width="32" height="32" rx="7" fill="#252526" />
            <path
              d="M9 9L3 16L9 23"
              stroke="#569cd6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M14 23L18 9"
              stroke="#ce9178"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M23 9L29 16L23 23"
              stroke="#569cd6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <h1 className="text-3xl font-bold">Dev Toolkit</h1>
        </div>
        <p className="text-gray-500 mb-10 text-sm">
          Tools for daily development needs
        </p>

        <div className="flex flex-col gap-10">
          {categories.map((cat) => (
            <section key={cat.name}>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4 border-b border-gray-800 pb-2">
                {cat.name}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cat.tools.map((tool) => (
                  <Link key={tool.href} href={tool.href} className="h-full">
                    <div className="h-full bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-600 transition-all hover:bg-gray-900/80 cursor-pointer group flex flex-col">
                      <div
                        className="text-2xl font-mono mb-4 font-bold"
                        style={{ color: tool.color }}
                      >
                        {tool.icon}
                      </div>
                      <h3 className="font-semibold mb-1 group-hover:text-white transition-colors">
                        {tool.name}
                      </h3>
                      <p className="text-gray-500 text-sm">
                        {tool.description}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
