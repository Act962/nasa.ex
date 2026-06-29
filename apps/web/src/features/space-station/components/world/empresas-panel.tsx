"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { Search, X, MapPin } from "lucide-react";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import { EmpresaCard, type EmpresaStation } from "./empresa-card";
import { AccessRequestModal } from "./access-request-modal";

interface Props {
  onClose: () => void;
}

function violetIcon(selected: boolean) {
  const size = selected ? 38 : 30;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.45"/>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <path fill="#8b5cf6" stroke="#fff" stroke-width="2"
          d="M16 2C10 2 5 7 5 13c0 7.5 11 17 11 17s11-9.5 11-17c0-6-5-11-11-11z"/>
        <circle cx="16" cy="13" r="4.5" fill="#fff"/>
      </g>
    </svg>
  `;
  return L.divIcon({
    className: "",
    html: svg,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

function FitToMarkers({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 12);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [points, map]);
  return null;
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 13), { duration: 0.8 });
  }, [target, map]);
  return null;
}

export default function EmpresasPanel({ onClose }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [requestModal, setRequestModal] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery(
    orpc.spaceStation.listEmpresasMap.queryOptions({ input: { search: search.trim() || undefined } }),
  );

  const stations = (data?.stations ?? []) as EmpresaStation[];
  const points = useMemo<[number, number][]>(
    () => stations
      .filter((s) => s.org?.latitude != null && s.org?.longitude != null)
      .map((s) => [s.org!.latitude!, s.org!.longitude!] as [number, number]),
    [stations],
  );

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedId) return;
    const el = listRef.current?.querySelector(`[data-station-id="${selectedId}"]`);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const handleAccess = (station: EmpresaStation) => {
    if (station.accessMode === "OPEN") {
      router.push(`/station/${station.nick}/world`);
      return;
    }
    if (station.accessMode === "MEMBERS_ONLY") {
      toast.error("Esta empresa é restrita a membros");
      return;
    }
    setRequestModal({ id: station.id, name: station.org?.name ?? `@${station.nick}` });
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[1100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-6xl h-[85vh] bg-slate-950 border border-white/10 rounded-2xl overflow-hidden flex shadow-2xl"
        >
          {/* Sidebar */}
          <aside className="w-[360px] shrink-0 border-r border-white/10 flex flex-col bg-slate-950">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-violet-400" />
                <h2 className="text-white font-bold">Ecossistemas</h2>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-white">
                <X className="size-4" />
              </button>
            </div>

            <div className="p-3 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar empresa, cidade..."
                  className="w-full bg-slate-900 border border-white/10 rounded-md pl-8 pr-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400/60"
                />
              </div>
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2">
              {isLoading ? (
                <div className="text-sm text-slate-500 text-center py-8">Carregando...</div>
              ) : stations.length === 0 ? (
                <div className="text-sm text-slate-500 text-center py-8">
                  Nenhuma empresa encontrada
                </div>
              ) : (
                stations.map((s) => (
                  <div key={s.id} data-station-id={s.id}>
                    <EmpresaCard
                      station={s}
                      selected={selectedId === s.id}
                      onSelect={() => {
                        setSelectedId(s.id);
                        if (s.org?.latitude != null && s.org?.longitude != null) {
                          setFlyTarget([s.org.latitude, s.org.longitude]);
                        }
                      }}
                      onAccess={() => handleAccess(s)}
                    />
                  </div>
                ))
              )}
            </div>
          </aside>

          {/* Map */}
          <div className="flex-1 relative bg-slate-900">
            <MapContainer
              center={[-14.235, -51.9253]}
              zoom={4}
              className="h-full w-full"
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitToMarkers points={points} />
              <FlyTo target={flyTarget} />
              {stations.map((s) =>
                s.org?.latitude != null && s.org?.longitude != null ? (
                  <Marker
                    key={s.id}
                    position={[s.org.latitude, s.org.longitude]}
                    icon={violetIcon(selectedId === s.id)}
                    eventHandlers={{
                      click: () => {
                        setSelectedId(s.id);
                        setFlyTarget([s.org!.latitude!, s.org!.longitude!]);
                      },
                    }}
                  />
                ) : null,
              )}
            </MapContainer>
          </div>
        </div>
      </div>

      {requestModal && (
        <AccessRequestModal
          stationId={requestModal.id}
          stationName={requestModal.name}
          onClose={() => setRequestModal(null)}
        />
      )}
    </>
  );
}
