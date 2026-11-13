"use client";

import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StationInteraction } from "../engine/station-engine";

export function interactionText(interaction: StationInteraction): string {
  if (interaction.kind === "colleague") return `Falar com ${firstName(interaction.name)}`;
  if (interaction.kind === "lead") return `Ver ${interaction.name}`;
  if (interaction.kind === "lockedDoor") return `Sem acesso a ${interaction.room.name}`;
  return `Ver ${interaction.room.name}`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "Colega";
}

/** Botão de proximidade (spec 0120, RF-5): uma ação por vez, pela tecla E ou por toque. */
export function InteractionPrompt({ interaction, showKey, onRun }: { interaction: StationInteraction; showKey: boolean; onRun: () => void }) {
  const isLocked = interaction.kind === "lockedDoor";
  return (
    <button
      type="button"
      onClick={onRun}
      className={cn(
        "pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur transition",
        isLocked ? "bg-destructive text-white hover:bg-destructive/90" : "bg-white/90 text-black hover:bg-white",
      )}
    >
      {isLocked ? (
        <span className="grid size-6 place-items-center rounded-md bg-white/25 text-white">
          <Lock className="size-3.5" />
        </span>
      ) : (
        showKey && <kbd className="grid size-6 place-items-center rounded-md bg-black text-xs text-white">E</kbd>
      )}
      {interactionText(interaction)}
    </button>
  );
}
