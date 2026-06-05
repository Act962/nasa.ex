"use client";

import { useRef, useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePagesBuilderStore } from "../../context/pages-builder-store";
import { isFlowSection } from "../../lib/section-flow";
import type { ElementBase, ElementType } from "../../types";
import { ElementRenderer } from "./element-renderer";

// Threshold em px de tela pra distinguir "clique" de "drag". Sem
// isso, qualquer micro-tremor do mouse vira drag e a section (que
// ocupa 1200×600px) voa pra fora do viewport.
const DRAG_THRESHOLD_PX = 4;

interface Props {
  element: ElementBase;
  editable: boolean;
}

type DragMode = "move" | "resize-se" | "resize-nw" | "resize-ne" | "resize-sw";

function extractText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  if (typeof node === "string") return node as string;
  const n = node as { text?: string; content?: unknown[] };
  if (n.text) return n.text;
  if (Array.isArray(n.content)) return n.content.map(extractText).join("\n");
  return "";
}

export function ElementBox({ element, editable }: Props) {
  const selected = usePagesBuilderStore((s) => s.selected.includes(element.id));
  const toggleSelected = usePagesBuilderStore((s) => s.toggleSelected);
  const updateElement = usePagesBuilderStore((s) => s.updateElement);
  const removeElement = usePagesBuilderStore((s) => s.removeElement);

  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Sections "de flow" (hero, features, navbar, footer…) ocupam
  // 1200×600+ e devem ser empilhadas verticalmente, NUNCA arrastadas
  // livremente — senão somem do canvas no primeiro tremor de cursor.
  // Clicar nelas seleciona; arrastar não faz nada.
  const isSection = isFlowSection(element.type as ElementType);
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    startEl: ElementBase;
    moved: boolean; // true depois que passou do threshold — confirma drag real
  } | null>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const startDrag = (mode: DragMode) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editable || element.locked || isEditing) return;
    // Sections (flow): nunca iniciam drag de move. Só seleciona.
    // Resize ainda funciona — handles ainda chamam startDrag com
    // mode="resize-*" e isso continua válido.
    if (isSection && mode === "move") {
      e.stopPropagation();
      toggleSelected(element.id, e.shiftKey);
      return;
    }
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startEl: { ...element },
      moved: false,
    };
    // NÃO seleciona ainda — espera pra ver se é clique ou drag.
    // Se for clique puro (pointerUp sem mover), seleciona no up.
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    // Compensa o zoom do canvas — sem isso, o elemento "foge" do
    // cursor em zoom != 1.0 e parece sumir.
    const zoom = usePagesBuilderStore.getState().zoom || 1;
    const rawDx = e.clientX - drag.startX;
    const rawDy = e.clientY - drag.startY;
    // Threshold: só começa a mover de verdade depois de N pixels.
    if (
      !drag.moved &&
      Math.abs(rawDx) < DRAG_THRESHOLD_PX &&
      Math.abs(rawDy) < DRAG_THRESHOLD_PX
    ) {
      return;
    }
    drag.moved = true;
    const dx = rawDx / zoom;
    const dy = rawDy / zoom;
    if (drag.mode === "move") {
      updateElement(element.id, {
        x: Math.round(drag.startEl.x + dx),
        y: Math.round(drag.startEl.y + dy),
      });
    } else if (drag.mode === "resize-se") {
      updateElement(element.id, {
        w: Math.max(16, Math.round(drag.startEl.w + dx)),
        h: Math.max(16, Math.round(drag.startEl.h + dy)),
      });
    } else if (drag.mode === "resize-nw") {
      updateElement(element.id, {
        x: Math.round(drag.startEl.x + dx),
        y: Math.round(drag.startEl.y + dy),
        w: Math.max(16, Math.round(drag.startEl.w - dx)),
        h: Math.max(16, Math.round(drag.startEl.h - dy)),
      });
    } else if (drag.mode === "resize-ne") {
      updateElement(element.id, {
        y: Math.round(drag.startEl.y + dy),
        w: Math.max(16, Math.round(drag.startEl.w + dx)),
        h: Math.max(16, Math.round(drag.startEl.h - dy)),
      });
    } else if (drag.mode === "resize-sw") {
      updateElement(element.id, {
        x: Math.round(drag.startEl.x + dx),
        w: Math.max(16, Math.round(drag.startEl.w - dx)),
        h: Math.max(16, Math.round(drag.startEl.h + dy)),
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    // Clique puro (sem passar do threshold) → só seleciona.
    if (drag && !drag.moved && drag.mode === "move") {
      toggleSelected(element.id, e.shiftKey);
    }
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // pointerId pode já ter sido liberado se o ponteiro saiu do elemento
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!editable || element.type !== "text") return;
    e.stopPropagation();
    setIsEditing(true);
  };

  const exitEditing = () => setIsEditing(false);

  const textValue = isEditing
    ? typeof element.content === "string"
      ? (element.content as string)
      : extractText(element.content)
    : "";

  return (
    <div
      data-el-id={element.id}
      className={cn(
        "absolute select-none",
        // Sections não têm cursor-move (não são draggable) — usa
        // cursor-pointer pra deixar claro que é clicável.
        editable && !isEditing && (isSection ? "cursor-pointer" : "cursor-move"),
        selected && !isEditing && "outline-2 outline-offset-2 outline-indigo-500 outline",
        isEditing && "outline-2 outline-offset-2 outline-indigo-400 outline",
      )}
      style={{
        left: element.x,
        top: element.y,
        width: element.w,
        height: element.h,
        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
        opacity: element.opacity ?? 1,
        zIndex: element.zIndex ?? 1,
        // touchAction: none impede o navegador de capturar o gesto
        // como scroll quando o user tá tentando arrastar/redimensionar.
        touchAction: editable && !isEditing ? "none" : undefined,
      }}
      onPointerDown={isEditing ? undefined : startDrag("move")}
      onPointerMove={isEditing ? undefined : onPointerMove}
      onPointerUp={isEditing ? undefined : onPointerUp}
      onDoubleClick={handleDoubleClick}
    >
      <ElementRenderer element={element} />

      {isEditing && element.type === "text" && (
        <textarea
          ref={textareaRef}
          className="absolute inset-0 w-full h-full bg-transparent resize-none p-0 border-0 focus:outline-none"
          style={{
            color: "transparent",
            caretColor: (element.color as string) ?? "#0f172a",
            fontSize: (element.fontSize as number) ?? 16,
            fontFamily: `${(element.fontFamily as string) ?? "Inter"}, sans-serif`,
            fontWeight: (element.fontWeight as string) ?? "400",
            lineHeight: (element.lineHeight as number) ?? 1.4,
            letterSpacing: element.letterSpacing ? `${element.letterSpacing}px` : undefined,
            textAlign: (element.align as "left" | "center" | "right" | "justify") ?? "left",
            cursor: "text",
          }}
          value={textValue}
          onChange={(e) => updateElement(element.id, { content: e.target.value })}
          onBlur={exitEditing}
          onKeyDown={(e) => {
            if (e.key === "Escape") exitEditing();
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        />
      )}

      {editable && selected && !isEditing && (
        <>
          <Handle pos="nw" onPointerDown={startDrag("resize-nw")} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
          <Handle pos="ne" onPointerDown={startDrag("resize-ne")} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
          <Handle pos="sw" onPointerDown={startDrag("resize-sw")} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
          <Handle pos="se" onPointerDown={startDrag("resize-se")} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
          <button
            className="absolute -top-7 right-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-destructive text-destructive-foreground shadow hover:bg-destructive/90 transition-colors"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); removeElement(element.id); }}
            title="Deletar (Del)"
          >
            <Trash2 className="size-3" />
            Deletar
          </button>
        </>
      )}
    </div>
  );
}

function Handle({
  pos,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  pos: "nw" | "ne" | "sw" | "se";
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const map = {
    nw: "-top-1.5 -left-1.5 cursor-nwse-resize",
    ne: "-top-1.5 -right-1.5 cursor-nesw-resize",
    sw: "-bottom-1.5 -left-1.5 cursor-nesw-resize",
    se: "-bottom-1.5 -right-1.5 cursor-nwse-resize",
  } as const;
  return (
    <div
      className={cn("absolute size-3 rounded-sm bg-white border-2 border-indigo-500", map[pos])}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}
