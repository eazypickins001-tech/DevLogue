import { describe, expect, it } from "vitest";
import {
  MEDIA_SIZE_LIMITS,
  classifyMedia,
  matchesSignature,
  safeFilename,
  validateUpload,
} from "@/lib/domain/media";

function bytes(values: number[]): Uint8Array {
  return new Uint8Array(values);
}

function asciiBytes(text: string): Uint8Array {
  return new Uint8Array([...text].map((character) => character.charCodeAt(0)));
}

describe("matchesSignature", () => {
  it("recognizes PNG, JPEG and GIF images", () => {
    expect(matchesSignature(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]), "image")).toBe(true);
    expect(matchesSignature(bytes([0xff, 0xd8, 0xff, 0xe0]), "image")).toBe(true);
    expect(matchesSignature(asciiBytes("GIF89a"), "image")).toBe(true);
  });

  it("recognizes WEBP images", () => {
    const header = new Uint8Array(12);
    header.set(asciiBytes("RIFF"), 0);
    header.set(asciiBytes("WEBP"), 8);
    expect(matchesSignature(header, "image")).toBe(true);
  });

  it("recognizes MP4 video", () => {
    const header = new Uint8Array(12);
    header.set(asciiBytes("ftyp"), 4);
    header.set(asciiBytes("isom"), 8);
    expect(matchesSignature(header, "video")).toBe(true);
  });

  it("rejects a PDF declared as an image", () => {
    expect(matchesSignature(asciiBytes("%PDF-1.7"), "image")).toBe(false);
  });

  it("rejects an executable declared as video", () => {
    expect(matchesSignature(bytes([0x4d, 0x5a, 0x90, 0x00]), "video")).toBe(false);
  });

  it("recognizes WAV and MP3 audio", () => {
    const wav = new Uint8Array(12);
    wav.set(asciiBytes("RIFF"), 0);
    wav.set(asciiBytes("WAVE"), 8);
    expect(matchesSignature(wav, "audio")).toBe(true);
    expect(matchesSignature(asciiBytes("ID3"), "audio")).toBe(true);
  });
});

describe("classifyMedia", () => {
  it("classifies allowed types", () => {
    expect(classifyMedia("image/png")).toBe("image");
    expect(classifyMedia("video/mp4")).toBe("video");
    expect(classifyMedia("audio/mpeg")).toBe("audio");
    expect(classifyMedia("application/pdf")).toBe("document");
  });

  it("strips parameters and normalizes case", () => {
    expect(classifyMedia("Image/JPEG; charset=binary")).toBe("image");
  });

  it("rejects unknown types", () => {
    expect(classifyMedia("application/x-msdownload")).toBeNull();
    expect(classifyMedia("")).toBeNull();
  });
});

describe("safeFilename", () => {
  it("removes directory traversal", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename("C:\\Users\\me\\secret.png")).toBe("secret.png");
  });

  it("replaces unsafe characters", () => {
    expect(safeFilename("my file (1).png")).toBe("my-file-1.png");
  });

  it("falls back for empty input", () => {
    expect(safeFilename("...")).toBe("file");
  });
});

describe("validateUpload", () => {
  it("accepts a reasonable image", () => {
    const result = validateUpload({ filename: "shot.png", contentType: "image/png", sizeBytes: 1024 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe("image");
      expect(result.filename).toBe("shot.png");
    }
  });

  it("rejects unsupported MIME types", () => {
    const result = validateUpload({ filename: "evil.exe", contentType: "application/x-msdownload", sizeBytes: 10 });
    expect(result.ok).toBe(false);
  });

  it("rejects files above the type limit", () => {
    const result = validateUpload({
      filename: "big.png",
      contentType: "image/png",
      sizeBytes: MEDIA_SIZE_LIMITS.image + 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/limit/);
  });

  it("rejects zero-byte and invalid sizes", () => {
    expect(validateUpload({ filename: "a.png", contentType: "image/png", sizeBytes: 0 }).ok).toBe(false);
    expect(
      validateUpload({ filename: "a.png", contentType: "image/png", sizeBytes: Number.NaN }).ok,
    ).toBe(false);
  });

  it("requires an extension", () => {
    expect(validateUpload({ filename: "noextension", contentType: "image/png", sizeBytes: 10 }).ok).toBe(
      false,
    );
  });
});
