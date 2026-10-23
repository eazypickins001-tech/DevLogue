import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import {
  SESSION_TTL_MS,
  createSessionToken,
  verifySessionToken,
} from "@/lib/session";

export { verifyPassword } from "@/lib/session";

export const SESSION_COOKIE = "devlogue_session";

export function isAuthConfigured(): boolean {
  return Boolean(process.env.APP_PASSWORD?.trim() && process.env.AUTH_SECRET?.trim());
}

export function ownerEmail(): string {
  return process.env.OWNER_EMAIL?.trim() || "owner@devlogue.local";
}

function authSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured. Add it to .env.local.");
  }
  return secret;
}

export async function setSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(authSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function hasSession(): Promise<boolean> {
  if (!isAuthConfigured()) return false;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token, authSecret()) : false;
}

export async function requireSession(): Promise<void> {
  if (!(await hasSession())) redirect("/login");
}

export async function getOwner(): Promise<{ id: string; email: string }> {
  const db = getDb();
  const email = ownerEmail();
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return { id: existing[0].id, email: existing[0].email };
  const inserted = await db
    .insert(users)
    .values({ email, name: "Owner" })
    .onConflictDoNothing({ target: users.email })
    .returning();
  if (inserted[0]) return { id: inserted[0].id, email: inserted[0].email };
  const again = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!again[0]) throw new Error("Could not create the owner account.");
  return { id: again[0].id, email: again[0].email };
}
