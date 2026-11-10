"use server";

import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin, requireSession } from "@/lib/auth";
import { redirectError, redirectSuccess } from "@/lib/forms";

const ROLES = ["admin", "member"] as const;
const STATUSES = ["active", "suspended"] as const;

async function anotherActiveAdmin(userId: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.status, "active"), ne(users.id, userId)))
    .limit(1);
  return rows.length > 0;
}

export async function updateUserRole(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!ROLES.includes(role as (typeof ROLES)[number])) {
    redirectError("/operations/users", "Choose a valid role.");
  }
  if (userId === admin.id) {
    redirectError("/operations/users", "You cannot change your own role.");
  }

  const rows = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  const target = rows[0];
  if (!target) redirectError("/operations/users", "User not found.");
  if (target.role === role) {
    redirectSuccess("/operations/users", `${target.email} already has that role.`);
  }
  if (target.role === "admin" && !(await anotherActiveAdmin(target.id))) {
    redirectError("/operations/users", "Keep at least one active admin.");
  }

  await getDb()
    .update(users)
    .set({ role: role as (typeof ROLES)[number], updatedAt: new Date() })
    .where(eq(users.id, target.id));
  redirectSuccess("/operations/users", `${target.email} is now ${role}.`);
}

export async function updateUserStatus(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    redirectError("/operations/users", "Choose a valid status.");
  }
  if (userId === admin.id) {
    redirectError("/operations/users", "You cannot change your own status.");
  }

  const rows = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  const target = rows[0];
  if (!target) redirectError("/operations/users", "User not found.");
  if (target.status === status) {
    redirectSuccess("/operations/users", `${target.email} already has that status.`);
  }
  if (target.role === "admin" && status === "suspended" && !(await anotherActiveAdmin(target.id))) {
    redirectError("/operations/users", "Keep at least one active admin.");
  }

  await getDb()
    .update(users)
    .set({ status: status as (typeof STATUSES)[number], updatedAt: new Date() })
    .where(eq(users.id, target.id));
  redirectSuccess(
    "/operations/users",
    status === "suspended" ? `${target.email} was suspended.` : `${target.email} was reactivated.`,
  );
}

export async function updateProfileName(formData: FormData): Promise<void> {
  const user = await requireSession();
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  await getDb()
    .update(users)
    .set({ name: name || null, updatedAt: new Date() })
    .where(eq(users.id, user.id));
  redirectSuccess("/settings", "Profile updated.");
}
