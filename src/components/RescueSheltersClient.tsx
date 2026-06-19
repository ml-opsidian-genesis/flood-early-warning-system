"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import LoadingSpinner from "./LoadingSpinner";

const LocationPickerMap = dynamic(() => import("./LocationPickerMap"), {
  ssr: false,
  loading: () => <div className="h-full bg-slate-100 flex items-center justify-center text-slate-400 text-sm animate-pulse rounded-lg">Loading map...</div>,
});

type Shelter = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  capacity: number | null;
  facilities: string[];
  contactInfo: string | null;
  description: string | null;
  status: string;
  createdAt?: string;
};

export default function RescueSheltersClient() {
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Partial<Shelter> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facilityInput, setFacilityInput] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/rescue-shelters")
      .then((r) => r.json())
      .then((d) => setShelters(d.shelters ?? []))
      .catch(() => setShelters([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setEditing({ status: "open", facilities: [] });
    setIsNew(true);
    setError(null);
    setFacilityInput("");
  }

  function openEdit(s: Shelter) {
    setEditing({ ...s });
    setIsNew(false);
    setError(null);
    setFacilityInput("");
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editing.name || !editing.address || editing.latitude === undefined || editing.longitude === undefined) {
      setError("Name, address, latitude, and longitude are required.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const url = isNew ? "/api/admin/rescue-shelters" : `/api/admin/rescue-shelters/${editing.id}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");

      setEditing(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function deleteShelter(id: string) {
    if (!confirm("Are you sure you want to delete this shelter?")) return;
    try {
      const res = await fetch(`/api/admin/rescue-shelters/${id}`, { method: "DELETE" });
      if (res.ok) load();
      else alert("Failed to delete shelter.");
    } catch (e) {
      alert("Failed to delete shelter.");
    }
  }

  async function geocode() {
    if (!editing?.address) {
      alert("Please enter an address first.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(editing.address)}&format=json&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        setEditing({ ...editing, latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) });
      } else {
        alert("Location not found. Try a more specific address.");
      }
    } catch (e) {
      alert("Geocoding failed.");
    } finally {
      setBusy(false);
    }
  }

  function addFacility(e: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) {
    if ((e.type === "keydown" && (e as React.KeyboardEvent).key !== "Enter") || !facilityInput.trim()) return;
    e.preventDefault();
    if (!editing?.facilities?.includes(facilityInput.trim())) {
      setEditing((prev) => ({
        ...prev!,
        facilities: [...(prev?.facilities || []), facilityInput.trim()],
      }));
    }
    setFacilityInput("");
  }

  function removeFacility(fac: string) {
    setEditing((prev) => ({
      ...prev!,
      facilities: (prev?.facilities || []).filter((f) => f !== fac),
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rescue Shelters</h1>
          <p className="text-sm text-slate-500">Manage rescue shelters and safe zones.</p>
        </div>
        <button
          onClick={openAdd}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Add Shelter
        </button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th>Address</th>
              <th>Contact Info</th>
              <th>Capacity</th>
              <th>Status</th>
              <th className="w-1/3">Facilities</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center">
                  <LoadingSpinner size="large" />
                </td>
              </tr>
            ) : shelters.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No shelters found.
                </td>
              </tr>
            ) : (
              shelters.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="py-3 text-slate-600">{s.address}</td>
                  <td className="py-3 text-slate-600">{s.contactInfo ?? "N/A"}</td>
                  <td className="py-3 text-slate-600">{s.capacity ?? "N/A"}</td>
                  <td className="py-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        s.status === "open"
                          ? "bg-green-100 text-green-800"
                          : s.status === "full"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="py-3">
                    {s.facilities.length === 0 ? (
                      <span className="text-slate-400">none</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {s.facilities.map((f, i) => (
                          <span
                            key={i}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(s)}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteShelter(s.id)}
                      className="ml-3 text-xs font-medium text-red-600 hover:underline"
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

      {/* Add/Edit modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !busy && setEditing(null)}
        >
          <div
            className="card flex max-h-[90vh] w-full max-w-2xl flex-col p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold">{isNew ? "Add Shelter" : "Edit Shelter"}</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Name *</label>
                <input
                  type="text"
                  value={editing.name || ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                  placeholder="e.g. Town Hall Shelter"
                />
              </div>

              <div className="col-span-2 flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Address *</label>
                  <input
                    type="text"
                    value={editing.address || ""}
                    onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={geocode}
                  disabled={busy}
                  className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50 disabled:opacity-60"
                  type="button"
                >
                  Geocode
                </button>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Latitude *</label>
                <input
                  type="number"
                  step="any"
                  value={editing.latitude ?? ""}
                  onChange={(e) => setEditing({ ...editing, latitude: parseFloat(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Longitude *</label>
                <input
                  type="number"
                  step="any"
                  value={editing.longitude ?? ""}
                  onChange={(e) => setEditing({ ...editing, longitude: parseFloat(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div className="col-span-2 mb-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Map location (click to drop pin)</label>
                <div className="h-[250px] w-full rounded-lg overflow-hidden border border-slate-300">
                  <LocationPickerMap
                    lat={editing.latitude}
                    lng={editing.longitude}
                    onChange={(lat, lng) => setEditing({ ...editing, latitude: lat, longitude: lng })}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Capacity</label>
                <input
                  type="number"
                  value={editing.capacity ?? ""}
                  onChange={(e) => setEditing({ ...editing, capacity: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                  placeholder="Number of people"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                <select
                  value={editing.status || "open"}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                >
                  <option value="open">Open</option>
                  <option value="full">Full</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Contact Info</label>
                <input
                  type="text"
                  value={editing.contactInfo || ""}
                  onChange={(e) => setEditing({ ...editing, contactInfo: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                  placeholder="Phone number, email, etc."
                />
              </div>

              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Facilities (press Enter to add)</label>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    {editing.facilities?.map((f, i) => (
                      <span key={i} className="flex items-center gap-1 rounded bg-blue-100 px-2 py-1 text-sm text-blue-800">
                        {f}
                        <button type="button" onClick={() => removeFacility(f)} className="ml-1 text-blue-600 hover:text-blue-900">×</button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={facilityInput}
                    onChange={(e) => setFacilityInput(e.target.value)}
                    onKeyDown={addFacility}
                    onBlur={addFacility}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                    placeholder="e.g. Medical Aid, Food..."
                  />
                </div>
              </div>

              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={editing.description || ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 min-h-[80px]"
                  placeholder="Extra details about this shelter..."
                  maxLength={300}
                />
              </div>
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                disabled={busy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={busy}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
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
