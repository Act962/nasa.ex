"use client";

import Link from "next/link";
import Image from "next/image";
import { Rocket, Globe, Lock, Star, ExternalLink, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMyStations } from "../hooks/use-station";

const THEME_COLORS: Record<string, string> = {
  space:    "#020210",
  nebula:   "#1a0530",
  asteroid: "#1a1510",
  galaxy:   "#050a18",
};

const THEME_LABELS: Record<string, string> = {
  space:    "Espaço",
  nebula:   "Nebulosa",
  asteroid: "Asteroides",
  galaxy:   "Galáxia",
};

export function MyStationsList() {
  const { data, isLoading } = useMyStations();
  const stations = data?.stations ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (stations.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Rocket className="h-4 w-4 text-indigo-400" />
          Minhas Space Stations
          <Badge variant="outline" className="border-white/10 text-slate-400 font-mono text-xs">
            {stations.length}
          </Badge>
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {stations.map((station) => {
          const bg = THEME_COLORS[station.worldConfig?.ambientTheme ?? "space"] ?? "#020210";
          const planet = station.worldConfig?.planetColor ?? "#4B0082";
          const displayName =
            station.type === "ORG"
              ? (station.org?.name ?? station.nick)
              : (station.user?.name ?? station.nick);
          const logo =
            station.type === "ORG" ? station.org?.logo : station.user?.image;

          return (
            <div
              key={station.id}
              className="relative group rounded-xl border border-white/10 overflow-hidden transition-all hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/10"
              style={{ background: bg }}
            >
              {/* Planeta decorativo */}
              <div
                className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-20 blur-sm"
                style={{ background: planet }}
              />
              <div
                className="absolute -top-4 -right-4 w-14 h-14 rounded-full opacity-30"
                style={{ background: planet }}
              />

              <div className="relative p-4 flex flex-col gap-3">
                {/* Topo: avatar + nome + badges */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden bg-slate-700 border border-white/10 flex items-center justify-center">
                    {logo ? (
                      <Image src={logo} alt={displayName} width={40} height={40} className="object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-slate-300">
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{displayName}</p>
                    <p className="text-slate-400 font-mono text-xs">@{station.nick}</p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant="outline"
                      className={
                        station.type === "ORG"
                          ? "border-violet-500/30 text-violet-400 text-[10px] px-1.5 py-0"
                          : "border-sky-500/30 text-sky-400 text-[10px] px-1.5 py-0"
                      }
                    >
                      {station.type === "ORG" ? "Org" : "Pessoal"}
                    </Badge>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      {station.isPublic ? (
                        <><Globe className="h-2.5 w-2.5 text-green-400" /><span className="text-green-400">Pública</span></>
                      ) : (
                        <><Lock className="h-2.5 w-2.5" /><span>Privada</span></>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bio */}
                {station.bio && (
                  <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{station.bio}</p>
                )}

                {/* Rodapé: stars + tema + ação */}
                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Star className="h-2.5 w-2.5 text-yellow-400" />
                      {station.starsReceived}
                    </span>
                    {station.worldConfig?.ambientTheme && (
                      <span>{THEME_LABELS[station.worldConfig.ambientTheme]}</span>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2.5 text-[11px] text-indigo-400 hover:bg-indigo-500/15 hover:text-indigo-300 gap-1"
                    asChild
                  >
                    <Link href={`/station/${station.nick}/world`} target="_blank">
                      <ExternalLink className="h-3 w-3" />
                      Abrir
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Card de nova station */}
        <Link
          href="/space-station"
          className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 p-6 text-slate-500 hover:border-indigo-500/40 hover:text-indigo-400 transition-all min-h-[128px]"
        >
          <Plus className="h-5 w-5" />
          <span className="text-xs font-medium">Nova Space Station</span>
        </Link>
      </div>
    </div>
  );
}
