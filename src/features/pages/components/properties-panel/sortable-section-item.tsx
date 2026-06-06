"use client";

/**
 * Item de lista reutilizável pras sections compostas (testimonials,
 * features, pricing, faq, stats, logos).
 *
 * Layout: drag handle · label · spacer · duplicar · excluir · expand/collapse.
 * Body colapsável dentro do card (children).
 *
 * Sortable via `@dnd-kit/sortable` — NÃO monta `DndContext`; quem
 * orquestra é o pai (o editor de cada section).
 *
 * Convenções:
 *   - `id` é o id do item no array (não confundir com index).
 *   - `defaultOpen` controla estado inicial. User pode colapsar pra
 *     reduzir scroll quando há muitos itens.
 *   - `summary` é texto curto opcional que aparece à direita do label
 *     quando colapsado (ex: nome do autor pra depoimento).
 */
import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical, ChevronDown, ChevronRight, Copy, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  /** Cabeçalho do item — ex: "#1 · Mariana F.". */
  label: string;
  /** Texto curto mostrado quando colapsado. */
  summary?: string;
  /** Nome da coleção no element (ex: "testimonials", "features", "plans").
   *  Atribuído ao `data` do sortable pra que o `DndContext` global do
   *  builder-sidebar saiba em qual array fazer arrayMove. */
  collection: string;
  /** ID do element NasaPage que dona da collection — pra patch via store. */
  elementId: string;
  onDuplicate?: () => void;
  onRemove: () => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function SortableSectionItem(props: Props) {
  // `data` é lido pelo handleDragEnd do BuilderSidebar pra distinguir
  // de drag de elementos / drag de subpages / drag de camadas.
  const sortable = useSortable({
    id: props.id,
    data: {
      kind: "section-item",
      collection: props.collection,
      elementId: props.elementId,
    },
  });
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = sortable;
  const [open, setOpen] = useState(props.defaultOpen ?? false);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border rounded-md bg-card mb-2 overflow-hidden",
        isDragging && "ring-2 ring-indigo-300",
      )}
    >
      <div className="flex items-center gap-1 px-1 py-1.5 bg-muted/30 border-b">
        <button
          {...attributes}
          {...listeners}
          aria-label="Arrastar pra reordenar"
          className="shrink-0 text-muted-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing p-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setOpen((x) => !x)}
          className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
        >
          {open ? (
            <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
          )}
          <span className="text-[11px] font-medium truncate">
            {props.label}
          </span>
          {!open && props.summary && (
            <span className="text-[10px] text-muted-foreground truncate ml-1">
              · {props.summary}
            </span>
          )}
        </button>
        {props.onDuplicate && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              props.onDuplicate?.();
            }}
            aria-label="Duplicar"
            title="Duplicar"
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-background"
          >
            <Copy className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            props.onRemove();
          }}
          aria-label="Excluir"
          title="Excluir"
          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-background"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {open && <div className="px-2 py-2 flex flex-col gap-1.5">{props.children}</div>}
    </div>
  );
}
