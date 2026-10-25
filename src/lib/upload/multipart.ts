export type MultipartTicket = {
  uploadId: string;
  key: string;
  partSize: number;
  parts: { partNumber: number; url: string }[];
  completedParts?: number[];
};

type UploadOptions = {
  concurrency?: number;
  maxRetries?: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function putPart(url: string, blob: Blob, signal?: AbortSignal, maxRetries = 3): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const response = await fetch(url, { method: "PUT", body: blob, signal });
      if (response.ok) return;
      const detail = await response.text().catch(() => "");
      lastError = new Error(`R2 part upload failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}.`);
      if (response.status < 500) throw lastError;
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;
    }
    if (attempt < maxRetries - 1) await delay(500 * 2 ** attempt);
  }
  throw lastError instanceof Error ? lastError : new Error("R2 part upload failed.");
}

export async function uploadMultipart(
  file: Blob,
  ticket: MultipartTicket,
  options: UploadOptions = {},
): Promise<void> {
  const parts = [...ticket.parts].sort((a, b) => a.partNumber - b.partNumber);
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, parts.length || 1));
  const maxRetries = options.maxRetries ?? 3;
  const completed = new Set(ticket.completedParts ?? []);
  const partBytes = (partNumber: number) => {
    const start = (partNumber - 1) * ticket.partSize;
    return Math.max(0, Math.min(file.size, start + ticket.partSize) - start);
  };
  let next = 0;
  let uploaded = parts.reduce((sum, part) => sum + (completed.has(part.partNumber) ? partBytes(part.partNumber) : 0), 0);
  options.onProgress?.(file.size > 0 ? uploaded / file.size : 1);

  const worker = async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= parts.length) return;
      const part = parts[index];
      if (completed.has(part.partNumber)) continue;
      const start = (part.partNumber - 1) * ticket.partSize;
      const end = Math.min(file.size, start + ticket.partSize);
      const blob = file.slice(start, end);
      await putPart(part.url, blob, options.signal, maxRetries);
      uploaded += blob.size;
      options.onProgress?.(file.size > 0 ? uploaded / file.size : 1);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}
