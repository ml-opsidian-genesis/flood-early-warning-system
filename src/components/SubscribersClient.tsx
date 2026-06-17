"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import Pagination from "./Pagination";
import { Skeleton, Spin } from "antd";

type Sub = {
  id: string;
  phone: string;
  verified: boolean;
  createdAt: string;
  locationIds: string[];
  locations: { id: string; name: string; district: string }[];
};

type Loc = { id: string; name: string; district: string };

const PAGE_SIZE = 15;

export default function SubscribersClient() {
  const [subscribers, setSubscribers] = useState<Sub[]>([]);
  const [allLocations, setAllLocations] = useState<Loc[]>([]);
  const [editing, setEditing] = useState<Sub | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/subscribers")
      .then((r) => r.json())
      .then((d) => setSubscribers(d.subscribers ?? []))
      .catch(() => setSubscribers([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    fetch("/api/admin/locations")
      .then((r) => r.json())
      .then((d) =>
        setAllLocations(
          (d.locations ?? []).map((l: Loc) => ({ id: l.id, name: l.name, district: l.district })),
        ),
      )
      .catch(() => setAllLocations([]));
  }, [load]);

  const stats = useMemo(() => {
    const verified = subscribers.filter((s) => s.verified).length;
    const subs = subscribers.reduce((n, s) => n + s.locationIds.length, 0);
    return { total: subscribers.length, verified, subs };
  }, [subscribers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subscribers.filter((s) => {
      if (q && !s.phone.toLowerCase().includes(q)) return false;
      if (statusFilter === "verified" && !s.verified) return false;
      if (statusFilter === "unverified" && s.verified) return false;
      return true;
    });
  }, [subscribers, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleSearch(v: string) { setSearch(v); setPage(1); }
  function handleStatus(v: string) { setStatusFilter(v); setPage(1); }

  function openEdit(s: Sub) {
    setEditing(s);
    setSelected(new Set(s.locationIds));
    setError(null);
  }

  function Card({ label, value }: { label: string; value: ReactNode }) {
    return (
      <div className="card p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
      </div>
    );
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/subscribers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriberId: editing.id, locationIds: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setEditing(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe(s: Sub) {
    if (!confirm(`Remove subscriber ${s.phone}? They'll be notified and all their alerts removed.`)) return;
    const res = await fetch(`/api/admin/subscribers?id=${s.id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subscribers</h1>
        <p className="text-sm text-slate-500">Manage who receives alerts and the locations they follow.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          <Card label="Subscribers" value={<Skeleton active paragraph={false} />} />
          <Card label="Verified" value={<Skeleton active paragraph={false} />} />
          <Card label="Subscriptions" value={<Skeleton active paragraph={false} />} />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Subscribers" value={stats.total} />
          <Stat label="Verified" value={stats.verified} />
          <Stat label="Subscriptions" value={stats.subs} />
        </div>
      )}

      {/* Search & filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by phone…"
          className="min-w-[200px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => handleStatus(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
        >
          <option value="">All statuses</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
        </select>
        {(search || statusFilter) && (
          <button
            onClick={() => { setSearch(""); setStatusFilter(""); setPage(1); }}
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
              <th className="px-4 py-3">Phone</th>
              <th>Status</th>
              <th>Joined</th>
              <th className="w-1/2">Locations</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center">
                  <Spin size="large" />
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  {subscribers.length === 0 ? "No subscribers yet." : "No subscribers match the filters."}
                </td>
              </tr>
            ) : (
              pageRows.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 font-medium">{s.phone}</td>
                  <td>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${s.verified ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                        }`}
                    >
                      {s.verified ? "verified" : "unverified"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-slate-500">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3">
                    {s.locations.length === 0 ? (
                      <span className="text-slate-400">none</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {s.locations.map((l) => (
                          <span
                            key={l.id}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs"
                          >
                            {l.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 text-right">
                    <button
                      onClick={() => openEdit(s)}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => unsubscribe(s)}
                      className="ml-3 text-xs font-medium text-red-600 hover:underline"
                    >
                      Unsubscribe
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !busy && setEditing(null)}
        >
          <div
            className="card flex max-h-[85vh] w-full max-w-md flex-col p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-lg font-semibold">Edit locations</h3>
            <p className="mb-3 text-sm text-slate-500">
              {editing.phone} — {selected.size} selected
            </p>
            <div className="mb-3 flex-1 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {allLocations.map((l) => (
                <label
                  key={l.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(l.id)}
                    onChange={() => toggle(l.id)}
                  />
                  <span>{l.name}</span>
                  <span className="text-xs text-slate-400">{l.district}</span>
                </label>
              ))}
            </div>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                disabled={busy}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={busy}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
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
