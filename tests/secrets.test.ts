import { describe, expect, it } from "vitest";
import { containsSecret, redactSecrets } from "@/lib/domain/secrets";

describe("redactSecrets", () => {
  it("redacts provider API keys", () => {
    const text = "key=sk-or-v1-abcdefghijklmnopqrstuvwxyz0123456789";
    expect(redactSecrets(text)).not.toContain("sk-or-v1");
    expect(redactSecrets(text)).toContain("[REDACTED]");
  });

  it("redacts GitHub tokens", () => {
    const text = "token ghp_abcdefghijklmnopqrstuvwxyz0123456789 used";
    expect(redactSecrets(text)).not.toContain("ghp_");
  });

  it("redacts AWS access keys", () => {
    expect(redactSecrets("AKIAIOSFODNN7EXAMPLE")).not.toContain("AKIA");
  });

  it("redacts environment assignments but keeps the name", () => {
    const redacted = redactSecrets("DATABASE_URL=postgres://user:pass@host/db");
    expect(redacted).toContain("DATABASE_URL=[REDACTED]");
    expect(redacted).not.toContain("user:pass");
  });

  it("redacts bearer tokens", () => {
    const redacted = redactSecrets("Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345");
    expect(redacted).not.toContain("abcdefghijklmnopqrstuvwxyz012345");
  });
});

describe("containsSecret", () => {
  it("detects secrets", () => {
    expect(containsSecret("sk-abcdefghijklmnopqrstuvwxyz")).toBe(true);
    expect(containsSecret("nothing sensitive here")).toBe(false);
  });
});
