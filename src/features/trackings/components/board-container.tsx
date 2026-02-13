"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  useQueryStatus,
  useUpdateColumnOrder,
  useUpdateLeadOrder,
} from "../hooks/use-trackings";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { StatusForm } from "./status-form";
import { StatusColumn, StatusItemSkeleton } from "./status-column";
import { Footer } from "./footer";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
// Removendo importação incorreta de StatusItem
import { LeadItem } from "./lead-item";
import { Decimal } from "@prisma/client/runtime/client";
import { useKanbanStore } from "../lib/kanban-store";
import { Lead } from "../types";
import { useLostOrWin } from "@/hooks/use-lost-or-win";
import { useDeletLead } from "@/hooks/use-delete-lead";

interface BoardContainerProps {
  trackingId: string;
}

interface Status {
  order: string;
  id: string;
  name: string;
  color: string | null;
}

export function BoardContainer({ trackingId }: BoardContainerProps) {
  const [activeLead, setActiveLead] = useState<any>(null);
  const [activeColumn, setActiveColumn] = useState<Status | null>(null);
  const [originalNeighbors, setOriginalNeighbors] = useState<{
    beforeId?: string;
    afterId?: string;
    statusId: string;
  } | null>(null);
  const {
    columnList,
    setColumnList,
    moveColumn,
    moveLeadInColumn,
    moveLeadToColumn,
  } = useKanbanStore();
  const { onOpen } = useLostOrWin();
  const { onOpen: onOpenDeleteLead } = useDeletLead();
  const updateColumnOrder = useUpdateColumnOrder();
  const updateLeadOrder = useUpdateLeadOrder();

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragStart(event: DragStartEvent) {
    const type = event.active.data.current?.type;

    if (type === "Column" && event.active.data.current?.column) {
      setActiveColumn(event.active.data.current.column);
    }

    if (type === "Lead" && event.active.data.current?.lead) {
      const lead = event.active.data.current.lead;
      const neighbors = useKanbanStore
        .getState()
        .getLeadNeighbors(lead.statusId, lead.id);
      setOriginalNeighbors({ ...neighbors, statusId: lead.statusId });
      setActiveLead(lead);
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    setActiveColumn(null);
    setActiveLead(null);

    if (!over) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    if (activeType === "Lead" && overType === "FooterButton") {
      const leadData: Lead = active.data.current?.lead;
      const footerAction = over.data.current?.action;

      switch (footerAction) {
        case "ganho":
          onOpen(leadData.id, "WIN");
          break;
        case "perdido":
          onOpen(leadData.id, "LOSS");
          break;
        case "excluir":
          onOpenDeleteLead({ ...leadData, trackingId });
          break;
      }

      return;
    }

    if (activeType === "Column") {
      const activeId = active.id as string;

      const originalIndex = status.findIndex((s) => s.id === activeId);
      const newIndex = columnList.findIndex((c) => c.id === activeId);

      if (originalIndex === newIndex) return;

      const prev = columnList[newIndex - 1];
      const next = columnList[newIndex + 1];

      let newOrder: Decimal;

      if (!prev && next) {
        newOrder = new Decimal(next.order).minus(1);
      } else if (prev && !next) {
        newOrder = new Decimal(prev.order).plus(1);
      } else if (prev && next) {
        newOrder = new Decimal(prev.order).plus(next.order).div(2);
      } else {
        newOrder = new Decimal(1000);
      }

      updateColumnOrder.mutate({
        id: activeId,
        order: newOrder.toString(),
      });

      return;
    }

    if (activeType === "Lead") {
      const lead = active.data.current?.lead;

      let targetColumnId: string | null = null;
      let overLeadId: string | undefined;

      if (overType === "Lead") {
        targetColumnId = over.data.current?.lead.statusId;
        overLeadId = over.data.current?.lead.id;
      }

      if (overType === "Column") {
        targetColumnId = over.data.current?.column.id;
      }

      if (!targetColumnId) return;

      const currentNeighbors = useKanbanStore
        .getState()
        .getLeadNeighbors(targetColumnId, lead.id);

      if (
        targetColumnId === originalNeighbors?.statusId &&
        currentNeighbors.beforeId === originalNeighbors.beforeId &&
        currentNeighbors.afterId === originalNeighbors.afterId
      ) {
        return;
      }

      updateLeadOrder.mutate({
        leadId: lead.id,
        targetStatusId: targetColumnId,
        beforeId: currentNeighbors.beforeId,
        afterId: currentNeighbors.afterId,
      });
    }
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    if (activeType === "Column" && overType === "Column") {
      moveColumn(activeId, overId);
      return;
    }

    if (activeType !== "Lead") return;

    const activeColumnId = active.data.current?.lead.statusId;
    const overColumnId =
      overType === "Lead" ? over.data.current?.lead.statusId : over.id;

    if (activeColumnId !== overColumnId) {
      // MOVE ENTRE COLUNAS VISUALMENTE
      moveLeadToColumn(
        activeId,
        activeColumnId,
        overColumnId,
        overType === "Lead" ? overId : undefined,
      );
    } else {
      // REORDENA NA MESMA COLUNA VISUALMENTE
      moveLeadInColumn(activeColumnId, activeId, overId);
    }
  }

  const { status, isLoading } = useQueryStatus({
    trackingId: trackingId,
  });

  useEffect(() => {
    if (status) {
      setColumnList(status);
    }
  }, [status, setColumnList]);

  if (isLoading) {
    return (
      <div className="grid grid-rows-[1fr_auto] h-full">
        <ol className="flex gap-x-3 overflow-x-auto">
          <StatusItemSkeleton />
          <StatusItemSkeleton />
          <StatusItemSkeleton />
          <StatusItemSkeleton />
          <StatusItemSkeleton />
        </ol>
        <Footer />
      </div>
    );
  }
  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
    >
      <div className="grid grid-rows-[1fr_auto] h-full">
        <ol className="flex gap-x-3 overflow-x-auto">
          <SortableContext items={columnList.map((s) => s.id)}>
            {columnList.map((s, index) => (
              <StatusColumn
                key={s.id}
                status={s}
                index={index}
                trackingId={trackingId}
              />
            ))}
          </SortableContext>
          <StatusForm />
          <div className="shrink-0 w-1" />
        </ol>
        <Footer />
      </div>

      {typeof window !== "undefined" &&
        createPortal(
          <DragOverlay>
            {activeColumn && (
              <StatusColumn
                index={Number(activeColumn.order)}
                status={activeColumn}
                trackingId={trackingId}
              />
            )}
            {activeLead && <LeadItem data={activeLead} />}
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
}
