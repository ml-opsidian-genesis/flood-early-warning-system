"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  Popup,
  GeoJSON,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection, Feature } from "geojson";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { RISK_COLORS, DEFAULT_THRESHOLDS, type RiskLevel, type Thresholds } from "@/lib/risk";
import type { LocationScore } from "./types";
import FeedbackForm from "./FeedbackForm";

export type DistrictAgg = {
  district: string;
  score: number;
  level: string;
  count: number;
};

export type MapView = "heatmap" | "districts" | "none";

type Props = {
  locations: LocationScore[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  view?: MapView;
  thresholds?: Thresholds;
  districts?: DistrictAgg[];
  geojson?: FeatureCollection | null;
};

// Geographic centre of Sri Lanka.
const CENTER: [number, number] = [7.8731, 80.7718];

const normDistrict = (s: string) => s.toLowerCase().replace(/\s*district$/i, "").trim();

/** Heat gradient whose colour stops align with the risk-level thresholds. */
function heatGradient(t: Thresholds): Record<number, string> {
  return {
    0.0: RISK_COLORS.Low,
    [t.moderateMin]: RISK_COLORS.Moderate,
    [t.highMin]: RISK_COLORS.High,
    [t.criticalMin]: RISK_COLORS.Critical,
    1.0: RISK_COLORS.Critical,
  };
}

/** leaflet.heat layer rendered beneath the markers (markers stay clickable). */
function HeatLayer({
  points,
  gradient,
}: {
  points: [number, number, number][];
  gradient: Record<number, string>;
}) {
  const map = useMap();
  useEffect(() => {
    const layer = (L as unknown as { heatLayer: (p: unknown, o: unknown) => L.Layer }).heatLayer(
      points,
      { radius: 32, blur: 24, max: 1, minOpacity: 0.35, maxZoom: 12, gradient },
    );
    layer.addTo(map);
    const canvas = (layer as unknown as { _canvas?: HTMLCanvasElement })._canvas;
    if (canvas) canvas.style.pointerEvents = "none";
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points, gradient]);
  return null;
}

/** District polygons filled by aggregated risk level. */
function DistrictChoropleth({
  geojson,
  districts,
}: {
  geojson: FeatureCollection;
  districts: DistrictAgg[];
}) {
  const lookup = useMemo(
    () => new Map(districts.map((d) => [normDistrict(d.district), d])),
    [districts],
  );
  // Re-mount when the aggregates change so polygon styles refresh.
  const key = useMemo(() => districts.map((d) => `${d.district}:${d.level}`).join("|"), [districts]);

  function styleFor(feature?: Feature) {
    const name = (feature?.properties as { shapeName?: string } | null)?.shapeName ?? "";
    const agg = lookup.get(normDistrict(name));
    return {
      fillColor: agg ? RISK_COLORS[agg.level as RiskLevel] : "#e2e8f0",
      fillOpacity: agg ? 0.55 : 0.2,
      color: "#475569",
      weight: 1,
    };
  }

  function onEachFeature(feature: Feature, layer: L.Layer) {
    const raw = (feature.properties as { shapeName?: string } | null)?.shapeName ?? "";
    const agg = lookup.get(normDistrict(raw));
    const name = raw.replace(/\s*District$/i, "");
    layer.bindTooltip(
      agg
        ? `${name}: ${agg.level} (${(agg.score * 100).toFixed(0)}%, ${agg.count} loc.)`
        : `${name}: no data`,
      { sticky: true },
    );
  }

  return <GeoJSON key={key} data={geojson} style={styleFor} onEachFeature={onEachFeature} />;
}

export default function FloodMap({
  locations,
  selectedIds,
  onToggle,
  view = "none",
  thresholds,
  districts,
  geojson,
}: Props) {
  const t = thresholds ?? DEFAULT_THRESHOLDS;
  const heatPoints = locations
    .filter((l) => typeof l.score === "number")
    .map((l) => [l.latitude, l.longitude, l.score as number] as [number, number, number]);

  return (
    <MapContainer center={CENTER} zoom={7} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Overlays render before markers → markers stay on top + clickable. */}
      {view === "heatmap" && heatPoints.length > 0 && (
        <HeatLayer points={heatPoints} gradient={heatGradient(t)} />
      )}
      {view === "districts" && geojson && districts && (
        <DistrictChoropleth geojson={geojson} districts={districts} />
      )}

      {locations.map((loc) => {
        const hasScore = typeof loc.score === "number";
        const color =
          hasScore && loc.riskLevel ? RISK_COLORS[loc.riskLevel as RiskLevel] : "#94a3b8";
        const selected = selectedIds.has(loc.id);
        return (
          <CircleMarker
            key={loc.id}
            center={[loc.latitude, loc.longitude]}
            radius={selected ? 13 : 8}
            pathOptions={{
              color: selected ? "#1d4ed8" : "#ffffff",
              weight: selected ? 3 : 1.5,
              fillColor: color,
              fillOpacity: 0.95,
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
                    Risk: <b style={{ color }}>{loc.riskLevel}</b> ({(loc.score as number).toFixed(4)})
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
                <FeedbackForm location={loc} />
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
