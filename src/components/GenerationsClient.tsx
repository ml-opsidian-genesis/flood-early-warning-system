"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RISK_COLORS, type RiskLevel } from "@/lib/risk";
import Pagination from "./Pagination";
import LoadingSpinner from "./LoadingSpinner";
import CardSkeleton from "./customComponents/CardSkeleton";

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

type ScoreRow = {
  locationId: string;
  name: string;
  district: string;
  score: number;
  riskLevel: string;
  weatherRegime: string | null;
  feedbackCount: number;
  features: unknown;
};

type FeedbackRow = {
  id: string;
  name: string;
  district: string;
  score: number;
  actualFlooded: boolean | null;
  accuracy: string | null;
  comment: string | null;
  reporter: string | null;
  createdAt: string;
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
  scores: ScoreRow[];
  feedbacks: FeedbackRow[];
};

type PredictionRow = {
  id: string;
  source: string;
  modelVersion: string;
  locationName: string | null;
  district: string | null;
  input: unknown;
  score: number;
  riskLevel: string;
  confidence: string;
  createdAt: string;
};

const GEN_PAGE = 10;
const SCORE_PAGE = 15;
const FB_PAGE = 15;
const PRED_PAGE = 15;
const RISK_LEVELS = ["Low", "Moderate", "High", "Critical"];
const SOURCES = ["predict", "predict/batch"];

const TABS: { id: "generations" | "predictions"; label: string }[] = [
  { id: "generations", label: "Generations" },
  { id: "predictions", label: "Predictions" },
];

