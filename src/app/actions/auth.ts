"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, isDatabaseConfigured } from "@/db";
import { loginTokens } from "@/db/schema";
import {
  clearSessionCookie,
  isAuthConfigured,
  ownerEmail,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { isEmailConfigured, sendLoginCode } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  generateOtpCode,
  hashOtpCode,
  isOtpUsable,
  normalizeEmail,
  verifyOtpCode,
} from "@/lib/domain/otp";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isAuthConfigured()) {
    return { error: "Set APP_PASSWORD and AUTH_SECRET in .env.local before signing in." };
  }
  const password = String(formData.get("password") ?? "");
  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    "local";

  if (!checkRateLimit(`login:${ip}`)) {
    return { error: "Too many attempts. Wait a few minutes before trying again." };
  }
  if (!verifyPassword(password, process.env.APP_PASSWORD!.trim())) {
    return { error: "Incorrect password." };
  }
  await setSessionCookie();
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

export type OtpRequestState = { error?: string; sent?: boolean; email?: string };

async function clientIp(): Promise<string> {
  const headerStore = await headers();
  return (
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    "local"
  );
}

function authSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) throw new Error("AUTH_SECRET is not configured.");
  return secret;
}

export async function requestLoginCode(
  _prev: OtpRequestState,
  formData: FormData,
): Promise<OtpRequestState> {
  if (!isAuthConfigured()) {
    return { error: "Set APP_PASSWORD and AUTH_SECRET in .env.local first." };
  }
  if (!isEmailConfigured()) {
    return { error: "Email sign-in is not configured. Add RESEND_API_KEY and OWNER_EMAIL." };
  }
  if (!isDatabaseConfigured()) {
    return { error: "The database is not configured, so a code cannot be stored." };
  }
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (email !== normalizeEmail(ownerEmail())) {
    return { error: "That address is not the workspace owner." };
  }
  const ip = await clientIp();
  if (!checkRateLimit(`otp-request:${ip}`, 3, 15 * 60 * 1000)) {
    return { error: "Too many code requests. Wait 15 minutes before trying again." };
  }
  if (!checkRateLimit(`otp-request:${email}`, 3, 15 * 60 * 1000)) {
    return { error: "Too many code requests. Wait 15 minutes before trying again." };
  }

  const code = generateOtpCode();
  const db = getDb();
  await db.delete(loginTokens).where(eq(loginTokens.email, email));
  await db.insert(loginTokens).values({
    email,
    codeHash: hashOtpCode(email, code, authSecret()),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  try {
    await sendLoginCode(email, code);
  } catch (error) {
    await db.delete(loginTokens).where(eq(loginTokens.email, email));
    return {
      error:
        error instanceof Error
          ? `Could not send the email: ${error.message}`
          : "Could not send the email.",
    };
  }
  return { sent: true, email };
}

export type OtpVerifyState = { error?: string };

export async function verifyLoginCode(
  _prev: OtpVerifyState,
  formData: FormData,
): Promise<OtpVerifyState> {
  if (!isAuthConfigured()) return { error: "Authentication is not configured." };
  if (!isDatabaseConfigured()) return { error: "The database is not configured." };
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  if (email !== normalizeEmail(ownerEmail())) {
    return { error: "That address is not the workspace owner." };
  }
  if (!/^\d{6}$/.test(code)) return { error: "Enter the six-digit code." };

  const ip = await clientIp();
  if (!checkRateLimit(`otp-verify:${ip}`, 12, 10 * 60 * 1000)) {
    return { error: "Too many attempts. Wait 10 minutes before trying again." };
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(loginTokens)
    .where(and(eq(loginTokens.email, email), isNull(loginTokens.usedAt)))
    .orderBy(desc(loginTokens.createdAt))
    .limit(1);
  const token = rows[0];
  if (!token || !isOtpUsable(token)) {
    return { error: "That code expired or was not requested. Send a new code." };
  }
  if (token.attempts >= OTP_MAX_ATTEMPTS) {
    return { error: "Too many wrong attempts for this code. Send a new code." };
  }

  if (!verifyOtpCode(email, code, token.codeHash, authSecret())) {
    await db
      .update(loginTokens)
      .set({ attempts: token.attempts + 1 })
      .where(eq(loginTokens.id, token.id));
    const left = OTP_MAX_ATTEMPTS - token.attempts - 1;
    return { error: `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.` };
  }

  await db.update(loginTokens).set({ usedAt: new Date() }).where(eq(loginTokens.email, email));
  await setSessionCookie();
  redirect("/dashboard");
}