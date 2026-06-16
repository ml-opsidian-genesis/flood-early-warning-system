import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

/** PUT /api/admin/profile/password — change the logged-in admin's password. */
export async function PUT(req: NextRequest) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { currentPassword, newPassword } = parsed.data;

  const admin = await prisma.admin.findUnique({ where: { id: session.sub } });
  if (!admin || !verifyPassword(currentPassword, admin.passwordHash)) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  await prisma.admin.update({
    where: { id: session.sub },
    data: { passwordHash: hashPassword(newPassword) },
  });

  return NextResponse.json({ ok: true });
}
