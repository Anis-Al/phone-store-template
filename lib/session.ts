import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Admin passwords and session tokens. Plain-Node importable (scripts, tests, proxy.ts): node:crypto only.

export const MIN_PASSWORD = 10;

const scryptAsync = (password: string, salt: Buffer, length: number) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, length, (err, key) => (err ? reject(err) : resolve(key))),
  );

/** `scrypt$<salt>$<key>` (base64url, N=16384 r=8 p=1). */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64url")}$${(await scryptAsync(password, salt, 64)).toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [alg, salt, key] = stored.split("$");
  if (alg !== "scrypt" || !salt || !key) return false;
  const want = Buffer.from(key, "base64url");
  return timingSafeEqual(want, await scryptAsync(password, Buffer.from(salt, "base64url"), want.length));
}

export const SESSION_COOKIE = "adm";
export const SESSION_TTL_MS = 7 * 86_400_000;
/** `userId.expires.sessionVersion.hmac`. proxy.ts only checks this shape; requireRole() checks the rest. */
export const SESSION_FORMAT = /^\d{1,15}\.\d{13}\.\d{1,15}\.[\w-]{43}$/;

const mac = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function signSession(userId: number, version: number, secret: string, now = Date.now()) {
  const payload = `${userId}.${now + SESSION_TTL_MS}.${version}`;
  return `${payload}.${mac(payload, secret)}`;
}

/** null if malformed, tampered or expired. The caller still checks the user and its session_version. */
export function verifySession(token: string, secret: string, now = Date.now()) {
  if (!SESSION_FORMAT.test(token)) return null;
  const cut = token.lastIndexOf(".");
  const payload = token.slice(0, cut);
  if (!timingSafeEqual(Buffer.from(token.slice(cut + 1)), Buffer.from(mac(payload, secret)))) return null;
  const [userId, expires, version] = payload.split(".").map(Number);
  return expires > now ? { userId, version, expires } : null;
}
