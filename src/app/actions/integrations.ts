"use server";

import { sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { getOwner, isAuthConfigured, requireSession } from "@/lib/auth";
import { isAiConfigured } from "@/lib/env";
import { isStorageConfigured, probeStorage } from "@/lib/storage";
import { redactSecrets } from "@/lib/domain/secrets";

export type CheckResult = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
};

async function checkDatabase(): Promise<CheckResult> {
  const base = { key: "database", label: "Neon Postgres" };
  if (!isDatabaseConfigured()) {
    return { ...base, ok: false, detail: "DATABASE_URL is not set." };
  }
  try {
    await getDb().execute(sql`select 1`);
    return { ...base, ok: true, detail: "Connection succeeded." };
  } catch (error) {
    return {
      ...base,
      ok: false,
      detail: redactSecrets(error instanceof Error ? error.message : "Connection failed."),
    };
  }
}

async function checkAi(): Promise<CheckResult> {
  const base = { key: "ai", label: "AI provider" };
  if (!isAiConfigured()) return { ...base, ok: false, detail: "No AI provider key is set." };
  const provider = (process.env.AI_PROVIDER ?? "openrouter").toLowerCase();
  try {
    if (provider === "openai-compatible") {
      const baseUrl = process.env.AI_BASE_URL?.trim().replace(/\/+$/, "");
      const key = process.env.AI_API_KEY?.trim();
      if (!baseUrl || !key) return { ...base, ok: false, detail: "AI_BASE_URL or AI_API_KEY missing." };
      const response = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        return { ...base, ok: false, detail: `Provider returned HTTP ${response.status}.` };
      }
      return { ...base, ok: true, detail: "Provider reachable with the configured key." };
    }
    const key = process.env.OPENROUTER_API_KEY?.trim();
    if (!key) return { ...base, ok: false, detail: "OPENROUTER_API_KEY is not set." };
    const response = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return { ...base, ok: false, detail: `OpenRouter returned HTTP ${response.status}.` };
    }
    return { ...base, ok: true, detail: "OpenRouter key is valid." };
  } catch (error) {
    return {
      ...base,
      ok: false,
      detail: redactSecrets(error instanceof Error ? error.message : "AI check failed."),
    };
  }
}

async function checkStorage(): Promise<CheckResult> {
  const base = { key: "storage", label: "Cloudflare R2" };
  if (!isStorageConfigured()) return { ...base, ok: false, detail: "R2_* variables are incomplete." };
  const result = await probeStorage();
  return { ...base, ok: result.ok, detail: result.detail };
}

async function checkGhl(): Promise<CheckResult> {
  const base = { key: "ghl", label: "GoHighLevel" };
  const token = process.env.GHL_API_TOKEN?.trim();
  const locationId = process.env.GHL_LOCATION_ID?.trim();
  if (!token || !locationId) {
    return { ...base, ok: false, detail: "GHL_API_TOKEN or GHL_LOCATION_ID is not set." };
  }
  try {
    const response = await fetch(
      `https://services.leadconnectorhq.com/social-media-posting/${encodeURIComponent(locationId)}/accounts`,
      {
        headers: { Authorization: `Bearer ${token}`, Version: "2021-07-28", Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) {
      return {
        ...base,
        ok: false,
        detail: `HighLevel returned HTTP ${response.status}. Check the token scopes and location ID.`,
      };
    }
    const payload = (await response.json()) as {
      accounts?: unknown[];
      results?: { accounts?: unknown[] };
    };
    const accounts = payload.accounts ?? payload.results?.accounts ?? [];
    const count = Array.isArray(accounts) ? accounts.length : 0;
    return { ...base, ok: true, detail: `${count} connected social account(s) visible.` };
  } catch (error) {
    return {
      ...base,
      ok: false,
      detail: redactSecrets(error instanceof Error ? error.message : "HighLevel check failed."),
    };
  }
}

export async function runConnectionChecks(): Promise<CheckResult[]> {
  await requireSession();
  await getOwner();
  const auth: CheckResult = {
    key: "auth",
    label: "Access protection",
    ok: isAuthConfigured(),
    detail: isAuthConfigured() ? "Password and session secret are set." : "APP_PASSWORD or AUTH_SECRET missing.",
  };
  const [database, ai, storage, ghl] = await Promise.all([
    checkDatabase(),
    checkAi(),
    checkStorage(),
    checkGhl(),
  ]);
  return [auth, database, storage, ai, ghl];
}
