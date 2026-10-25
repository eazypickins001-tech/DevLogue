import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadMultipart } from "@/lib/upload/multipart";

function ticket(partNumbers = [1, 2, 3]): {
  uploadId: string;
  key: string;
  partSize: number;
  parts: { partNumber: number; url: string }[];
  completedParts?: number[];
} {
  return {
    uploadId: "upload-1",
    key: "media/test.webm",
    partSize: 4,
    parts: partNumbers.map((partNumber) => ({
      partNumber,
      url: `https://r2.example/part-${partNumber}`,
    })),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadMultipart", () => {
  it("uploads all parts and reports progress", async () => {
    const sizes: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        sizes.push((init?.body as Blob).size);
        return new Response(null, { status: 200 });
      }),
    );
    const progress: number[] = [];
    await uploadMultipart(new Blob([new Uint8Array(10)]), ticket(), {
      concurrency: 2,
      onProgress: (fraction) => progress.push(fraction),
    });

    expect(sizes.sort((a, b) => a - b)).toEqual([2, 4, 4]);
    expect(progress.at(-1)).toBe(1);
  });

  it("skips parts already uploaded by a previous attempt", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        return new Response(null, { status: 200 });
      }),
    );
    const progress: number[] = [];
    const pending = ticket();
    pending.completedParts = [1, 3];
    await uploadMultipart(new Blob([new Uint8Array(10)]), pending, {
      onProgress: (fraction) => progress.push(fraction),
    });

    expect(urls).toEqual(["https://r2.example/part-2"]);
    expect(progress[0]).toBeCloseTo(0.6);
    expect(progress.at(-1)).toBe(1);
  });
  it("retries a failed part", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return new Response(calls === 1 ? "temporary" : null, { status: calls === 1 ? 503 : 200 });
      }),
    );

    await uploadMultipart(new Blob([new Uint8Array(4)]), ticket([1]), {
      maxRetries: 2,
    });
    expect(calls).toBe(2);
  });

  it("fails after the retry limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("permanent", { status: 403 })),
    );

    await expect(
      uploadMultipart(new Blob([new Uint8Array(4)]), ticket([1]), { maxRetries: 3 }),
    ).rejects.toThrow(/403/);
  });
});
