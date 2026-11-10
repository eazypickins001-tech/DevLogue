import type { NextConfig } from "next";

const requiredProductionEnv = ["AUTH_SECRET", "RESEND_API_KEY", "OWNER_EMAIL"];

if (process.env.VERCEL_ENV === "production") {
  const missing = requiredProductionEnv.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Refusing to build production without ${missing.join(", ")}. Add them in Vercel before deploying.`,
    );
  }
}

const nextConfig: NextConfig = {
  serverExternalPackages: ["@neondatabase/serverless"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
