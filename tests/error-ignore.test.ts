import { describe, expect, it } from "vitest";
import { isExtensionError } from "@/lib/errors/ignore";

describe("isExtensionError", () => {
  it("ignores chrome extension frames", () => {
    expect(
      isExtensionError(
        "TypeError: x\n    at Y (chrome-extension://abcdef/executors/200.js:1:761)",
      ),
    ).toBe(true);
  });

  it("ignores other browser extension schemes", () => {
    expect(isExtensionError("moz-extension://abc/script.js:1:1")).toBe(true);
    expect(isExtensionError("safari-web-extension://abc/script.js:1:1")).toBe(true);
  });

  it("keeps application errors", () => {
    expect(isExtensionError("Error: boom\n    at handler (http://localhost:3000/app.js:1:1)")).toBe(
      false,
    );
    expect(isExtensionError(null, undefined, "")).toBe(false);
  });
});
