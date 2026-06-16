"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import SubscribePanel from "./SubscribePanel";
import RiskLegend from "./RiskLegend";
import type { LocationScore } from "./types";
import type { Thresholds } from "@/lib/risk";

const FloodMap = dynamic(() => import("./FloodMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">
      Loading map…
    </div>
  ),
});

export default function Landing() {
  const [locations, setLocations] = useState<LocationScore[]>([]);
  const [thresholds, setThresholds] = useState<Thresholds | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
  }, []);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const scored = locations.filter((l) => l.score != null).length;
  const latestDate = locations.find((l) => l.scoredFor)?.scoredFor;

  return (
    <div className="space-y-4">
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

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card flex flex-col gap-3 p-3 lg:col-span-2">
          <div className="h-[60vh] min-h-[420px]">
            <FloodMap locations={locations} selectedIds={selectedIds} onToggle={toggle} />
          </div>
          <RiskLegend thresholds={thresholds} />
        </div>
        <SubscribePanel locations={locations} selectedIds={selectedIds} onToggle={toggle} />
      </div>
    </div>
  );
}
