"use client";

import Image from "next/image";
import { Building2, Lock, Globe, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

export type EmpresaStation = {
  id: string;
  nick: string;
  avatarUrl: string | null;
  accessMode: "OPEN" | "MEMBERS_ONLY" | "REQUEST";
  bio: string | null;
  org: {
    id: string;
    name: string;
    logo: string | null;
    addressLine: string | null;
    city: string | null;
    state: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
};

interface Props {
  station: EmpresaStation;
  selected: boolean;
  onSelect: () => void;
  onAccess: () => void;
}

export function EmpresaCard({ station, selected, onSelect, onAccess }: Props) {
  const logo = station.org?.logo ?? station.avatarUrl;
  const addressParts = [station.org?.city, station.org?.state].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
        selected
          ? "border-violet-500 bg-violet-500/10"
          : "border-white/10 bg-slate-900/50 hover:border-violet-500/40 hover:bg-slate-900",
      )}
    >
      <div className="size-10 rounded-lg overflow-hidden bg-slate-800 shrink-0 flex items-center justify-center">
        {logo ? (
          <Image src={logo} alt={station.org?.name ?? station.nick} width={40} height={40} className="size-full object-cover" />
        ) : (
          <Building2 className="size-5 text-slate-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm text-white truncate">
            {station.org?.name ?? `@${station.nick}`}
          </span>
          <AccessBadge mode={station.accessMode} />
        </div>
        <p className="text-[11px] text-slate-400 truncate">
          {station.org?.addressLine ?? addressParts ?? `@${station.nick}`}
        </p>
        {addressParts && station.org?.addressLine && (
          <p className="text-[10px] text-slate-500 truncate">{addressParts}</p>
        )}
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onAccess(); }}
        className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-md bg-violet-600 hover:bg-violet-500 text-white transition-colors"
      >
        Acessar
      </button>
    </button>
  );
}

function AccessBadge({ mode }: { mode: EmpresaStation["accessMode"] }) {
  const cfg = {
    OPEN:         { icon: Globe,    label: "Aberto",   cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
    MEMBERS_ONLY: { icon: Lock,     label: "Membros",  cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
    REQUEST:      { icon: UserPlus, label: "Solicitar", cls: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  }[mode];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full border", cfg.cls)}>
      <Icon className="size-2.5" />
      {cfg.label}
    </span>
  );
}
