import "leaflet/dist/leaflet.css";

import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

import { pinIcon } from "./mapIcon";

const DEFAULT_CENTER = [-6.4025, 106.7942];
const ZOOM = 13;

export const MAP_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const SATELLITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function MapFlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], 16, { duration: 0.7 });
    }
  }, [map, target]);
  return null;
}

export default function MapPicker({ lat, lng, onChange }) {
  const [position, setPosition] = useState(lat != null ? { lat, lng } : null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [layer, setLayer] = useState("osm");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState([]);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    setPosition(lat != null ? { lat, lng } : null);
  }, [lat, lng]);

  const handlePick = (next) => {
    setPosition(next);
    onChange(next);
  };

  const selectResult = (item) => {
    const next = { lat: Number(item.lat), lng: Number(item.lon) };
    handlePick(next);
    setFlyTarget({ ...next, _t: Date.now() });
    setResults([]);
    setSearchError("");
  };

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError("");
    setResults([]);
    try {
      const searchQ = /depok/i.test(q) ? q : `${q}, Depok, Indonesia`;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=4&q=${encodeURIComponent(searchQ)}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) throw new Error("Gagal mencari lokasi");
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        setSearchError("Lokasi tidak ditemukan. Coba nama jalan atau kelurahan lain.");
      } else if (data.length === 1) {
        selectResult(data[0]);
      } else {
        setResults(data);
      }
    } catch {
      setSearchError("Pencarian lokasi sedang tidak tersedia. Klik langsung di peta.");
    } finally {
      setSearching(false);
    }
  };

  const handleMyLocation = () => {
    if (!navigator.geolocation) {
      setSearchError("Browser tidak mendukung deteksi lokasi GPS.");
      return;
    }
    setLocating(true);
    setSearchError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        handlePick(next);
        setFlyTarget({ ...next, _t: Date.now() });
        setLocating(false);
      },
      () => {
        setSearchError("Izin lokasi ditolak atau gagal mendeteksi posisi.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 gap-2">
          <input
            type="text"
            className="field-input"
            placeholder="Cari jalan atau lokasi di Depok (mis. Jl. Margonda Raya)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSearch();
              }
            }}
          />
          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={searching || !query.trim()}
            className="btn-outline shrink-0 px-4 text-xs"
          >
            {searching ? "Mencari..." : "Cari"}
          </button>
        </div>
        <button
          type="button"
          onClick={handleMyLocation}
          disabled={locating}
          className="btn-outline shrink-0 px-4 text-xs"
        >
          {locating ? "Mendeteksi..." : "Lokasi Saya"}
        </button>
      </div>

      {searchError ? (
        <p className="text-xs font-medium text-status-ditolak-fg" role="alert">
          {searchError}
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-btn border border-line bg-white">
          {results.map((item) => (
            <li key={item.place_id}>
              <button
                type="button"
                onClick={() => selectResult(item)}
                className="flex min-h-control w-full items-center px-3.5 py-2 text-left text-xs text-ink transition hover:bg-surface"
              >
                <span className="line-clamp-2">{item.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative h-[280px] w-full overflow-hidden rounded-card border border-line bg-white">
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
          center={DEFAULT_CENTER}
          zoom={ZOOM}
          className="h-full w-full"
          scrollWheelZoom={true}
          attributionControl={false}
        >
          <TileLayer
            attribution={
              layer === "osm"
                ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                : "Tiles &copy; Esri"
            }
            url={layer === "osm" ? MAP_TILES : SATELLITE_TILES}
          />
          <MapFlyTo target={flyTarget} />
          <ClickHandler onPick={handlePick} />
          {position ? (
            <Marker
              position={position}
              icon={pinIcon}
              draggable
              onDragEnd={(e) => handlePick(e.latlng)}
            />
          ) : null}
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          Cari alamat, pakai Lokasi Saya, atau klik &amp; geser pin di peta untuk menandai lokasi.
        </p>
        {position ? (
          <button
            type="button"
            className="btn-outline px-4 text-xs"
            onClick={() => {
              setPosition(null);
              onChange(null);
            }}
          >
            Hapus titik
          </button>
        ) : null}
      </div>
    </div>
  );
}
