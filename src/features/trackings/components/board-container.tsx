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
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { StatusForm } from "./status-form";
import { StatusColumn, StatusItemSkeleton } from "./status-column";
import { Footer } from "./footer";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
// Removendo importação incorreta de StatusItem
import { LeadItem } from "./lead-item";
import { Decimal } from "@prisma/client/runtime/client";
import { useKanbanStore } from "../lib/kanban-store";
import { Lead } from "../types";
import { useLostOrWin } from "@/hooks/use-lost-or-win";
import { useDeletLead } from "@/hooks/use-delete-lead";
import { NavOptionsTracking } from "./nav-options-trancking";
import { useQueryState } from "nuqs";
import dayjs from "dayjs";
import { useLeadSoundAlert } from "@/hooks/use-lead-sound-alert";

interface BoardContainerProps {
  trackingId: string;
}

interface Status {
  id: string;
  order: string;
  name: string;
  color: string | null;
  leads: number;
}

export function BoardContainer({ trackingId }: BoardContainerProps) {
  const [activeLead, setActiveLead] = useState<any>(null);
  const [activeColumn, setActiveColumn] = useState<Status | null>(null);
  const [originalNeighbors, setOriginalNeighbors] = useState<{
    beforeId?: string;
    afterId?: string;
    statusId: string;
  } | null>(null);
  const [dateInit] = useQueryState("date_init");
  const [dateEnd] = useQueryState("date_end");
  const [participantFilter] = useQueryState("participant");
  const [tagsFilter] = useQueryState("tags");
  const [temperatureFilter] = useQueryState("temperature");
  const [actionFilter] = useQueryState("filter");

  const queryInput = useMemo(
    () => ({
      dateInit: dateInit ? dayjs(dateInit).startOf("day").toDate() : undefined,
      dateEnd: dateEnd ? dayjs(dateEnd).endOf("day").toDate() : undefined,
      participantFilter: participantFilter || undefined,
      tagsFilter: tagsFilter ? tagsFilter.split(",") : undefined,
      temperatureFilter: temperatureFilter
        ? temperatureFilter.split(",")
        : undefined,
      actionFilter: actionFilter || "ACTIVE",
    }),
    [
      dateInit,
      dateEnd,
      participantFilter,
      tagsFilter,
      temperatureFilter,
      actionFilter,
    ],
  );

  const { status, isLoading } = useQueryStatus({
    trackingId: trackingId,
    ...queryInput,
  });

  const columnList = useKanbanStore((s) => s.columnList);
  const setColumnList = useKanbanStore((s) => s.setColumnList);
  const moveColumn = useKanbanStore((s) => s.moveColumn);
  const moveLeadInColumn = useKanbanStore((s) => s.moveLeadInColumn);
  const moveLeadToColumn = useKanbanStore((s) => s.moveLeadToColumn);
  const setIsDragging = useKanbanStore((s) => s.setIsDragging);

  const { onOpen } = useLostOrWin();
  const { onOpen: onOpenDeleteLead } = useDeletLead();
  const updateColumnOrder = useUpdateColumnOrder();
  const updateLeadOrder = useUpdateLeadOrder();

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 10,
    },
  });
  const pointerSensor = useSensor(PointerSensor);
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250,
      tolerance: 5,
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(
    mouseSensor,
    pointerSensor,
    touchSensor,
    keyboardSensor,
  );

  const columnIds = useMemo(() => columnList.map((s) => s.id), [columnList]);

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      setIsDragging(true);
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
    },
    [setIsDragging],
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      setIsDragging(false);
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
        console.log({
          leadId: lead.id,
          targetStatusId: targetColumnId,
          beforeId: currentNeighbors.beforeId,
          afterId: currentNeighbors.afterId,
          trackingId: trackingId,
        });

        updateLeadOrder.mutate({
          leadId: lead.id,
          targetStatusId: targetColumnId,
          beforeId: currentNeighbors.beforeId,
          afterId: currentNeighbors.afterId,
          trackingId,
        });
      }
    },
    [
      columnList,
      onOpen,
      onOpenDeleteLead,
      originalNeighbors,
      setIsDragging,
      status,
      trackingId,
      updateColumnOrder,
      updateLeadOrder,
    ],
  );

  const onDragOver = useCallback(
    (event: DragOverEvent) => {
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

      // Busca a coluna ATUAL do lead no store, não a original
      const activeColumnId = useKanbanStore.getState().findLeadColumn(activeId);
      if (!activeColumnId) return;

      const overColumnId =
        overType === "Lead" ? over.data.current?.lead.statusId : over.id;

      if (activeColumnId !== overColumnId) {
        moveLeadToColumn(
          activeId,
          activeColumnId,
          overColumnId,
          overType === "Lead" ? overId : undefined,
        );
      } else {
        moveLeadInColumn(activeColumnId, activeId, overId);
      }
    },
    [moveColumn, moveLeadToColumn, moveLeadInColumn],
  );

  const isDragging = useKanbanStore((s) => s.isDragging);
  const columns = useKanbanStore((s) => s.columns);
  const totalLeads = useMemo(
    () => Object.values(columns).reduce((acc, col) => acc + col.leads.length, 0),
    [columns],
  );

  useLeadSoundAlert({ trackingId, totalLeads });

  useEffect(() => {
    if (status && !isDragging) {
      setColumnList(status);
    }
  }, [status, setColumnList, isDragging]);

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
    <>
      <NavOptionsTracking />
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
      >
        <div className="grid grid-rows-[1fr_auto] h-full">
          <ol className="flex gap-x-3 overflow-x-auto">
            <SortableContext items={columnIds}>
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
                  isOverlay
                />
              )}
              {activeLead && <LeadItem data={activeLead} />}
            </DragOverlay>,
            document.body,
          )}
      </DndContext>
    </>
  );
}
