"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorKey, type ActionState } from "@/lib/admin";
import { requireRole } from "@/lib/auth";
import { hashPassword, MIN_PASSWORD } from "@/lib/session";

const password = z.string().min(MIN_PASSWORD, "admin.errors.password").max(256, "admin.errors.password");

const newUser = z.object({
  username: z.string().trim().regex(/^[\w.-]{2,32}$/, "admin.errors.username"),
  name: z.string().trim().min(1, "admin.errors.required").max(80),
  role: z.enum(["owner", "staff"]),
  password,
});

export async function createUser(_: ActionState, form: FormData): Promise<ActionState> {
  const { user, admin } = await requireRole("owner");
  try {
    const input = newUser.parse(Object.fromEntries(form));
    if (await admin.findUser(input.username)) return { error: "admin.errors.user_taken" };
    await admin.createUser({ ...input, passwordHash: await hashPassword(input.password) }, user.id);
  } catch (e) {
    return { error: errorKey(e) };
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

const change = z.discriminatedUnion("op", [
  z.object({ op: z.literal("password"), id: z.coerce.number().int(), password }),
  z.object({ op: z.enum(["disable", "enable"]), id: z.coerce.number().int() }),
]);

export async function updateUser(_: ActionState, form: FormData): Promise<ActionState> {
  const { user, admin } = await requireRole("owner");
  try {
    const input = change.parse(Object.fromEntries(form));
    if (input.op === "disable" && input.id === user.id) return { error: "admin.errors.self" };
    await admin.updateUser(
      input.id,
      input.op === "password" ? { passwordHash: await hashPassword(input.password) } : { disabled: input.op === "disable" },
      user.id,
    );
  } catch (e) {
    return { error: errorKey(e) };
  }
  revalidatePath("/admin/users");
  return { ok: true };
}
