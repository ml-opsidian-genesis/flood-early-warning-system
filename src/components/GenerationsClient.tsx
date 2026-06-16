"use client";

import { useCallback, useEffect, useState } from "react";
import { RISK_COLORS, type RiskLevel } from "@/lib/risk";

type Generation = {
  date: string;
  scoredFor: string;
  locationCount: number;
  avgScore: number;
  feedbackCount: number;
  alertsSent: number;
  highRiskCount: number;
  modelVersion: string | null;
  ranAt: string | null;
};

type Detail = {
  date: string;
  summary: {
    total: number;
    floodedYes: number;
    floodedNo: number;
    accurate: number;
    overestimated: number;
    underestimated: number;
  };
  scores: {
    locationId: string;
    name: string;
    district: string;
    score: number;
    riskLevel: string;
    weatherRegime: string | null;
    feedbackCount: number;
    features: unknown;
  }[];
  feedbacks: {
    id: string;
    name: string;
    district: string;
    score: number;
    actualFlooded: boolean | null;
    accuracy: string | null;
    comment: string | null;
    reporter: string | null;
    createdAt: string;
  }[];
};

export default function GenerationsClient() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetch("/api/admin/generations")
      .then((r) => r.json())
      .then((d) => {
        setGenerations(d.generations ?? []);
        if (d.generations?.[0]) setSelected(d.generations[0].date);
      })
      .catch(() => setGenerations([]));
  }, []);

  const loadDetail = useCallback((date: string) => {
    setLoadingDetail(true);
    fetch(`/api/admin/generations/${date}`)
      .then((r) => r.json())
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false));
  }, []);

  useEffect(() => {
    if (selected) loadDetail(selected);
  }, [selected, loadDetail]);

  function downloadJson() {
    if (!detail) return;
    const blob = new Blob([JSON.stringify(detail, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `floodguard-generation-${detail.date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline generations &amp; feedback</h1>
        <p className="text-sm text-slate-500">
          Every morning generation, its predicted scores, and the ground-truth feedback collected —
          your retraining dataset.
        </p>
      </div>

      {/* Generations list */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Generation</th>
              <th>Locations</th>
              <th>Avg score</th>
              <th>High-risk</th>
              <th>Alerts</th>
              <th>Feedback</th>
              <th>Model</th>
            </tr>
          </thead>
          <tbody>
            {generations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No generations yet — run the pipeline.
                </td>
              </tr>
            ) : (
              generations.map((g) => (
                <tr
                  key={g.date}
                  onClick={() => setSelected(g.date)}
                  className={`cursor-pointer border-t border-slate-100 ${
                    selected === g.date ? "bg-blue-50" : "hover:bg-slate-50"
                  }`}
                >
                  <td className="px-4 py-2 font-medium">{new Date(g.scoredFor).toLocaleDateString()}</td>
                  <td className="text-slate-500">{g.locationCount}</td>
                  <td className="tabular-nums text-slate-500">{g.avgScore.toFixed(4)}</td>
                  <td className="text-slate-500">{g.highRiskCount}</td>
                  <td className="text-slate-500">{g.alertsSent}</td>
                  <td className="font-medium">{g.feedbackCount}</td>
                  <td className="text-slate-400">{g.modelVersion ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Selected generation detail */}
      {selected && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              Generation {selected} {loadingDetail && <span className="text-sm text-slate-400">loading…</span>}
            </h2>
            <button
              onClick={downloadJson}
              disabled={!detail}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
            >
              ⬇ Download training JSON
            </button>
          </div>

          {detail && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Stat label="Feedback" value={detail.summary.total} />
                <Stat label="Flooded: yes" value={detail.summary.floodedYes} />
                <Stat label="Flooded: no" value={detail.summary.floodedNo} />
                <Stat label="Accurate" value={detail.summary.accurate} />
                <Stat label="Too high" value={detail.summary.overestimated} />
                <Stat label="Too low" value={detail.summary.underestimated} />
              </div>

              {/* Scores for this generation */}
              <div className="card overflow-x-auto p-0">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Location</th>
                      <th>Score</th>
                      <th>Level</th>
                      <th>Regime</th>
                      <th>Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.scores.map((s) => (
                      <tr key={s.locationId} className="border-t border-slate-100">
                        <td className="px-4 py-2 font-medium">
                          {s.name}
                          <span className="font-normal text-slate-400">, {s.district}</span>
                        </td>
                        <td className="tabular-nums">{s.score.toFixed(4)}</td>
                        <td>
                          <span
                            className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
                            style={{ backgroundColor: RISK_COLORS[s.riskLevel as RiskLevel] ?? "#64748b" }}
                          >
                            {s.riskLevel}
                          </span>
                        </td>
                        <td className="text-slate-500">{s.weatherRegime ?? "—"}</td>
                        <td className="text-slate-500">{s.feedbackCount || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Feedback entries */}
              <div className="card p-5">
                <h3 className="mb-3 text-sm font-semibold">Feedback entries ({detail.feedbacks.length})</h3>
                {detail.feedbacks.length === 0 ? (
                  <p className="text-sm text-slate-400">No feedback collected for this generation.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="py-2">Location</th>
                          <th>Predicted</th>
                          <th>Flooded?</th>
                          <th>Accuracy</th>
                          <th>Comment</th>
                          <th>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.feedbacks.map((f) => (
                          <tr key={f.id} className="border-t border-slate-100">
                            <td className="py-2">{f.name}, {f.district}</td>
                            <td className="tabular-nums text-slate-500">{f.score.toFixed(4)}</td>
                            <td>
                              {f.actualFlooded === true ? (
                                <span className="text-red-600">Yes</span>
                              ) : f.actualFlooded === false ? (
                                <span className="text-green-600">No</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="text-slate-500">{f.accuracy ?? "—"}</td>
                            <td className="max-w-xs truncate text-slate-500" title={f.comment ?? ""}>
                              {f.comment ?? "—"}
                            </td>
                            <td className="text-slate-400">{new Date(f.createdAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-xl font-bold">{value}</div>
    </div>
  );
}
