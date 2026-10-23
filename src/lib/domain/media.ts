export type MediaKindValue = "image" | "video" | "audio" | "document";

export const MEDIA_SIZE_LIMITS: Record<MediaKindValue, number> = {
  image: 15 * 1024 * 1024,
  video: 512 * 1024 * 1024,
  audio: 100 * 1024 * 1024,
  document: 25 * 1024 * 1024,
};

export const ALLOWED_MEDIA_TYPES: Record<MediaKindValue, readonly string[]> = {
  image: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"],
  video: ["video/mp4", "video/quicktime", "video/webm"],
  audio: ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/ogg", "audio/webm"],
  document: ["application/pdf", "text/plain", "text/markdown"],
};

export function classifyMedia(contentType: string): MediaKindValue | null {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  for (const [kind, types] of Object.entries(ALLOWED_MEDIA_TYPES) as [
    MediaKindValue,
    readonly string[],
  ][]) {
    if (types.includes(normalized)) return kind;
  }
  return null;
}

export function safeFilename(input: string): string {
  const base = input.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/^[.\-]+/, "")
    .slice(0, 120);
  return cleaned || "file";
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function startsWithBytes(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

export function matchesSignature(bytes: Uint8Array, kind: MediaKindValue): boolean {
  if (bytes.length < 3) return false;
  const brand = ascii(bytes, 4, 4);
  const riff = ascii(bytes, 0, 4);
  const container = ascii(bytes, 8, 4);

  switch (kind) {
    case "image":
      return (
        startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47]) ||
        startsWithBytes(bytes, [0xff, 0xd8, 0xff]) ||
        ascii(bytes, 0, 4) === "GIF8" ||
        (riff === "RIFF" && container === "WEBP") ||
        (brand === "ftyp" && ["avif", "avis"].includes(ascii(bytes, 8, 4)))
      );
    case "video":
      return (
        (brand === "ftyp" &&
          ["isom", "iso2", "mp41", "mp42", "avc1", "M4V ", "qt  "].includes(container)) ||
        startsWithBytes(bytes, [0x1a, 0x45, 0xdf, 0xa3])
      );
    case "audio":
      return (
        ascii(bytes, 0, 3) === "ID3" ||
        startsWithBytes(bytes, [0xff, 0xfb]) ||
        startsWithBytes(bytes, [0xff, 0xf3]) ||
        (riff === "RIFF" && container === "WAVE") ||
        ascii(bytes, 0, 4) === "OggS" ||
        brand === "ftyp"
      );
    case "document":
      return true;
  }
}

export type UploadValidation =
  | { ok: true; kind: MediaKindValue; filename: string }
  | { ok: false; reason: string };

export function validateUpload(input: {
  filename: string;
  contentType: string;
  sizeBytes: number;
}): UploadValidation {
  const kind = classifyMedia(input.contentType);
  if (!kind) {
    return {
      ok: false,
      reason: `Unsupported file type: ${input.contentType || "unknown"}.`,
    };
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, reason: "File size is missing or invalid." };
  }
  const limit = MEDIA_SIZE_LIMITS[kind];
  if (input.sizeBytes > limit) {
    return {
      ok: false,
      reason: `File is ${(input.sizeBytes / (1024 * 1024)).toFixed(1)}MB; the ${kind} limit is ${Math.round(
        limit / (1024 * 1024),
      )}MB.`,
    };
  }
  const filename = safeFilename(input.filename);
  if (!/\.\w{1,8}$/.test(filename)) {
    return { ok: false, reason: "File must have a valid extension." };
  }
  return { ok: true, kind, filename };
}
