import { NextRequest, NextResponse } from "next/server";
import { runScoringPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev convenience when no secret configured
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  const header = req.headers.get("x-cron-secret");
  const query = new URL(req.url).searchParams.get("secret");
  return [bearer, header, query].includes(secret);
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runScoringPipeline();
    return NextResponse.json(summary);
  } catch (e) {
    return NextResponse.json(
      { error: "Pipeline failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}

// Vercel Cron issues a GET; manual triggers can use POST.
export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
