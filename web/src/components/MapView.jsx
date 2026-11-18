import "leaflet/dist/leaflet.css";

import { useState } from "react";
import { MapContainer, Marker, TileLayer } from "react-leaflet";

import { pinIcon } from "./mapIcon";

const TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const SATELLITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

/** Peta read-only untuk detail admin: dengan switch Peta/Satelit dan tautan Google Maps. */
export default function MapView({ lat, lng, className = "h-[280px]" }) {
  const [layer, setLayer] = useState("osm");

  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return (
      <div
        className={`flex items-center justify-center rounded-card border border-dashed border-line bg-surface ${className}`}
      >
        <p className="text-sm text-muted">Titik lokasi tidak tersedia.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className={`relative overflow-hidden rounded-card border border-line bg-white ${className}`}>
        <div className="absolute right-2.5 top-2.5 z-[400] flex overflow-hidden rounded-btn border border-line bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setLayer("osm")}
            className={`min-h-[36px] px-3 text-xs font-semibold transition ${
              layer === "osm" ? "bg-navy text-white" : "text-ink hover:bg-surface"
            }`}
          >
            Peta
          </button>
          <button
            type="button"
            onClick={() => setLayer("sat")}
            className={`min-h-[36px] px-3 text-xs font-semibold transition ${
              layer === "sat" ? "bg-navy text-white" : "text-ink hover:bg-surface"
            }`}
          >
            Satelit
          </button>
        </div>

        <MapContainer
          center={[lat, lng]}
          zoom={16}
          className="h-full w-full"
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          touchZoom={false}
          boxZoom={false}
          keyboard={false}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            attribution={layer === "osm" ? "&copy; OpenStreetMap contributors" : "Tiles &copy; Esri"}
            url={layer === "osm" ? TILES : SATELLITE_TILES}
          />
          <Marker position={[lat, lng]} icon={pinIcon} />
        </MapContainer>
      </div>
      <div className="flex justify-end">
        <a
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noreferrer"
          className="link text-xs"
        >
          Buka titik di Google Maps
        </a>
      </div>
    </div>
  );
}
