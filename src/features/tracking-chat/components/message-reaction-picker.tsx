"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { SmileIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import pt from "emoji-picker-react/dist/data/emojis-pt.json";
import { EmojiData } from "emoji-picker-react/dist/types/exposedTypes";
import { cn } from "@/lib/utils";

/** Emojis padrão do WhatsApp (ordem da imagem de referência). */
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

/**
 * Picker de reação inline pra hover de mensagens. Visual idêntico ao
 * WhatsApp Web: 6 emojis rápidos em linha + botão "+" que expande o
 * picker completo.
 *
 * IMPORTANTE: o `EmojiPicker` (emoji-picker-react) só é renderizado
 * quando o popover está aberto E o usuário clica em "+". Isso evita
 * carregar o pacote pesado pra centenas de mensagens visíveis.
 */
export function MessageReactionPicker({
  onReact,
  className,
}: {
  /** Chamado quando o usuário escolhe um emoji. */
  onReact: (emoji: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [showFull, setShowFull] = useState(false);

  const handlePick = (emoji: string) => {
    onReact(emoji);
    setOpen(false);
    setShowFull(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setShowFull(false);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(
            "opacity-0 group-hover:opacity-100 transition-opacity duration-100",
            className,
          )}
          aria-label="Reagir à mensagem"
          title="Reagir"
        >
          <SmileIcon className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className={cn(
          // Quando o picker completo está aberto, libera o padding/largura.
          showFull ? "w-fit p-0" : "w-fit p-1 rounded-full",
        )}
      >
        {/* Só renderiza o EmojiPicker quando o usuário pediu — picker
            completo é caro (~200KB de JSON + render de milhares de emojis). */}
        {showFull ? (
          <EmojiPicker
            searchPlaceholder="Pesquisar emoji"
            skinTonesDisabled={true}
            previewConfig={{ showPreview: false }}
            emojiData={pt as EmojiData}
            theme={Theme.DARK}
            onEmojiClick={(emoji) => handlePick(emoji.emoji)}
          />
        ) : (
          <div className="flex items-center gap-1">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handlePick(emoji)}
                className="text-xl px-1.5 py-1 rounded-full hover:bg-accent transition-colors"
                aria-label={`Reagir com ${emoji}`}
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowFull(true)}
              className="ml-1 size-7 rounded-full bg-accent hover:bg-accent/80 flex items-center justify-center transition-colors"
              aria-label="Mais emojis"
              title="Mais emojis"
            >
              <PlusIcon className="size-4" />
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
