"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Uploader } from "@/components/file-uploader/uploader";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import EmojiPicker, { Theme } from "emoji-picker-react";
import pt from "emoji-picker-react/dist/data/emojis-pt.json";
import { EmojiData } from "emoji-picker-react/dist/types/exposedTypes";
import { PlusIcon, SmileIcon, StickerIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Picker combinado de Emojis + Figurinhas pro composer do tracking-chat.
 *
 * Toggle simples entre dois modos (Emoji | Figurinha) via botões no
 * topo. NÃO usa `<Tabs>` do Radix porque o focus management dele
 * estava engolindo o callback `onEmojiClick` do emoji-picker-react
 * quando ficava aninhado em `<TabsContent>`.
 */
export function EmojiStickerPicker({
  trigger,
  onEmoji,
  onSticker,
}: {
  /** Trigger do popover (botão clicável). */
  trigger: React.ReactNode;
  /** Chamado quando usuário escolhe um emoji do picker. */
  onEmoji: (emoji: string) => void;
  /** Chamado quando usuário escolhe uma figurinha (envia direto). */
  onSticker: (sticker: { url: string; mimetype: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"emoji" | "sticker">("emoji");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-fit h-fit p-0">
        {/* Header com toggle entre modos */}
        <div className="flex items-center border-b bg-background sticky top-0 z-10">
          <button
            type="button"
            onClick={() => setMode("emoji")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
              mode === "emoji"
                ? "text-foreground border-b-2 border-violet-500"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <SmileIcon className="size-3.5" />
            Emojis
          </button>
          <button
            type="button"
            onClick={() => setMode("sticker")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
              mode === "sticker"
                ? "text-foreground border-b-2 border-violet-500"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <StickerIcon className="size-3.5" />
            Figurinhas
          </button>
        </div>

        {/* Conteúdo condicional (não Tabs, pra evitar conflito de focus
            do Radix com o emoji-picker-react). */}
        {mode === "emoji" ? (
          <EmojiPicker
            searchPlaceholder="Pesquisar emoji"
            skinTonesDisabled={true}
            previewConfig={{ showPreview: false }}
            emojiData={pt as EmojiData}
            theme={Theme.DARK}
            onEmojiClick={(emoji) => {
              onEmoji(emoji.emoji);
              // Não fecha — usuário pode querer múltiplos emojis seguidos.
            }}
          />
        ) : (
          <StickerGrid
            onPick={(s) => {
              onSticker(s);
              setOpen(false);
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Grid de figurinhas da org + uploader. Tamanho fixo (~350x420) pra bater
 * visualmente com o EmojiPicker e evitar layout shift entre modos.
 */
function StickerGrid({
  onPick,
}: {
  onPick: (sticker: { url: string; mimetype: string }) => void;
}) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState<string | undefined>(undefined);

  const { data, isLoading } = useQuery(
    orpc.stickers.list.queryOptions({
      input: {},
    }),
  );

  const create = useMutation(
    orpc.stickers.create.mutationOptions({
      onSuccess: () => {
        toast.success("Figurinha adicionada");
        qc.invalidateQueries({ queryKey: orpc.stickers.list.queryKey({ input: {} }) });
        setUploading(undefined);
      },
      onError: () => {
        toast.error("Não consegui salvar a figurinha");
        setUploading(undefined);
      },
    }),
  );

  const remove = useMutation(
    orpc.stickers.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Figurinha removida");
        qc.invalidateQueries({ queryKey: orpc.stickers.list.queryKey({ input: {} }) });
      },
      onError: () => toast.error("Não consegui remover essa figurinha"),
    }),
  );

  const items = data?.items ?? [];

  return (
    <div className="w-[350px] h-[420px] flex flex-col">
      {/* Header com botão de adicionar */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-medium text-muted-foreground">
          {items.length > 0
            ? `${items.length} ${items.length === 1 ? "figurinha" : "figurinhas"}`
            : "Suas figurinhas"}
        </span>
        <StickerUploader
          uploadingKey={uploading}
          onChange={(url) => {
            if (!url) return;
            setUploading(url);
            create.mutate({ url, mimetype: "image/webp" });
          }}
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
            <StickerIcon className="size-10 opacity-30" />
            <p className="text-xs">
              Você ainda não tem figurinhas.
              <br />
              Clique no <PlusIcon className="inline size-3" /> pra adicionar.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {items.map((sticker) => (
              <StickerCell
                key={sticker.id}
                sticker={sticker}
                onClick={() =>
                  onPick({ url: sticker.url, mimetype: sticker.mimetype })
                }
                onDelete={
                  sticker.ownedByMe
                    ? () => remove.mutate({ stickerId: sticker.id })
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StickerCell({
  sticker,
  onClick,
  onDelete,
}: {
  sticker: { id: string; url: string; label: string | null };
  onClick: () => void;
  onDelete?: () => void;
}) {
  const fullUrl = useConstructUrl(sticker.url);
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        title={sticker.label ?? "Enviar figurinha"}
        className="w-full aspect-square rounded-md border border-transparent hover:border-violet-500/50 hover:bg-accent transition flex items-center justify-center overflow-hidden p-1"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fullUrl}
          alt={sticker.label ?? "Figurinha"}
          className="max-w-full max-h-full object-contain"
        />
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 size-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow transition-opacity"
          title="Remover figurinha"
          aria-label="Remover figurinha"
        >
          <Trash2Icon className="size-3" />
        </button>
      )}
    </div>
  );
}

/**
 * Wrapper pequeno do `Uploader` global, configurado pra aceitar só
 * imagens (PNG/WebP/JPG/GIF). O uazapi converte tudo pra sticker no
 * send-media.
 */
function StickerUploader({
  uploadingKey,
  onChange,
}: {
  uploadingKey: string | undefined;
  onChange: (url: string | undefined) => void;
}) {
  return (
    <div className="relative">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        title="Adicionar figurinha"
        aria-label="Adicionar figurinha"
        className="size-7"
      >
        <PlusIcon className="size-4" />
      </Button>
      <div className="absolute inset-0 opacity-0">
        <Uploader
          fileTypeAccepted="image"
          value={uploadingKey}
          onUpload={(url) => onChange(url)}
          onUploadStart={() => onChange(undefined)}
        />
      </div>
    </div>
  );
}
