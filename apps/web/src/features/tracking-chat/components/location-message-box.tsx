"use client";

import { MapPinIcon } from "lucide-react";

interface LocationMessageBoxProps {
  latitude: number;
  longitude: number;
  name?: string | null;
}

export function LocationMessageBox({
  latitude,
  longitude,
  name,
}: LocationMessageBoxProps) {
  const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
  const delta = 0.004;
  const bbox = [
    longitude - delta,
    latitude - delta,
    longitude + delta,
    latitude + delta,
  ].join(",");
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`;

  return (
    <div className="block w-72 overflow-hidden rounded-md border bg-background">
      <div className="relative w-full h-44 overflow-hidden">
        <iframe
          src={embedUrl}
          className="absolute inset-x-0 top-0 w-full border-0 pointer-events-none"
          style={{ height: "calc(100% + 56px)" }}
          loading="lazy"
          title="Mapa da localização"
        />
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0"
          aria-label="Abrir no Google Maps"
        />
      </div>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-2 p-2 hover:bg-accent/40 transition-colors"
      >
        <MapPinIcon className="size-4 mt-0.5 shrink-0 text-red-500" />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium truncate">
            {name || "Localização"}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </span>
        </div>
      </a>
    </div>
  );
}
