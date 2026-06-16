"use server";

import { runScoringPipeline, type PipelineSummary } from "@/lib/pipeline";
import { requireAdmin } from "@/lib/auth";

export type RunResult =
  | { ok: true; summary: PipelineSummary }
  | { ok: false; error: string };

/** Server action used by the dashboard "Run morning pipeline" button.
 *  Admin-only, and runs entirely server-side so no secret reaches the browser. */
export async function runNowAction(): Promise<RunResult> {
  try {
    await requireAdmin();
    const summary = await runScoringPipeline();
    return { ok: true, summary };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
