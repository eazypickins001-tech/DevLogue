import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { SESSION_TTL_MS, createSessionToken, verifySessionToken } from "@/lib/session";

export const SESSION_COOKIE = "devlogue_session";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "member";
  status: "active" | "suspended";
};

export function isAuthConfigured(): boolean {
  return Boolean(process.env.AUTH_SECRET?.trim());
}

export function ownerEmail(): string {
  return process.env.OWNER_EMAIL?.trim().toLowerCase() || "";
}

function authSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured. Add it to .env.local.");
  }
  return secret;
}

export async function setSessionCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(authSecret(), userId), {
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

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isAuthConfigured()) return null;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = token ? verifySessionToken(token, authSecret()) : null;
  if (!session) return null;

  const rows = await getDb()
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      status: users.status,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  const user = rows[0];
  if (!user || user.status !== "active") return null;
  return user;
}

export async function hasSession(): Promise<boolean> {
  return Boolean(await getCurrentUser());
}

export async function requireSession(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireSession();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}

export async function getOwner(): Promise<CurrentUser> {
  return requireSession();
}
