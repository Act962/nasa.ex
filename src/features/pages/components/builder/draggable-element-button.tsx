/**
 * draggable-element-button — botão de "adicionar elemento" da aba Elementos.
 *
 * Tem duplo comportamento via @dnd-kit:
 * - Click  → chama `onClick` (handleAdd): insere no centro do viewport
 *            ou dentro da section visível / no fim do flow.
 * - Drag   → arrasta o `ElementType` pra dentro da aba Camadas; soltar
 *            numa drop zone insere no índice exato (tratado pelo
 *            handleDragEnd do BuilderSidebar).
 *
 * `activationConstraint.distance` (4px no PointerSensor do DndContext)
 * garante que cliques curtos NÃO virem drag — só após mover ≥4px o
 * drag ativa, deixando o click chegar no `onClick`.
 */
"use client";

import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { ElementType } from "../../types";

export function DraggableElementButton({
  type,
  label,
  Icon,
  onClick,
}: {
  type: ElementType;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `add-${type}`,
    data: { kind: "add-element-button", elementType: type },
  });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      title={`Clique pra adicionar · arraste pra escolher posição em Camadas`}
      className={cn(
        "flex items-center gap-3 px-2 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left",
        isDragging && "opacity-50 ring-2 ring-indigo-300",
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span>{label}</span>
    </button>
  );
}
