"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CheckIcon, FolderPlusIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Action } from "../../types";
import { SubActionItem } from "./sub-action-item";
import { SubActionGroup } from "./sub-action-group";

type SubAction = NonNullable<Action["subActions"]>[number];
type Group = NonNullable<Action["subActionGroups"]>[number];

const ROOT_GROUP_ID = "__root__";

interface SubActionsProps {
  subActions?: Action["subActions"];
  subActionGroups?: Action["subActionGroups"];
  members?: any[];
  actionStartDate?: Date | null;
  actionDueDate?: Date | null;
  onCreate: (title: string, groupId?: string | null) => void;
  onToggle: (id: string, isDone: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (
    id: string,
    data: {
      title?: string;
      description?: string | null;
      finishDate?: Date | null;
    },
  ) => void;
  onAddResponsible: (subActionId: string, userId: string) => void;
  onRemoveResponsible: (subActionId: string, userId: string) => void;
  onPromote: (id: string) => void;
  onReorder?: (
    items: { id: string; order: number; groupId: string | null }[],
  ) => void;
  onCreateGroup?: (name: string) => void;
  onUpdateGroup?: (
    groupId: string,
    data: { name?: string; isOpen?: boolean },
  ) => void;
  onDeleteGroup?: (groupId: string, deleteSubActions?: boolean) => void;
  onReorderGroups?: (items: { id: string; order: number }[]) => void;
  isCreating: boolean;
  isDeleting: boolean;
  isUpdating?: boolean;
}

export function ActionSubActions({
  subActions = [],
  subActionGroups = [],
  members = [],
  actionStartDate,
  actionDueDate,
  onCreate,
  onToggle,
  onDelete,
  onUpdate,
  onAddResponsible,
  onRemoveResponsible,
  onPromote,
  onReorder,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onReorderGroups,
  isCreating,
  isDeleting,
  isUpdating,
}: SubActionsProps) {
  const [newSubActionTitle, setNewSubActionTitle] = useState("");
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null); // null = not adding; string = groupId or ROOT_GROUP_ID
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const subActionInputRef = useRef<HTMLInputElement>(null);
  const groupInputRef = useRef<HTMLInputElement>(null);

  // Optimistic local state for reordering during drag
  const [localItems, setLocalItems] = useState<SubAction[] | null>(null);
  const [localGroups, setLocalGroups] = useState<Group[] | null>(null);
  const [activeType, setActiveType] = useState<"group" | "subaction" | null>(
    null,
  );

  const items = localItems ?? subActions;

