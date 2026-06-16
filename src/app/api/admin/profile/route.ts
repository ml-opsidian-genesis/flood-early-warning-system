import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { signSession, SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  email: z.string().trim().email(),
});

/** PUT /api/admin/profile — update email/username, re-signs the session cookie. */
export async function PUT(req: NextRequest) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const newEmail = parsed.data.email.toLowerCase();

  const existing = await prisma.admin.findUnique({ where: { email: newEmail } });
  if (existing && existing.id !== session.sub) {
    return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
  }

  await prisma.admin.update({ where: { id: session.sub }, data: { email: newEmail } });

  // Re-sign the session with the new email so the header stays accurate.
  const newToken = await signSession({ sub: session.sub, email: newEmail, role: session.role });
  const res = NextResponse.json({ ok: true, email: newEmail });
  res.cookies.set(SESSION_COOKIE, newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
