"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, isDatabaseConfigured } from "@/db";
import { loginTokens, users } from "@/db/schema";
import {
  clearSessionCookie,
  isAuthConfigured,
  ownerEmail,
  setSessionCookie,
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

export type OtpRequestState = { error?: string; sent?: boolean; email?: string };
export type OtpVerifyState = { error?: string };

const isProduction = process.env.NODE_ENV === "production";
const REQUEST_LIMIT = isProduction ? 3 : 50;
const VERIFY_LIMIT = isProduction ? 12 : 100;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

export async function requestLoginCode(
  _prev: OtpRequestState,
  formData: FormData,
): Promise<OtpRequestState> {
  if (!isAuthConfigured()) {
    return { error: "Set AUTH_SECRET in .env.local before signing in." };
  }
  if (!isEmailConfigured()) {
    return { error: "Email sign-in is not configured. Add RESEND_API_KEY." };
  }
  if (!isDatabaseConfigured()) {
    return { error: "The database is not configured, so a code cannot be stored." };
  }
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!EMAIL_PATTERN.test(email)) {
    return { error: "Enter a valid email address." };
  }
  const ip = await clientIp();
  if (!(await checkRateLimit(`otp-request:${ip}`, REQUEST_LIMIT, 15 * 60 * 1000))) {
    return { error: "Too many code requests. Wait 15 minutes before trying again." };
  }
  if (!(await checkRateLimit(`otp-request:${email}`, REQUEST_LIMIT, 15 * 60 * 1000))) {
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

export async function verifyLoginCode(
  _prev: OtpVerifyState,
  formData: FormData,
): Promise<OtpVerifyState> {
  if (!isAuthConfigured()) return { error: "Authentication is not configured." };
  if (!isDatabaseConfigured()) return { error: "The database is not configured." };
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  if (!EMAIL_PATTERN.test(email)) return { error: "Enter a valid email address." };
  if (!/^\d{6}$/.test(code)) return { error: "Enter the six-digit code." };

  const ip = await clientIp();
  if (!(await checkRateLimit(`otp-verify:${ip}`, VERIFY_LIMIT, 10 * 60 * 1000))) {
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

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  let user = existing[0];
  if (!user) {
    const inserted = await db
      .insert(users)
      .values({ email })
      .onConflictDoNothing({ target: users.email })
      .returning();
    user =
      inserted[0] ?? (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  }
  if (!user) return { error: "Could not create the account." };
  if (user.status !== "active") {
    return { error: "This account is suspended. Contact an administrator." };
  }

  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);
  const role = email === ownerEmail() || admins.length === 0 ? "admin" : user.role;

  await db
    .update(users)
    .set({ role, lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  await setSessionCookie(user.id);
  redirect("/dashboard");
}
