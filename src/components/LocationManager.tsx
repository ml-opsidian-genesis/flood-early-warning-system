"use client";

import { useCallback, useEffect, useState } from "react";
import { RISK_COLORS, type RiskLevel } from "@/lib/risk";

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

export default function LocationManager() {
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/locations")
      .then((r) => r.json())
      .then((d) => setLocations(d.locations ?? []))
      .catch(() => setLocations([]));
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
      setNotice(null);
      setError(d.error ?? "Failed to delete");
      return;
    }
    load();
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">Monitored locations</h2>
        <button
          onClick={openModal}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Add location
        </button>
      </div>

      {notice && <p className="text-sm text-green-700">{notice}</p>}
      {!showModal && error && <p className="text-sm text-red-600">{error}</p>}

      {/* Risk values table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Location</th>
              <th>District</th>
              <th>Coordinates</th>
              <th>Risk value</th>
              <th>Regime</th>
              <th>Subs</th>
              <th>Scored</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  No locations yet.
                </td>
              </tr>
            ) : (
              locations.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{l.name}</td>
                  <td className="text-slate-500">{l.district}</td>
                  <td className="tabular-nums text-slate-500">
                    {l.latitude.toFixed(3)}, {l.longitude.toFixed(3)}
                  </td>
                  <td>
                    {l.score != null ? (
                      <span
                        className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: RISK_COLORS[l.riskLevel as RiskLevel] ?? "#64748b" }}
                      >
                        {l.riskLevel} {(l.score * 100).toFixed(0)}%
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
