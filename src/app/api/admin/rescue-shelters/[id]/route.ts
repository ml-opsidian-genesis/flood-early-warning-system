import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

/** PUT /api/admin/rescue-shelters/[id] — update a shelter */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    const id = params.id;
    const body = await req.json();

    const { name, address, latitude, longitude, capacity, facilities, contactInfo, description, status } = body;

    if (!name || !address || latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: "Missing required fields (name, address, latitude, longitude)" }, { status: 400 });
    }

    const shelter = await prisma.shelter.update({
      where: { id },
      data: {
        name,
        address,
        latitude,
        longitude,
        capacity: capacity ? parseInt(capacity) : null,
        facilities: facilities || [],
        contactInfo,
        description,
        status: status || "open",
      },
    });

    return NextResponse.json({ shelter });
  } catch (error) {
    console.error("PUT /api/admin/rescue-shelters/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** DELETE /api/admin/rescue-shelters/[id] — delete a shelter */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    const id = params.id;

    await prisma.shelter.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/rescue-shelters/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
