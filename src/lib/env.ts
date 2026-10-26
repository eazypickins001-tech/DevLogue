import { isDatabaseConfigured } from "@/db";

export type ServiceStatus = {
  key: string;
  label: string;
  configured: boolean;
  requiredFor: string;
  envVars: string[];
  setup: string;
};

function has(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export function isAiConfigured(): boolean {
  const provider = (process.env.AI_PROVIDER ?? "openrouter").toLowerCase();
  if (provider === "openai-compatible") {
    return has("AI_BASE_URL") && has("AI_API_KEY");
  }
  return has("OPENROUTER_API_KEY");
}

export function aiProviderName(): string {
  return (process.env.AI_PROVIDER ?? "openrouter").toLowerCase();
}

export function getServiceStatuses(): ServiceStatus[] {
  return [
    {
      key: "auth",
      label: "Access protection",
      configured: has("APP_PASSWORD") && has("AUTH_SECRET"),
      requiredFor: "Signing in",
      envVars: ["APP_PASSWORD", "AUTH_SECRET"],
      setup: "Set a long password and a random 32+ character AUTH_SECRET.",
    },
    {
      key: "database",
      label: "Neon Postgres",
      configured: isDatabaseConfigured(),
      requiredFor: "Projects, sessions, drafts and all persistence",
      envVars: ["DATABASE_URL"],
      setup: "Create a free Neon project, copy the pooled connection string, then run pnpm db:migrate.",
    },
    {
      key: "storage",
      label: "Cloudflare R2",
      configured:
        has("R2_ACCOUNT_ID") &&
        has("R2_ACCESS_KEY_ID") &&
        has("R2_SECRET_ACCESS_KEY") &&
        has("R2_BUCKET"),
      requiredFor: "Screenshots, recordings and rendered video",
      envVars: ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"],
      setup:
        "Create an R2 bucket and an S3 API token scoped to it, then set the four R2 variables.",
    },
    {
      key: "ai",
      label: "AI provider",
      configured: isAiConfigured(),
      requiredFor: "Session analysis and content generation",
      envVars:
        aiProviderName() === "openai-compatible"
          ? ["AI_BASE_URL", "AI_API_KEY"]
          : ["OPENROUTER_API_KEY"],
      setup:
        "Add an OpenRouter key (or set AI_PROVIDER=openai-compatible with a base URL and key). Model names are configured separately.",
    },
    {
      key: "worker",
      label: "Worker control",
      configured: has("WORKER_CONTROL_URL") && has("WORKER_CONTROL_TOKEN"),
      requiredFor: "Starting and stopping the render/transcription worker from the UI",
      envVars: ["WORKER_CONTROL_URL", "WORKER_CONTROL_TOKEN"],
      setup:
        "Run pnpm worker:control on the worker machine and expose it over HTTPS for Vercel, then add the URL and token.",
    },
    {
      key: "ghl",
      label: "GoHighLevel",
      configured: has("GHL_API_TOKEN") && has("GHL_LOCATION_ID") && has("GHL_USER_ID"),
      requiredFor: "Scheduling and publishing (phase 4)",
      envVars: ["GHL_API_TOKEN", "GHL_LOCATION_ID", "GHL_USER_ID"],
      setup:
        "Create a Private Integration Token with socialplanner scopes, then set the location and user IDs.",
    },
  ];
}
