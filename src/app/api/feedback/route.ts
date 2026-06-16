import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const Body = z.object({
  locationId: z.string().min(1),
  scoredFor: z.string().min(1), // ISO date/datetime of the generation
  score: z.number().min(0).max(1),
  actualFlooded: z.boolean().nullable().optional(),
  accuracy: z.enum(["accurate", "overestimated", "underestimated"]).nullable().optional(),
  comment: z.string().trim().max(500).optional(),
  reporter: z.string().trim().max(120).optional(),
});

/** POST /api/feedback — public. Collects ground-truth feedback on a prediction. */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { locationId, scoredFor, score, actualFlooded, accuracy, comment, reporter } = parsed.data;

  // Require at least one signal so we don't store empty feedback.
  if (actualFlooded == null && !accuracy && !comment) {
    return NextResponse.json({ error: "Please provide at least one piece of feedback" }, { status: 400 });
  }

  const scoredForDate = new Date(scoredFor);
  if (Number.isNaN(scoredForDate.getTime())) {
    return NextResponse.json({ error: "Invalid generation date" }, { status: 400 });
  }

  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) {
    return NextResponse.json({ error: "Unknown location" }, { status: 400 });
  }

  await prisma.feedback.create({
    data: {
      locationId,
      scoredFor: scoredForDate,
      score,
      actualFlooded: actualFlooded ?? null,
      accuracy: accuracy ?? null,
      comment: comment || null,
      reporter: reporter || null,
    },
  });

  return NextResponse.json({ ok: true });
}
