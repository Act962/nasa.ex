"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { client } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical, Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import type { LinnkerPage, LinnkerLink } from "../types";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { LinnkerLinkRow } from "./links/linnker-link-row";
import { LinnkerLinkThumb } from "./links/linnker-link-thumb";
import { LinnkerAddLinkDialog } from "./links/linnker-add-link-dialog";

interface Props {
  page: LinnkerPage;
  onRefetch: () => void;
  /** Aberto também pelo botão central do menu de baixo, por isso o estado mora no editor. */
  isAddLinkOpen: boolean;
  onAddLinkOpenChange: (open: boolean) => void;
}

export function LinnkerLinksEditor({ page, onRefetch, isAddLinkOpen, onAddLinkOpenChange }: Props) {
  const [localLinks, setLocalLinks] = useState<LinnkerLink[]>(page.links);
  const [syncedLinks, setSyncedLinks] = useState<LinnkerLink[]>(page.links);
  const [activeLinkId, setActiveLinkId] = useState<string | null>(null);

  // Lista nova do servidor substitui a ordem local (padrão do React para estado derivado de props).
  if (syncedLinks !== page.links) {
    setSyncedLinks(page.links);
    setLocalLinks(page.links);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { mutate: reorderLinks } = useMutation({
    mutationFn: (orderedIds: string[]) =>
      client.linnker.reorderLinks({ pageId: page.id, orderedIds }),
    onError: () => {
      toast.error("Erro ao reordenar");
      onRefetch();
    },
    onSuccess: () => onRefetch(),
  });

  const { mutate: deleteLink } = useMutation({
    mutationFn: (id: string) => client.linnker.deleteLink({ id }),
    onSuccess: () => {
      toast.success("Link removido");
      onRefetch();
    },
  });

  const { mutate: toggleLink } = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      client.linnker.updateLink({ id, isActive }),
    onSuccess: onRefetch,
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveLinkId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLinkId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localLinks.findIndex((link) => link.id === active.id);
    const newIndex = localLinks.findIndex((link) => link.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reorderedLinks = arrayMove(localLinks, oldIndex, newIndex);
    setLocalLinks(reorderedLinks);
    reorderLinks(reorderedLinks.map((link) => link.id));
  };

  const draggedLink = activeLinkId ? localLinks.find((link) => link.id === activeLinkId) : null;

  return (
    <div className="space-y-3">
      {localLinks.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-[22px] border border-dashed border-line px-6 py-10 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-muted">
            <Link2 className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Adicione o primeiro link: WhatsApp, formulário, agenda ou qualquer site.
          </p>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveLinkId(null)}
      >
        <SortableContext items={localLinks.map((link) => link.id)} strategy={verticalListSortingStrategy}>
          <ul className="m-0 list-none space-y-2 p-0 sm:space-y-3">
            {localLinks.map((link) => (
              <LinnkerLinkRow
                key={link.id}
                link={link}
                pageSlug={page.slug}
                pageCoverColor={page.coverColor}
                onDelete={() => deleteLink(link.id)}
                onToggle={(isActive) => toggleLink({ id: link.id, isActive })}
                onRefetch={onRefetch}
              />
            ))}
          </ul>
        </SortableContext>
        <DragOverlay>
          {draggedLink ? (
            <div className="cursor-grabbing rounded-[18px] border-2 border-primary bg-card shadow-2xl ring-4 ring-primary/20">
              <div className="flex items-center gap-3 p-3">
                <GripVertical className="size-4 shrink-0 text-primary" />
                <LinnkerLinkThumb link={draggedLink} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{draggedLink.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{draggedLink.url}</p>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Button
        variant="outline"
        className="mt-2 h-11 w-full rounded-full border-dashed md:h-9"
        onClick={() => onAddLinkOpenChange(true)}
        data-guide={GUIDE_ANCHORS.linnkerAddLinkButton.id}
      >
        <Plus className="size-4" /> Adicionar link
      </Button>

      <LinnkerAddLinkDialog
        page={page}
        open={isAddLinkOpen}
        onOpenChange={onAddLinkOpenChange}
        onRefetch={onRefetch}
      />
    </div>
  );
}
