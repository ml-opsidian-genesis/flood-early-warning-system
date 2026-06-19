"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

type Props = {
  lat?: number;
  lng?: number;
  onChange: (lat: number, lng: number) => void;
};

const CENTER: [number, number] = [7.8731, 80.7718]; // Sri Lanka center

function MapEvents({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapUpdater({ lat, lng }: { lat?: number; lng?: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
      map.setView([lat, lng], map.getZoom(), { animate: true });
    }
  }, [lat, lng, map]);
  return null;
}

export default function LocationPickerMap({ lat, lng, onChange }: Props) {
  const center = lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng) 
    ? ([lat, lng] as [number, number]) 
    : CENTER;

  const pinIcon = useMemo(() => {
    return L.divIcon({
      className: "",
      html: `<div style="
        display: flex;
        justify-content: center;
        align-items: center;
        width: 28px;
        height: 28px;
        background-color: #2563eb;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });
  }, []);

  return (
    <MapContainer center={center} zoom={lat !== undefined ? 13 : 7} style={{ height: "100%", width: "100%", zIndex: 10 }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapEvents onChange={onChange} />
      <MapUpdater lat={lat} lng={lng} />
      {lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng) && (
        <Marker position={[lat, lng]} icon={pinIcon} />
      )}
    </MapContainer>
  );
}
