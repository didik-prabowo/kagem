import Link from "next/link";

const tools = [
  {
    name: "JSON Formatter",
    description: "Format, validate, dan minify JSON",
    href: "/json-formatter",
    icon: "{}",
    color: "#60a5fa",
  },
  {
    name: "Base64 Converter",
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
    name: "SQL Formatter",
    description: "Format & minify SQL, support berbagai dialect",
    href: "/sql-formatter",
    icon: "SQL",
    color: "#569cd6",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-1">Dev Toolkit</h1>
        <p className="text-gray-500 mb-10 text-sm">
          Tools for daily development needs
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => (
            <Link key={tool.href} href={tool.href} className="h-full">
              <div className="h-full bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-600 transition-all hover:bg-gray-900/80 cursor-pointer group flex flex-col">
                <div
                  className="text-2xl font-mono mb-4 font-bold"
                  style={{ color: tool.color }}
                >
                  {tool.icon}
                </div>
                <h2 className="font-semibold mb-1 group-hover:text-white transition-colors">
                  {tool.name}
                </h2>
                <p className="text-gray-500 text-sm">{tool.description}</p>
              </div>
            </Link>
          ))}

          {/* Placeholder card */}
          <div className="h-full bg-gray-900/40 border border-gray-800/50 border-dashed rounded-xl p-6 flex items-center justify-center">
            <p className="text-gray-700 text-sm">More tools coming soon...</p>
          </div>
        </div>
      </div>
    </main>
  );
}
