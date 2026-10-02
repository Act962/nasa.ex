"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FormBlocks } from "@/features/form/lib/form-blocks";
import { useConstructUrl } from "@/hooks/use-construct-url";
import type { FormBlockInstance } from "../types";
import { defaultBackgroundColor } from "../constants";

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
const DEFAULT_ASPECT = 2 / 1;

export interface ThumbnailSettings {
  backgroundColor?: string | null;
  backgroundImage?: string | null;
  primaryColor?: string | null;
}

/** Primeira página do formulário (até a quebra de página), para a miniatura vertical. */
function firstPage(jsonBlock: string): FormBlockInstance[] {
  if (!jsonBlock) return [];
  try {
    const parsed = JSON.parse(jsonBlock) as FormBlockInstance[];
    if (!Array.isArray(parsed)) return [];
    const pageBlocks: FormBlockInstance[] = [];
    for (const block of parsed) {
      if (block?.blockType === "PageBreak") break;
      pageBlocks.push(block);
    }
    return pageBlocks;
  } catch {
    return [];
  }
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
  aspectRatio = DEFAULT_ASPECT,
  scope = "first-group",
}: {
  jsonBlock: string;
  settings?: ThumbnailSettings | null;
  className?: string;
  thumbWidthPx?: number;
  /** Largura ÷ altura. 3/4 = vertical, como uma página. */
  aspectRatio?: number;
  /** "first-page" mostra o formulário inteiro até a primeira quebra de página. */
  scope?: "first-group" | "first-page";
}) {
  const blocks = useMemo(
    () => (scope === "first-page" ? firstPage(jsonBlock) : firstGroup(jsonBlock)),
    [jsonBlock, scope],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredWidthPx, setMeasuredWidthPx] = useState<number | null>(null);

  // Escala pela largura real do card — a miniatura fica exata em qualquer tela.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setMeasuredWidthPx(entry.contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  // useConstructUrl resolve a key/URL do S3 — funciona tanto pra `https://…`
  // quanto pra keys cruas armazenadas no banco.
  const bgImage = useConstructUrl(settings?.backgroundImage ?? "");

  const widthPx = measuredWidthPx || thumbWidthPx;
  const scale = widthPx / VIRTUAL_WIDTH;
  const thumbHeight = widthPx / aspectRatio;
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
      ref={containerRef}
      className={cn(
        "relative w-full overflow-hidden rounded-lg border border-border",
        className,
      )}
      style={{
        aspectRatio: `${aspectRatio}`,
        backgroundColor: settings?.backgroundColor || defaultBackgroundColor,
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
