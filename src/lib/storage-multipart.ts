import "server-only";

import { storageClient, storageObjectUrl } from "@/lib/storage";

export const MULTIPART_PART_SIZE = 16 * 1024 * 1024;
export const MULTIPART_THRESHOLD = MULTIPART_PART_SIZE;

export type MultipartPart = {
  partNumber: number;
  etag: string;
  size: number;
};

function xmlText(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function tagValue(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
  return match ? xmlText(match[1].trim()) : null;
}

function responseError(status: number, body: string): Error {
  const message = tagValue(body, "Message");
  const code = tagValue(body, "Code");
  return new Error(
    `R2 multipart request failed (${status})${code ? ` ${code}` : ""}${message ? `: ${message}` : ""}.`,
  );
}

export async function createMultipartUpload(
  key: string,
  contentType: string,
): Promise<string> {
  const url = new URL(storageObjectUrl(key));
  url.searchParams.set("uploads", "");
  const signed = await storageClient().sign(url.toString(), {
    method: "POST",
    headers: { "content-type": contentType },
  });
  const response = await fetch(signed.url, { method: "POST", headers: signed.headers });
  const body = await response.text();
  if (!response.ok) throw responseError(response.status, body);
  const uploadId = tagValue(body, "UploadId");
  if (!uploadId) throw new Error("R2 did not return a multipart upload id.");
  return uploadId;
}

export async function presignUploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresSeconds = 3600,
): Promise<string> {
  const url = new URL(storageObjectUrl(key));
  url.searchParams.set("partNumber", String(partNumber));
  url.searchParams.set("uploadId", uploadId);
  url.searchParams.set("X-Amz-Expires", String(expiresSeconds));
  const signed = await storageClient().sign(url.toString(), {
    method: "PUT",
    aws: { signQuery: true },
  });
  return signed.url;
}

export async function listMultipartParts(key: string, uploadId: string): Promise<MultipartPart[]> {
  const url = new URL(storageObjectUrl(key));
  url.searchParams.set("uploadId", uploadId);
  const signed = await storageClient().sign(url.toString(), { method: "GET" });
  const response = await fetch(signed.url, { method: "GET", headers: signed.headers });
  const body = await response.text();
  if (!response.ok) throw responseError(response.status, body);
  return [...body.matchAll(/<Part>([\s\S]*?)<\/Part>/g)]
    .map((match) => ({
      partNumber: Number(tagValue(match[1], "PartNumber") ?? 0),
      etag: tagValue(match[1], "ETag") ?? "",
      size: Number(tagValue(match[1], "Size") ?? 0),
    }))
    .filter((part) => part.partNumber > 0 && part.etag);
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: MultipartPart[],
): Promise<void> {
  const body = `<CompleteMultipartUpload>${parts
    .map(
      (part) =>
        `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${part.etag}</ETag></Part>`,
    )
    .join("")}</CompleteMultipartUpload>`;
  const url = new URL(storageObjectUrl(key));
  url.searchParams.set("uploadId", uploadId);
  const signed = await storageClient().sign(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/xml" },
    body,
  });
  const response = await fetch(signed.url, {
    method: "POST",
    headers: signed.headers,
    body,
  });
  if (!response.ok) throw responseError(response.status, await response.text());
}

export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  const url = new URL(storageObjectUrl(key));
  url.searchParams.set("uploadId", uploadId);
  const signed = await storageClient().sign(url.toString(), { method: "DELETE" });
  const response = await fetch(signed.url, { method: "DELETE", headers: signed.headers });
  if (!response.ok && response.status !== 404) {
    throw responseError(response.status, await response.text());
  }
}

export function partCountFor(sizeBytes: number, partSize = MULTIPART_PART_SIZE): number {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return 0;
  return Math.ceil(sizeBytes / partSize);
}
