import { mkdirSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";

// Plain-Node importable (scripts + tests): runtime imports are node builtins and @libsql/client only.

/** `file:.data/store.db` on a Node host (default), `libsql://…` for Turso. */
export function openDb(url = process.env.DATABASE_URL || "file:.data/store.db"): Client {
  if (url.startsWith("file:") && !url.includes(":memory:")) {
    mkdirSync(/*turbopackIgnore: true*/ path.dirname(url.slice(5)), { recursive: true });
  }
  // 5 s busy timeout: the server, a seed script and a backup can share the file.
  return createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN, timeout: 5000 });
}

/** Applies lib/db/migrations/*.sql in name order, once each (recorded in _migrations). */
export async function migrate(db: Client, dir = path.join(process.cwd(), "lib", "db", "migrations")) {
  await db.execute("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  if ((await db.execute("PRAGMA journal_mode")).rows[0]?.[0] === "delete") await db.execute("PRAGMA journal_mode = WAL");
  const done = new Set((await db.execute("SELECT name FROM _migrations")).rows.map((r) => String(r.name)));
  const applied: string[] = [];
  for (const name of (await readdir(/*turbopackIgnore: true*/ dir)).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(name)) continue;
    const sql = await readFile(/*turbopackIgnore: true*/ path.join(dir, name), "utf8");
    // One transaction per file: a failing migration leaves nothing half-applied.
    await db.executeMultiple(
      `BEGIN;\n${sql}\nINSERT INTO _migrations VALUES ('${name.replace(/'/g, "")}', '${new Date().toISOString()}');\nCOMMIT;`,
    );
    applied.push(name);
  }
  return applied;
}
