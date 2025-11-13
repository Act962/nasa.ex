"use client";

import { orpc } from "@/lib/orpc";
import { useSuspenseQuery } from "@tanstack/react-query";
import { StatusForm } from "./status-form";
import { useEffect, useState } from "react";
import { StatusItem } from "./status-item";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

interface ListContainerProps {
  trackingId: string;
}

export function ListContainer({ trackingId }: ListContainerProps) {
  const { data, isLoading } = useSuspenseQuery(
    orpc.status.list.queryOptions({
      input: {
        trackingId,
      },
    })
  );
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(PointerSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [statusData, setStatusData] = useState(data.status);

  useEffect(() => {
    setStatusData(data.status);
  }, [data]);

  return (
    <DndContext>
      <ol className="flex gap-x-3 h-full">
        <SortableContext items={statusData.map((col) => col.id)}>
          {statusData.map((status, index) => {
            return <StatusItem key={status.id} index={index} data={status} />;
          })}
        </SortableContext>
        <StatusForm />
        <div className="shrink-0 w-1" />
      </ol>
    </DndContext>
  );
}
