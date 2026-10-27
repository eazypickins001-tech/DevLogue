const SECRET_KEY_PATTERN =
  /(authorization|cookie|password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|database[_-]?url|dsn|dsn[_-]?url)/i;

const REDACTIONS: [RegExp, string][] = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]"],
  [/\b(postgres(?:ql)?|mysql|redis):\/\/[^\s"'<>]+/gi, "$1://[redacted]"],
  [/\bsk-[A-Za-z0-9_-]{12,}\b/g, "sk-[redacted]"],
  [/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]"],
  [
    /([?&](?:token|key|secret|signature|sig|X-Amz-[A-Za-z-]+)=)[^&\s]+/gi,
    "$1[redacted]",
  ],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]"],
];

export function redactText(value: string, max = 6000): string {
  let result = value;
  for (const [pattern, replacement] of REDACTIONS) {
    result = result.replace(pattern, replacement);
  }
  return result.slice(0, max);
}

function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

export function sanitizeContext(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactText(value, 2000);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactText(value.message, 2000),
      stack: value.stack ? redactText(value.stack, 6000) : null,
    };
  }
  if (depth >= 4) return "[max-depth]";
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeContext(item, depth + 1));
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, 50)) {
      if (isSecretKey(key)) {
        result[key] = "[redacted]";
        continue;
      }
      result[key] = sanitizeContext(item, depth + 1);
    }
    return result;
  }
  return String(value);
}

export function sanitizeBreadcrumbs(value: unknown[] | null | undefined): Record<string, unknown>[] {
  if (!value) return [];
  return value
    .slice(0, 30)
    .map((item) => sanitizeContext(item))
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
}
