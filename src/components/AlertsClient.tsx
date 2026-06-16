"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RISK_COLORS, type RiskLevel } from "@/lib/risk";
import Pagination from "./Pagination";

type AlertRow = {
  id: string;
  phone: string;
  locationName: string;
  district: string;
  score: number;
  riskLevel: string;
  channel: string;
  status: string;
  detail: string | null;
  createdAt: string;
};

const STATUS_STYLES: Record<string, string> = {
  sent: "bg-green-100 text-green-800",
  simulated: "bg-slate-100 text-slate-600",
  failed: "bg-red-100 text-red-700",
};

const PAGE_SIZE = 20;
const RISK_LEVELS = ["Low", "Moderate", "High", "Critical"];

export default function AlertsClient() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    fetch("/api/admin/alerts")
      .then((r) => r.json())
      .then((d) => {
        setAlerts(d.alerts ?? []);
        setCounts(d.counts ?? {});
        setTotal(d.total ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(load, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return alerts.filter((a) => {
      if (q && !a.phone.toLowerCase().includes(q) && !a.locationName.toLowerCase().includes(q) && !a.district.toLowerCase().includes(q)) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      if (riskFilter && a.riskLevel !== riskFilter) return false;
      return true;
    });
  }, [alerts, search, statusFilter, riskFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleSearch(v: string) { setSearch(v); setPage(1); }
  function handleStatus(v: string) { setStatusFilter(v); setPage(1); }
  function handleRisk(v: string) { setRiskFilter(v); setPage(1); }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Alert delivery log</h1>
        <p className="text-sm text-slate-500">
          Every WhatsApp alert the pipeline attempted, newest first.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total attempts" value={total} />
        <Stat label="Sent" value={counts.sent ?? 0} />
        <Stat label="Failed" value={counts.failed ?? 0} />
        <Stat label="Simulated" value={counts.simulated ?? 0} />
      </div>

      {/* Search & filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search phone or location…"
          className="min-w-[220px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => handleStatus(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
        >
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="simulated">Simulated</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={riskFilter}
          onChange={(e) => handleRisk(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
        >
          <option value="">All risk levels</option>
          {RISK_LEVELS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        {(search || statusFilter || riskFilter) && (
          <button
            onClick={() => { setSearch(""); setStatusFilter(""); setRiskFilter(""); setPage(1); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
          >
            Clear
          </button>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-slate-400">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
          <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th>Location</th>
              <th>Phone</th>
              <th>Risk</th>
              <th>Channel</th>
              <th>Status</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  {alerts.length === 0
                    ? "No alerts yet. Run the pipeline when a subscribed location is high-risk."
                    : "No alerts match the current filters."}
                </td>
              </tr>
            ) : (
              pageRows.map((a) => (
                <tr key={a.id} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                    {new Date(a.createdAt).toLocaleString()}
                  </td>
                  <td className="font-medium">
                    {a.locationName}
                    <span className="font-normal text-slate-400">, {a.district}</span>
                  </td>
                  <td className="text-slate-500">{a.phone}</td>
                  <td>
                    <span
                      className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: RISK_COLORS[a.riskLevel as RiskLevel] ?? "#64748b" }}
                    >
                      {a.riskLevel} {(a.score * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="text-slate-500">{a.channel}</td>
                  <td>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLES[a.status] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="max-w-xs truncate text-xs text-slate-400" title={a.detail ?? ""}>
                    {a.detail ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
