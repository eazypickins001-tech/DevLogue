import "server-only";

import { redactSecrets } from "@/lib/domain/secrets";
import type { PlatformValue } from "@/lib/domain/content";
import type { GhlPostStatus, GhlPostType } from "@/lib/domain/publishing";

const BASE_URL = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

export class GhlError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(redactSecrets(message));
    this.name = "GhlError";
    this.status = status;
  }
}

export type GhlAccount = {
  id: string;
  name: string;
  platform: PlatformValue;
  rawPlatform: string;
  type: string | null;
};

type GhlConfig = { token: string; locationId: string };

export function isGhlConfigured(): boolean {
  return Boolean(process.env.GHL_API_TOKEN?.trim() && process.env.GHL_LOCATION_ID?.trim());
}

function config(): GhlConfig {
  const token = process.env.GHL_API_TOKEN?.trim();
  const locationId = process.env.GHL_LOCATION_ID?.trim();
  if (!token || !locationId) {
    throw new GhlError(
      "GoHighLevel is not configured. Set GHL_API_TOKEN and GHL_LOCATION_ID in .env.local.",
    );
  }
  return { token, locationId };
}

function mapPlatform(value: string | undefined): PlatformValue {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("instagram")) return "instagram";
  if (normalized.includes("facebook")) return "facebook";
  if (normalized.includes("tiktok")) return "tiktok";
  if (normalized.includes("youtube")) return "youtube";
  if (normalized.includes("threads")) return "threads";
  if (normalized.includes("linkedin")) return "linkedin";
  if (normalized.includes("bluesky")) return "bluesky";
  return "other";
}

async function ghlRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { token } = config();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: API_VERSION,
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message =
      (payload as { message?: string; error?: string } | null)?.message ??
      (payload as { error?: string } | null)?.error ??
      text.slice(0, 200) ??
      "Unknown error";
    throw new GhlError(`HighLevel ${response.status}: ${message}`, response.status);
  }
  return payload as T;
}

export async function listGhlAccounts(): Promise<GhlAccount[]> {
  const { locationId } = config();
  const payload = await ghlRequest<{
    accounts?: Array<Record<string, unknown>>;
    results?: { accounts?: Array<Record<string, unknown>> };
  }>(`/social-media-posting/${encodeURIComponent(locationId)}/accounts`);

  const accounts = payload.accounts ?? payload.results?.accounts ?? [];
  return accounts
    .map((account) => {
      const id = String(account.id ?? account._id ?? "");
      const rawPlatform = String(account.platform ?? "");
      return {
        id,
        name: String(account.name ?? account.username ?? account.accountName ?? "Unnamed account"),
        platform: mapPlatform(rawPlatform),
        rawPlatform,
        type: account.type ? String(account.type) : null,
      };
    })
    .filter((account) => account.id.length > 0);
}

export async function getGhlUserId(): Promise<string> {
  const existing = process.env.GHL_USER_ID?.trim();
  if (existing) return existing;
  const { locationId } = config();
  const payload = await ghlRequest<{ users?: Array<{ id?: string }> }>(
    `/users/?locationId=${encodeURIComponent(locationId)}`,
  );
  const userId = payload.users?.find((user) => user.id)?.id;
  if (!userId) throw new GhlError("No HighLevel user found for this location.");
  return userId;
}

export async function uploadMediaToGhl(input: {
  fileUrl: string;
  name: string;
}): Promise<{ fileId: string; url: string }> {
  const form = new FormData();
  form.set("hosted", "true");
  form.set("fileUrl", input.fileUrl);
  form.set("name", input.name);
  const payload = await ghlRequest<{ fileId?: string; url?: string }>("/medias/upload-file", {
    method: "POST",
    body: form,
  });
  if (!payload.fileId || !payload.url) {
    throw new GhlError("HighLevel did not return a media URL.");
  }
  return { fileId: payload.fileId, url: payload.url };
}

export async function uploadMediaFile(input: {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
}): Promise<{ fileId: string; url: string }> {
  const form = new FormData();
  const buffer = input.bytes.buffer.slice(
    input.bytes.byteOffset,
    input.bytes.byteOffset + input.bytes.byteLength,
  ) as ArrayBuffer;
  form.set("file", new Blob([buffer], { type: input.contentType }), input.filename);
  form.set("name", input.filename);
  const payload = await ghlRequest<{ fileId?: string; url?: string }>("/medias/upload-file", {
    method: "POST",
    body: form,
  });
  if (!payload.fileId || !payload.url) {
    throw new GhlError("HighLevel did not return a media URL.");
  }
  return { fileId: payload.fileId, url: payload.url };
}

export type GhlPostInput = {
  accountId: string;
  userId: string;
  summary: string;
  type: GhlPostType;
  status: GhlPostStatus;
  scheduledAt?: Date | null;
  media?: Array<{ url: string; type: "image" | "video" }>;
};

export type GhlPostResult = {
  postId: string | null;
  status: string;
  raw: Record<string, unknown>;
};

export async function createGhlPost(input: GhlPostInput): Promise<GhlPostResult> {
  const { locationId } = config();
  const body: Record<string, unknown> = {
    accountIds: [input.accountId],
    type: input.type,
    userId: input.userId,
    summary: input.summary,
    status: input.status,
  };
  if (input.status === "scheduled" && input.scheduledAt) {
    body.scheduleDate = input.scheduledAt.toISOString();
  }
  body.media = input.media ?? [];
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) delete body[key];
  }

  const payload = await ghlRequest<Record<string, unknown>>(
    `/social-media-posting/${encodeURIComponent(locationId)}/posts`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  const containers = [
    (payload.results as Record<string, unknown> | undefined)?.post,
    payload.post,
    payload.results,
    payload.data,
    payload,
  ].filter(
    (item): item is Record<string, unknown> => Boolean(item && typeof item === "object"),
  );
  let postId: string | null = null;
  for (const container of containers) {
    const candidate = container.id ?? container._id ?? container.postId;
    if (typeof candidate === "string" && candidate.length > 0) {
      postId = candidate;
      break;
    }
  }
  const statusCandidates = [
    payload.status,
    (payload.post as Record<string, unknown> | undefined)?.status,
    (payload.results as Record<string, unknown> | undefined)?.post &&
      ((payload.results as Record<string, unknown>).post as Record<string, unknown>)?.status,
  ];
  const status =
    (statusCandidates.find(
      (value) => typeof value === "string" && value.length > 0,
    ) as string | undefined) ?? input.status;

  return { postId, status, raw: payload };
}

export async function deleteGhlPost(postId: string): Promise<void> {
  const { locationId } = config();
  await ghlRequest(
    `/social-media-posting/${encodeURIComponent(locationId)}/posts/${encodeURIComponent(postId)}`,
    { method: "DELETE" },
  );
}