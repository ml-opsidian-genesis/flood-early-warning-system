"use client";

import { useState } from "react";
import type { LocationScore } from "./types";

type Accuracy = "accurate" | "overestimated" | "underestimated";

export default function FeedbackForm({ location }: { location: LocationScore }) {
  const [open, setOpen] = useState(false);
  const [flooded, setFlooded] = useState<boolean | null>(null);
  const [accuracy, setAccuracy] = useState<Accuracy | null>(null);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (location.score == null || !location.scoredFor) {
    return <p className="mt-1 text-xs text-slate-400">No score to give feedback on yet.</p>;
  }

  async function submit() {
    setError(null);
    if (flooded == null && !accuracy && !comment.trim()) {
      setError("Add at least one answer.");
      return;
    }
    setStatus("saving");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: location.id,
          scoredFor: location.scoredFor,
          score: location.score,
          actualFlooded: flooded,
          accuracy,
          comment: comment.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to submit");
    }
  }

  if (status === "done") {
    return <p className="mt-2 text-xs font-medium text-green-700">✅ Thanks for your feedback!</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="mt-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        Give feedback
      </button>
    );
  }

  const pill = (active: boolean) =>
    `rounded px-1.5 py-0.5 text-[11px] font-medium border ${active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 text-slate-600"
    }`;

  return (
    <div
      className="mt-2 space-y-2 border-t border-slate-100 pt-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div>
        <div className="mb-1 text-[11px] font-semibold text-slate-600">Did flooding actually occur?</div>
        <div className="flex gap-1">
          <button onClick={() => setFlooded(true)} className={pill(flooded === true)}>Yes</button>
          <button onClick={() => setFlooded(false)} className={pill(flooded === false)}>No</button>
          <button onClick={() => setFlooded(null)} className={pill(flooded === null)}>Unsure</button>
        </div>
      </div>
      <div>
        <div className="mb-1 text-[11px] font-semibold text-slate-600">Was this risk accurate?</div>
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setAccuracy("accurate")} className={pill(accuracy === "accurate")}>Accurate</button>
          <button onClick={() => setAccuracy("overestimated")} className={pill(accuracy === "overestimated")}>Too high</button>
          <button onClick={() => setAccuracy("underestimated")} className={pill(accuracy === "underestimated")}>Too low</button>
        </div>
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment…"
        rows={2}
        className="w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
      />
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={status === "saving"}
        className="w-full rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {status === "saving" ? "Submitting…" : "Submit feedback"}
      </button>
    </div>
  );
}
