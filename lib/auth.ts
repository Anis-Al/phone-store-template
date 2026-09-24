import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { adminRepo, type AdminRepository, type AdminUser, type Role } from "@/lib/data/repository";
import { SESSION_COOKIE, SESSION_TTL_MS, signSession, verifySession } from "@/lib/session";

// Server-only. Pages, Server Actions and route handlers under /admin call requireRole() themselves:
// proxy.ts is only a cheap redirect, and Server Actions are public POST endpoints.

function secret() {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters (openssl rand -base64 32)");
  return s;
}

export async function currentUser(): Promise<AdminUser | null> {
  if (!adminRepo) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? verifySession(token, secret()) : null;
  if (!session) return null;
  const user = await adminRepo.getUser(session.userId);
  // A password change or a disabled account bumps session_version: older cookies stop working.
  return user && !user.disabledAt && user.sessionVersion === session.version ? user : null;
}

/** No database → 404. No session → login. Staff on an owner-only area → 404. */
export async function requireRole(role: Role = "staff"): Promise<{ user: AdminUser; admin: AdminRepository }> {
  if (!adminRepo) notFound();
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  if (role === "owner" && user.role !== "owner") notFound();
  return { user, admin: adminRepo };
}

export async function startSession(user: AdminUser) {
  (await cookies()).set(SESSION_COOKIE, signSession(user.id, user.sessionVersion, secret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function endSession() {
  (await cookies()).delete({ name: SESSION_COOKIE, path: "/admin" });
}

// ponytail: in-memory, per-process counters (same as /api/orders). Redis if the admin ever runs on >1 instance.
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 5;
const failures = new Map<string, number[]>();
const recent = (key: string) => (failures.get(key) ?? []).filter((t) => Date.now() - t < WINDOW_MS);

/** Login throttle, per IP and per username: 5 failures per 15 minutes. */
export async function loginThrottle(username: string) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const keys = [`ip:${ip}`, `user:${username.toLowerCase()}`];
  return {
    blocked: keys.some((k) => recent(k).length >= MAX_FAILURES),
    fail: () => {
      if (failures.size > 5000) failures.clear(); // crude memory cap
      for (const k of keys) failures.set(k, [...recent(k), Date.now()]);
    },
  };
}