export default function GenerationsClient() {
  const [tab, setTab] = useState<"generations" | "predictions">("generations");

  const [generations, setGenerations] = useState<Generation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingGens, setLoadingGens] = useState(false);

  // Generations list filter/pagination
  const [genSearch, setGenSearch] = useState("");
  const [genPage, setGenPage] = useState(1);

  // Scores table filter/pagination
  const [scoreSearch, setScoreSearch] = useState("");
  const [scoreRisk, setScoreRisk] = useState("");
  const [scorePage, setScorePage] = useState(1);

  // Feedback table pagination
  const [fbPage, setFbPage] = useState(1);

  // Predictions tab
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [predCounts, setPredCounts] = useState<Record<string, number>>({});
  const [predTotal, setPredTotal] = useState(0);
  const [loadingPred, setLoadingPred] = useState(false);
  const [predLoaded, setPredLoaded] = useState(false);
  const [predSearch, setPredSearch] = useState("");
  const [predSource, setPredSource] = useState("");
  const [predRisk, setPredRisk] = useState("");
  const [predPage, setPredPage] = useState(1);

  useEffect(() => {
    setLoadingGens(true);
    fetch("/api/admin/generations")
      .then((r) => r.json())
      .then((d) => {
        setGenerations(d.generations ?? []);
        if (d.generations?.[0]) setSelected(d.generations[0].date);
      })
      .catch(() => setGenerations([]))
      .finally(() => setLoadingGens(false));
  }, []);

  const loadDetail = useCallback((date: string) => {
    setLoadingDetail(true);
    setScoreSearch("");
    setScoreRisk("");
    setScorePage(1);
    setFbPage(1);
    fetch(`/api/admin/generations/${date}`)
      .then((r) => r.json())
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false));
  }, []);

  useEffect(() => {
    if (selected) loadDetail(selected);
  }, [selected, loadDetail]);

  // Lazy-load predictions only when the tab is first opened.
  useEffect(() => {
    if (tab !== "predictions" || predLoaded) return;
    setLoadingPred(true);
    fetch("/api/admin/predictions")
      .then((r) => r.json())
      .then((d) => {
        setPredictions(d.predictions ?? []);
        setPredCounts(d.counts ?? {});
        setPredTotal(d.total ?? 0);
      })
      .catch(() => setPredictions([]))
      .finally(() => {
        setLoadingPred(false);
        setPredLoaded(true);
      });
  }, [tab, predLoaded]);

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

  // Filtered + paginated generations list
  const filteredGens = useMemo(() => {
    const q = genSearch.trim().toLowerCase();
    if (!q) return generations;
    return generations.filter(
      (g) =>
        new Date(g.scoredFor).toLocaleDateString().toLowerCase().includes(q) ||
        (g.modelVersion ?? "").toLowerCase().includes(q),
    );
  }, [generations, genSearch]);
  const genTotalPages = Math.max(1, Math.ceil(filteredGens.length / GEN_PAGE));
  const genSafePage = Math.min(genPage, genTotalPages);
  const genPageRows = filteredGens.slice((genSafePage - 1) * GEN_PAGE, genSafePage * GEN_PAGE);

  // Filtered + paginated scores
  const filteredScores = useMemo(() => {
    if (!detail) return [];
    const q = scoreSearch.trim().toLowerCase();
    return detail.scores.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q) && !s.district.toLowerCase().includes(q)) return false;
      if (scoreRisk && s.riskLevel !== scoreRisk) return false;
      return true;
    });
  }, [detail, scoreSearch, scoreRisk]);
  const scoreTotalPages = Math.max(1, Math.ceil(filteredScores.length / SCORE_PAGE));
  const scoreSafePage = Math.min(scorePage, scoreTotalPages);
  const scorePageRows = filteredScores.slice(
    (scoreSafePage - 1) * SCORE_PAGE,
    scoreSafePage * SCORE_PAGE,
  );

  // Paginated feedback
  const feedbacks = detail?.feedbacks ?? [];
  const fbTotalPages = Math.max(1, Math.ceil(feedbacks.length / FB_PAGE));
  const fbSafePage = Math.min(fbPage, fbTotalPages);
  const fbPageRows = feedbacks.slice((fbSafePage - 1) * FB_PAGE, fbSafePage * FB_PAGE);

  // Filtered + paginated predictions
  const filteredPred = useMemo(() => {
    const q = predSearch.trim().toLowerCase();
    return predictions.filter((p) => {
      if (
        q &&
        !(p.locationName ?? "").toLowerCase().includes(q) &&
        !(p.district ?? "").toLowerCase().includes(q) &&
        !p.modelVersion.toLowerCase().includes(q)
      )
        return false;
      if (predSource && p.source !== predSource) return false;
      if (predRisk && p.riskLevel !== predRisk) return false;
      return true;
    });
  }, [predictions, predSearch, predSource, predRisk]);
  const predTotalPages = Math.max(1, Math.ceil(filteredPred.length / PRED_PAGE));
  const predSafePage = Math.min(predPage, predTotalPages);
  const predPageRows = filteredPred.slice((predSafePage - 1) * PRED_PAGE, predSafePage * PRED_PAGE);

  function handleScoreSearch(v: string) { setScoreSearch(v); setScorePage(1); }
  function handleScoreRisk(v: string) { setScoreRisk(v); setScorePage(1); }
  function handleGenSearch(v: string) { setGenSearch(v); setGenPage(1); }
  function handlePredSearch(v: string) { setPredSearch(v); setPredPage(1); }
  function handlePredSource(v: string) { setPredSource(v); setPredPage(1); }
  function handlePredRisk(v: string) { setPredRisk(v); setPredPage(1); }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Predictions &amp; feedback</h1>
        <p className="text-sm text-slate-500">
          Every morning prediction scores, the ground-truth feedback collected, and the raw
          prediction log from the model service.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-4 py-1.5 font-medium transition ${
              tab === t.id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "generations" && (
        <div className="space-y-6">
          {/* Generations list */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={genSearch}
                onChange={(e) => handleGenSearch(e.target.value)}
                placeholder="Search by date"
                className="min-w-[200px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
              />
              {genSearch && (
                <button
                  onClick={() => { setGenSearch(""); setGenPage(1); }}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
                >
                  Clear
                </button>
              )}
              <div className="ml-auto flex items-center gap-3">
                <span className="text-sm text-slate-400">{filteredGens.length} generation{filteredGens.length !== 1 ? "s" : ""}</span>
                <Pagination page={genSafePage} totalPages={genTotalPages} onPage={setGenPage} />
              </div>
            </div>

            <div className="card overflow-x-auto p-0">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Generation</th>
                    <th>Locations</th>
                    <th>Avg score</th>
                    <th>High-risk</th>
                    <th>Alerts</th>
                    <th>Feedbacks</th>
                    <th>Model</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingGens ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center">
                        <LoadingSpinner size="large" />
                      </td>
                    </tr>
                  ) : genPageRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                        {generations.length === 0
                          ? "No generations yet — run the pipeline."
                          : "No generations match the search."}
                      </td>
                    </tr>
                  ) : (
                    genPageRows.map((g) => (
                      <tr
                        key={g.date}
                        onClick={() => setSelected(g.date)}
                        className={`cursor-pointer border-t border-slate-100 ${selected === g.date ? "bg-blue-50" : "hover:bg-slate-50"
                          }`}
                      >
                        <td className="px-4 py-2 font-medium">
                          {new Date(g.scoredFor).toLocaleDateString()}
                        </td>
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
          </div>

          {/* Selected generation detail */}
          {selected && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  Generation {selected}{" "}
                  {loadingDetail && <span className="text-sm text-slate-400">loading…</span>}
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
                    <Stat label="Feedbacks" value={detail.summary.total} />
                    <Stat label="Flooded: yes" value={detail.summary.floodedYes} />
                    <Stat label="Flooded: no" value={detail.summary.floodedNo} />
                    <Stat label="Accurate" value={detail.summary.accurate} />
                    <Stat label="Too high" value={detail.summary.overestimated} />
                    <Stat label="Too low" value={detail.summary.underestimated} />
                  </div>

                  {/* Scores table with search + filter */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={scoreSearch}
                        onChange={(e) => handleScoreSearch(e.target.value)}
                        placeholder="Search location or district…"
                        className="min-w-[200px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                      />
                      <select
                        value={scoreRisk}
                        onChange={(e) => handleScoreRisk(e.target.value)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                      >
                        <option value="">All risk levels</option>
                        {RISK_LEVELS.map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                      {(scoreSearch || scoreRisk) && (
                        <button
                          onClick={() => { setScoreSearch(""); setScoreRisk(""); setScorePage(1); }}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
                        >
                          Clear
                        </button>
                      )}
                      <div className="ml-auto flex items-center gap-3">
                        <span className="text-sm text-slate-400">{filteredScores.length} location{filteredScores.length !== 1 ? "s" : ""}</span>
                        <Pagination page={scoreSafePage} totalPages={scoreTotalPages} onPage={setScorePage} />
                      </div>
                    </div>

                    <div className="card overflow-x-auto p-0">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                          <tr>
                            <th className="px-4 py-3">Location</th>
                            <th>Score</th>
                            <th>Level</th>
                            <th>Regime</th>
                            <th>Feedbacks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loadingDetail ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-6 text-center">
                                <LoadingSpinner size="large" />
                              </td>
                            </tr>
                          ) : scorePageRows.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                                No scores match the filters.
                              </td>
                            </tr>
                          ) : (
                            scorePageRows.map((s) => (
                              <tr key={s.locationId} className="border-t border-slate-100">
                                <td className="px-4 py-2 font-medium">
                                  {s.name}
                                  <span className="font-normal text-slate-400">, {s.district}</span>
                                </td>
                                <td className="tabular-nums">{s.score.toFixed(4)}</td>
                                <td>
                                  <span
                                    className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
                                    style={{
                                      backgroundColor: RISK_COLORS[s.riskLevel as RiskLevel] ?? "#64748b",
                                    }}
                                  >
                                    {s.riskLevel}
                                  </span>
                                </td>
                                <td className="text-slate-500">{s.weatherRegime ?? "—"}</td>
                                <td className="text-slate-500">{s.feedbackCount || "—"}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Feedback entries */}
                  <div className="card p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">Feedback entries ({feedbacks.length})</h3>
                      <Pagination page={fbSafePage} totalPages={fbTotalPages} onPage={setFbPage} />
                    </div>
                    {feedbacks.length === 0 ? (
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
                            {fbPageRows.map((f) => (
                              <tr key={f.id} className="border-t border-slate-100">
                                <td className="py-2">
                                  {f.name}, {f.district}
                                </td>
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
                                <td
                                  className="max-w-xs truncate text-slate-500"
                                  title={f.comment ?? ""}
                                >
                                  {f.comment ?? "—"}
                                </td>
                                <td className="text-slate-400">
                                  {new Date(f.createdAt).toLocaleString()}
                                </td>
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
      )}

      {tab === "predictions" && (
        <div className="space-y-4">
          {loadingPred ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <CardSkeleton label="Total predictions" />
              <CardSkeleton label="Via /predict" />
              <CardSkeleton label="Via /predict/batch" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Stat label="Total predictions" value={predTotal} />
              <Stat label="Via /predict" value={predCounts.predict ?? 0} />
              <Stat label="Via /predict/batch" value={predCounts["predict/batch"] ?? 0} />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={predSearch}
              onChange={(e) => handlePredSearch(e.target.value)}
              placeholder="Search location, district, or model version…"
              className="min-w-[240px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
            />
            <select
              value={predSource}
              onChange={(e) => handlePredSource(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
            >
              <option value="">All sources</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={predRisk}
              onChange={(e) => handlePredRisk(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
            >
              <option value="">All risk levels</option>
              {RISK_LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            {(predSearch || predSource || predRisk) && (
              <button
                onClick={() => { setPredSearch(""); setPredSource(""); setPredRisk(""); setPredPage(1); }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
              >
                Clear
              </button>
            )}
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-slate-400">{filteredPred.length} result{filteredPred.length !== 1 ? "s" : ""}</span>
              <Pagination page={predSafePage} totalPages={predTotalPages} onPage={setPredPage} />
            </div>
          </div>

          <div className="card overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th>Source</th>
                  <th>Location</th>
                  <th>Model</th>
                  <th>Score</th>
                  <th>Level</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {loadingPred ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center">
                      <LoadingSpinner size="large" />
                    </td>
                  </tr>
                ) : predPageRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                      {predictions.length === 0
                        ? "No predictions logged yet."
                        : "No predictions match the filters."}
                    </td>
                  </tr>
                ) : (
                  predPageRows.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100 align-top">
                      <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                        {new Date(p.createdAt).toLocaleString()}
                      </td>
                      <td className="text-slate-500">{p.source}</td>
                      <td className="font-medium">
                        {p.locationName ? (
                          <>
                            {p.locationName}
                            <span className="font-normal text-slate-400">, {p.district}</span>
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="text-slate-400">{p.modelVersion}</td>
                      <td className="tabular-nums">{p.score.toFixed(4)}</td>
                      <td>
                        <span
                          className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: RISK_COLORS[p.riskLevel as RiskLevel] ?? "#64748b" }}
                        >
                          {p.riskLevel}
                        </span>
                      </td>
                      <td className="text-slate-500">{p.confidence}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
