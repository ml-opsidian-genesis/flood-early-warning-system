"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";
import SubscribePanel from "./SubscribePanel";
import RiskLegend from "./RiskLegend";
import type { LocationScore } from "./types";
import type { DistrictAgg, MapView } from "./FloodMap";
import type { Thresholds } from "@/lib/risk";

const FloodMap = dynamic(() => import("./FloodMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">
      Loading map…
    </div>
  ),
});

const VIEWS: { id: MapView; label: string }[] = [
  { id: "none", label: "Markers" },
  { id: "districts", label: "Districts" },
  { id: "heatmap", label: "Heatmap" },
];

export default function Landing() {
  const [locations, setLocations] = useState<LocationScore[]>([]);
  const [thresholds, setThresholds] = useState<Thresholds | undefined>(undefined);
  const [districts, setDistricts] = useState<DistrictAgg[]>([]);
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<MapView>("none");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d) => {
        setLocations(d.locations ?? []);
        setThresholds(d.thresholds);
      })
      .catch(() => setLocations([]))
      .finally(() => setLoaded(true));

    fetch("/api/districts")
      .then((r) => r.json())
      .then((d) => setDistricts(d.districts ?? []))
      .catch(() => setDistricts([]));

    fetch("/lk-districts.geojson")
      .then((r) => r.json())
      .then(setGeojson)
      .catch(() => setGeojson(null));
  }, []);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const setSelected = useCallback((ids: string[]) => setSelectedIds(new Set(ids)), []);

  const scored = locations.filter((l) => l.score != null).length;
  const latestDate = locations.find((l) => l.scoredFor)?.scoredFor;

  return (
    <div className="space-y-1">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Sri Lanka Flood-Risk Map</h1>
        <p className="text-sm text-slate-500">
          {loaded
            ? scored > 0
              ? `Showing ${scored} scored locations${
                  latestDate ? ` for ${new Date(latestDate).toLocaleDateString()}` : ""
                }. Click markers to subscribe.`
              : "No scores yet — run the morning pipeline from the Ops Dashboard."
            : "Loading…"}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 items-start">
        <div className="card flex flex-col gap-3 p-3 lg:col-span-2">
          <div className="flex items-center justify-end">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  className={`rounded-md px-3 py-1 font-medium transition ${
                    view === v.id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[50vh] min-h-[420px]">
            <FloodMap
              locations={locations}
              selectedIds={selectedIds}
              onToggle={toggle}
              view={view}
              thresholds={thresholds}
              districts={districts}
              geojson={geojson}
            />
          </div>
          <RiskLegend thresholds={thresholds} />
        </div>
        <SubscribePanel
          locations={locations}
          selectedIds={selectedIds}
          onToggle={toggle}
          onSetSelected={setSelected}
        />
      </div>
    </div>
  );
}
