import { describe, expect, it } from "vitest";
import { redactText, sanitizeContext, sanitizeBreadcrumbs } from "@/lib/errors/redact";

describe("error redaction", () => {
  it("removes credentials and urls", () => {
    const value = redactText(
      "Authorization: Bearer abc.def.ghi token=secret postgresql://user:pass@host/db user@example.com sk-abcdefghijklmnop",
    );
    expect(value).not.toContain("abc.def.ghi");
    expect(value).not.toContain("user:pass");
    expect(value).not.toContain("user@example.com");
    expect(value).toContain("[redacted]");
  });

  it("redacts secret keys recursively", () => {
    const value = sanitizeContext({
      password: "hunter2",
      nested: { apiKey: "key", note: "safe" },
      headers: { authorization: "Bearer 12345678901234567890123456789012" },
    });
    expect(value).toEqual({
      password: "[redacted]",
      nested: { apiKey: "[redacted]", note: "safe" },
      headers: { authorization: "[redacted]" },
    });
  });

  it("keeps breadcrumbs bounded", () => {
    expect(sanitizeBreadcrumbs(Array.from({ length: 40 }, (_, index) => ({ index })))).toHaveLength(30);
  });
});
