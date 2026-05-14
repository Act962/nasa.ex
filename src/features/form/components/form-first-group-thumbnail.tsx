"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { FormBlocks } from "@/features/form/lib/form-blocks";
import { useConstructUrl } from "@/hooks/use-construct-url";
import type { FormBlockInstance } from "../types";

/**
 * Miniatura real do primeiro grupo do form. Renderiza os blocos via
 * `FormBlocks[type].formComponent` (mesmos componentes do form público)
 * em larga escala virtual e aplica `transform: scale(...)` pra caber num
 * card 2:1.
 *
 * Recebe também as `settings` do form (cor de fundo, imagem de fundo,
 * cor primária) pra que a miniatura tenha a MESMA aparência que o form
 * tem pro respondente — não só o esqueleto.
 *
 * `pointer-events: none` desliga toda interação (necessário porque os blocos
 * são designed pra serem interativos).
 */

const VIRTUAL_WIDTH = 650; // mesma largura "natural" do PreviewDialog
const ASPECT = 2 / 1;

export interface ThumbnailSettings {
  backgroundColor?: string | null;
  backgroundImage?: string | null;
  primaryColor?: string | null;
}

function firstGroup(jsonBlock: string): FormBlockInstance[] {
  if (!jsonBlock) return [];
  try {
    const parsed = JSON.parse(jsonBlock) as FormBlockInstance[];
    if (!Array.isArray(parsed)) return [];
    const firstRow = parsed.find((b) => b?.blockType === "RowLayout");
    if (firstRow) return [firstRow];
    // Forms antigos sem RowLayout: pega os top-level até o primeiro PageBreak
    const out: FormBlockInstance[] = [];
    for (const b of parsed) {
      if (b?.blockType === "PageBreak") break;
      out.push(b);
    }
    return out;
  } catch {
    return [];
  }
}

export function FormFirstGroupThumbnail({
  jsonBlock,
  settings,
  className,
  thumbWidthPx = 264, // largura aprox do card no carrossel (w-72 - paddings)
}: {
  jsonBlock: string;
  settings?: ThumbnailSettings | null;
  className?: string;
  thumbWidthPx?: number;
}) {
  const blocks = useMemo(() => firstGroup(jsonBlock), [jsonBlock]);
  // useConstructUrl resolve a key/URL do S3 — funciona tanto pra `https://…`
  // quanto pra keys cruas armazenadas no banco.
  const bgImage = useConstructUrl(settings?.backgroundImage ?? "");

  const scale = thumbWidthPx / VIRTUAL_WIDTH;
  const thumbHeight = thumbWidthPx / ASPECT;
  const virtualHeight = Math.ceil(thumbHeight / scale);

  // Mesma lógica do form público: settings.backgroundColor é a cor de fundo
  // do canvas; passamos pros blocos como prop pra que eles invertam o texto
  // automaticamente em fundos escuros (via `getContrastColor`).
  const settingsLike = settings
    ? {
        backgroundColor: settings.backgroundColor ?? undefined,
        primaryColor: settings.primaryColor ?? undefined,
      }
    : undefined;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg border border-border",
        className,
      )}
      style={{
        aspectRatio: `${ASPECT}`,
        backgroundColor: settings?.backgroundColor || "var(--card)",
        backgroundImage: bgImage ? `url(${bgImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      aria-hidden
    >
      {blocks.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
          Sem campos
        </div>
      ) : (
        <div
          className="pointer-events-none absolute top-0 left-0 select-none"
          style={{
            width: `${VIRTUAL_WIDTH}px`,
            height: `${virtualHeight}px`,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <div className="flex w-full flex-col gap-4 p-4">
            {blocks.map((block) => {
              const Component = FormBlocks[block.blockType]?.formComponent;
              if (!Component) return null;
              // settings é tipado como FormSettings | null no block; passamos
              // o subset que importa pra textColor não quebrar.
              return (
                <Component
                  key={block.id}
                  blockInstance={block}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  settings={settingsLike as any}
                />
              );
            })}
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/20 to-transparent" />
    </div>
  );
}
