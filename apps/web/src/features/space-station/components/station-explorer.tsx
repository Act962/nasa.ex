"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Star, Search, Rocket } from "lucide-react";
import { useListStations } from "../hooks/use-station";

export function StationExplorer() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListStations({ search: search || undefined });

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Rocket className="h-5 w-5 text-indigo-400" />
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Explorar a Galáxia NASA
        </h2>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <Input
          placeholder="Buscar stations, empresas ou usuários..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data?.stations.map((s) => {
            const name = s.org?.name ?? s.user?.name ?? s.nick;
            const avatar = s.avatarUrl ?? s.org?.logo ?? s.user?.image;
            const planetColor = s.worldConfig?.planetColor ?? "#4B0082";

            return (
              <Link key={s.id} href={`/@${s.nick}`}>
                <div
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-indigo-500/30 transition-all group"
                >
                  <div
                    className="relative h-10 w-10 rounded-full overflow-hidden flex-shrink-0 ring-2"
                    style={{ ["--tw-ring-color" as string]: planetColor } as CSSProperties}
                  >
                    {avatar ? (
                      <Image src={avatar} alt={name} fill className="object-cover" />
                    ) : (
                      <div
                        className="h-full w-full flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: planetColor }}
                      >
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate group-hover:text-indigo-300 transition-colors">
                      {name}
                    </p>
                    <p className="text-slate-500 text-xs font-mono">@{s.nick}</p>
                  </div>
                  <div className="flex items-center gap-1 text-yellow-400 flex-shrink-0">
                    <Star className="h-3 w-3 fill-yellow-400" />
                    <span className="text-xs">{s.starsReceived}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {data?.stations.length === 0 && (
        <p className="text-center text-slate-500 text-sm py-8">
          Nenhuma station encontrada no espaço...
        </p>
      )}
    </div>
  );
}
