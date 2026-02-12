"use client";

import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useQueryStatus } from "../hooks/use-trackings";
import {
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { StatusForm } from "./status-form";
import { StatusColumn } from "./status-column";
import { Footer } from "./footer";
import { useState } from "react";
import { createPortal } from "react-dom";
import { StatusItem } from "@/app/(platform)/(tracking)/tracking/[trackingId]/_components/kanbam/status-item";
import { LeadItem } from "./lead-item";

interface BoardContainerProps {
  trackingId: string;
}

interface Status {
  id: string;
  name: string;
  color: string | null;
  order: number;
}

export function BoardContainer({ trackingId }: BoardContainerProps) {
  const [activeLead, setActiveLead] = useState<any>(null);
  const [activeColumn, setActiveColumn] = useState<Status | null>(null);

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
      setActiveLead(event.active.data.current.lead);
    }
  }

  const { status, isLoading } = useQueryStatus({
    trackingId,
  });

  if (isLoading) return null;
  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={() => {}}
      onDragOver={() => {}}
    >
      <div className="grid grid-rows-[1fr_auto] h-full">
        <ol className="flex gap-x-3 overflow-x-auto">
          <SortableContext items={status.map((s) => s.id)}>
            {status.map((s, index) => (
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
                index={activeColumn.order}
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
