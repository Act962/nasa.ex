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
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { WorkspaceColumn, StatusItemSkeleton } from "./status-column";
import { KanbanCard } from "./kanban-card";
import { ErrorBoundary } from "@/components/error-boundary";
import { Decimal } from "@prisma/client/runtime/client";
import { ColumnForm } from "./column-form";
import { useReorderAction } from "../../hooks/use-tasks";
import { useActionKanbanStore } from "../../lib/kanban-store";
import { Action } from "../../types";
import { useUpdateColumnOrder } from "../../hooks/use-columns";
import { useColumnsByWorkspace } from "@/features/workspace/hooks/use-workspace";
import { useActionFilters } from "../../hooks/use-action-filters";

interface Props {
  workspaceId: string;
}

export const DataKanban = ({ workspaceId }: Props) => {
  return (
    <ErrorBoundary>
      <KanbanBoard workspaceId={workspaceId} />
    </ErrorBoundary>
  );
};

const KanbanBoard = ({ workspaceId }: Props) => {
  const { filters } = useActionFilters();
  const { columns: fetchedColumns, isLoading: isColumnsLoading } =
    useColumnsByWorkspace(workspaceId, {
      participantIds: filters.participantIds,
      tagIds: filters.tagIds,
      dueDateFrom: filters.dueDateFrom,
      dueDateTo: filters.dueDateTo,
    });
  const reorderAction = useReorderAction();
  const reorderColumn = useUpdateColumnOrder();

  const columnList = useActionKanbanStore((s) => s.columnList);
  const setColumnList = useActionKanbanStore((s) => s.setColumnList);
  const moveColumn = useActionKanbanStore((s) => s.moveColumn);
  const moveActionInColumn = useActionKanbanStore((s) => s.moveActionInColumn);
  const moveActionToColumn = useActionKanbanStore((s) => s.moveActionToColumn);
  const setIsDragging = useActionKanbanStore((s) => s.setIsDragging);
  const isDragging = useActionKanbanStore((s) => s.isDragging);

  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [activeColumn, setActiveColumn] = useState<any>(null);

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 10 },
  });
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 5 },
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

  useEffect(() => {
    if (!fetchedColumns.length || isDragging) return;

    const currentIds = columnList.map((c) => c.id).join(",");
    const nextIds = fetchedColumns.map((c) => c.id).join(",");

    if (currentIds !== nextIds) {
      setColumnList(fetchedColumns);
    }
  }, [fetchedColumns, setColumnList, isDragging, columnList]);

  const columnIds = useMemo(() => columnList.map((c) => c.id), [columnList]);

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      setIsDragging(true);
      const type = event.active.data?.current?.type;

      if (type === "Column") {
        setActiveColumn(event.active.data?.current?.column);
      }

      if (type === "Action") {
        setActiveAction(event.active.data?.current?.action);
      }
    },
    [setIsDragging],
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setIsDragging(false);
      setActiveColumn(null);
      setActiveAction(null);

      if (!over) return;

      const activeType = active.data?.current?.type;
      const overType = over.data?.current?.type;

      if (activeType === "Column") {
        const activeId = active.id as string;
        const overId = over.id as string;

        if (activeId !== overId) {
          const columns = useActionKanbanStore.getState().columnList;
          const overIndex = columns.findIndex((c) => c.id === overId);
          const prev = columns[overIndex - 1];
          const next = columns[overIndex];

          let newOrder: string;
          if (!prev && next) {
            newOrder = new Decimal(next.order).minus(1000).toString();
          } else if (prev && !next) {
            newOrder = new Decimal(prev.order).plus(1000).toString();
          } else if (prev && next) {
            newOrder = new Decimal(prev.order)
              .plus(next.order)
              .div(2)
              .toString();
          } else {
            newOrder = "1000";
          }

          reorderColumn.mutate({ id: activeId, order: newOrder });
        }
        return;
      }

      if (activeType === "Action") {
        const action = active.data?.current?.action as Action;
        let targetColumnId: string | null = null;
        let overActionId: string | undefined;

        if (overType === "Action") {
          targetColumnId = over.data?.current?.action.columnId;
          overActionId = over.data?.current?.action.id;
        } else if (overType === "Column") {
          targetColumnId = over.data?.current?.column.id;
        }

        if (!targetColumnId) return;

        const newOrder = useActionKanbanStore
          .getState()
          .calculateMidpoint(targetColumnId, action.id);

        reorderAction.mutate({
          id: action.id,
          columnId: targetColumnId,
          order: newOrder,
        });
      }
    },
    [columnList, reorderAction, reorderColumn, setIsDragging],
  );

  const onDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;
      const activeType = active.data?.current?.type;
      const overType = over.data?.current?.type;

      if (activeType === "Column" && overType === "Column") {
        moveColumn(activeId, overId);
        return;
      }

      if (activeType !== "Action") return;

      const activeColumnId = useActionKanbanStore
        .getState()
        .findActionColumn(activeId);
      if (!activeColumnId) return;

      const overColumnId =
        overType === "Action" ? over.data?.current?.action.columnId : over.id;

      if (activeColumnId !== overColumnId) {
        moveActionToColumn(
          activeId,
          activeColumnId,
          overColumnId,
          overType === "Action" ? overId : undefined,
        );
      } else {
        moveActionInColumn(activeColumnId, activeId, overId);
      }
    },
    [moveColumn, moveActionToColumn, moveActionInColumn],
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
    >
      <div className="grid grid-rows-[1fr_auto] h-full overflow-hidden">
        <ol className="flex  gap-x-3 overflow-x-auto p-4 h-full scrollbar-thin">
          <SortableContext items={columnIds}>
            {columnList.map((column) => (
              <WorkspaceColumn
                key={column.id}
                {...column}
                workspaceId={workspaceId}
              />
            ))}
          </SortableContext>
          <ColumnForm />
          <div className="shrink-0 w-1" />
        </ol>
      </div>

      {typeof window !== "undefined" &&
        createPortal(
          <DragOverlay>
            {activeColumn && <WorkspaceColumn {...activeColumn} isOverlay />}
            {activeAction && <KanbanCard action={activeAction} />}
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
};
