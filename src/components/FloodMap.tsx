"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { RISK_COLORS, type RiskLevel } from "@/lib/risk";
import type { LocationScore } from "./types";

type Props = {
  locations: LocationScore[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
};

// Geographic centre of Sri Lanka.
const CENTER: [number, number] = [7.8731, 80.7718];

export default function FloodMap({ locations, selectedIds, onToggle }: Props) {
  return (
    <MapContainer center={CENTER} zoom={7} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {locations.map((loc) => {
        const hasScore = typeof loc.score === "number";
        const color =
          hasScore && loc.riskLevel ? RISK_COLORS[loc.riskLevel as RiskLevel] : "#94a3b8";
        const selected = selectedIds.has(loc.id);
        return (
          <CircleMarker
            key={loc.id}
            center={[loc.latitude, loc.longitude]}
            radius={selected ? 13 : 9}
            pathOptions={{
              color: selected ? "#1d4ed8" : color,
              weight: selected ? 3 : 1,
              fillColor: color,
              fillOpacity: 0.75,
            }}
            eventHandlers={{ click: () => onToggle(loc.id) }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <span className="font-medium">{loc.name}</span>
              {hasScore ? ` — ${loc.riskLevel} (${Math.round((loc.score as number) * 100)}%)` : " — no score yet"}
            </Tooltip>
            <Popup>
              <div className="space-y-1 text-sm">
                <div className="font-semibold">
                  {loc.name}, {loc.district}
                </div>
                {hasScore ? (
                  <div>
                    Risk: <b style={{ color }}>{loc.riskLevel}</b> ({((loc.score as number) * 100).toFixed(0)}%)
                  </div>
                ) : (
                  <div className="text-slate-500">Not scored yet — run the pipeline.</div>
                )}
                <button
                  onClick={() => onToggle(loc.id)}
                  className="mt-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                >
                  {selected ? "Remove from selection" : "Select for alerts"}
                </button>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
