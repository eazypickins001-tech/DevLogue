import { describe, expect, it } from "vitest";
import { findOrphanKeys, isAuditedKey, parseListObjectsXml } from "@/lib/storage-audit";

describe("storage audit", () => {
  it("parses keys, sizes, entities and truncation", () => {
    const xml = `<ListBucketResult>
      <Contents><Key>media/user/a&amp;b.mp4</Key><Size>123</Size></Contents>
      <Contents><Key>renders/x.mp4</Key><Size>456</Size></Contents>
      <IsTruncated>true</IsTruncated>
      <NextContinuationToken>next-token</NextContinuationToken>
    </ListBucketResult>`;
    const parsed = parseListObjectsXml(xml);
    expect(parsed.objects).toEqual([
      { key: "media/user/a&b.mp4", size: 123, lastModified: null },
      { key: "renders/x.mp4", size: 456, lastModified: null },
    ]);
    expect(parsed.truncated).toBe(true);
    expect(parsed.nextToken).toBe("next-token");
  });

  it("only audits known prefixes", () => {
    expect(isAuditedKey("media/a.mp4")).toBe(true);
    expect(isAuditedKey("renders/a.mp4")).toBe(true);
    expect(isAuditedKey("derivatives/a.jpg")).toBe(true);
    expect(isAuditedKey("backup/a.mp4")).toBe(false);
  });

  it("finds only unknown audited keys", () => {
    const objects = [
      { key: "media/known.mp4", size: 1, lastModified: null },
      { key: "media/orphan.mp4", size: 2, lastModified: null },
      { key: "backup/orphan.mp4", size: 3, lastModified: null },
    ];
    expect(findOrphanKeys(objects, new Set(["media/known.mp4"])).map((item) => item.key)).toEqual([
      "media/orphan.mp4",
    ]);
  });
});
