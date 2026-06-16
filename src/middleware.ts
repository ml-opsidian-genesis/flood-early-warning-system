import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession, isAdminRole } from "@/lib/session";

/** Gate admin-only areas. End-user routes (map, subscribe, verify) are public. */
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  const isAdmin = isAdminRole(session?.role);

  if (isAdmin) return NextResponse.next();

  const { pathname, search } = req.nextUrl;

  // API routes get a 401; pages redirect to the login screen.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/locations/:path*",
    "/subscribers/:path*",
    "/alerts/:path*",
    "/settings/:path*",
    "/api/stats/:path*",
    "/api/admin/:path*",
  ],
};
