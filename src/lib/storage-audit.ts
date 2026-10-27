export type R2ListObject = {
  key: string;
  size: number;
  lastModified: string | null;
};

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

export function parseListObjectsXml(xml: string): {
  objects: R2ListObject[];
  truncated: boolean;
  nextToken: string | null;
} {
  const objects: R2ListObject[] = [];
  for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const body = match[1];
    const key = body.match(/<Key>([\s\S]*?)<\/Key>/)?.[1];
    if (!key) continue;
    const size = Number(body.match(/<Size>(\d+)<\/Size>/)?.[1] ?? "0");
    const lastModified = body.match(/<LastModified>([\s\S]*?)<\/LastModified>/)?.[1] ?? null;
    objects.push({
      key: decodeXml(key),
      size: Number.isFinite(size) ? size : 0,
      lastModified: lastModified ? decodeXml(lastModified) : null,
    });
  }
  const truncated = /<IsTruncated>true<\/IsTruncated>/i.test(xml);
  const nextToken = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ?? null;
  return { objects, truncated, nextToken: nextToken ? decodeXml(nextToken) : null };
}

const AUDITED_PREFIXES = ["media/", "renders/", "derivatives/"];

export function isAuditedKey(key: string): boolean {
  return AUDITED_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function findOrphanKeys(objects: R2ListObject[], knownKeys: Set<string>): R2ListObject[] {
  return objects.filter((object) => isAuditedKey(object.key) && !knownKeys.has(object.key));
}
