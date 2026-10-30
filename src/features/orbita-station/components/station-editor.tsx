"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROOM_KINDS } from "../layout/room-kinds";
import { resolveLayout } from "../layout/station-layout";
import { STATION_TEMPLATES } from "../layout/station-templates";
import { ROOM_NAME_MAX_LENGTH, type RoomNames, type StationSettings } from "../lib/station-settings";

interface StationEditorProps {
  station: StationSettings;
  isSaving: boolean;
  onSave: (templateKey: string, roomNames: RoomNames) => void;
  onClose: () => void;
}

/** Editor da estação da empresa: modelo e nomes das salas (spec 0119, RF-2). Só aparece para quem tem "Editar". */
export function StationEditor({ station, isSaving, onSave, onClose }: StationEditorProps) {
  const [templateKey, setTemplateKey] = useState(station.templateKey);
  const [roomNames, setRoomNames] = useState<RoomNames>(station.roomNames);
  const rooms = useMemo(() => resolveLayout(templateKey).rooms, [templateKey]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const renameRoom = (roomKey: string, name: string) => {
    setRoomNames((current) => {
      const next = { ...current };
      // Nome vazio volta ao nome do tipo da sala (CB-9).
      if (name.trim()) next[roomKey] = name.slice(0, ROOM_NAME_MAX_LENGTH);
      else delete next[roomKey];
      return next;
    });
  };

  return (
    <div role="dialog" aria-label="Editar a estação" className="absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l border-white/10 bg-black/80 backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 p-4">
        <div>
          <h2 className="text-lg font-semibold">Estação da empresa</h2>
          <p className="text-xs text-white/60">Vale para todos os membros.</p>
        </div>
        <Button size="icon" variant="ghost" aria-label="Fechar o editor" onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <div className="space-y-2">
          <p className="text-sm">Modelo da estação</p>
          <Select value={templateKey} onValueChange={setTemplateKey}>
            <SelectTrigger aria-label="Modelo da estação" className="w-full border-white/20 bg-black/40 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATION_TEMPLATES.map((template) => (
                <SelectItem key={template.key} value={template.key}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-white/60">{STATION_TEMPLATES.find((template) => template.key === templateKey)?.description}</p>
        </div>
        <div className="space-y-3">
          <p className="text-sm">Nomes das salas</p>
          {rooms.map((room) => (
            <label key={room.key} className="block space-y-1">
              <span className="flex items-center gap-2 text-xs text-white/60">
                <span className="size-2 rounded-full" style={{ background: ROOM_KINDS[room.kind].color }} />
                {ROOM_KINDS[room.kind].label} · {room.module}
              </span>
              <Input
                value={roomNames[room.key] ?? ""}
                placeholder={room.name}
                maxLength={ROOM_NAME_MAX_LENGTH}
                onChange={(event) => renameRoom(room.key, event.target.value)}
                className="border-white/20 bg-black/40 text-white"
              />
            </label>
          ))}
        </div>
      </div>
      <div className="flex gap-2 border-t border-white/10 p-4">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Cancelar
        </Button>
        <Button className="flex-1" disabled={isSaving} onClick={() => onSave(templateKey, roomNames)}>
          <Check /> Salvar
        </Button>
      </div>
    </div>
  );
}
