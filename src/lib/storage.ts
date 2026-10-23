import "server-only";

import { AwsClient } from "aws4fetch";

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim() &&
      process.env.R2_BUCKET?.trim(),
  );
}

function settings() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("R2 is not configured. Set the four R2 environment variables.");
  }
  return { accountId, bucket, accessKeyId, secretAccessKey };
}

function client(): AwsClient {
  const { accessKeyId, secretAccessKey } = settings();
  return new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
}

function objectUrl(key: string): string {
  const { accountId, bucket } = settings();
  const encodedKey = key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${encodedKey}`;
}

export async function presignPut(key: string, expiresSeconds = 900): Promise<string> {
  const url = new URL(objectUrl(key));
  url.searchParams.set("X-Amz-Expires", String(expiresSeconds));
  const signed = await client().sign(url.toString(), {
    method: "PUT",
    aws: { signQuery: true },
  });
  return signed.url;
}

export async function presignGet(
  key: string,
  expiresSeconds = 900,
  disposition: "attachment" | "inline" = "attachment",
): Promise<string> {
  const url = new URL(objectUrl(key));
  url.searchParams.set("X-Amz-Expires", String(expiresSeconds));
  url.searchParams.set("response-content-disposition", disposition);
  const signed = await client().sign(url.toString(), {
    method: "GET",
    aws: { signQuery: true },
  });
  return signed.url;
}

export async function readObjectPrefix(key: string, bytes = 32): Promise<Uint8Array | null> {
  const signed = await client().sign(objectUrl(key), {
    method: "GET",
    headers: { Range: `bytes=0-${bytes - 1}` },
  });
  const response = await fetch(signed.url, {
    method: "GET",
    headers: signed.headers,
  });
  if (!response.ok) return null;
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function headObject(
  key: string,
): Promise<{ size: number; contentType: string | null } | null> {
  const signed = await client().sign(objectUrl(key), { method: "HEAD" });
  const response = await fetch(signed.url, { method: "HEAD", headers: signed.headers });
  if (!response.ok) return null;
  const size = Number(response.headers.get("content-length") ?? "0");
  return { size, contentType: response.headers.get("content-type") };
}

export async function probeStorage(): Promise<{ ok: boolean; detail: string }> {
  try {
    const signed = await client().sign(objectUrl("__devlogue_probe__"), { method: "HEAD" });
    const response = await fetch(signed.url, { method: "HEAD", headers: signed.headers });
    if (response.status === 403) {
      return { ok: false, detail: "R2 rejected the credentials (403)." };
    }
    return { ok: true, detail: `R2 reachable (probe status ${response.status}).` };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "R2 check failed." };
  }
}

export async function deleteObject(key: string): Promise<void> {
  const signed = await client().sign(objectUrl(key), { method: "DELETE" });
  const response = await fetch(signed.url, { method: "DELETE", headers: signed.headers });
  if (!response.ok && response.status !== 404) {
    throw new Error(`R2 delete failed with status ${response.status}.`);
  }
}

export function buildMediaKey(userId: string, filename: string): string {
  return `media/${userId}/${crypto.randomUUID()}/${filename}`;
}
