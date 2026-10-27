import { describe, expect, it } from "vitest";
import { DEFAULT_STORAGE_WARNING_BYTES, formatStorageBytes, storageWarningLevel } from "@/lib/storage-policy";

describe("storage policy", () => {
  it("formats bytes", () => {
    expect(formatStorageBytes(0)).toBe("0 B");
    expect(formatStorageBytes(1024)).toBe("1.0 KB");
    expect(formatStorageBytes(DEFAULT_STORAGE_WARNING_BYTES)).toBe("8.0 GB");
  });

  it("warns at the configured threshold", () => {
    expect(storageWarningLevel(100, 200)).toBe("ok");
    expect(storageWarningLevel(200, 200)).toBe("warning");
    expect(storageWarningLevel(300, 200)).toBe("warning");
  });
});
