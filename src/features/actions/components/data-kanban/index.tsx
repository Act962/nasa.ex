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
import { WorkspaceColumn } from "./status-column";
import { KanbanCard } from "./kanban-card";
import { ErrorBoundary } from "@/components/error-boundary";
import { ColumnForm } from "./column-form";
import { toast } from "sonner";
import { useReorderAction } from "../../hooks/use-tasks";
import { useActionKanbanStore } from "../../lib/kanban-store";
import { Action } from "../../types";
import { useUpdateColumnOrder } from "../../hooks/use-columns";
import { useColumnsByWorkspace } from "@/features/workspace/hooks/use-workspace";
import { useActionFilters } from "../../hooks/use-action-filters";
import { useBoardActionsRealtimeSync } from "../../hooks/use-board-actions-realtime-sync";

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
      projectIds: filters.projectIds,
      dueDateFrom: filters.dueDateFrom,
      dueDateTo: filters.dueDateTo,
    });
  useBoardActionsRealtimeSync({ workspaceId });
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
  const [originalNeighbors, setOriginalNeighbors] = useState<{
    beforeId?: string;
    afterId?: string;
    columnId: string;
  } | null>(null);

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

    // Lê o snapshot atual via getState() em vez de incluir columnList nas deps
    // — caso contrário, o setColumnList logo abaixo dispararia o efeito de novo.
    const sig = (cols: any[]) =>
      cols
        .map(
          (column) =>
            `${column.id}:${column.name}:${column.color}:${column.actionsCount}:${column.order}`,
        )
        .join(",");

    const current = useActionKanbanStore.getState().columnList;

    if (sig(current) !== sig(fetchedColumns)) {
      setColumnList(fetchedColumns);
    }
  }, [fetchedColumns, setColumnList, isDragging]);

  const columnIds = useMemo(() => columnList.map((c) => c.id), [columnList]);

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      const type = event.active.data?.current?.type;

      if (type === "Action" && filters.sortBy !== "order") {
        toast.info(
          "A ordenação manual só é refletida quando o filtro de ordenação está em 'Manual'.",
        );
      }

      setIsDragging(true);

      if (type === "Column") {
        const column = event.active.data?.current?.column;
        const neighbors = useActionKanbanStore
          .getState()
          .getColumnNeighbors(column.id);
        setOriginalNeighbors({ ...neighbors, columnId: "NONE" }); // Columns don't have parent column
        setActiveColumn(column);
      }

      if (type === "Action") {
        const action = event.active.data?.current?.action;
        const neighbors = useActionKanbanStore
          .getState()
          .getActionNeighbors(action.columnId, action.id);
        setOriginalNeighbors({ ...neighbors, columnId: action.columnId });
        setActiveAction(action);
      }
    },
    [setIsDragging],
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveColumn(null);
      setActiveAction(null);
      setOriginalNeighbors(null);

      if (!over) {
        setIsDragging(false);
        return;
      }

      const activeType = active.data?.current?.type;
      const overType = over.data?.current?.type;

      if (activeType === "Column") {
        const activeId = active.id as string;
        const overId = over.id as string;

        if (activeId !== overId) {
          const currentNeighbors = useActionKanbanStore
            .getState()
            .getColumnNeighbors(activeId);

          if (
            currentNeighbors.beforeId === originalNeighbors?.beforeId &&
            currentNeighbors.afterId === originalNeighbors?.afterId
          ) {
            setIsDragging(false);
            return;
          }

          reorderColumn.mutate(
            {
              id: activeId,
              beforeId: currentNeighbors.beforeId,
              afterId: currentNeighbors.afterId,
            },
            {
              onSettled: () => setIsDragging(false),
            },
          );
        } else {
          setIsDragging(false);
        }
        return;
      }

      if (activeType === "Action") {
        const action = active.data?.current?.action as Action;
        let targetColumnId: string | null = null;

        if (overType === "Action") {
          targetColumnId =
            useActionKanbanStore
              .getState()
              .findActionColumn(over.id as string) ??
            over.data?.current?.action.columnId;
        } else if (overType === "Column") {
          targetColumnId = over.data?.current?.column.id;
        }

        if (!targetColumnId) {
          setIsDragging(false);
          return;
        }

        // Aplica o movimento (cross-column OU within-column) APENAS no drop.
        // Mid-drag não mutamos o store — dnd-kit lida com o visual via
        // DragOverlay. Isso evita unmount/mount em loop.
        const currentColumnId = useActionKanbanStore
          .getState()
          .findActionColumn(action.id);

        if (currentColumnId !== targetColumnId) {
          moveActionToColumn(
            action.id,
            currentColumnId ?? action.columnId ?? targetColumnId,
            targetColumnId,
            overType === "Action" ? (over.id as string) : undefined,
          );
        } else if (overType === "Action" && (over.id as string) !== action.id) {
          moveActionInColumn(targetColumnId, action.id, over.id as string);
        }

        const currentNeighbors = useActionKanbanStore
          .getState()
          .getActionNeighbors(targetColumnId, action.id);

        if (
          targetColumnId === originalNeighbors?.columnId &&
          currentNeighbors.beforeId === originalNeighbors?.beforeId &&
          currentNeighbors.afterId === originalNeighbors?.afterId
        ) {
          setIsDragging(false);
          return;
        }

        reorderAction.mutate(
          {
            id: action.id,
            columnId: targetColumnId,
            beforeId: currentNeighbors.beforeId,
            afterId: currentNeighbors.afterId,
            previousColumnId: originalNeighbors?.columnId,
          },
          { onSettled: () => setIsDragging(false) },
        );
        return;
      }

      setIsDragging(false);
    },
    [
      moveActionInColumn,
      moveActionToColumn,
      originalNeighbors,
      reorderAction,
      reorderColumn,
      setIsDragging,
    ],
  );

  const onDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;
      if (activeId === overId) return;

      const activeType = active.data?.current?.type;
      const overType = over.data?.current?.type;

      if (activeType === "Column" && overType === "Column") {
        moveColumn(activeId, overId);
        return;
      }

      // Within-column é seguro: KanbanCard fica montado na mesma SortableContext,
      // dnd-kit só aplica CSS transforms (sem unmount/mount → sem ref churn nos
      // Radix internos). Cross-column NÃO entra aqui — fica pro onDragEnd, senão
      // o ciclo unmount/remount dispara "Maximum update depth".
      if (activeType === "Action" && overType === "Action") {
        const activeAction = active.data?.current?.action;
        const overAction = over.data?.current?.action;
        if (
          activeAction &&
          overAction &&
          activeAction.columnId === overAction.columnId
        ) {
          moveActionInColumn(activeAction.columnId, activeId, overId);
        }
      }
    },
    [moveColumn, moveActionInColumn],
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
            {activeAction && (
              <KanbanCard action={activeAction} isOverlay={true} />
            )}
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
};
