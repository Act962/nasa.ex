"use client";

import { useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EMOTES, type EmoteKey } from "../lib/emotes";

/** Botão de emotes do topo: os colegas veem ao vivo (mensagem `emote`). Teclas 1 a 4 fazem o mesmo. */
export function EmoteMenu({ showKeys, onEmote }: { showKeys: boolean; onEmote: (key: EmoteKey) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative">
      <Button size="icon" variant={isOpen ? "default" : "secondary"} aria-label="Emotes" aria-expanded={isOpen} onClick={() => setIsOpen(!isOpen)}>
        <Smile />
      </Button>
      {isOpen && (
        <div className="absolute right-0 top-11 z-20 w-44 space-y-1 rounded-2xl bg-black/80 p-2 backdrop-blur" role="menu">
          {EMOTES.map((emote, index) => (
            <button
              key={emote.key}
              type="button"
              role="menuitem"
              onClick={() => {
                onEmote(emote.key);
                setIsOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/10"
            >
              {emote.label}
              {showKeys && <kbd className="rounded bg-white/15 px-1.5 text-xs">{index + 1}</kbd>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
