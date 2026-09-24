"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { endSession, loginThrottle, startSession } from "@/lib/auth";
import { adminRepo } from "@/lib/data/repository";
import { hashPassword, verifyPassword } from "@/lib/session";

// The only admin actions that don't call requireRole(): they create or drop the session.

const credentials = z.object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(256) });

export async function login(form: FormData) {
  if (!adminRepo) notFound();
  const input = credentials.safeParse({ username: form.get("username"), password: form.get("password") });
  if (!input.success) redirect("/admin/login?error=invalid");
  const { username, password } = input.data;

  const throttle = await loginThrottle(username);
  if (throttle.blocked) redirect("/admin/login?error=rate");
  const user = await adminRepo.findUser(username);
  // Unknown users still pay for a hash, so response time doesn't reveal which usernames exist.
  const ok = user && !user.disabledAt ? await verifyPassword(password, user.passwordHash) : (await hashPassword(password), false);
  if (!user || !ok) {
    throttle.fail();
    redirect("/admin/login?error=invalid");
  }
  await startSession(user);
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin/login");
}
