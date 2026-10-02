"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LinnkerLinkThumb } from "./linnker-link-thumb";
import { LinnkerLinkEditDialog } from "./linnker-link-edit-dialog";
import type { LinnkerLink } from "../../types";

interface LinnkerLinkRowProps {
  link: LinnkerLink;
  pageSlug: string;
  pageCoverColor: string;
  onDelete: () => void;
  onToggle: (isActive: boolean) => void;
  onRefetch: () => void;
}

export function LinnkerLinkRow({ link, pageSlug, pageCoverColor, onDelete, onToggle, onRefetch }: LinnkerLinkRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const isBanner = link.displayStyle === "banner";

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: link.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("list-none overflow-hidden rounded-[18px] border border-line bg-card", isDragging && "opacity-30")}
    >
      <div className="flex items-center gap-2 p-2 sm:gap-3 sm:p-3">
        <div
          ref={setActivatorNodeRef}
          aria-label="Arrastar para reordenar"
          {...attributes}
          {...listeners}
          className="grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded-full outline-none select-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        >
          <GripVertical className="pointer-events-none size-4 text-muted-foreground" />
        </div>

        <LinnkerLinkThumb link={link} />

        <button type="button" onClick={() => setIsEditing(true)} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1.5">
            <p className={cn("truncate text-sm font-medium", !link.isActive && "text-muted-foreground")}>{link.title}</p>
            {isBanner && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Banner
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{link.url}</p>
        </button>

        <Switch
          checked={link.isActive}
          onCheckedChange={onToggle}
          className="shrink-0"
          aria-label={link.isActive ? "Esconder link da página" : "Mostrar link na página"}
        />

        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 rounded-full max-sm:hidden"
          onClick={() => setIsEditing(true)}
          aria-label="Editar link"
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 rounded-full text-destructive hover:text-destructive max-sm:hidden"
          onClick={onDelete}
          aria-label="Excluir link"
        >
          <Trash2 className="size-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-9 shrink-0 rounded-full sm:hidden" aria-label="Mais ações">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsEditing(true)}>
              <Pencil className="size-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="size-4" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isEditing && (
        <LinnkerLinkEditDialog
          link={link}
          pageSlug={pageSlug}
          pageCoverColor={pageCoverColor}
          open={isEditing}
          onOpenChange={setIsEditing}
          onRefetch={onRefetch}
        />
      )}
    </li>
  );
}
