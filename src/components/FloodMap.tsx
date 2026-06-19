"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
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
import type { LocationScore, Shelter } from "./types";
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
  shelters?: Shelter[];
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
  shelters = [],
}: Props) {
  const t = thresholds ?? DEFAULT_THRESHOLDS;
  const heatPoints = locations
    .filter((l) => typeof l.score === "number")
    .map((l) => [l.latitude, l.longitude, l.score as number] as [number, number, number]);

  const shelterIcon = useMemo(() => {
    return L.divIcon({
      className: '',
      html: `<div style="
        display: flex;
        justify-content: center;
        align-items: center;
        width: 24px;
        height: 24px;
        background-color: #2563eb;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14]
    });
  }, []);

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
            pane="markerPane"
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
                  <div className="text-slate-500">No risk predictions given.</div>
                )}
                <button
                  onClick={() => onToggle(loc.id)}
                  className="mt-1 mr-2 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                >
                  {selected ? "Remove from selection" : "Select for alerts"}
                </button>
                <FeedbackForm location={loc} />
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {shelters.map((shelter) => (
        <Marker
          key={shelter.id}
          position={[shelter.latitude, shelter.longitude]}
          icon={shelterIcon}
        >
          <Popup>
            <div className="space-y-2 text-sm min-w-[220px]">
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-base">{shelter.name}</div>
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
                    {shelter.status}
                  </span>
                </div>
                <div className="text-slate-600 text-xs mt-0.5">{shelter.address}</div>
              </div>

              <div className="space-y-1">
                {shelter.capacity && (
                  <div className="text-xs text-slate-700">
                    <span className="font-medium text-slate-500">Capacity:</span> {shelter.capacity} people
                  </div>
                )}
                {shelter.facilities.length > 0 && (
                  <div className="text-xs text-slate-700">
                    <span className="font-medium text-slate-500">Facilities:</span> {shelter.facilities.join(', ')}
                  </div>
                )}
                {shelter.contactInfo && (
                  <div className="text-xs text-slate-700">
                    <span className="font-medium text-slate-500">Contact:</span> {shelter.contactInfo}
                  </div>
                )}
              </div>

              {shelter.description && (
                <div className="mt-2 text-xs text-slate-500 italic border-t border-slate-100 pt-2">
                  {shelter.description}
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
