"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Gamepad2, Globe } from "lucide-react";
import type { PublicStation } from "../types";
import { StationSendStar } from "./station-send-star";

interface Props {
  station: PublicStation;
}

const rankConfig = {
  COMMANDER: { label: "Comandante", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  CREW: { label: "Tripulação", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
};

export function StationProfileHeader({ station }: Props) {
  const displayName = station.org?.name ?? station.user?.name ?? station.nick;
  const avatar = station.avatarUrl ?? station.org?.logo ?? station.user?.image;
  const rank = rankConfig[station.rank];

  return (
    <div className="relative w-full">
      {/* Banner */}
      <div
        className="h-48 w-full bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-950 relative overflow-hidden"
        style={
          station.bannerUrl
            ? { backgroundImage: `url(${station.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      >
        {/* Starfield effect */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: Math.random() * 2 + 1 + "px",
                height: Math.random() * 2 + 1 + "px",
                left: Math.random() * 100 + "%",
                top: Math.random() * 100 + "%",
                opacity: Math.random() * 0.7 + 0.1,
              }}
            />
          ))}
        </div>
      </div>

      {/* Profile content */}
      <div className="px-6 pb-6 bg-slate-950/95 backdrop-blur-sm border-b border-white/5">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-12 relative z-10">
          {/* Avatar */}
          <div className="relative h-24 w-24 rounded-full ring-4 ring-slate-950 overflow-hidden bg-indigo-900 flex-shrink-0">
            {avatar ? (
              <Image src={avatar} alt={displayName} fill className="object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-3xl font-bold text-white">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 pt-4 sm:pt-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-white">{displayName}</h1>
              <Badge variant="outline" className={rank.color}>
                {rank.label}
              </Badge>
            </div>
            <p className="text-slate-400 text-sm font-mono">@{station.nick}</p>
            {station.bio && (
              <p className="text-slate-300 text-sm mt-2 max-w-xl">{station.bio}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-4 sm:mt-0">
            <div className="flex items-center gap-1.5 text-yellow-400">
              <Star className="h-4 w-4 fill-yellow-400" />
              <span className="text-sm font-semibold">{station.starsReceived.toLocaleString("pt-BR")}</span>
            </div>
            <StationSendStar toNick={station.nick} />
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
              onClick={() => (window.location.href = `/@${station.nick}/world`)}
            >
              <Gamepad2 className="h-4 w-4" />
              Entrar no Mundo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
