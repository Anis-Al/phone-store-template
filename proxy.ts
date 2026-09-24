import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_FORMAT } from "@/lib/session";

// Cheap gate for /admin: no well-formed session cookie → login page. The real check (signature,
// expiry, user, role) is requireRole() in lib/auth.ts, run by every admin page, action and route.
export function proxy(req: NextRequest) {
  const isLogin = req.nextUrl.pathname === "/admin/login";
  const res =
    isLogin || SESSION_FORMAT.test(req.cookies.get(SESSION_COOKIE)?.value ?? "")
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/admin/login", req.url), 303);
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
