import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getThresholds, saveThresholds } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  moderateMin: z.number().min(0).max(1),
  highMin: z.number().min(0).max(1),
  criticalMin: z.number().min(0).max(1),
  alertThreshold: z.number().min(0).max(1),
});

/** GET /api/admin/settings — current thresholds. */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ thresholds: await getThresholds() });
}

/** PUT /api/admin/settings — update thresholds. */
export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const saved = await saveThresholds(parsed.data);
    return NextResponse.json({ ok: true, thresholds: saved });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid thresholds" },
      { status: 400 },
    );
  }
}
