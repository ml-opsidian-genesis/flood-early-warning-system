import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

/** GET /api/admin/rescue-shelters — get all shelters ordered by createdAt desc */
export async function GET() {
  try {
    await requireAdmin();
    const shelters = await prisma.shelter.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ shelters });
  } catch (error) {
    console.error("GET /api/admin/rescue-shelters error:", error);
    return NextResponse.json({ error: "Unauthorized or server error" }, { status: 401 });
  }
}

/** POST /api/admin/rescue-shelters — add a new rescue shelter */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();

    const { name, address, latitude, longitude, capacity, facilities, contactInfo, description, status } = body;

    if (!name || !address || latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: "Missing required fields (name, address, latitude, longitude)" }, { status: 400 });
    }

    const shelter = await prisma.shelter.create({
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
    console.error("POST /api/admin/rescue-shelters error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
