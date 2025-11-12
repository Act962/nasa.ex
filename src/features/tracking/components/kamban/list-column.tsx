"use client";

import { useEffect, useMemo, useState } from "react";
import { ColumnTracking } from "./column";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext } from "@dnd-kit/sortable";
import { createPortal } from "react-dom";
import { CardTracking } from "./card/card";
import { ButtonAddColumn } from "./button-add-column";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useParams } from "next/navigation";
import { toast } from "sonner";

export interface Column {
  id: string;
  name: string;
  color: string | null;
  order: number;
  leads: Lead[];
}

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  order: number;
  phone: string | null;
  statusId: string;
}

export function ListColumn() {
  const loadingColumns = false;
  const params = useParams();

  const trackingId = params.trackingId as string;
  const {
    data: { status },
    isLoading,
  } = useSuspenseQuery(
    orpc.status.list.queryOptions({
      input: {
        trackingId,
      },
    })
  );

  const updateColumnOrder = useMutation(
    orpc.status.updateOrder.mutationOptions({
      onSuccess: (data) => {
        toast.success("Coluna atualizado com sucesso!");
      },
      onError: () => {
        toast.error("Erro ao atualizar coluna");
      },
    })
  );

  const [columns, setColumns] = useState<Column[]>(status);

  const columnsId = useMemo(() => status.map((col) => col.id), [status]);
  const [activeColumn, setActiveColumn] = useState<Column | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const touchSensor = useSensor(TouchSensor);

  const keyboardSensor = useSensor(KeyboardSensor);

  // Configuração dos sensores
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 2,
      },
    }),
    touchSensor,
    keyboardSensor
  );

  // Handlers de drag and drop
  function onDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === "Column") {
      setActiveColumn(event.active.data.current.column);
      return;
    }
    if (event.active.data.current?.type === "Lead") {
      setActiveLead(event.active.data.current.lead);
      return;
    }
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveColumn(null);
    setActiveLead(null);

    const { active, over } = event;
    if (!over) return;
    console.log("active:", active);
    console.log("over:", over);
    // Drag de colunas
    if (
      active.data.current?.type === "Column" &&
      over.data.current?.type === "Column"
    ) {
      const activeColumnId = active.id;
      const overColumnId = over.id;

      if (activeColumnId === overColumnId) return;

      // Calcule primeiro
      const activeColumnIndex = columns.findIndex(
        (col) => col.id === activeColumnId
      );
      const overColumnIndex = columns.findIndex(
        (col) => col.id === overColumnId
      );

      const newItems = arrayMove(columns, activeColumnIndex, overColumnIndex);

      // Agora você tem newItems disponível
      console.log("Nova ordem:", newItems);

      // Atualiza o estado
      setColumns(newItems);

      const newOrder = newItems.findIndex((col) => col.id === activeColumnId);

      updateColumnOrder.mutate({
        newOrder,
        statusId: activeColumnId as string,
        trackingId,
      });
    }
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveALead = active.data.current?.type === "Lead";
    const isOverALead = over.data.current?.type === "Lead";

    if (!isActiveALead) return;

    // Lead sobre Lead (mesma coluna ou coluna diferente)
    // if (isActiveALead && isOverALead) {
    //   setLeads((leads) => {
    //     const activeIndex = leads.findIndex((t) => t.id === activeId);
    //     const overIndex = leads.findIndex((t) => t.id === overId);

    //     // Atualiza a coluna do lead ativo
    //     leads[activeIndex].statusId = leads[overIndex].statusId;

    //     return arrayMove(leads, activeIndex, overIndex);
    //   });
    // }

    // // Lead sobre Coluna
    // const isOverAColumn = over.data.current?.type === "Column";
    // if (isActiveALead && isOverAColumn) {
    //   setLeads((leads) => {
    //     const activeIndex = leads.findIndex((t) => t.id === activeId);

    //     // Atualiza a coluna do lead
    //     leads[activeIndex].statusId = overId as string;

    //     return arrayMove(leads, activeIndex, activeIndex);
    //   });
    // }
  }
  return (
    <div className="h-full w-full absolute ">
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
      >
        <ol className="overflow-x-auto overflow-y-auto flex flex-row scroll-cols-tracking ">
          {columns.length >= 1 && !loadingColumns && (
            <div className="flex gap-2">
              <SortableContext items={columnsId}>
                {columns.map((column, index) => (
                  <div key={column.id} className="ml-2">
                    <ColumnTracking
                      index={index}
                      key={column.id}
                      id={column.id}
                      name={column.name}
                      leads={column.leads}
                      color=""
                      columnId={column.id}
                    />
                  </div>
                ))}
              </SortableContext>
            </div>
          )}

          <div>
            <ButtonAddColumn />
          </div>

          {/* DragOverlay para preview durante o drag */}
          {typeof document !== "undefined" &&
            createPortal(
              <DragOverlay>
                {activeColumn && (
                  <ColumnTracking
                    id={activeColumn.id}
                    name={activeColumn.name}
                    color=""
                    columnId={activeColumn.id}
                    leads={activeColumn.leads}
                    index={activeColumn.order}
                  />
                )}
                {activeLead && (
                  <div>
                    <CardTracking
                      columnId={activeLead.statusId}
                      leadId={activeLead.id}
                      name={activeLead.name}
                      // tags={activeLead.tags}
                      key={activeLead.id}
                      index={activeLead.order}
                    />
                  </div>
                )}
              </DragOverlay>,
              document.body
            )}
        </ol>
      </DndContext>
    </div>
  );
}
