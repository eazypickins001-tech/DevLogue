"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  clearSessionCookie,
  isAuthConfigured,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

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
