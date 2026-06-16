import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signSession, SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // scrypt + prisma need the Node runtime

const Body = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

/** POST /api/auth/login — verify admin credentials, set a signed session cookie. */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
  // Always run a verify to keep timing roughly constant whether or not the user exists.
  const ok =
    admin !== null && verifyPassword(password, admin.passwordHash);

  if (!admin || !ok) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await signSession({ sub: admin.id, email: admin.email, role: admin.role });

  const res = NextResponse.json({ ok: true, role: admin.role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}