  // Bucket sub-actions by group
  const buckets = useMemo(() => {
    const map: Record<string, SubAction[]> = { [ROOT_GROUP_ID]: [] };
    for (const g of subActionGroups ?? []) map[g.id] = [];
    for (const s of items) {
      const key = s.groupId ?? ROOT_GROUP_ID;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    // Sort within each bucket
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return map;
  }, [items, subActionGroups]);

  const orderedGroups = useMemo(
    () =>
      [...(localGroups ?? subActionGroups ?? [])].sort(
        (a, b) => a.order - b.order,
      ),
    [localGroups, subActionGroups],
  );

  const totalSubActions = items.length;
  const doneSubActions = items.filter((s) => s.isDone).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleAddSubAction = (groupId: string | null) => {
    const title = newSubActionTitle.trim();
    if (!title) return;
    onCreate(title, groupId);
    setNewSubActionTitle("");
    setAddingTo(null);
  };

  const handleSubActionKeyDown =
    (groupId: string | null) => (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleAddSubAction(groupId);
      if (e.key === "Escape") {
        setAddingTo(null);
        setNewSubActionTitle("");
      }
    };

  const handleAddGroup = () => {
    const name = newGroupName.trim();
    if (!name || !onCreateGroup) return;
    onCreateGroup(name);
    setNewGroupName("");
    setCreatingGroup(false);
  };

  const findContainer = (id: string): string | null => {
    for (const [key, list] of Object.entries(buckets)) {
      if (list.some((s) => s.id === id)) return key;
    }
    if (id === ROOT_GROUP_ID || (subActionGroups ?? []).some((g) => g.id === id))
      return id;
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    const type = event.active.data.current?.type as
      | "group"
      | "subaction"
      | undefined;
    const isGroup =
      type === "group" || (subActionGroups ?? []).some((g) => g.id === id);
    setActiveId(id);
    setActiveType(isGroup ? "group" : "subaction");
    if (isGroup) {
      setLocalGroups([...(subActionGroups ?? [])]);
    } else {
      setLocalItems([...subActions]);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (activeType === "group") return; // groups only reorder among themselves

    const { active, over } = event;
    if (!over) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    if (activeIdStr === overIdStr) return;

    const activeContainer = findContainer(activeIdStr);
    let overContainer = findContainer(overIdStr);

    // Dropped on a group container directly
    if (
      overContainer === overIdStr &&
      (subActionGroups ?? []).some((g) => g.id === overIdStr)
    ) {
      overContainer = overIdStr;
    } else if (overIdStr === ROOT_GROUP_ID) {
      overContainer = ROOT_GROUP_ID;
    }

    if (!activeContainer || !overContainer) return;
    if (activeContainer === overContainer) return;

    // Move between containers
    setLocalItems((prev) => {
      if (!prev) return prev;
      const newGroupId =
        overContainer === ROOT_GROUP_ID ? null : overContainer;
      return prev.map((s) =>
        s.id === activeIdStr ? { ...s, groupId: newGroupId } : s,
      );
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const wasGroupDrag = activeType === "group";
    setActiveId(null);
    setActiveType(null);

    if (!over) {
      setLocalItems(null);
      setLocalGroups(null);
      return;
    }

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // Group reorder
    if (wasGroupDrag) {
      const groups = localGroups ?? subActionGroups ?? [];
      const oldIndex = groups.findIndex((g) => g.id === activeIdStr);
      const newIndex = groups.findIndex((g) => g.id === overIdStr);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        setLocalGroups(null);
        return;
      }
      const reordered = arrayMove(groups, oldIndex, newIndex).map((g, idx) => ({
        ...g,
        order: idx,
      }));
      setLocalGroups(reordered);
      onReorderGroups?.(reordered.map((g) => ({ id: g.id, order: g.order })));
      setTimeout(() => setLocalGroups(null), 600);
      return;
    }

    const activeContainer = findContainer(activeIdStr);
    let overContainer = findContainer(overIdStr);

    if (
      overContainer === overIdStr &&
      (subActionGroups ?? []).some((g) => g.id === overIdStr)
    ) {
      overContainer = overIdStr;
    } else if (overIdStr === ROOT_GROUP_ID) {
      overContainer = ROOT_GROUP_ID;
    }

    if (!activeContainer || !overContainer) {
      setLocalItems(null);
      return;
    }

    // Build the new ordered list per container
    const current = localItems ?? subActions;
    const targetGroupId =
      overContainer === ROOT_GROUP_ID ? null : overContainer;

    // Take items in active container excluding the moved one, then in target add at right position
    const targetList = current
      .filter((s) =>
        overContainer === ROOT_GROUP_ID
          ? s.groupId == null
          : s.groupId === overContainer,
      )
      .filter((s) => s.id !== activeIdStr);

    // Find the moved item from the original (with possibly updated groupId)
    const movedItem = current.find((s) => s.id === activeIdStr);
    if (!movedItem) {
      setLocalItems(null);
      return;
    }
    const movedAdjusted = { ...movedItem, groupId: targetGroupId };

    // Index of `over` within the target list (excluding moved)
    let insertIndex = targetList.length;
    if (overIdStr !== overContainer) {
      const idx = targetList.findIndex((s) => s.id === overIdStr);
      if (idx !== -1) insertIndex = idx;
    }

    const reorderedTarget = [
      ...targetList.slice(0, insertIndex),
      movedAdjusted,
      ...targetList.slice(insertIndex),
    ];

    // Build full updated state preserving other groups untouched
    const updated = current.map((s) => {
      if (s.id === activeIdStr) return movedAdjusted;
      return s;
    });

    // Reassign order numbers in the target group only
    const orderedTarget = reorderedTarget.map((s, idx) => ({
      ...s,
      order: idx,
    }));

    const final = updated.map((s) => {
      const fromTarget = orderedTarget.find((t) => t.id === s.id);
      if (fromTarget) return fromTarget;
      return s;
    });

    setLocalItems(final);

    // If active and over were same container with same id, no-op
    if (activeContainer === overContainer && activeIdStr === overIdStr) {
      setLocalItems(null);
      return;
    }

    // Persist: send new order for items in BOTH affected containers
    const affectedContainers = new Set<string>([activeContainer, overContainer]);
    const itemsPayload: { id: string; order: number; groupId: string | null }[] =
      [];

    for (const c of affectedContainers) {
      const groupIdValue = c === ROOT_GROUP_ID ? null : c;
      const list = final
        .filter((s) =>
          c === ROOT_GROUP_ID ? s.groupId == null : s.groupId === c,
        )
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      list.forEach((s, idx) => {
        itemsPayload.push({ id: s.id, order: idx, groupId: groupIdValue });
      });
    }

    onReorder?.(itemsPayload);

    // Reset local state — server response will refresh
    setTimeout(() => setLocalItems(null), 600);
  };

  const renderList = (groupId: string | null) => {
    const key = groupId ?? ROOT_GROUP_ID;
    const list = buckets[key] ?? [];
    return (
      <SortableContext
        items={list.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
        id={key}
      >
        <div
          className="space-y-1 min-h-[8px]"
          data-droppable-id={key}
        >
          {list.map((sub) => (
            <SubActionItem
              key={sub.id}
              sub={sub}
              members={members}
              fromDate={actionStartDate ?? undefined}
              toDate={actionDueDate ?? undefined}
              isExpanded={expandedId === sub.id}
              isEditingTitle={editingTitleId === sub.id}
              onToggleExpand={() =>
                setExpandedId(expandedId === sub.id ? null : sub.id)
              }
              onEditTitleStart={() => setEditingTitleId(sub.id)}
              onEditTitleEnd={() => setEditingTitleId(null)}
              onToggle={onToggle}
              onDelete={onDelete}
              onUpdate={onUpdate}
              onAddResponsible={onAddResponsible}
              onRemoveResponsible={onRemoveResponsible}
              onPromote={onPromote}
              isUpdating={isUpdating}
              isDeleting={isDeleting}
            />
          ))}

          {addingTo === key && (
            <div className="flex items-center gap-2 py-1 pl-1">
              <div className="size-4 shrink-0" />
              <Input
                ref={subActionInputRef}
                placeholder="Título da sub-ação..."
                value={newSubActionTitle}
                onChange={(e) => setNewSubActionTitle(e.target.value)}
                onKeyDown={handleSubActionKeyDown(groupId)}
                onBlur={() => {
                  if (!newSubActionTitle.trim()) {
                    setAddingTo(null);
                  }
                }}
                className="h-7 text-sm min-w-0 flex-1"
                disabled={isCreating}
              />
              <Button
                size="sm"
                className="h-7 px-2 shrink-0"
                onClick={() => handleAddSubAction(groupId)}
                disabled={!newSubActionTitle.trim() || isCreating}
              >
                <CheckIcon className="size-3.5" />
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground w-fit"
            onClick={() => {
              setAddingTo(key);
              setTimeout(() => subActionInputRef.current?.focus(), 0);
            }}
          >
            <PlusIcon className="size-3.5" />
            Adicionar sub-ação
          </Button>
        </div>
      </SortableContext>
    );
  };

  const activeSub = useMemo(
    () => (activeId ? items.find((s) => s.id === activeId) ?? null : null),
    [activeId, items],
  );

  return (
    <div className="space-y-2">
      {/* Header — uses flex-wrap so the action buttons never get pushed off-screen */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Sub-ações
          </p>
          {totalSubActions > 0 && (
            <span className="text-xs text-muted-foreground shrink-0">
              {doneSubActions}/{totalSubActions}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onCreateGroup && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => {
                setCreatingGroup(true);
                setTimeout(() => groupInputRef.current?.focus(), 0);
              }}
            >
              <FolderPlusIcon className="size-3.5" />
              Pasta
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => {
              setAddingTo(ROOT_GROUP_ID);
              setTimeout(() => subActionInputRef.current?.focus(), 0);
            }}
          >
            <PlusIcon className="size-3.5" />
            Adicionar
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      {totalSubActions > 0 && (
        <div className="w-full bg-muted rounded-full h-1.5 mb-2">
          <div
            className="bg-emerald-500 h-1.5 rounded-full transition-all"
            style={{
              width: `${(doneSubActions / totalSubActions) * 100}%`,
            }}
          />
        </div>
      )}

      {/* Inline new-group input */}
      {creatingGroup && (
        <div className="flex items-center gap-2 py-1">
          <Input
            ref={groupInputRef}
            placeholder="Nome da pasta..."
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddGroup();
              if (e.key === "Escape") {
                setCreatingGroup(false);
                setNewGroupName("");
              }
            }}
            onBlur={() => {
              if (!newGroupName.trim()) setCreatingGroup(false);
            }}
            className="h-7 text-sm min-w-0 flex-1"
          />
          <Button
            size="sm"
            className="h-7 px-2 shrink-0"
            onClick={handleAddGroup}
            disabled={!newGroupName.trim()}
          >
            <CheckIcon className="size-3.5" />
          </Button>
        </div>
      )}

      {/* DnD context wrapping all groups + root */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Root list (sub-actions without group) */}
        {renderList(null)}

        {/* Groups (sortable among themselves) */}
        <SortableContext
          items={orderedGroups.map((g) => g.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {orderedGroups.map((group) => (
              <SubActionGroup
                key={group.id}
                group={group}
                count={(buckets[group.id] ?? []).length}
                doneCount={
                  (buckets[group.id] ?? []).filter((s) => s.isDone).length
                }
                onUpdate={
                  onUpdateGroup
                    ? (data) => onUpdateGroup(group.id, data)
                    : undefined
                }
                onDelete={
                  onDeleteGroup
                    ? (deleteSubActions) =>
                        onDeleteGroup(group.id, deleteSubActions)
                    : undefined
                }
              >
                {renderList(group.id)}
              </SubActionGroup>
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeType === "subaction" && activeSub ? (
            <div className="rounded-md border border-border bg-card shadow-lg px-2 py-1.5 text-sm opacity-90">
              {activeSub.title}
            </div>
          ) : activeType === "group" && activeId ? (
            <div className="rounded-md border border-border bg-card shadow-lg px-2 py-1.5 text-sm opacity-90 font-medium">
              {orderedGroups.find((g) => g.id === activeId)?.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
