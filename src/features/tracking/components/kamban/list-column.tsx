"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";
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

export interface Column {
  id: string;
  title: string;
  loading?: boolean;
  leads: Lead[];
}

export interface Lead {
  id: string;
  name: string;
  tags: string[];
  profile?: string;
  columnId: string;
}

export function ListColumn() {
  const loadingColumns = false;

  // Estados separados para columns e leads
  const [columns, setColumns] = useState<Column[]>([
    { title: "Coluna 1", id: "1", loading: false, leads: [] },
    {
      title:
        "Coluna 2zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
      id: "2",
      loading: false,
      leads: [],
    },
    { title: "Coluna 3", id: "3", loading: false, leads: [] },
  ]);

  const [leads, setLeads] = useState<Lead[]>([
    {
      name: "Arthur",
      id: "01",
      tags: ["nada", "teste"],
      columnId: "1",
    },
    {
      name: "Fulano",
      id: "02",
      tags: ["nada", "teste"],
      columnId: "1",
    },
    {
      name: "Maria",
      id: "03",
      tags: ["importante"],
      columnId: "2",
    },
    {
      name: "João",
      id: "04",
      tags: ["urgente"],
      columnId: "3",
    },
    {
      name: "Arthur",
      id: "06",
      tags: ["nada", "teste"],
      columnId: "1",
    },
    {
      name: "Arthur",
      id: "07",
      tags: ["nada", "teste"],
      columnId: "1",
    },
    {
      name: "Arthur",
      id: "08",
      tags: ["nada", "teste"],
      columnId: "1",
    },
  ]);

  const columnsId = useMemo(() => columns.map((col) => col.id), [columns]);
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

  function handleAddColumn() {
    // Sua lógica aqui
  }

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

    // Drag de colunas
    if (
      active.data.current?.type === "Column" &&
      over.data.current?.type === "Column"
    ) {
      const activeColumnId = active.id;
      const overColumnId = over.id;

      if (activeColumnId === overColumnId) return;

      setColumns((columns) => {
        const activeColumnIndex = columns.findIndex(
          (col) => col.id === activeColumnId
        );
        const overColumnIndex = columns.findIndex(
          (col) => col.id === overColumnId
        );

        return arrayMove(columns, activeColumnIndex, overColumnIndex);
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
    if (isActiveALead && isOverALead) {
      setLeads((leads) => {
        const activeIndex = leads.findIndex((t) => t.id === activeId);
        const overIndex = leads.findIndex((t) => t.id === overId);

        // Atualiza a coluna do lead ativo
        leads[activeIndex].columnId = leads[overIndex].columnId;

        return arrayMove(leads, activeIndex, overIndex);
      });
    }

    // Lead sobre Coluna
    const isOverAColumn = over.data.current?.type === "Column";
    if (isActiveALead && isOverAColumn) {
      setLeads((leads) => {
        const activeIndex = leads.findIndex((t) => t.id === activeId);

        // Atualiza a coluna do lead
        leads[activeIndex].columnId = overId as string;

        return arrayMove(leads, activeIndex, activeIndex);
      });
    }
  }

  return (
    <div className="h-full w-full absolute">
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
      >
        <ol className="overflow-x-auto overflow-y-auto flex flex-row">
          {columns.length >= 1 && !loadingColumns && (
            <div className="flex gap-2">
              <SortableContext items={columnsId}>
                {columns.map((column) => (
                  <div key={column.id} className="ml-2">
                    <ColumnTracking
                      key={column.id}
                      id={column.id}
                      title={column.title}
                      leads={leads.filter(
                        (lead) => lead.columnId === column.id
                      )}
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
                    title={activeColumn.title}
                    leads={leads.filter(
                      (lead) => lead.columnId === activeColumn.id
                    )}
                  />
                )}
                {activeLead && (
                  <div>
                    <CardTracking
                      columnId={activeLead.columnId}
                      id={activeLead.id}
                      name={activeLead.name}
                      tags={activeLead.tags}
                      key={activeLead.id}
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
