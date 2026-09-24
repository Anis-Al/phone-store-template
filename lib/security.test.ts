// Static security checks on the admin code. Server Actions are public POST endpoints and route
// handlers skip layouts, so each one must call requireRole() itself. Run: npm test
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const app = files("app").map((f) => f.split(path.sep).join("/"));
const src = (f: string) => readFileSync(f, "utf8");

/** Exported async functions of a file → the role passed to requireRole() in their body ("-" = none). */
function roles(file: string) {
  const code = src(file);
  const starts = [...code.matchAll(/export async function (\w+)/g)];
  return Object.fromEntries(
    starts.map((m, i) => {
      const body = code.slice(m.index, starts[i + 1]?.index ?? code.length);
      const call = body.match(/requireRole\((?:"(owner|staff)")?\)/);
      return [m[1], call ? (call[1] ?? "staff") : "-"];
    }),
  );
}

// Who may do what. staff = any signed-in user; owner = owner only.
const MATRIX: Record<string, Record<string, string>> = {
  "app/admin/login/actions.ts": { login: "-", logout: "-" }, // they create / drop the session
  "app/admin/(panel)/orders/actions.ts": { setStatus: "staff", saveNote: "staff" },
  "app/admin/(panel)/products/actions.ts": { saveVariant: "staff", setArchived: "owner", saveProduct: "owner", uploadImage: "owner" },
  "app/admin/(panel)/stock/actions.ts": { adjustStock: "staff", previewImport: "owner", applyImport: "owner" },
  "app/admin/(panel)/users/actions.ts": { createUser: "owner", updateUser: "owner" },
};

test("role matrix: every Server Action checks the expected role", () => {
  const actionFiles = app.filter((f) => /^\s*["']use server["']/.test(src(f)));
  assert.deepEqual(actionFiles.sort(), Object.keys(MATRIX).sort(), "a new 'use server' file must be added to MATRIX");
  for (const f of actionFiles) assert.deepEqual(roles(f), MATRIX[f], f);
});

test("admin route handlers and pages call requireRole()", () => {
  const gated = app.filter((f) => f.startsWith("app/admin/") && /\/(route|page)\.tsx?$/.test(f) && !f.startsWith("app/admin/login/"));
  assert.ok(gated.length >= 9);
  for (const f of gated) assert.match(src(f), /await requireRole\(/, f);
});

test("staff can't price: saveVariant ignores a price unless the user is owner", () => {
  assert.match(src("app/admin/(panel)/products/actions.ts"), /user\.role === "owner" && r\.price !== undefined/);
});
