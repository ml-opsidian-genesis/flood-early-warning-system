import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/rescue-shelters — get all open shelters for the public map */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const shelters = await prisma.shelter.findMany({
      where: { status: "open" },
    });
    return NextResponse.json({ shelters });
  } catch (error) {
    console.error("GET /api/rescue-shelters error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
