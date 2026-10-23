import { describe, expect, it } from "vitest";
import { parseModelJson } from "@/lib/ai/json";

describe("parseModelJson", () => {
  it("parses plain JSON", () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips markdown code fences", () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("extracts an object surrounded by prose", () => {
    expect(parseModelJson('Here is the result:\n{"a":1}\nDone.')).toEqual({ a: 1 });
  });

  it("escapes raw newlines inside string values", () => {
    expect(parseModelJson('{"a":"line one\nline two"}')).toEqual({
      a: "line one\nline two",
    });
  });

  it("escapes raw tabs inside string values", () => {
    expect(parseModelJson('{"a":"one\ttwo"}')).toEqual({ a: "one\ttwo" });
  });

  it("removes trailing commas", () => {
    expect(parseModelJson('{"a":[1,2,],}')).toEqual({ a: [1, 2] });
  });

  it("preserves already escaped newlines", () => {
    expect(parseModelJson('{"a":"one\\ntwo"}')).toEqual({ a: "one\ntwo" });
  });

  it("throws on irreparable JSON", () => {
    expect(() => parseModelJson("not json at all")).toThrow();
  });
});
