"use client";

import { useState, useEffect } from "react";
import { GripVertical, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useColumnsByWorkspace,
  useCreateColumn,
  useUpdateColumn,
  useDeleteColumn,
  useUpdateColumnOrder,
} from "@/features/workspace/hooks/use-workspace";

export function ColumnsTab({ workspaceId }: { workspaceId: string }) {
  const { columns: initialColumns, isLoading } =
    useColumnsByWorkspace(workspaceId);
  const [columns, setColumns] = useState<any[]>([]);
  const createColumn = useCreateColumn();
  const updateColumn = useUpdateColumn();
  const reorderColumn = useUpdateColumnOrder();
  const deleteColumn = useDeleteColumn();

  const [newColumnName, setNewColumnName] = useState("");
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    if (initialColumns) setColumns(initialColumns);
  }, [initialColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex((col) => col.id === active.id);
      const newIndex = columns.findIndex((col) => col.id === over.id);

      const newColumns = arrayMove(columns, oldIndex, newIndex);
      setColumns(newColumns);

      const prev = newColumns[newIndex - 1];
      const next = newColumns[newIndex + 1];

      reorderColumn.mutate({
        id: active.id as string,
        beforeId: prev?.id,
        afterId: next?.id,
      });
    }
  };

  const handleAddColumn = () => {
    if (!newColumnName.trim()) return;
    createColumn.mutate(
      { workspaceId, name: newColumnName.trim() },
      { onSuccess: () => setNewColumnName("") },
    );
  };

  const handleSaveEdit = () => {
    if (!editingColumnId || !editingName.trim()) return;
    updateColumn.mutate(
      { columnId: editingColumnId, name: editingName.trim() },
      { onSuccess: () => setEditingColumnId(null) },
    );
  };

  const handleDeleteColumn = (column: any) => {
    if (column.actionsCount > 0) {
      toast.error(
        "Não é possível deletar uma coluna com ações. Mova as ações primeiro.",
      );
      return;
    }
    if (confirm(`Deseja realmente excluir a coluna "${column.name}"?`)) {
      deleteColumn.mutate({ columnId: column.id });
    }
  };

  if (isLoading) return <div>Carregando colunas...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-y-4">
        <div>
          <h3 className="text-lg font-medium text-center sm:text-start">
            Colunas do Kanban
          </h3>
          <p className="text-sm text-muted-foreground text-center sm:text-start">
            Gerencie as colunas e a ordem em que aparecem no quadro.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Nova coluna..."
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            className="w-48 h-9"
          />
          <Button
            size="sm"
            onClick={handleAddColumn}
            disabled={createColumn.isPending}
          >
            <Plus className="size-4 mr-1" />
            Adicionar
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={columns.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 border rounded-lg p-2 bg-muted/30 overflow-x-auto">
            {columns.map((column) => (
              <SortableColumnItem
                key={column.id}
                column={column}
                isEditing={editingColumnId === column.id}
                editingName={editingName}
                onEditNameChange={(val: string) => setEditingName(val)}
                onStartEdit={() => {
                  setEditingColumnId(column.id);
                  setEditingName(column.name);
                }}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => setEditingColumnId(null)}
                onDelete={() => handleDeleteColumn(column)}
              />
            ))}
            {columns.length === 0 && (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Nenhuma coluna configurada.
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableColumnItem({
  column,
  isEditing,
  editingName,
  onEditNameChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 bg-background border rounded-md shadow-sm group min-w-100",
        isDragging && "opacity-50 z-50",
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="size-4" />
      </div>
      <div
        className="size-3 rounded-full shrink-0"
        style={{ backgroundColor: column.color || "#1447e6" }}
      />
      {isEditing ? (
        <div className="flex-1 flex gap-2">
          <Input
            value={editingName}
            onChange={(e) => onEditNameChange(e.target.value)}
            className="h-8 py-0"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && onSaveEdit()}
          />
          <Button
            size="icon"
            variant="ghost"
            className="size-8 text-emerald-600"
            onClick={onSaveEdit}
          >
            <Check className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={onCancelEdit}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <>
          <span className="flex-1 font-medium">{column.name}</span>
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
            {column.actionsCount || 0} ações
          </span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-muted-foreground hover:text-foreground"
              onClick={onStartEdit}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-destructive hover:bg-destructive/10"
              onClick={onDelete}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
