"use client";

/**
 * Uma linha da lista de Camadas — drag handle, ícone do tipo, nome
 * amigável, badge contextual e ações inline (visibilidade, lock, kebab).
 *
 * Sortable via `useSortable` do `@dnd-kit/sortable`. Não monta `DndContext`
 * — quem orquestra é o `LayersPanel`.
 */
import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical, Eye, EyeOff, Lock, LockOpen, MoreVertical,
  Copy, Trash2, ChevronRight, ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ElementBase } from "../../types";
import {
  getElementDisplayName,
  getElementIcon,
  getElementBadge,
} from "../../lib/layer-utils";

interface Props {
  element: ElementBase;
  isSelected: boolean;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Disabled = filho de grupo (não pode sair sozinho). */
  disableDrag?: boolean;
  /** Indentação visual pra filhos de grupo. */
  indent?: number;
}

export function SortableLayerRow(props: Props) {
  const {
    element,
    isSelected,
    onSelect,
    onToggleVisibility,
    onToggleLock,
    onDuplicate,
    onDelete,
    disableDrag,
    indent = 0,
  } = props;

  const sortable = useSortable({
    id: element.id,
    disabled: disableDrag,
  });
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = sortable;

  const [expanded, setExpanded] = useState(true);

  const Icon = getElementIcon(element.type);
  const name = getElementDisplayName(element);
  const badge = getElementBadge(element);
  const isGroup = element.type === "group";
  const childrenCount =
    isGroup && Array.isArray(element.children)
      ? (element.children as ElementBase[]).length
      : 0;
  const hidden = element.hidden === true;
  const locked = element.locked === true;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    paddingLeft: 4 + indent * 16,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group relative flex items-center gap-1.5 px-1 py-1 rounded-md text-xs transition-colors cursor-pointer",
          isSelected
            ? "bg-indigo-50 ring-1 ring-indigo-300 text-indigo-900"
            : "hover:bg-accent",
          hidden && "opacity-50",
        )}
        onClick={onSelect}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          aria-label="Arrastar pra reordenar"
          className={cn(
            "shrink-0 text-muted-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing",
            disableDrag && "opacity-30 cursor-not-allowed",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="size-3.5" />
        </button>

        {/* Expand chevron pra groups */}
        {isGroup ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((x) => !x);
            }}
            className="shrink-0 text-muted-foreground/70 hover:text-foreground"
            aria-label={expanded ? "Recolher" : "Expandir"}
          >
            {expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        {/* Ícone do tipo */}
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />

        {/* Nome + badge */}
        <div className="flex-1 min-w-0 truncate">
          <span className="truncate">{name}</span>
          {badge && (
            <span className="ml-1.5 text-[10px] text-muted-foreground/70">
              ({badge})
            </span>
          )}
        </div>

        {/* Ações inline (aparecem em hover ou quando selecionado) */}
        <div
          className={cn(
            "flex items-center gap-0.5 shrink-0 transition-opacity",
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility();
            }}
            aria-label={hidden ? "Mostrar" : "Esconder"}
            title={hidden ? "Mostrar" : "Esconder (H)"}
            className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"
          >
            {hidden ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleLock();
            }}
            aria-label={locked ? "Destravar" : "Travar"}
            title={locked ? "Destravar (L)" : "Travar (L)"}
            className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"
          >
            {locked ? (
              <Lock className="size-3.5" />
            ) : (
              <LockOpen className="size-3.5" />
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                aria-label="Mais ações"
                className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"
              >
                <MoreVertical className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="size-3.5 mr-2" /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-3.5 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Children do grupo — readonly, sem drag handle, indentados.
          O grupo é "caixa fechada" — quem edita os filhos é o painel
          direito (properties-panel) ao selecionar o grupo. */}
      {isGroup && expanded && childrenCount > 0 && (
        <div className="ml-1">
          {(element.children as ElementBase[]).map((child) => {
            const ChildIcon = getElementIcon(child.type);
            const childName = getElementDisplayName(child);
            return (
              <div
                key={child.id}
                style={{ paddingLeft: 12 + indent * 16 }}
                className={cn(
                  "flex items-center gap-1.5 px-1 py-1 text-[11px] text-muted-foreground",
                  child.hidden && "opacity-40 line-through",
                )}
              >
                <span className="w-3.5 shrink-0 text-muted-foreground/40">
                  ↳
                </span>
                <ChildIcon className="size-3 shrink-0" />
                <span className="truncate">{childName}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
