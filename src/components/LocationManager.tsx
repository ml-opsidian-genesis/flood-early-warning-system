"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RISK_COLORS, type RiskLevel } from "@/lib/risk";
import { Skeleton, Spin } from "antd";
import Pagination from "./Pagination";

type AdminLocation = {
  id: string;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  subscribers: number;
  score: number | null;
  riskLevel: string | null;
  weatherRegime: string | null;
  scoredFor: string | null;
};

const EMPTY = { name: "", district: "", latitude: "", longitude: "" };
const PAGE_SIZE = 15;
const RISK_LEVELS = ["Low", "Moderate", "High", "Critical"];

export default function LocationManager() {
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/locations")
      .then((r) => r.json())
      .then((d) => setLocations(d.locations ?? []))
      .catch(() => setLocations([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  function openModal() {
    setForm(EMPTY);
    setError(null);
    setShowModal(true);
  }

  function closeModal() {
    if (!busy) setShowModal(false);
  }

  async function addLocation(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          district: form.district,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add location");
      setNotice(`Added ${data.location.name}. Run the pipeline to score it.`);
      setShowModal(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add location");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete ${name}? This removes its scores and subscriptions.`)) return;
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/admin/locations?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to delete");
      return;
    }
    load();
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return locations.filter((l) => {
      if (q && !l.name.toLowerCase().includes(q) && !l.district.toLowerCase().includes(q)) return false;
      if (riskFilter === "Not scored") return l.riskLevel == null;
      if (riskFilter && l.riskLevel !== riskFilter) return false;
      return true;
    });
  }, [locations, search, riskFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleSearch(v: string) { setSearch(v); setPage(1); }
  function handleRisk(v: string) { setRiskFilter(v); setPage(1); }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Monitored locations</h2>
          <p className="text-sm text-slate-500">{locations.length} total</p>
        </div>
        <button
          onClick={openModal}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Add location
        </button>
      </div>

      {notice && <p className="text-sm text-green-700">{notice}</p>}
      {!showModal && error && <p className="text-sm text-red-600">{error}</p>}

      {/* Search & filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search name or district…"
          className="min-w-[200px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
        />
        <select
          value={riskFilter}
          onChange={(e) => handleRisk(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
        >
          <option value="">All risk levels</option>
          {RISK_LEVELS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
          <option value="Not scored">Not scored</option>
        </select>
        {(search || riskFilter) && (
          <button
            onClick={() => { setSearch(""); setRiskFilter(""); setPage(1); }}
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

      {/* Locations table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Location</th>
              <th>District</th>
              <th>Coordinates</th>
              <th>Score</th>
              <th>Level</th>
              <th>Regime</th>
              <th>Subs</th>
              <th>Scored</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center">
                  <Spin size="large" />
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-400">
                  {locations.length === 0 ? "No locations yet." : "No locations match the filters."}
                </td>
              </tr>
            ) : (
              pageRows.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{l.name}</td>
                  <td className="text-slate-500">{l.district}</td>
                  <td className="tabular-nums text-slate-500">
                    {l.latitude.toFixed(3)}, {l.longitude.toFixed(3)}
                  </td>
                  <td className="tabular-nums font-medium">
                    {l.score != null ? l.score.toFixed(4) : <span className="text-slate-400">—</span>}
                  </td>
                  <td>
                    {l.score != null ? (
                      <span
                        className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: RISK_COLORS[l.riskLevel as RiskLevel] ?? "#64748b" }}
                      >
                        {l.riskLevel}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">not scored</span>
                    )}
                  </td>
                  <td className="text-slate-500">{l.weatherRegime ?? "—"}</td>
                  <td className="tabular-nums text-slate-500">{l.subscribers}</td>
                  <td className="text-slate-400">
                    {l.scoredFor ? new Date(l.scoredFor).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 text-right">
                    <button
                      onClick={() => remove(l.id, l.name)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add-location modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-semibold">Add a monitored location</h3>
            <p className="mb-4 text-sm text-slate-500">
              Coordinates must be within Sri Lanka. New places are scored on the next pipeline run.
            </p>
            <form onSubmit={addLocation} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Place name</span>
                <input
                  value={form.name}
                  onChange={set("name")}
                  required
                  autoFocus
                  className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">District</span>
                <input
                  value={form.district}
                  onChange={set("district")}
                  required
                  className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Latitude</span>
                  <input
                    value={form.latitude}
                    onChange={set("latitude")}
                    placeholder="6.93"
                    inputMode="decimal"
                    required
                    className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Longitude</span>
                  <input
                    value={form.longitude}
                    onChange={set("longitude")}
                    placeholder="79.86"
                    inputMode="decimal"
                    required
                    className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                  />
                </label>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={busy}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {busy ? "Adding…" : "Add location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
