"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ColleagueInfo, StationEngine } from "../engine/station-engine";
import { ROOM_KINDS } from "../layout/room-kinds";
import type { RoomLayout } from "../layout/station-layout";
import { firstName } from "./interaction-prompt";

export type SidePanelTarget = { type: "room"; room: RoomLayout } | { type: "colleague"; id: string; name: string };

interface StationSidePanelProps {
  engine: StationEngine;
  target: SidePanelTarget;
  currentRoom: RoomLayout | null;
  appAccess: Readonly<Record<string, boolean>>;
  onWalkToRoom: (roomKey: string) => void;
  onWalkToColleague: (id: string) => void;
  onClose: () => void;
}

/** Colegas mudam de sala o tempo todo: o painel relê do motor a cada meio segundo, sem guardar cópia. */
function useColleagues(engine: StationEngine) {
  const [colleagues, setColleagues] = useState<ColleagueInfo[]>(() => engine.colleagues());
  useEffect(() => {
    const timer = setInterval(() => setColleagues(engine.colleagues()), 500);
    return () => clearInterval(timer);
  }, [engine]);
  return colleagues;
}

/** Painel lateral da sala ou do colega (spec 0120, RF-6 e RF-7). Fecha com Esc pela tela da estação. */
export function StationSidePanel({ engine, target, currentRoom, appAccess, onWalkToRoom, onWalkToColleague, onClose }: StationSidePanelProps) {
  const colleagues = useColleagues(engine);

  return (
    <aside className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 max-h-[70dvh] overflow-y-auto rounded-t-2xl bg-black/80 p-5 backdrop-blur sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-80 sm:rounded-none">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-white/60">{target.type === "room" ? "Sala" : "Colega"}</span>
        <Button size="sm" variant="ghost" className="text-white/80" onClick={onClose}>
          Fechar <X />
        </Button>
      </div>
      {target.type === "room" ? (
        <RoomPanel
          engine={engine}
          room={target.room}
          colleagues={colleagues}
          isHere={currentRoom?.key === target.room.key}
          appAccess={appAccess}
          onWalkToRoom={onWalkToRoom}
        />
      ) : (
        <ColleaguePanel colleague={colleagues.find((colleague) => colleague.id === target.id)} name={target.name} onWalkToColleague={onWalkToColleague} />
      )}
    </aside>
  );
}

function RoomPanel({
  engine,
  room,
  colleagues,
  isHere,
  appAccess,
  onWalkToRoom,
}: {
  engine: StationEngine;
  room: RoomLayout;
  colleagues: ColleagueInfo[];
  isHere: boolean;
  appAccess: Readonly<Record<string, boolean>>;
  onWalkToRoom: (roomKey: string) => void;
}) {
  const kind = ROOM_KINDS[room.kind];
  const header = (
    <>
      <h2 className="text-xl font-semibold leading-tight">{room.name}</h2>
      {room.module !== "—" && <p className="text-sm text-white/60">{room.module}</p>}
    </>
  );
  if (!engine.isRoomOpenForMe(room.key)) {
    return (
      <div className="space-y-4">
        {header}
        <p className="flex gap-2 rounded-xl bg-destructive/20 p-3 text-sm text-white">
          <Lock className="mt-0.5 size-4 shrink-0" />
          Você não tem acesso a esta sala. Peça a um Master para liberar.
        </p>
      </div>
    );
  }
  const present = colleagues.filter((colleague) => colleague.room?.key === room.key);
  const links = kind.links.filter((link) => appAccess[link.appKey]);
  return (
    <div className="space-y-5">
      {header}
      <section>
        <p className="mb-2 text-xs uppercase tracking-wider text-white/60">Pessoas aqui</p>
        <ul className="space-y-1 text-sm">
          {isHere && <li>Você</li>}
          {present.map((colleague) => (
            <li key={colleague.id}>{colleague.name}</li>
          ))}
          {!isHere && present.length === 0 && <li className="text-white/50">Ninguém na sala agora.</li>}
        </ul>
      </section>
      {links.length > 0 && (
        <div className="flex flex-col gap-2">
          {links.map((link) => (
            <Button key={link.href} asChild>
              {/* Aba nova: a estação continua aberta e conectada aos colegas nesta (spec 0120, D-4). */}
              <a href={link.href} target="_blank" rel="noopener noreferrer">
                Abrir {link.label} <ExternalLink />
              </a>
            </Button>
          ))}
        </div>
      )}
      {!isHere && (
        <Button variant="secondary" className="w-full" onClick={() => onWalkToRoom(room.key)}>
          Ir até a sala
        </Button>
      )}
    </div>
  );
}

function ColleaguePanel({ colleague, name, onWalkToColleague }: { colleague: ColleagueInfo | undefined; name: string; onWalkToColleague: (id: string) => void }) {
  const place = !colleague ? "Saiu da estação" : colleague.isRestricted ? "Em sala restrita" : (colleague.room?.name ?? "Corredor");
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold leading-tight">{colleague?.name ?? name}</h2>
      <p className="text-sm">
        <span className="text-white/60">Onde está: </span>
        {place}
      </p>
      {colleague && !colleague.isRestricted && (
        <Button variant="secondary" className="w-full" onClick={() => onWalkToColleague(colleague.id)}>
          Ir até {firstName(colleague.name)}
        </Button>
      )}
    </div>
  );
}
