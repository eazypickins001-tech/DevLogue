import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@neondatabase/serverless"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
