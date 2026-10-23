import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type Database = NeonHttpDatabase<typeof schema>;

export class DatabaseUnconfiguredError extends Error {
  constructor() {
    super(
      "DATABASE_URL is not set. Add your Neon Postgres connection string to .env.local, then run pnpm db:migrate.",
    );
    this.name = "DatabaseUnconfiguredError";
  }
}

let cached: Database | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getDb(): Database {
  if (cached) return cached;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new DatabaseUnconfiguredError();
  cached = drizzle(neon(url), { schema });
  return cached;
}

export { schema };
