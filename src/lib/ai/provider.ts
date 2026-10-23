import "server-only";

import type { z } from "zod";
import { redactSecrets } from "@/lib/domain/secrets";

export class AiNotConfiguredError extends Error {
  constructor(message = "AI is not configured. Add a provider key and model names to .env.local.") {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}

export type AiTask = "analysis" | "content";

export type AiGeneration<T> = {
  data: T;
  provider: string;
  model: string;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: string | null;
  raw: string;
};

type ProviderConfig = {
  provider: string;
  url: string;
  apiKey: string;
  model: string;
};

function taskModel(task: AiTask): string {
  const model =
    task === "analysis"
      ? process.env.AI_MODEL_ANALYSIS?.trim() || process.env.AI_MODEL?.trim()
      : process.env.AI_MODEL_CONTENT?.trim() || process.env.AI_MODEL?.trim();
  if (!model) {
    throw new AiNotConfiguredError(
      `No model configured for ${task}. Set AI_MODEL (or ${
        task === "analysis" ? "AI_MODEL_ANALYSIS" : "AI_MODEL_CONTENT"
      }) in .env.local.`,
    );
  }
  return model;
}

function resolveProvider(task: AiTask): ProviderConfig {
  const provider = (process.env.AI_PROVIDER ?? "openrouter").trim().toLowerCase();
  if (provider === "openai-compatible") {
    const base = process.env.AI_BASE_URL?.trim();
    const apiKey = process.env.AI_API_KEY?.trim();
    if (!base || !apiKey) {
      throw new AiNotConfiguredError(
        "AI_PROVIDER=openai-compatible requires AI_BASE_URL and AI_API_KEY.",
      );
    }
    return {
      provider,
      url: `${base.replace(/\/+$/, "")}/chat/completions`,
      apiKey,
      model: taskModel(task),
    };
  }
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new AiNotConfiguredError(
      "OPENROUTER_API_KEY is not set. Add it to .env.local or switch AI_PROVIDER.",
    );
  }
  return {
    provider: "openrouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    apiKey,
    model: taskModel(task),
  };
}

type ChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number;
  };
  error?: { message?: string };
};

function parseJsonLoose(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new Error("Model returned content that is not valid JSON.");
  }
}

async function callModel(
  config: ProviderConfig,
  messages: Array<{ role: "system" | "user"; content: string }>,
): Promise<{ content: string; tokensIn: number | null; tokensOut: number | null; costUsd: string | null }> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await fetch(config.url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.4,
          max_tokens: 3000,
          response_format: { type: "json_object" },
        }),
      });
      const text = await response.text();
      let payload: ChatResponse = {};
      try {
        payload = JSON.parse(text) as ChatResponse;
      } catch {
        payload = {};
      }
      if (!response.ok) {
        const message = redactSecrets(payload.error?.message ?? `HTTP ${response.status}`);
        if ((response.status === 429 || response.status >= 500) && attempt < 2) {
          lastError = new Error(message);
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        throw new Error(`AI provider error (${response.status}): ${message}`);
      }
      const content = payload.choices?.[0]?.message?.content ?? "";
      if (!content.trim()) {
        throw new Error("AI provider returned an empty response.");
      }
      const cost =
        typeof payload.usage?.cost === "number" ? payload.usage.cost.toFixed(6) : null;
      return {
        content,
        tokensIn: payload.usage?.prompt_tokens ?? null,
        tokensOut: payload.usage?.completion_tokens ?? null,
        costUsd: cost,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`AI request failed: ${redactSecrets(lastError?.message ?? "unknown error")}`);
}

export async function generateStructured<T>(input: {
  task: AiTask;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  schemaName: string;
}): Promise<AiGeneration<T>> {
  const config = resolveProvider(input.task);
  const baseMessages = [
    { role: "system" as const, content: input.system },
    { role: "user" as const, content: input.user },
  ];
  const first = await callModel(config, baseMessages);
  let parsed: T | null = null;
  let lastRaw = first.content;
  let lastProblem = "";

  try {
    const result = input.schema.safeParse(parseJsonLoose(first.content));
    if (result.success) parsed = result.data;
    else lastProblem = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  } catch (error) {
    lastProblem = error instanceof Error ? error.message : "invalid JSON";
  }

  let tokensIn = first.tokensIn;
  let tokensOut = first.tokensOut;
  let costUsd = first.costUsd;

  if (parsed === null) {
    const repair = await callModel(config, [
      ...baseMessages,
      { role: "user" as const, content: `Your previous output failed validation (${lastProblem}). Return only corrected JSON for schema "${input.schemaName}". Previous output:\n${lastRaw}` },
    ]);
    lastRaw = repair.content;
    tokensIn = (tokensIn ?? 0) + (repair.tokensIn ?? 0);
    tokensOut = (tokensOut ?? 0) + (repair.tokensOut ?? 0);
    const result = input.schema.safeParse(parseJsonLoose(repair.content));
    if (!result.success) {
      throw new Error(
        `AI output did not match the expected structure: ${result.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    parsed = result.data;
  }

  return {
    data: parsed,
    provider: config.provider,
    model: config.model,
    tokensIn,
    tokensOut,
    costUsd,
    raw: lastRaw,
  };
}
