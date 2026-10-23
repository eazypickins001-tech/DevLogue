function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced ? fenced[1].trim() : trimmed;
}

function extractObject(raw: string): string {
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) return raw.slice(first, last + 1);
  return raw;
}

function escapeControlCharsInStrings(input: string): string {
  let output = "";
  let inString = false;
  let escaped = false;
  for (const char of input) {
    if (inString) {
      if (escaped) {
        output += char;
        escaped = false;
        continue;
      }
      if (char === "\\") {
        output += char;
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
        output += char;
        continue;
      }
      if (char === "\n") {
        output += "\\n";
        continue;
      }
      if (char === "\r") {
        output += "\\r";
        continue;
      }
      if (char === "\t") {
        output += "\\t";
        continue;
      }
      output += char;
      continue;
    }
    if (char === '"') inString = true;
    output += char;
  }
  return output;
}

export function parseModelJson(raw: string): unknown {
  const candidate = escapeControlCharsInStrings(extractObject(stripFences(raw))).replace(
    /,\s*([}\]])/g,
    "$1",
  );
  return JSON.parse(candidate);
}
