import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function guardSuperadmin() {
  try {
    const session = await requireAdmin();
    if (session.role !== "superadmin") throw new Error("forbidden");
    return { session, denied: null };
  } catch {
    return { session: null, denied: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
}

/** GET /api/admin/admins — list all admins (superadmin only). */
export async function GET() {
  const { denied } = await guardSuperadmin();
  if (denied) return denied;

  const admins = await prisma.admin.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, role: true, createdAt: true },
  });
  return NextResponse.json({ admins });
}

const CreateBody = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "superadmin"]),
});

/** POST /api/admin/admins — create a new admin (superadmin only). */
export async function POST(req: NextRequest) {
  const { denied } = await guardSuperadmin();
  if (denied) return denied;

  const parsed = CreateBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { email, password, role } = parsed.data;
  const normalised = email.toLowerCase();

  const existing = await prisma.admin.findUnique({ where: { email: normalised } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }

  const admin = await prisma.admin.create({
    data: { email: normalised, passwordHash: hashPassword(password), role },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, admin }, { status: 201 });
}

/** DELETE /api/admin/admins?id=... — remove an admin (superadmin only, cannot remove self). */
export async function DELETE(req: NextRequest) {
  const { session, denied } = await guardSuperadmin();
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  if (id === session!.sub) {
    return NextResponse.json({ error: "You cannot remove your own account" }, { status: 400 });
  }

  const admin = await prisma.admin.findUnique({ where: { id } });
  if (!admin) return NextResponse.json({ error: "Admin not found" }, { status: 404 });

  if (admin.role === "superadmin") {
    return NextResponse.json({ error: "Superadmin accounts cannot be removed" }, { status: 403 });
  }

  await prisma.admin.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
